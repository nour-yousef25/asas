import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";

export class BootstrapAdminProvisioningError extends Error {
  constructor(public readonly code: "REQUEST_DENIED" | "REQUEST_REVOKED" | "PRODUCTION_DISABLED" | "DUPLICATE_REQUEST" | "AUDIT_REQUIRED") {
    super(`BOOTSTRAP_ADMIN_${code}`);
  }
}

export const bootstrapAdminRequestSchema = z.object({
  requestId: z.string().regex(/^bootstrap_[A-Za-z0-9_-]{16,120}$/),
  organizationId: z.string().regex(/^[A-Za-z0-9_-]{12,160}$/),
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(120),
  reason: z.string().trim().min(12).max(500),
  requestedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
  mode: z.enum(["DRY_RUN", "AUDIT_FIXTURE", "PRODUCTION"]),
}).superRefine((value, context) => {
  if (/(demo|example|test-user|fake)/i.test(`${value.email} ${value.displayName}`)) context.addIssue({ code: "custom", message: "Demo identities are prohibited." });
  if (new Date(value.expiresAt).getTime() <= new Date(value.requestedAt).getTime()) context.addIssue({ code: "custom", message: "Expiry must be after request time." });
});

export type BootstrapAdminRequest = z.infer<typeof bootstrapAdminRequestSchema>;
export type BootstrapAdminAudit = Readonly<{ requestId: string; organizationId: string; action: "DRY_RUN" | "FIXTURE_PROVISIONED" | "REVOKED" | "DENIED"; actorFingerprint: string; correlationId: string; at: Date }>;
export type BootstrapAdminStore = Readonly<{
  find(requestId: string): Promise<BootstrapAdminAudit | undefined>;
  append(event: BootstrapAdminAudit): Promise<void>;
}>;

function fingerprint(value: string) { return createHash("sha256").update(`bootstrap-admin:${value}`).digest("base64url"); }

export async function loadRootOnlyBootstrapAdminRequest(path: string): Promise<BootstrapAdminRequest> {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || details.uid !== 0 || (details.mode & 0o077) !== 0) throw new BootstrapAdminProvisioningError("REQUEST_DENIED");
  let raw: unknown;
  try { raw = JSON.parse(await readFile(path, "utf8")); } catch { throw new BootstrapAdminProvisioningError("REQUEST_DENIED"); }
  return bootstrapAdminRequestSchema.parse(raw);
}

export class BootstrapAdminProvisioner {
  constructor(private readonly store: BootstrapAdminStore, private readonly allowFixtureProvisioning = false, private readonly now: () => Date = () => new Date()) {}

  async execute(raw: unknown, correlationId: string = randomUUID()) {
    const request = bootstrapAdminRequestSchema.parse(raw);
    const now = this.now();
    if (new Date(request.expiresAt).getTime() <= now.getTime()) throw new BootstrapAdminProvisioningError("REQUEST_DENIED");
    const prior = await this.store.find(request.requestId);
    if (prior?.action === "REVOKED") throw new BootstrapAdminProvisioningError("REQUEST_REVOKED");
    if (prior) throw new BootstrapAdminProvisioningError("DUPLICATE_REQUEST");
    const actorFingerprint = fingerprint(request.email);
    if (request.mode === "PRODUCTION") throw new BootstrapAdminProvisioningError("PRODUCTION_DISABLED");
    const action = request.mode === "AUDIT_FIXTURE" && this.allowFixtureProvisioning ? "FIXTURE_PROVISIONED" : "DRY_RUN";
    const event: BootstrapAdminAudit = { requestId: request.requestId, organizationId: request.organizationId, action, actorFingerprint, correlationId, at: now };
    await this.store.append(event);
    return { requestId: request.requestId, mode: request.mode, outcome: action, actorFingerprint, correlationId } as const;
  }

  async revoke(requestId: string, organizationId: string, correlationId: string = randomUUID()) {
    const prior = await this.store.find(requestId);
    if (!prior || prior.organizationId !== organizationId) throw new BootstrapAdminProvisioningError("AUDIT_REQUIRED");
    const event: BootstrapAdminAudit = { requestId, organizationId, action: "REVOKED", actorFingerprint: prior.actorFingerprint, correlationId, at: this.now() };
    await this.store.append(event);
    return event;
  }
}

export class MemoryBootstrapAdminAuditStore implements BootstrapAdminStore {
  readonly events: BootstrapAdminAudit[] = [];
  async find(requestId: string) { return [...this.events].reverse().find((event) => event.requestId === requestId); }
  async append(event: BootstrapAdminAudit) { this.events.push(event); }
}
