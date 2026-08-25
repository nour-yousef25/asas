import { createHash, randomUUID } from "node:crypto";
import { rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import { PrismaClient, Role } from "@prisma/client";
import { BootstrapSuperAdminError, loadRootOnlyBootstrapSuperAdminRequest, provisionBootstrapSuperAdmin, readRootOnlyBootstrapPassword } from "@/lib/bootstrap-super-admin";

const requestPath = process.env.ASAS_BOOTSTRAP_CONTROL_REQUEST_FILE;
const auditPath = process.env.ASAS_BOOTSTRAP_AUDIT_FILE;
if (process.env.ASAS_BOOTSTRAP_EXECUTION !== "CONFIRM" || !requestPath || !auditPath) throw new BootstrapSuperAdminError("EXECUTION_NOT_CONFIRMED");

const prisma = new PrismaClient({ log: ["error"] });
const fingerprint = (value: string) => createHash("sha256").update(`bootstrap-audit:${value}`).digest("base64url");

async function assertRootOnlyNewAuditPath(path: string) {
  const directory = await stat(dirname(path)).catch(() => undefined);
  if (!directory?.isDirectory() || directory.uid !== 0 || directory.gid !== 0 || (directory.mode & 0o077) !== 0) throw new BootstrapSuperAdminError("REQUEST_INVALID");
  if (await stat(path).then(() => true).catch(() => false)) throw new BootstrapSuperAdminError("REQUEST_INVALID");
}

async function main() {
  const request = await loadRootOnlyBootstrapSuperAdminRequest(requestPath);
  await assertRootOnlyNewAuditPath(auditPath);
  let password: Buffer | undefined;
  let result: Awaited<ReturnType<typeof provisionBootstrapSuperAdmin>>;
  try {
    const existing = await prisma.user.findUnique({ where: { email: request.email }, select: { id: true } });
    if (!existing) password = await readRootOnlyBootstrapPassword(request.passwordFile);
    result = await provisionBootstrapSuperAdmin({
      findByEmail: async (email) => prisma.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, isActive: true, activeOrganizationId: true } }),
      countOrganizationMemberships: async (userId) => prisma.organizationMembership.count({ where: { userId } }),
      create: async (input) => prisma.user.create({ data: { ...input, role: Role.SUPER_ADMIN }, select: { id: true, email: true, role: true, isActive: true, activeOrganizationId: true } }),
    }, request, password);
  } finally {
    password?.fill(0);
  }
  await rm(requestPath, { force: false });
  await rm(request.passwordFile, { force: true });
  const audit = { schema: "ASAS_BOOTSTRAP_SUPER_ADMIN_AUDIT_V1", requestId: request.requestId, outcome: result.outcome, accountFingerprint: fingerprint(result.userId), emailFingerprint: result.emailFingerprint, role: "SUPER_ADMIN", noOrganizationMembership: true, passwordArtifactRemoved: true, requestConsumed: true, correlationId: randomUUID(), at: new Date().toISOString() };
  await writeFile(auditPath, `${JSON.stringify(audit)}\n`, { mode: 0o600, flag: "wx" });
  process.stdout.write(`BOOTSTRAP_SUPER_ADMIN_${result.outcome}\n`);
}

main().catch((error: unknown) => {
  const code = error instanceof BootstrapSuperAdminError ? error.code : "FAILED";
  process.stderr.write(`BOOTSTRAP_SUPER_ADMIN_${code}\n`);
  process.exitCode = 1;
}).finally(async () => prisma.$disconnect());
