import { createHash, randomUUID } from "node:crypto";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { basename, join } from "node:path";
import { promisify } from "node:util";
import { execFile } from "node:child_process";

const execute = promisify(execFile);

function required(name) {
  const value = process.env[name];
  if (!value) throw new Error(`${name} is required.`);
  return value;
}

function sha256(buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

async function run(command, args, options = {}) {
  try {
    return await execute(command, args, { maxBuffer: 10 * 1024 * 1024, ...options });
  } catch {
    throw new Error(`Subprocess failed: ${command}`);
  }
}

async function main() {
  const databaseUrl = new URL(required("DATABASE_URL"));
  const evidenceDirectory = process.env.ASAS_AUDIT_EVIDENCE_DIR ?? "/home/ubuntu/asas-audit-evidence";
  const mcBinary = required("ASAS_AUDIT_MC_BINARY");
  const mcConfigDirectory = required("MC_CONFIG_DIR");
  const storageTarget = required("ASAS_AUDIT_STORAGE_TARGET");
  const encryptionKey = required("ASAS_AUDIT_BACKUP_ENCRYPTION_KEY");
  const edition = required("ASAS_EDITION");
  const releaseVersion = required("ASAS_RELEASE_VERSION");
  const releaseChannel = required("ASAS_RELEASE_CHANNEL");
  const createdAt = new Date().toISOString();
  const backupId = randomUUID();
  const stamp = createdAt.replace(/[:.]/g, "-");
  const artifactStem = `asas-w01-audit-${stamp}-${backupId}`;
  const workingDirectory = join(evidenceDirectory, artifactStem);
  const dumpPath = join(workingDirectory, "database.dump");
  const configurationPath = join(workingDirectory, "configuration-summary.json");
  const archivePath = join(evidenceDirectory, `${artifactStem}.tar.gz`);
  const encryptedPath = join(evidenceDirectory, `${artifactStem}.tar.gz.enc`);
  const downloadedPath = join(workingDirectory, "provider-verified-download.enc");
  const manifestPath = join(evidenceDirectory, `${artifactStem}.manifest.json`);
  const evidencePath = join(evidenceDirectory, `${artifactStem}.evidence.json`);

  await mkdir(workingDirectory, { recursive: true, mode: 0o700 });
  await writeFile(
    configurationPath,
    `${JSON.stringify({ schemaVersion: 1, createdAt, edition, release: { version: releaseVersion, channel: releaseChannel }, database: "included", storage: "not-included", secrets: "excluded" }, null, 2)}\n`,
    { mode: 0o600 },
  );

  const pgEnvironment = {
    ...process.env,
    PGPASSWORD: decodeURIComponent(databaseUrl.password),
    PGHOST: databaseUrl.hostname,
    PGPORT: databaseUrl.port || "5432",
    PGUSER: decodeURIComponent(databaseUrl.username),
    PGDATABASE: databaseUrl.pathname.replace(/^\//, ""),
  };
  await run("pg_dump", ["--format=custom", "--no-owner", "--no-privileges", `--file=${dumpPath}`], { env: pgEnvironment });
  await run("tar", ["-C", workingDirectory, "-czf", archivePath, "database.dump", "configuration-summary.json"]);
  await run("openssl", ["enc", "-aes-256-cbc", "-pbkdf2", "-md", "sha256", "-salt", "-in", archivePath, "-out", encryptedPath, "-pass", "env:ASAS_AUDIT_BACKUP_ENCRYPTION_KEY"], {
    env: { ...process.env, ASAS_AUDIT_BACKUP_ENCRYPTION_KEY: encryptionKey },
  });

  const encryptedChecksum = sha256(await readFile(encryptedPath));
  const objectName = basename(encryptedPath);
  const remoteArtifact = `${storageTarget}/${objectName}`;
  const mcEnvironment = { ...process.env, MC_CONFIG_DIR: mcConfigDirectory };
  await run(mcBinary, ["cp", encryptedPath, remoteArtifact], { env: mcEnvironment });
  const remoteStat = JSON.parse((await run(mcBinary, ["stat", "--json", remoteArtifact], { env: mcEnvironment })).stdout.trim());
  await run(mcBinary, ["cp", remoteArtifact, downloadedPath], { env: mcEnvironment });
  const providerVerifiedChecksum = sha256(await readFile(downloadedPath));
  if (providerVerifiedChecksum !== encryptedChecksum) throw new Error("Provider checksum verification failed.");

  const verifiedAt = new Date().toISOString();
  const bucket = storageTarget.split("/").at(-1);
  const manifest = {
    schemaVersion: 1,
    backupId,
    createdAt,
    verifiedAt,
    edition,
    owner: "ASAS",
    location: `s3://${bucket}/${objectName}`,
    checksum: `sha256:${encryptedChecksum}`,
    encryption: { enabled: true, owner: "ASAS" },
    contents: { database: true, storage: false, configuration: true },
  };
  await writeFile(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  await run(mcBinary, ["cp", manifestPath, `${storageTarget}/${basename(manifestPath)}`], { env: mcEnvironment });

  const evidence = {
    schemaVersion: 1,
    finalStatus: "PASS",
    createdAt,
    verifiedAt,
    environment: "audit-only",
    gitCommit: process.env.ASAS_AUDIT_GIT_COMMIT ?? "unknown",
    commands: [
      "pg_dump --format=custom --no-owner --no-privileges",
      "tar -czf <archive> database.dump configuration-summary.json",
      "openssl enc -aes-256-cbc -pbkdf2 -md sha256 -salt",
      "mc cp/stat/cp against audit-only S3-compatible storage",
    ],
    artifact: {
      localName: objectName,
      remoteLocation: manifest.location,
      remoteSize: remoteStat.size,
      checksum: manifest.checksum,
      checksumVerifiedAfterProviderDownload: true,
      encrypted: true,
      encryptionAlgorithm: "AES-256-CBC with PBKDF2, SHA-256 and salt",
    },
    ownership: { owner: "ASAS", retentionDays: Number(process.env.ASAS_BACKUP_RETENTION_DAYS ?? "30") },
    contents: manifest.contents,
    provider: { type: "S3-compatible MinIO audit storage", bucket, verification: "upload, stat, download, SHA-256 comparison" },
    healthIntegration: { verifiedAtEnvironmentVariable: "ASAS_BACKUP_LAST_VERIFIED_AT", valueDerivedAtRuntime: verifiedAt },
    logs: { minio: "/home/ubuntu/asas-audit-storage/minio-audit.log", credentials: "not logged" },
  };
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ finalStatus: "PASS", evidencePath, manifestPath, verifiedAt, checksum: manifest.checksum }, null, 2));
}

main().catch((error) => {
  console.error(error instanceof Error ? error.message : "Audit backup failed.");
  process.exitCode = 1;
});
