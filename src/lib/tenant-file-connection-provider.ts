/** W02 deployment boundary: per-tenant opaque credential files; no global data-plane URL. */
import { PrismaClient } from "@prisma/client";
import { realpath, readFile, stat } from "node:fs/promises";
import path from "node:path";
import { BrokerDeniedError } from "@/lib/tenant-access-broker";
import type { TenantConnectionCheckout, TenantConnectionProvider, TenantConnectionRequest } from "@/lib/tenant-bound-prisma-authority";

type PrismaFactory = (url: string) => Pick<PrismaClient, "$connect" | "$disconnect">;
type CredentialFileOptions = Readonly<{ allowedReadGroupId?: number }>;

const referencePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function denied(code: string): never {
  throw new BrokerDeniedError(code);
}

function parseCredentialReference(reference: string) {
  if (!reference.startsWith("file://")) denied("TENANT_CREDENTIAL_REFERENCE_INVALID");
  const name = reference.slice("file://".length);
  if (!referencePattern.test(name)) denied("TENANT_CREDENTIAL_REFERENCE_INVALID");
  return name;
}

function validateTenantUrl(url: string, principalName: string) {
  let parsed: URL;
  try {
    parsed = new URL(url);
  } catch {
    denied("TENANT_CREDENTIAL_VALUE_INVALID");
  }
  if (parsed.protocol !== "postgres:" && parsed.protocol !== "postgresql:") denied("TENANT_CREDENTIAL_VALUE_INVALID");
  if (!["127.0.0.1", "::1", "localhost"].includes(parsed.hostname)) denied("TENANT_CREDENTIAL_TARGET_INVALID");
  if (decodeURIComponent(parsed.username) !== principalName) denied("TENANT_CREDENTIAL_PRINCIPAL_MISMATCH");
  return parsed.toString();
}

function hasAcceptedCredentialPermissions(file: Awaited<ReturnType<typeof stat>>, allowedReadGroupId?: number) {
  const mode = Number(file.mode) & 0o777;
  if (mode === 0o600) return true;
  return allowedReadGroupId !== undefined && mode === 0o640 && Number(file.uid) === 0 && Number(file.gid) === allowedReadGroupId;
}

/**
 * Reads one root-provisioned credential file per exact opaque reference. The
 * application only receives a scoped Prisma checkout for one tenant operation.
 */
export class FileTenantConnectionProvider implements TenantConnectionProvider {
  private readonly directoryPromise: Promise<string>;

  constructor(
    directory: string,
    private readonly prismaFactory: PrismaFactory = (url) => new PrismaClient({ datasources: { db: { url } } }),
    private readonly options: CredentialFileOptions = {},
  ) {
    this.directoryPromise = realpath(directory).catch(() => denied("TENANT_CREDENTIAL_DIRECTORY_UNAVAILABLE"));
  }

  async checkout(request: TenantConnectionRequest): Promise<TenantConnectionCheckout> {
    const directory = await this.directoryPromise;
    const reference = parseCredentialReference(request.credentialReference);
    const filePath = path.join(directory, `${reference}.url`);
    if (path.dirname(filePath) !== directory) denied("TENANT_CREDENTIAL_REFERENCE_INVALID");

    let file: Awaited<ReturnType<typeof stat>>;
    let raw: string;
    try {
      [file, raw] = await Promise.all([stat(filePath), readFile(filePath, "utf8")]);
    } catch {
      denied("TENANT_CREDENTIAL_UNAVAILABLE");
    }
    if (!file.isFile() || !hasAcceptedCredentialPermissions(file, this.options.allowedReadGroupId)) denied("TENANT_CREDENTIAL_FILE_PERMISSIONS_INVALID");

    const prisma = this.prismaFactory(validateTenantUrl(raw.trim(), request.principalName));
    try {
      await prisma.$connect();
    } catch {
      denied("TENANT_CONNECTION_AUTHORITY_UNAVAILABLE");
    }

    let discarded = false;
    return {
      prisma: prisma as PrismaClient,
      discard: async () => {
        if (discarded) return;
        discarded = true;
        await prisma.$disconnect();
      },
    };
  }
}
