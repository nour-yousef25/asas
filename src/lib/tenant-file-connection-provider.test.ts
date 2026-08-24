import { mkdtemp, chmod, writeFile } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import { BrokerDeniedError } from "@/lib/tenant-access-broker";
import { FileTenantConnectionProvider } from "@/lib/tenant-file-connection-provider";

const request = { credentialReference: "file://tenant-a", principalName: "tenant_a", correlationId: "corr", connectionId: "conn" };

describe("FileTenantConnectionProvider", () => {
  it("creates and discards an exact tenant-local checkout", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "asas-tenant-provider-"));
    const file = path.join(directory, "tenant-a.url");
    await writeFile(file, "postgresql://tenant_a:opaque@127.0.0.1:5432/asasplus_staging\n", { mode: 0o600 });
    await chmod(file, 0o600);
    const connect = jest.fn().mockResolvedValue(undefined);
    const disconnect = jest.fn().mockResolvedValue(undefined);
    const provider = new FileTenantConnectionProvider(directory, () => ({ $connect: connect, $disconnect: disconnect }));

    const checkout = await provider.checkout(request);
    await checkout.discard();
    await checkout.discard();
    expect(connect).toHaveBeenCalledTimes(1);
    expect(disconnect).toHaveBeenCalledTimes(1);
  });

  it("fails closed for a mismatched principal, non-local target, or loose file mode", async () => {
    const directory = await mkdtemp(path.join(os.tmpdir(), "asas-tenant-provider-"));
    const file = path.join(directory, "tenant-a.url");
    await writeFile(file, "postgresql://other:opaque@127.0.0.1:5432/asasplus_staging\n", { mode: 0o600 });
    await chmod(file, 0o600);
    const provider = new FileTenantConnectionProvider(directory, () => ({ $connect: jest.fn(), $disconnect: jest.fn() }));
    await expect(provider.checkout(request)).rejects.toEqual(expect.objectContaining<Partial<BrokerDeniedError>>({ code: "TENANT_CREDENTIAL_PRINCIPAL_MISMATCH" }));

    await writeFile(file, "postgresql://tenant_a:opaque@db.example.invalid:5432/asasplus_staging\n", { mode: 0o600 });
    await chmod(file, 0o600);
    await expect(provider.checkout(request)).rejects.toEqual(expect.objectContaining<Partial<BrokerDeniedError>>({ code: "TENANT_CREDENTIAL_TARGET_INVALID" }));

    await writeFile(file, "postgresql://tenant_a:opaque@127.0.0.1:5432/asasplus_staging\n", { mode: 0o644 });
    await chmod(file, 0o644);
    await expect(provider.checkout(request)).rejects.toEqual(expect.objectContaining<Partial<BrokerDeniedError>>({ code: "TENANT_CREDENTIAL_FILE_PERMISSIONS_INVALID" }));
  });
});
