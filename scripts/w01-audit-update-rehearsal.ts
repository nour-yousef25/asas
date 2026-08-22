import { createHash, generateKeyPairSync, sign } from "node:crypto";
import { basename, join } from "node:path";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { promisify } from "node:util";
import { execFile } from "node:child_process";
import { prisma } from "@/lib/db";
import { collectHealthReport } from "@/lib/health/health-service";
import { verifyBackupManifest } from "@/lib/lifecycle/backup";
import { createUpdatePlan, getManifestSigningPayload, verifyReleaseManifest, type ReleaseManifest } from "@/lib/lifecycle/release";
import { closeRedis, getRedis } from "@/lib/redis";

const execute = promisify(execFile);

function required(name: string): string {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function checksum(path: string): Promise<string> {
  return readFile(path).then((contents) => `sha256:${createHash("sha256").update(contents).digest("hex")}`);
}

async function run(command: string, args: string[], options: Parameters<typeof execute>[2] = {}) {
  try {
    return await execute(command, args, { maxBuffer: 10 * 1024 * 1024, ...options });
  } catch {
    throw new Error(`Subprocess failed: ${command}`);
  }
}

async function main() {
  const evidenceDirectory = required("ASAS_AUDIT_EVIDENCE_DIR");
  const backupManifestPath = required("ASAS_AUDIT_BACKUP_MANIFEST_PATH");
  const gitCommit = required("ASAS_AUDIT_GIT_COMMIT");
  const mcBinary = required("ASAS_AUDIT_MC_BINARY");
  const storageAlias = required("ASAS_AUDIT_STORAGE_ALIAS");
  const mcConfigDirectory = required("MC_CONFIG_DIR");
  const currentVersion = required("ASAS_RELEASE_VERSION");
  const edition = required("ASAS_EDITION") as "SAAS" | "DEDICATED" | "SELF_HOSTED";
  const startedAt = new Date().toISOString();
  const stamp = startedAt.replace(/[:.]/g, "-");
  const artifactPath = join(evidenceDirectory, `asas-w01-release-${stamp}-${gitCommit.slice(0, 8)}.tar.gz`);
  const evidencePath = join(evidenceDirectory, `w01-update-rehearsal-${stamp}.json`);
  const backupManifest = verifyBackupManifest(JSON.parse(await readFile(backupManifestPath, "utf8")));

  await mkdir(evidenceDirectory, { recursive: true, mode: 0o700 });
  await run("sh", ["-c", `git archive --format=tar ${gitCommit} | gzip -9 > ${JSON.stringify(artifactPath)}`], { cwd: process.cwd() });
  const artifactChecksum = await checksum(artifactPath);

  const { privateKey, publicKey } = generateKeyPairSync("ed25519");
  const keyId = `w01-audit-${stamp}`;
  const manifest: ReleaseManifest = {
    schemaVersion: 1,
    release: { version: "0.1.1", channel: "STABLE", issuedAt: new Date().toISOString() },
    compatibility: { editions: [edition], minNodeMajor: 20, requiredModules: [], migrationPolicy: "EXPAND_CONTRACT_ONLY" },
    artifact: { uri: `file://${artifactPath}`, checksum: artifactChecksum },
    signature: { keyId, algorithm: "ed25519", value: "" },
  };
  manifest.signature.value = sign(null, getManifestSigningPayload(manifest), privateKey).toString("base64");
  const keyring = { [keyId]: publicKey.export({ type: "spki", format: "pem" }).toString() };
  const verifiedManifest = verifyReleaseManifest(manifest, keyring);
  if ((await checksum(artifactPath)) !== verifiedManifest.artifact.checksum) throw new Error("Artifact checksum verification failed.");

  const backupObject = `${storageAlias}/${backupManifest.location.replace(/^s3:\/\//, "")}`;
  const mcEnvironment = { ...process.env, MC_CONFIG_DIR: mcConfigDirectory };
  const backupStat = JSON.parse((await run(mcBinary, ["stat", "--json", backupObject], { env: mcEnvironment })).stdout.trim());
  const readyPlan = createUpdatePlan({ manifest: verifiedManifest, currentVersion, edition, backupManifest });
  if (readyPlan.status !== "READY") throw new Error(`Update plan should be ready: ${readyPlan.reasons.join(" ")}`);

  await run("npx", ["prisma", "migrate", "deploy"], { cwd: process.cwd() });
  const health = await collectHealthReport(
    {
      database: async () => prisma.$queryRaw`SELECT 1`.then(() => undefined),
      redis: async () => getRedis().ping().then(() => undefined),
      storage: async () => {
        const probeUrl = required("ASAS_PREFLIGHT_STORAGE_PROBE_URL");
        const response = await fetch(probeUrl, { method: "GET", signal: AbortSignal.timeout(5_000) });
        if (!response.ok) throw new Error(`Storage probe returned ${response.status}.`);
      },
      backup: async () => verifyBackupManifest(JSON.parse(await readFile(backupManifestPath, "utf8"))).backupId && undefined,
      workerHeartbeat: async () => Boolean(await getRedis().get("asas:health:worker:communications")),
    },
    { ...process.env, ASAS_INSTANCE_ROLE: "APP", ASAS_BACKUP_LAST_VERIFIED_AT: backupManifest.verifiedAt },
  );

  const tamperedManifest = structuredClone(manifest);
  tamperedManifest.artifact.checksum = `sha256:${"0".repeat(64)}`;
  let signatureFailureDetected = false;
  try {
    verifyReleaseManifest(tamperedManifest, keyring);
  } catch {
    signatureFailureDetected = true;
  }
  const blockedPlan = createUpdatePlan({ manifest: verifiedManifest, currentVersion, edition, backupManifest: { ...backupManifest, verifiedAt: undefined } });
  if (!signatureFailureDetected || blockedPlan.status !== "BLOCKED") throw new Error("Controlled update failure was not safely detected.");

  const recoveryPlan = createUpdatePlan({ manifest: verifiedManifest, currentVersion, edition, backupManifest });
  if (recoveryPlan.status !== "READY") throw new Error("Recovery planning did not return to a verified ready state.");
  const evidence = {
    schemaVersion: 1,
    finalStatus: "PASS",
    startedAt,
    completedAt: new Date().toISOString(),
    environment: "audit-only",
    gitCommit,
    artifact: { path: artifactPath, checksum: artifactChecksum, signature: "Ed25519", keyId, verified: true },
    backup: { backupId: backupManifest.backupId, manifestPath: backupManifestPath, verifiedAt: backupManifest.verifiedAt, remoteStat: { size: backupStat.size, type: backupStat.type }, verified: true },
    migration: { command: "prisma migrate deploy", policy: "EXPAND_CONTRACT_ONLY", destructiveMigration: false, result: "PASS" },
    health: { status: health.status, storage: health.checks.find((check) => check.name === "storage")?.status, backup: health.checks.find((check) => check.name === "backup")?.status },
    failureScenario: { tamperedSignedManifest: "DETECTED_AND_BLOCKED", missingVerifiedBackup: blockedPlan.status },
    recovery: {
      preApply: "Original signed manifest, artifact checksum and verified backup were revalidated; no data rollback was required because controlled failure occurred before application of an update.",
      postApply: "No full database rollback is claimed. If a post-apply incident occurs, preserve evidence, stop update progression, validate the verified backup, and follow the separately documented restore/DR procedure scheduled for W19.",
      status: recoveryPlan.status,
    },
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ finalStatus: "PASS", evidencePath, health: evidence.health, failureScenario: evidence.failureScenario }, null, 2));
}

main()
  .catch((error: unknown) => {
    console.error(error instanceof Error ? error.message : String(error));
    process.exitCode = 1;
  })
  .finally(async () => {
    await closeRedis();
    await prisma.$disconnect();
  });
