import { createHash, randomUUID } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import { z } from "zod";

export class BootstrapControlPlaneError extends Error {
  constructor(public readonly code: "REQUEST_DENIED" | "APPROVAL_DENIED" | "PASSWORD_DENIED" | "DUPLICATE" | "EXECUTION_DISABLED" | "REVOKED") { super(`BOOTSTRAP_CONTROL_${code}`); }
}

const personSchema = z.object({ email: z.string().email().max(320).transform((value) => value.toLowerCase()), name: z.string().trim().min(2).max(120) }).superRefine((value, context) => { if (/(demo|example|test-user|fake)/i.test(`${value.email} ${value.name}`)) context.addIssue({ code: "custom", message: "Demo identities are prohibited." }); });
export const bootstrapControlRequestSchema = z.discriminatedUnion("kind", [
  z.object({ requestId: z.string().regex(/^bootstrap_[A-Za-z0-9_-]{16,120}$/), kind: z.literal("SUPER_ADMIN"), administrator: personSchema, approvedBy: z.string().min(3).max(120), approvalReference: z.string().min(8).max(180), passwordFile: z.string().min(1), requestedAt: z.string().datetime({ offset: true }), expiresAt: z.string().datetime({ offset: true }) }),
  z.object({ requestId: z.string().regex(/^bootstrap_[A-Za-z0-9_-]{16,120}$/), kind: z.literal("ORGANIZATION_ADMIN"), organizationId: z.string().regex(/^[A-Za-z0-9_-]{12,160}$/), administrator: personSchema, approvedBySuperAdminId: z.string().min(12).max(160), approvalReference: z.string().min(8).max(180), passwordFile: z.string().min(1), requestedAt: z.string().datetime({ offset: true }), expiresAt: z.string().datetime({ offset: true }) }),
]).superRefine((value, context) => { if (new Date(value.expiresAt).getTime() <= new Date(value.requestedAt).getTime()) context.addIssue({ code: "custom", message: "Expiry must follow request time." }); });
export type BootstrapControlRequest = z.infer<typeof bootstrapControlRequestSchema>;
export type BootstrapControlAudit = Readonly<{ requestId: string; kind: BootstrapControlRequest["kind"]; organizationId?: string; administratorFingerprint: string; action: "PROVISIONED" | "IDEMPOTENT" | "REVOKED"; correlationId: string; at: Date }>;
export type BootstrapControlPlaneStore = Readonly<{ findRequest(requestId: string): Promise<BootstrapControlAudit | undefined>; provision(input: Readonly<{ request: BootstrapControlRequest; password: string }>): Promise<Readonly<{ userId: string; outcome: "PROVISIONED" | "IDEMPOTENT" }>>; append(event: BootstrapControlAudit): Promise<void> }>;

function fingerprint(email: string) { return createHash("sha256").update(`bootstrap-control:${email}`).digest("base64url"); }
async function readRootOnly(path: string) {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || details.uid !== 0 || (details.mode & 0o077) !== 0) throw new BootstrapControlPlaneError("REQUEST_DENIED");
  return readFile(path, "utf8");
}

export async function loadBootstrapControlRequest(path: string) { return bootstrapControlRequestSchema.parse(JSON.parse(await readRootOnly(path))); }
export async function loadBootstrapPassword(path: string) {
  const value = (await readRootOnly(path)).trim();
  if (value.length < 16 || value.length > 256) throw new BootstrapControlPlaneError("PASSWORD_DENIED");
  return value;
}

export class BootstrapControlPlaneProvisioner {
  constructor(private readonly store: BootstrapControlPlaneStore, private readonly now: () => Date = () => new Date()) {}
  async execute(request: BootstrapControlRequest, password: string, enabled: boolean, correlationId = randomUUID()) {
    if (!enabled) throw new BootstrapControlPlaneError("EXECUTION_DISABLED");
    if (new Date(request.expiresAt).getTime() <= this.now().getTime()) throw new BootstrapControlPlaneError("REQUEST_DENIED");
    const prior = await this.store.findRequest(request.requestId);
    if (prior?.action === "REVOKED") throw new BootstrapControlPlaneError("REVOKED");
    if (prior) return { userId: "", outcome: "IDEMPOTENT" as const, correlationId };
    const provisioned = await this.store.provision({ request, password });
    const audit: BootstrapControlAudit = { requestId: request.requestId, kind: request.kind, organizationId: request.kind === "ORGANIZATION_ADMIN" ? request.organizationId : undefined, administratorFingerprint: fingerprint(request.administrator.email), action: provisioned.outcome, correlationId, at: this.now() };
    await this.store.append(audit);
    return { ...provisioned, correlationId };
  }
}
