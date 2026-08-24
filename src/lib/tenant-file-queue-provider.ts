/** W02 queue deployment boundary: one opaque local Redis credential file per tenant principal. */
import Redis from "ioredis";
import { readFile, realpath, stat } from "node:fs/promises";
import path from "node:path";
import { TenantQueueBoundaryError } from "@/lib/tenant-queue-boundary";
import type { TenantQueueCheckout, TenantQueueConnectionProvider, TenantQueueConnectionRequest } from "@/lib/tenant-queue";

type RedisFactory = (url: string) => Pick<Redis, "connect" | "quit">;
const referencePattern = /^[A-Za-z0-9][A-Za-z0-9_-]{0,127}$/;

function denied(code: string): never { throw new TenantQueueBoundaryError(code); }

function parseReference(reference: string) {
  if (!reference.startsWith("file://")) denied("QUEUE_CREDENTIAL_REFERENCE_INVALID");
  const value = reference.slice("file://".length);
  if (!referencePattern.test(value)) denied("QUEUE_CREDENTIAL_REFERENCE_INVALID");
  return value;
}

function validateUrl(raw: string) {
  let url: URL;
  try { url = new URL(raw); } catch { denied("QUEUE_CREDENTIAL_VALUE_INVALID"); }
  if (url.protocol !== "redis:" || !["127.0.0.1", "::1", "localhost"].includes(url.hostname)) denied("QUEUE_CREDENTIAL_TARGET_INVALID");
  return url.toString();
}

export class FileTenantQueueConnectionProvider implements TenantQueueConnectionProvider {
  private readonly directoryPromise: Promise<string>;

  constructor(directory: string, private readonly referenceForOrganization: (organizationId: string) => Promise<string>, private readonly redisFactory: RedisFactory = (url) => new Redis(url, { lazyConnect: true })) {
    this.directoryPromise = realpath(directory).catch(() => denied("QUEUE_CREDENTIAL_DIRECTORY_UNAVAILABLE"));
  }

  async checkout(request: TenantQueueConnectionRequest): Promise<TenantQueueCheckout> {
    const directory = await this.directoryPromise;
    const reference = parseReference(await this.referenceForOrganization(request.organizationId));
    const filePath = path.join(directory, `${reference}.url`);
    if (path.dirname(filePath) !== directory) denied("QUEUE_CREDENTIAL_REFERENCE_INVALID");
    let metadata: Awaited<ReturnType<typeof stat>>;
    let raw: string;
    try { [metadata, raw] = await Promise.all([stat(filePath), readFile(filePath, "utf8")]); } catch { denied("QUEUE_CREDENTIAL_UNAVAILABLE"); }
    if (!metadata.isFile() || (metadata.mode & 0o077) !== 0) denied("QUEUE_CREDENTIAL_FILE_PERMISSIONS_INVALID");
    const redis = this.redisFactory(validateUrl(raw.trim()));
    try { await redis.connect(); } catch { denied("QUEUE_CONNECTION_AUTHORITY_UNAVAILABLE"); }
    let discarded = false;
    return {
      principalName: `queue_${reference}`,
      redis: redis as Redis,
      discard: async () => { if (discarded) return; discarded = true; await redis.quit(); },
    };
  }
}
