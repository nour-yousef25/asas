import { chmod, mkdtemp, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { TenantQueueBoundaryError } from "@/lib/tenant-queue-boundary";
import { FileTenantQueueConnectionProvider } from "@/lib/tenant-file-queue-provider";

describe("FileTenantQueueConnectionProvider", () => {
  it("uses an opaque per-organization reference and discards the checkout", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "asas-queue-provider-"));
    const file = path.join(directory, "queue-a.url");
    await writeFile(file, "redis://:opaque@127.0.0.1:6385/0\n", { mode: 0o600 });
    await chmod(file, 0o600);
    const connect = jest.fn().mockResolvedValue(undefined);
    const quit = jest.fn().mockResolvedValue(undefined);
    const provider = new FileTenantQueueConnectionProvider(directory, async () => "file://queue-a", () => ({ connect, quit }));
    const checkout = await provider.checkout({ organizationId: "org_12345678", correlationId: "corr", workload: "publication" });
    await checkout.discard();
    await checkout.discard();
    expect(checkout.principalName).toBe("queue_queue-a");
    expect(connect).toHaveBeenCalledTimes(1);
    expect(quit).toHaveBeenCalledTimes(1);
  });

  it("rejects a non-local URL and loose credential file mode", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "asas-queue-provider-"));
    const file = path.join(directory, "queue-a.url");
    await writeFile(file, "redis://:opaque@redis.example.invalid:6379/0\n", { mode: 0o600 });
    await chmod(file, 0o600);
    const provider = new FileTenantQueueConnectionProvider(directory, async () => "file://queue-a", () => ({ connect: jest.fn(), quit: jest.fn() }));
    await expect(provider.checkout({ organizationId: "org_12345678", correlationId: "corr", workload: "publication" })).rejects.toEqual(expect.objectContaining<Partial<TenantQueueBoundaryError>>({ code: "QUEUE_CREDENTIAL_TARGET_INVALID" }));
    await writeFile(file, "redis://:opaque@127.0.0.1:6385/0\n", { mode: 0o644 });
    await chmod(file, 0o644);
    await expect(provider.checkout({ organizationId: "org_12345678", correlationId: "corr", workload: "publication" })).rejects.toEqual(expect.objectContaining<Partial<TenantQueueBoundaryError>>({ code: "QUEUE_CREDENTIAL_FILE_PERMISSIONS_INVALID" }));
  });
});
