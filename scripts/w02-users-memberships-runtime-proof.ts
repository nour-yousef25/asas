import { chmodSync, readFileSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { PrismaClient, PermissionEffect, type Role } from "@prisma/client";
import { BrokerDeniedError, TenantAccessBroker } from "../src/lib/tenant-access-broker";
import {
  installTenantBoundPrismaExecutor,
  TenantBoundPrismaCredentialAuthority,
  TenantBoundPrismaExecutor,
  type TenantConnectionProvider,
} from "../src/lib/tenant-bound-prisma-authority";
import { MembershipRepository, MembershipScopeError } from "../src/lib/membership-repository";
import { assignOrganizationRole, IamAuthorizationError, setMembershipPermissionOverride } from "../src/lib/iam";
import { evaluatePermission } from "../src/lib/policy";
import type { TenantContext } from "../src/lib/tenant-context";

/** W02 Users/Memberships proof: disposable local PostgreSQL only; never a production provider or credential. */
const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_users_memberships_audit_${suffix}`;
const roles = ["migrator", "control", "a1", "a2", "b1"].map((item) => `um_${item}_${suffix}`);
const [migrator, controlRole, tenantA1, tenantA2, tenantB1] = roles;
const passwords = Object.fromEntries(roles.map((role) => [role, randomBytes(30).toString("base64url")])) as Record<string, string>;
const evidenceFile = `/tmp/w02-users-memberships-evidence-${suffix}.json`;
const mandatoryIds = ["UM01", "UM02", "UM03", "UM04", "UM05", "UM06", "UM07", "UM08", "UM09", "UM10"];
const evidence: Array<Record<string, unknown>> = [];

const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const userA = "aaaaaaaa-0000-4000-8000-000000000001";
const userB = "bbbbbbbb-0000-4000-8000-000000000002";
const userC = "cccccccc-0000-4000-8000-000000000003";
const userD = "dddddddd-0000-4000-8000-000000000004";
const userInactive = "eeeeeeee-0000-4000-8000-000000000005";
const userShared = "ffffffff-0000-4000-8000-000000000006";
const userWithoutMembership = "99999999-0000-4000-8000-000000000007";
const membershipA = "aaaaaaaa-0000-4000-8000-000000000101";
const membershipB = "bbbbbbbb-0000-4000-8000-000000000102";
const membershipTarget = "cccccccc-0000-4000-8000-000000000103";
const membershipSharedA = "ffffffff-0000-4000-8000-000000000104";
const membershipSharedB = "ffffffff-0000-4000-8000-000000000105";
const roleAdminA = "role-admin-a";
const roleEscalationA = "role-escalation-a";
const roleCreatorA = "role-creator-a";
const roleApproverA = "role-approver-a";

const run = (command: string, args: string[], options: Record<string, unknown> = {}) => spawnSync(command, args, { encoding: "utf8", ...options });

function adminSql(sql: string, db = "postgres") {
  const result = run("sudo", ["-u", "postgres", "psql", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql });
  if (result.status !== 0) throw new Error("AUDIT_ADMIN_SQL_FAILED");
  return result.stdout.trim();
}

function url(role: string) {
  return `postgresql://${role}:${passwords[role]}@127.0.0.1:5432/${database}?schema=public`;
}

function context(
  organizationId: string,
  userId: string,
  membershipId: string,
  correlationId: string,
  sessionVersion = 1,
  policySnapshotVersion = 1,
): TenantContext {
  return Object.freeze({ organizationId, userId, membershipId, correlationId, sessionVersion, policySnapshotVersion });
}

function writeEvidence(payload: Record<string, unknown>) {
  writeFileSync(evidenceFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidenceFile, 0o600);
}

