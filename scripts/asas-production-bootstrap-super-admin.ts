import { createHash, randomUUID } from "node:crypto";
import { rm, stat, writeFile } from "node:fs/promises";
import { dirname } from "node:path";
import process from "node:process";
import { PrismaClient, Role } from "@prisma/client";
import { BootstrapSuperAdminError, loadRootOnlyBootstrapSuperAdminRequest, provisionBootstrapSuperAdmin, readRootOnlyBootstrapPassword } from "@/lib/bootstrap-super-admin";

const requestPath = process.env.ASAS_BOOTSTRAP_CONTROL_REQUEST_FILE;
const auditPath = process.env.ASAS_BOOTSTRAP_AUDIT_FILE;
if (process.env.ASAS_BOOTSTRAP_EXECUTION !== "CONFIRM" || !requestPath || !auditPath) throw new BootstrapSuperAdminError("EXECUTION_NOT_CONFIRMED");

const prisma = new PrismaClient();
const TEMPORARY_BOOTSTRAP_ROLE = "asasplus_bootstrap_grant";
const fingerprint = (value: string) => createHash("sha256").update(`bootstrap-audit:${value}`).digest("base64url");

async function assertRootOnlyNewAuditPath(path: string) {
  const directory = await stat(dirname(path)).catch(() => undefined);
  if (!directory?.isDirectory() || directory.uid !== 0 || directory.gid !== 0 || (directory.mode & 0o077) !== 0) throw new BootstrapSuperAdminError("REQUEST_INVALID");
  if (await stat(path).then(() => true).catch(() => false)) throw new BootstrapSuperAdminError("REQUEST_INVALID");
}

async function assertRuntimePrivilegeBoundary() {
  const [runtime] = await prisma.$queryRaw<Array<{ canInsertUsers: boolean }>>`
    SELECT has_table_privilege(current_user, 'public.users', 'INSERT') AS "canInsertUsers"
  `;
  if (runtime?.canInsertUsers) throw new BootstrapSuperAdminError("TEMPORARY_ROLE_INVALID");
}

async function main() {
  const request = await loadRootOnlyBootstrapSuperAdminRequest(requestPath);
  await assertRootOnlyNewAuditPath(auditPath);
  await assertRuntimePrivilegeBoundary();
  let password: Buffer | undefined;
  let result: Awaited<ReturnType<typeof provisionBootstrapSuperAdmin>>;
  try {
    result = await prisma.$transaction(async (tx) => {
      await tx.$executeRawUnsafe(`SET LOCAL ROLE ${TEMPORARY_BOOTSTRAP_ROLE}`);
      const [role] = await tx.$queryRaw<Array<{ active: boolean; canInsertUsers: boolean; canUpdateUsers: boolean; canDeleteUsers: boolean; canWriteMemberships: boolean }>>`
        SELECT
          current_user = ${TEMPORARY_BOOTSTRAP_ROLE} AS "active",
          has_table_privilege(current_user, 'public.users', 'INSERT') AS "canInsertUsers",
          has_table_privilege(current_user, 'public.users', 'UPDATE') AS "canUpdateUsers",
          has_table_privilege(current_user, 'public.users', 'DELETE') AS "canDeleteUsers",
          has_table_privilege(current_user, 'public.organization_memberships', 'INSERT')
            OR has_table_privilege(current_user, 'public.organization_memberships', 'UPDATE')
            OR has_table_privilege(current_user, 'public.organization_memberships', 'DELETE') AS "canWriteMemberships"
      `;
      if (!role?.active || !role.canInsertUsers || role.canUpdateUsers || role.canDeleteUsers || role.canWriteMemberships) throw new BootstrapSuperAdminError("TEMPORARY_ROLE_INVALID");
      const existing = await tx.user.findUnique({ where: { email: request.email }, select: { id: true } });
      if (!existing) password = await readRootOnlyBootstrapPassword(request.passwordFile);
      return provisionBootstrapSuperAdmin({
        findByEmail: async (email) => tx.user.findUnique({ where: { email }, select: { id: true, email: true, role: true, isActive: true, activeOrganizationId: true } }),
        countOrganizationMemberships: async (userId) => tx.organizationMembership.count({ where: { userId } }),
        create: async (input) => tx.user.create({ data: { ...input, role: Role.SUPER_ADMIN }, select: { id: true, email: true, role: true, isActive: true, activeOrganizationId: true } }),
      }, request, password);
    });
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
