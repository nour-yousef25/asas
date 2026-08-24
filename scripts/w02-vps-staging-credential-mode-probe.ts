import { FileTenantQueueConnectionProvider } from "../src/lib/tenant-file-queue-provider";
import { TenantQueueBoundaryError } from "../src/lib/tenant-queue-boundary";

const directory = process.env.TENANT_QUEUE_CREDENTIAL_DIRECTORY;
const reference = process.env.ASAS_VPS_PERMISSION_PROBE_REFERENCE;
const groupId = process.env.TENANT_QUEUE_CREDENTIAL_ALLOWED_GROUP_ID;
if (!directory || !reference || !groupId || !/^(0|[1-9][0-9]{0,9})$/.test(groupId)) throw new Error("VPS_PERMISSION_PROBE_CONFIGURATION_MISSING");

const provider = new FileTenantQueueConnectionProvider(directory, async () => `file://${reference}`, undefined, { allowedReadGroupId: Number(groupId) });
async function main() {
  try {
    await provider.checkout({ organizationId: "permission_probe_123", correlationId: "permission-probe", workload: "publication" });
    throw new Error("VPS_PERMISSION_PROBE_UNEXPECTED_CHECKOUT");
  } catch (error) {
    const code = error instanceof TenantQueueBoundaryError ? error.code : "REDACTED_UNKNOWN";
    const pass = code === "QUEUE_CREDENTIAL_VALUE_INVALID";
    process.stdout.write(JSON.stringify({ status: pass ? "PASS_VPS_CREDENTIAL_GROUP_MODE" : "FAIL_VPS_CREDENTIAL_GROUP_MODE", code }) + "\n");
    process.exitCode = pass ? 0 : 2;
  }
}

void main();