async function record(id: string, expected: string, action: () => Promise<boolean | { pass: boolean; actual: unknown }>) {
  try {
    const outcome = await action();
    const passed = typeof outcome === "boolean" ? outcome : outcome.pass;
    const actual = typeof outcome === "boolean" ? outcome : outcome.actual;
    evidence.push({ id, expected, actual, result: passed ? "PASS" : "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
  } catch {
    evidence.push({ id, expected, actual: "REDACTED_EXCEPTION", result: "FAIL", timestamp: new Date().toISOString(), environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
  }
}

async function denies(action: () => Promise<unknown>, expectedCode?: string) {
  try {
    await action();
    return false;
  } catch (error) {
    const code = typeof error === "object" && error && "code" in error ? (error as { code?: unknown }).code : undefined;
    return expectedCode ? code === expectedCode : error instanceof MembershipScopeError || error instanceof IamAuthorizationError || error instanceof BrokerDeniedError;
  }
}

async function denialCode(action: () => Promise<unknown>) {
  try {
    await action();
    return "NO_DENIAL";
  } catch (error) {
    if (typeof error === "object" && error && "code" in error && typeof (error as { code?: unknown }).code === "string") return (error as { code: string }).code;
    return error instanceof Error ? `REDACTED_${error.name}` : "REDACTED_UNKNOWN";
  }
}

function cleanup() {
  const errors: string[] = [];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid<>pg_backend_pid();`); } catch { errors.push("TERMINATE_FAILED"); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch { errors.push("DROP_DATABASE_FAILED"); }
  for (const role of roles) {
    try { adminSql(`DROP ROLE IF EXISTS ${role};`); } catch { errors.push("DROP_ROLE_FAILED"); }
  }
  let residue = "";
  try {
    residue = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((role) => `'${role}'`).join(",")});`);
  } catch { errors.push("RESIDUE_SCAN_FAILED"); }
  return { ok: errors.length === 0 && residue === "", errors, residueCount: residue ? residue.split("\n").filter(Boolean).length : 0 };
}

async function main() {
  let controlPrisma: PrismaClient | null = null;
  const startedAt = new Date().toISOString();
  try {
    adminSql(`
      CREATE ROLE ${migrator} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords[migrator]}';
      CREATE DATABASE ${database} OWNER ${migrator};
      CREATE ROLE ${controlRole} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords[controlRole]}';
      CREATE ROLE ${tenantA1} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords[tenantA1]}';
      CREATE ROLE ${tenantA2} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords[tenantA2]}';
      CREATE ROLE ${tenantB1} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${passwords[tenantB1]}';
    `);
    if (run("./node_modules/.bin/prisma", ["migrate", "deploy", "--schema", "prisma/schema.prisma"], { env: { ...process.env, DATABASE_URL: url(migrator) } }).status !== 0) throw new Error("MIGRATION_DEPLOY_FAILED");

    adminSql(`
      GRANT CONNECT ON DATABASE ${database} TO ${roles.slice(1).join(",")};
      GRANT USAGE ON SCHEMA public TO ${roles.slice(1).join(",")};
      GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "organizations","users","organization_memberships","tenant_database_principals","tenant_access_leases","tenant_broker_audit_events" TO ${controlRole};
      GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE "organizations","users","organization_memberships","organization_roles","organization_role_permissions","membership_roles","membership_permission_overrides","permissions","audit_logs","platform_support_access" TO ${tenantA1},${tenantA2},${tenantB1};

      INSERT INTO "organizations" ("id","name","createdAt","updatedAt") VALUES ('${orgA}','Audit Organization A',now(),now()),('${orgB}','Audit Organization B',now(),now());
      INSERT INTO "users" ("id","name","email","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt") VALUES
        ('${userA}','Actor A','a-${suffix}@audit.invalid','MEMBER',true,1,'${orgA}',now(),now()),
        ('${userB}','Actor B','b-${suffix}@audit.invalid','MEMBER',true,1,'${orgB}',now(),now()),
        ('${userC}','Target C','c-${suffix}@audit.invalid','MEMBER',true,1,'${orgA}',now(),now()),
        ('${userD}','Create D','d-${suffix}@audit.invalid','MEMBER',true,1,NULL,now(),now()),
        ('${userInactive}','Inactive E','e-${suffix}@audit.invalid','MEMBER',false,1,NULL,now(),now()),
        ('${userShared}','Shared Identity','shared-${suffix}@audit.invalid','MEMBER',true,1,NULL,now(),now()),
        ('${userWithoutMembership}','No Membership','none-${suffix}@audit.invalid','MEMBER',true,1,NULL,now(),now());
      INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isActive","policyVersion","createdAt","updatedAt") VALUES
        ('${membershipA}','${orgA}','${userA}','MEMBER',true,1,now(),now()),
        ('${membershipB}','${orgB}','${userB}','MEMBER',true,1,now(),now()),
        ('${membershipTarget}','${orgA}','${userC}','MEMBER',true,1,now(),now()),
        ('${membershipSharedA}','${orgA}','${userShared}','MEMBER',true,1,now(),now()),
        ('${membershipSharedB}','${orgB}','${userShared}','MEMBER',true,1,now(),now());
      INSERT INTO "permissions" ("id","name","module","action") VALUES
        ('perm-membership-read','identity.membership.read','identity','membership.read'),
        ('perm-membership-manage','identity.membership.manage','identity','membership.manage'),
        ('perm-role-manage','identity.role.manage','identity','role.manage'),
        ('perm-donation-create','donation.create','donation','create'),
        ('perm-donation-approve','donation.approve','donation','approve');
      INSERT INTO "organization_roles" ("id","organizationId","name","isSystem","createdAt","updatedAt") VALUES
        ('${roleAdminA}','${orgA}','AUDIT_ADMIN',true,now(),now()),
        ('${roleEscalationA}','${orgA}','AUDIT_ESCALATION',true,now(),now()),
        ('${roleCreatorA}','${orgA}','AUDIT_DONATION_CREATOR',true,now(),now()),
        ('${roleApproverA}','${orgA}','AUDIT_DONATION_APPROVER',true,now(),now());
      INSERT INTO "organization_role_permissions" ("organizationRoleId","permissionId","effect") VALUES
        ('${roleAdminA}','perm-membership-read','ALLOW'),
        ('${roleAdminA}','perm-membership-manage','ALLOW'),
        ('${roleAdminA}','perm-role-manage','ALLOW'),
        ('${roleEscalationA}','perm-role-manage','ALLOW'),
        ('${roleCreatorA}','perm-donation-create','ALLOW'),
        ('${roleApproverA}','perm-donation-approve','ALLOW');
      INSERT INTO "membership_roles" ("membershipId","organizationRoleId","assignedAt") VALUES ('${membershipA}','${roleAdminA}',now());
      INSERT INTO security.role_to_organization (role_oid,organization_id) VALUES ('${tenantA1}'::regrole::oid,'${orgA}'),('${tenantB1}'::regrole::oid,'${orgB}');
      INSERT INTO "tenant_database_principals" ("id","organizationId","principalName","credentialReference","generation","status","activatedAt","createdAt","updatedAt") VALUES
        ('principal-a1','${orgA}','${tenantA1}','audit://um/a1',1,'ACTIVE',now(),now(),now()),
        ('principal-b1','${orgB}','${tenantB1}','audit://um/b1',1,'ACTIVE',now(),now(),now());
      INSERT INTO "audit_logs" ("id","organizationId","action","entity","entityId","details","createdAt") VALUES
        ('audit-a','${orgA}','AUDIT_SEED','OrganizationMembership','${membershipA}','{"correlationId":"um-seed-a"}'::jsonb,now()),
        ('audit-b','${orgB}','AUDIT_SEED','OrganizationMembership','${membershipB}','{"correlationId":"um-seed-b"}'::jsonb,now());
    `, database);

    controlPrisma = new PrismaClient({ datasources: { db: { url: url(controlRole) } } });
    const entries = new Map<string, { principalName: string; url: string }>([
      ["audit://um/a1", { principalName: tenantA1, url: url(tenantA1) }],
      ["audit://um/a2", { principalName: tenantA2, url: url(tenantA2) }],
      ["audit://um/b1", { principalName: tenantB1, url: url(tenantB1) }],
    ]);
    const unavailable = new Set<string>();
    const observations: Array<{ correlationId: string; identity: string; client: PrismaClient }> = [];
    let checkoutCount = 0;
    let discardCount = 0;
    const provider: TenantConnectionProvider = {
      async checkout(input) {
        const entry = entries.get(input.credentialReference);
        if (!entry || unavailable.has(input.credentialReference) || entry.principalName !== input.principalName) throw new Error("AUTHORITY_MAPPING_OR_PROVIDER_UNAVAILABLE");
        const prisma = new PrismaClient({ datasources: { db: { url: entry.url } } });
        const rows = await prisma.$queryRawUnsafe<Array<{ session_user: string }>>("SELECT session_user");
        if (rows[0]?.session_user !== input.principalName) {
          await prisma.$disconnect();
          throw new Error("SESSION_USER_MISMATCH");
        }
        checkoutCount += 1;
        observations.push({ correlationId: input.correlationId, identity: rows[0].session_user, client: prisma });
        return { prisma, discard: async () => { discardCount += 1; await prisma.$disconnect(); } };
      },
    };
    const authority = new TenantBoundPrismaCredentialAuthority(provider);
    const broker = new TenantAccessBroker(controlPrisma, authority, 5_000);
    const executor = new TenantBoundPrismaExecutor(broker);
    installTenantBoundPrismaExecutor(executor);
    const repository = new MembershipRepository(executor);
    const ctxA = context(orgA, userA, membershipA, "um-a");
    const ctxB = context(orgB, userB, membershipB, "um-b");
    const ctxC1 = context(orgA, userC, membershipTarget, "um-c", 1, 1);

    await record("UM01", "Broker consumes a one-time lease and the provider verifies tenant A session_user", async () => {
      const before = await controlPrisma!.tenantAccessLease.count({ where: { organizationId: orgA, status: "CONSUMED" } });
      const listed = await repository.list(ctxA, { skip: 0, take: 10 });
      const after = await controlPrisma!.tenantAccessLease.count({ where: { organizationId: orgA, status: "CONSUMED" } });
      return listed.data.every((item) => item.organizationId === orgA) && after > before && observations.some((item) => item.correlationId === ctxA.correlationId && item.identity === tenantA1);
    });

    await record("UM02", "A/B membership list, search, pagination and detail isolate memberships while User remains identity-only", async () => {
      const [aPage, aSearch, bPage, aDetail, bDetail] = await Promise.all([
        repository.list(ctxA, { skip: 0, take: 2 }),
        repository.list(ctxA, { skip: 0, take: 10, search: "Shared Identity" }),
        repository.list(ctxB, { skip: 0, take: 10 }),
        repository.getById(ctxA, membershipA),
        repository.getById(ctxB, membershipB),
      ]);
      return aPage.total === 3
        && aPage.data.length === 2
        && aPage.data.every((item) => item.organizationId === orgA && item.user.id !== userWithoutMembership)
        && aSearch.data.length === 1
        && aSearch.data[0]?.id === membershipSharedA
        && bPage.total === 2
        && bPage.data.every((item) => item.organizationId === orgB)
        && aDetail?.organizationId === orgA
        && bDetail?.organizationId === orgB;
    });

    await record("UM03", "Foreign membership detail, revoke, role and override mutations deny; tenant audit rows cannot leak across A/B", async () => {
      const foreignDetail = await repository.getById(ctxA, membershipB);
      const [foreignRevokeCode, foreignRole, foreignOverride, auditRows] = await Promise.all([
        denialCode(() => repository.revoke(ctxA, membershipB)),
        denies(() => assignOrganizationRole({ context: ctxA, membershipId: membershipB, organizationRoleId: roleAdminA })),
        denies(() => setMembershipPermissionOverride({ context: ctxA, membershipId: membershipB, permissionName: "identity.membership.read", effect: PermissionEffect.ALLOW, reason: "foreign" })),
        executor.execute(ctxA, (db) => db.auditLog.findMany({ select: { id: true, organizationId: true } })),
      ]);
      const foreignRevoke = foreignRevokeCode === "AUTHORITY_OR_OPERATION_FAILURE";
      const foreignMembership = await controlPrisma!.organizationMembership.findUnique({ where: { id: membershipB }, select: { isActive: true, revokedAt: true } });
      return {
        pass: foreignDetail === null && foreignRevoke && foreignMembership?.isActive === true && foreignMembership.revokedAt === null && foreignRole && foreignOverride && auditRows.length === 1 && auditRows[0]?.id === "audit-a" && auditRows[0]?.organizationId === orgA,
        actual: { foreignDetail: foreignDetail === null, foreignRevoke, foreignRevokeCode, foreignMembershipUntouched: foreignMembership?.isActive === true && foreignMembership.revokedAt === null, foreignRole, foreignOverride, auditRows: auditRows.map((row) => ({ id: row.id, organizationId: row.organizationId })) },
      };
    });

    await record("UM04", "Membership creation accepts only an existing active global User and stamps the organization from TenantContext", async () => {
      const forgedInput = { userId: userD, role: "MEMBER" as Role, organizationId: orgB } as unknown as { userId: string; role?: Role };
      const created = await repository.create(ctxA, forgedInput);
      const inactiveCode = await denialCode(() => repository.create(ctxA, { userId: userInactive }));
      const inactiveDenied = inactiveCode === "AUTHORITY_OR_OPERATION_FAILURE";
      const inactiveMembershipCount = await controlPrisma!.organizationMembership.count({ where: { organizationId: orgA, userId: userInactive } });
      return {
        pass: created.organizationId === orgA && created.userId === userD && inactiveDenied && inactiveMembershipCount === 0,
        actual: { createdOrganizationMatchesContext: created.organizationId === orgA, createdUserMatchesInput: created.userId === userD, inactiveDenied, inactiveCode, inactiveMembershipCount },
      };
    });

    await record("UM05", "Duplicate same-organization identity and cross-tenant mutation deny; explicitly seeded shared identity remains valid in both organizations", async () => {
      const duplicateCode = await denialCode(() => repository.create(ctxA, { userId: userD }));
      const crossTenantMutationCode = await denialCode(() => repository.revoke(ctxA, membershipB));
      const duplicate = duplicateCode === "AUTHORITY_OR_OPERATION_FAILURE";
      const crossTenantMutation = crossTenantMutationCode === "AUTHORITY_OR_OPERATION_FAILURE";
      const [duplicateMembershipCount, foreignMembership] = await Promise.all([
        controlPrisma!.organizationMembership.count({ where: { organizationId: orgA, userId: userD } }),
        controlPrisma!.organizationMembership.findUnique({ where: { id: membershipB }, select: { isActive: true, revokedAt: true } }),
      ]);
      const [sharedA, sharedB] = await Promise.all([
        repository.getById(ctxA, membershipSharedA),
        repository.getById(ctxB, membershipSharedB),
      ]);
      return {
        pass: duplicate && duplicateMembershipCount === 1 && crossTenantMutation && foreignMembership?.isActive === true && foreignMembership.revokedAt === null && sharedA?.userId === userShared && sharedB?.userId === userShared && sharedA.organizationId === orgA && sharedB.organizationId === orgB,
        actual: { duplicate, duplicateCode, duplicateMembershipCount, crossTenantMutation, crossTenantMutationCode, foreignMembershipUntouched: foreignMembership?.isActive === true && foreignMembership.revokedAt === null, sharedA: { userMatches: sharedA?.userId === userShared, organizationMatches: sharedA?.organizationId === orgA }, sharedB: { userMatches: sharedB?.userId === userShared, organizationMatches: sharedB?.organizationId === orgB } },
      };
    });

    await record("UM06", "Role binding and permission overrides use actual tables, default-deny applies, and self-escalation/SoD are denied", async () => {
      const defaultDeny = await evaluatePermission(ctxC1, "identity.membership.read");
      const selfEscalation = await denies(() => assignOrganizationRole({ context: ctxA, membershipId: membershipA, organizationRoleId: roleEscalationA }));
      const creatorBound = await assignOrganizationRole({ context: ctxA, membershipId: membershipTarget, organizationRoleId: roleCreatorA });
      const sodDenied = await denies(() => assignOrganizationRole({ context: ctxA, membershipId: membershipTarget, organizationRoleId: roleApproverA }));
      const allowOverride = await setMembershipPermissionOverride({ context: ctxA, membershipId: membershipTarget, permissionName: "identity.membership.read", effect: PermissionEffect.ALLOW, reason: "audit-allow" });
      const allowed = await evaluatePermission(context(orgA, userC, membershipTarget, "um-c-allow", 1, allowOverride.policyVersion), "identity.membership.read");
      const denyOverride = await setMembershipPermissionOverride({ context: ctxA, membershipId: membershipTarget, permissionName: "identity.membership.read", effect: PermissionEffect.DENY, reason: "audit-deny" });
      const denied = await evaluatePermission(context(orgA, userC, membershipTarget, "um-c-deny", 1, denyOverride.policyVersion), "identity.membership.read");
      return defaultDeny.allowed === false
        && defaultDeny.reason === "DEFAULT_DENY"
        && selfEscalation
        && creatorBound.policyVersion === 2
        && sodDenied
        && allowed.allowed === true
        && allowed.reason === "ALLOW"
        && denied.allowed === false
        && denied.reason === "EXPLICIT_DENY";
    });

    await record("UM07", "Revocation disables the membership, increments policy version, and fails closed for later data-plane access", async () => {
      const before = await controlPrisma!.organizationMembership.findUnique({ where: { id: membershipTarget }, select: { policyVersion: true } });
      const revoked = await repository.revoke(ctxA, membershipTarget);
      const denial = await denialCode(() => repository.getById(context(orgA, userC, membershipTarget, "um-c-revoked", 1, revoked.policyVersion), membershipTarget));
      return before?.policyVersion !== undefined && revoked.policyVersion === before.policyVersion + 1 && revoked.isActive === false && revoked.revokedAt !== null && denial === "MEMBERSHIP_ORGANIZATION_MISMATCH";
    });

    await record("UM08", "Lease replay/revocation and stale session/policy snapshots deny before a data-plane operation", async () => {
      const lease = await broker.issueLease(ctxA);
      await broker.execute(ctxA, lease, async (input) => input.prisma?.$queryRawUnsafe("SELECT 1"));
      const replay = await denies(() => broker.execute(ctxA, lease, async () => "unexpected"), "LEASE_REPLAY");
      const revokedLease = await broker.issueLease(ctxA);
      await broker.revokeLease(revokedLease.leaseId, ctxA.correlationId);
      const revoked = await denies(() => broker.execute(ctxA, revokedLease, async () => "unexpected"), "LEASE_REVOKED");
      const staleSession = await denialCode(() => repository.list(context(orgA, userA, membershipA, "um-stale-session", 0, 1), { skip: 0, take: 1 }));
      const stalePolicy = await denialCode(() => repository.list(context(orgA, userA, membershipA, "um-stale-policy", 1, 0), { skip: 0, take: 1 }));
      return replay && revoked && staleSession === "STALE_SESSION" && stalePolicy === "STALE_POLICY";
    });

    await record("UM09", "Provider outage, A1→A2 rotation, A/B parallel checkout and discard remain fail-closed and identity-separated", async () => {
      await broker.revokePrincipal("principal-a1", "um-rotation");
      adminSql(`UPDATE security.role_to_organization SET revoked_at=now() WHERE role_oid='${tenantA1}'::regrole::oid; INSERT INTO security.role_to_organization (role_oid,organization_id) VALUES ('${tenantA2}'::regrole::oid,'${orgA}');`, database);
      await controlPrisma!.tenantDatabasePrincipal.create({ data: { id: "principal-a2", organizationId: orgA, principalName: tenantA2, credentialReference: "audit://um/a2", generation: 2, status: "ACTIVE", activatedAt: new Date() } });
      entries.delete("audit://um/a1");
      const rotated = (await repository.list(ctxA, { skip: 0, take: 10 })).data.every((item) => item.organizationId === orgA) && observations.at(-1)?.identity === tenantA2;
      unavailable.add("audit://um/a2");
      const outage = await denies(() => repository.list(ctxA, { skip: 0, take: 1 }), "AUTHORITY_OR_OPERATION_FAILURE");
      unavailable.delete("audit://um/a2");
      const start = observations.length;
      const [a, b] = await Promise.all([repository.list(ctxA, { skip: 0, take: 10 }), repository.list(ctxB, { skip: 0, take: 10 })]);
      const recent = observations.slice(start);
      const aObservation = recent.find((item) => item.correlationId === ctxA.correlationId);
      const bObservation = recent.find((item) => item.correlationId === ctxB.correlationId);
      return rotated && outage && a.data.every((item) => item.organizationId === orgA) && b.data.every((item) => item.organizationId === orgB)
        && aObservation?.identity === tenantA2 && bObservation?.identity === tenantB1 && aObservation.client !== bObservation.client && discardCount >= checkoutCount;
    });

    await record("UM10", "Sources avoid unsafe authority patterns; non-owner roles, correlation audit records, cleanup and hygiene are required", async () => {
      const roleNames = roles.slice(1).map((role) => `'${role}'`).join(",");
      const unsafeRoles = adminSql(`SELECT count(*) FROM pg_roles WHERE rolname IN (${roleNames}) AND (rolsuper OR rolbypassrls OR rolcreaterole OR rolcreatedb OR rolinherit)`, database);
      const nonOwnerRoles = adminSql(`SELECT count(*) FROM pg_database AS database JOIN pg_roles AS role ON role.oid=database.datdba WHERE database.datname='${database}' AND role.rolname IN (${roleNames})`, database);
      const source = [
        "src/lib/membership-repository.ts",
        "src/app/api/memberships/route.ts",
        "src/lib/iam.ts",
        "src/lib/policy.ts",
        "src/app/api/users/route.ts",
      ].map((path) => readFileSync(path, "utf8")).join("\n");
      const tenantAudit = await executor.execute(ctxA, (db) => db.auditLog.findMany({ where: { organizationId: orgA, action: { in: ["IAM_ROLE_ASSIGNED", "IAM_PERMISSION_OVERRIDE_SET"] } }, select: { organizationId: true, details: true } }));
      const brokerAudit = await controlPrisma!.tenantBrokerAuditEvent.count({ where: { organizationId: orgA, correlationId: ctxA.correlationId, decision: "ALLOW" } });
      const unsafeSource = /(from "@\/lib\/db"|new PrismaClient|current_setting|set_config|DATABASE_URL|organizationMemberships\[0\]|activeOrganizationId)/.test(source);
      const correlatedAudit = tenantAudit.length >= 3 && tenantAudit.every((item) => item.organizationId === orgA && JSON.stringify(item.details).includes(ctxA.correlationId));
      return unsafeRoles === "0" && nonOwnerRoles === "0" && !unsafeSource && correlatedAudit && brokerAudit > 0;
    });

    await controlPrisma.$disconnect();
    controlPrisma = null;
    const finalCleanup = cleanup();
    const payload: Record<string, unknown> = {
      status: "PENDING",
      startedAt,
      finishedAt: new Date().toISOString(),
      databaseAlias: database,
      environment: "disposable-postgresql-audit",
      mandatoryIds,
      evidence,
      hardFailures: [],
      cleanup: finalCleanup,
      hygiene: { status: "PENDING" },
      credentialsPersisted: false,
      productionResourcesTouched: false,
      rawGucIdentityUsed: false,
      globalPrismaFallback: false,
      ownerOrBypassUsedForTenantEvidence: false,
    };
    for (const item of evidence) item.cleanupStatus = finalCleanup.ok ? "PASS" : "FAIL";
    writeEvidence(payload);
    const hygiene = run("node", ["scripts/w02-audit-artifact-hygiene-scan.mjs"]).status === 0;
    payload.hygiene = { status: hygiene ? "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" : "FAIL_AUDIT_ARTIFACT_HYGIENE_SCAN" };
    const failures = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
    payload.hardFailures = failures;
    payload.status = !finalCleanup.ok ? "FAIL_CLEANUP" : !hygiene ? "FAIL_HYGIENE" : failures.length === 0 ? "PASS_USERS_MEMBERSHIPS_RUNTIME" : "FAIL";
    writeEvidence(payload);
    process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile, hardFailures: failures, cleanup: finalCleanup, hygiene: payload.hygiene }, null, 2)}\n`);
    process.exitCode = payload.status === "PASS_USERS_MEMBERSHIPS_RUNTIME" ? 0 : 2;
  } catch {
    if (controlPrisma) await controlPrisma.$disconnect().catch(() => undefined);
    const finalCleanup = cleanup();
    writeEvidence({
      status: finalCleanup.ok ? "FAIL_SETUP_OR_HARNESS" : "FAIL_CLEANUP",
      startedAt,
      finishedAt: new Date().toISOString(),
      databaseAlias: database,
      error: "REDACTED_HARNESS_ERROR",
      mandatoryIds,
      evidence,
      cleanup: finalCleanup,
      hygiene: { status: "NOT_RUN" },
      credentialsPersisted: false,
      productionResourcesTouched: false,
      rawGucIdentityUsed: false,
      globalPrismaFallback: false,
      ownerOrBypassUsedForTenantEvidence: false,
    });
    process.stderr.write(`Users/Memberships runtime proof failed; redacted evidence: ${evidenceFile}\n`);
    process.exitCode = 2;
  }
}

void main();
