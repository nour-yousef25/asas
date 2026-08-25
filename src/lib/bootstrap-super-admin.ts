import { createHash } from "node:crypto";
import { readFile, stat } from "node:fs/promises";
import bcrypt from "bcryptjs";
import { z } from "zod";

export class BootstrapSuperAdminError extends Error {
  constructor(public readonly code: "REQUEST_INVALID" | "REQUEST_EXPIRED" | "EXECUTION_NOT_CONFIRMED" | "PASSWORD_INVALID" | "EXISTING_USER_INVALID" | "MEMBERSHIP_DENIED" | "TEMPORARY_ROLE_INVALID") {
    super(`BOOTSTRAP_SUPER_ADMIN_${code}`);
  }
}

export const bootstrapSuperAdminRequestSchema = z.object({
  requestId: z.string().regex(/^bootstrap_super_admin_[A-Za-z0-9_-]{16,120}$/),
  kind: z.literal("PLATFORM_SUPER_ADMIN"),
  email: z.string().email().max(320).transform((value) => value.toLowerCase()),
  displayName: z.string().trim().min(2).max(120),
  approvedBy: z.string().trim().min(2).max(120),
  approvalReference: z.string().trim().min(6).max(200),
  passwordFile: z.string().min(1).max(500),
  requestedAt: z.string().datetime({ offset: true }),
  expiresAt: z.string().datetime({ offset: true }),
}).superRefine((value, context) => {
  if (/(demo|example|test-user|fake)/i.test(`${value.email} ${value.displayName}`)) context.addIssue({ code: "custom", message: "Demo identities are prohibited." });
  if (new Date(value.expiresAt).getTime() <= new Date(value.requestedAt).getTime()) context.addIssue({ code: "custom", message: "Expiry must be after request time." });
});

export type BootstrapSuperAdminRequest = z.infer<typeof bootstrapSuperAdminRequestSchema>;
export type BootstrapSuperAdminUser = Readonly<{ id: string; email: string; role: "SUPER_ADMIN" | string; isActive: boolean; activeOrganizationId: string | null }>;
export type BootstrapSuperAdminStore = Readonly<{
  findByEmail(email: string): Promise<BootstrapSuperAdminUser | null>;
  countOrganizationMemberships(userId: string): Promise<number>;
  create(input: Readonly<{ name: string; email: string; password: string; role: "SUPER_ADMIN"; isActive: true; activeOrganizationId: null }>): Promise<BootstrapSuperAdminUser>;
}>;

function fingerprint(value: string) { return createHash("sha256").update(`bootstrap-super-admin:${value}`).digest("base64url"); }

export async function loadRootOnlyBootstrapSuperAdminRequest(path: string): Promise<BootstrapSuperAdminRequest> {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || details.uid !== 0 || details.gid !== 0 || (details.mode & 0o077) !== 0) throw new BootstrapSuperAdminError("REQUEST_INVALID");
  try { return bootstrapSuperAdminRequestSchema.parse(JSON.parse(await readFile(path, "utf8"))); }
  catch { throw new BootstrapSuperAdminError("REQUEST_INVALID"); }
}

export async function readRootOnlyBootstrapPassword(path: string): Promise<Buffer> {
  const details = await stat(path).catch(() => undefined);
  if (!details || !details.isFile() || details.uid !== 0 || details.gid !== 0 || (details.mode & 0o077) !== 0 || details.size < 1 || details.size > 4096) throw new BootstrapSuperAdminError("PASSWORD_INVALID");
  const value = await readFile(path);
  while (value.length > 0 && (value[value.length - 1] === 10 || value[value.length - 1] === 13)) value[value.length - 1] = 0;
  const trimmed = Buffer.from(value.subarray(0, value.findLastIndex((byte) => byte !== 0) + 1));
  value.fill(0);
  if (!trimmed.length) throw new BootstrapSuperAdminError("PASSWORD_INVALID");
  return trimmed;
}

export async function provisionBootstrapSuperAdmin(store: BootstrapSuperAdminStore, request: BootstrapSuperAdminRequest, password: Buffer | undefined, now = new Date()) {
  if (new Date(request.expiresAt).getTime() <= now.getTime()) throw new BootstrapSuperAdminError("REQUEST_EXPIRED");
  const existing = await store.findByEmail(request.email);
  if (existing) {
    const memberships = await store.countOrganizationMemberships(existing.id);
    if (existing.role !== "SUPER_ADMIN" || !existing.isActive || existing.activeOrganizationId !== null || memberships !== 0) throw new BootstrapSuperAdminError("EXISTING_USER_INVALID");
    return { outcome: "ALREADY_VALID" as const, userId: existing.id, emailFingerprint: fingerprint(existing.email) };
  }
  if (!password) throw new BootstrapSuperAdminError("PASSWORD_INVALID");
  const passwordHash = await bcrypt.hash(password.toString("utf8"), 12);
  password.fill(0);
  const created = await store.create({ name: request.displayName, email: request.email, password: passwordHash, role: "SUPER_ADMIN", isActive: true, activeOrganizationId: null });
  const memberships = await store.countOrganizationMemberships(created.id);
  if (memberships !== 0 || created.activeOrganizationId !== null || created.role !== "SUPER_ADMIN") throw new BootstrapSuperAdminError("MEMBERSHIP_DENIED");
  return { outcome: "PROVISIONED" as const, userId: created.id, emailFingerprint: fingerprint(created.email) };
}
