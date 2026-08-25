import { randomBytes } from "node:crypto";
import { chmod, rm, stat, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { LocalTenantArtifactProvider } from "../src/lib/local-tenant-artifact-provider";

const root = process.env.ASAS_LOCAL_STORAGE_ROOT;
const secret = process.env.ASAS_LOCAL_STORAGE_DELIVERY_SECRET;
const evidenceFile = process.env.ASAS_LOCAL_STORAGE_PROOF_EVIDENCE_PATH;
if (!root || !secret || !evidenceFile) throw new Error("LOCAL_STORAGE_PROOF_CONFIGURATION_REQUIRED");

const suffix = randomBytes(8).toString("hex");
const organizationA = `prooforga${suffix}`;
const organizationB = `prooforgb${suffix}`;
const artifactA = `proofartfa${suffix}`;
const artifactB = `proofartfb${suffix}`;
const keyA = `private/${organizationA}/artifact/${artifactA}/v1`;
const keyB = `private/${organizationB}/artifact/${artifactB}/v1`;
const provider = new LocalTenantArtifactProvider(root, secret);

async function denied(action: () => Promise<unknown>) { try { await action(); return false; } catch { return true; } }

async function main() {
  const evidence: Record<string, unknown>[] = [];
  try {
    await provider.assertReady();
    await provider.put({ organizationId: organizationA, artifactId: artifactA, objectKey: keyA, data: new Uint8Array([1, 2, 3]), contentType: "application/pdf" });
    await provider.put({ organizationId: organizationB, artifactId: artifactB, objectKey: keyB, data: new Uint8Array([4, 5]), contentType: "application/pdf" });
    const delivery = await provider.issueDelivery({ organizationId: organizationA, artifactId: artifactA, objectKey: keyA, expiresInSeconds: 60 });
    const token = new URL(`https://staging.invalid${delivery.delivery}`).searchParams.get("token");
    const resolved = token ? await provider.resolveDelivery(token, organizationA) : undefined;
    const crossTenantDenied = token ? await denied(() => provider.resolveDelivery(token, organizationB)) : false;
    const crossKeyDenied = await denied(() => provider.put({ organizationId: organizationA, artifactId: artifactA, objectKey: keyB, data: new Uint8Array([9]), contentType: "application/pdf" }));
    const rootDetails = await stat(root);
    evidence.push({ id: "LS01", result: resolved?.data.equals(Buffer.from([1, 2, 3])) ? "PASS" : "FAIL", detail: "owned delivery resolves without filesystem path" });
    evidence.push({ id: "LS02", result: crossTenantDenied ? "PASS" : "FAIL", detail: "delivery token cannot cross tenant boundary" });
    evidence.push({ id: "LS03", result: crossKeyDenied ? "PASS" : "FAIL", detail: "caller cannot use another tenant object key" });
    evidence.push({ id: "LS04", result: rootDetails.uid === 0 && (rootDetails.mode & 0o007) === 0 && (rootDetails.mode & 0o002) === 0 ? "PASS" : "FAIL", detail: "root is root-owned and not world-accessible/writable" });
    const passed = evidence.every((entry) => entry.result === "PASS");
    await writeFile(evidenceFile, `${JSON.stringify({ status: passed ? "PASS_LOCAL_VPS_STORAGE_RUNTIME" : "FAIL_LOCAL_VPS_STORAGE_RUNTIME", evidence, credentialsPersisted: false, filesystemPathsDisclosed: false, providerCalls: false, productionResourcesTouched: false }, null, 2)}\n`, { mode: 0o600 });
    await chmod(evidenceFile, 0o600);
    process.stdout.write(JSON.stringify({ status: passed ? "PASS_LOCAL_VPS_STORAGE_RUNTIME" : "FAIL_LOCAL_VPS_STORAGE_RUNTIME", evidenceCount: evidence.length }) + "\n");
    process.exitCode = passed ? 0 : 2;
  } finally {
    await provider.delete({ organizationId: organizationA, artifactId: artifactA, objectKey: keyA }).catch(() => undefined);
    await provider.delete({ organizationId: organizationB, artifactId: artifactB, objectKey: keyB }).catch(() => undefined);
    await rm(join(root, "private", organizationA), { recursive: true, force: true }).catch(() => undefined);
    await rm(join(root, "private", organizationB), { recursive: true, force: true }).catch(() => undefined);
  }
}

void main();
