// Day-0 production tenant provisioning generator. Reads secrets from root-only
// files, never prints them. Emits provision.sql (0600) and the tenant
// credential file (root:asasplus 0640).
import { readFileSync, writeFileSync, chmodSync, chownSync } from "node:fs";
import { randomBytes, randomUUID } from "node:crypto";
import { createRequire } from "node:module";

const require = createRequire("/opt/asasplus/app/package.json");
const bcrypt = require("bcryptjs");

const SECRETS = "/root/asasplus-day0-secrets";
const CRED_DIR = "/opt/asasplus/shared/production-tenant-credentials";
const DB = "asasplus_production";

const platformEmail = "nourrwaa@gmail.com";
const platformName = "نور إبراهيم محمد يوسف";
const adminEmail = "admin@hker.com";
const adminName = "مور يوسف";
const orgName = "جمعية الخير لأعمال الخير";

const accountPassword = readFileSync(`${SECRETS}/day0-password`, "utf8").trim();
if (!accountPassword) throw new Error("EMPTY_SECRET");

const platformHash = bcrypt.hashSync(accountPassword, 12);
const adminHash = bcrypt.hashSync(accountPassword, 12);

const suffix = randomBytes(6).toString("hex");
const principal = `asas_p_t1_${suffix}`;
const principalPassword = randomBytes(32).toString("hex");
const credRef = `prod_t1_${suffix}`;
const credFile = `${CRED_DIR}/${credRef}.url`;

const orgId = randomUUID();
const adminId = randomUUID();
const membershipId = randomUUID();
const orgRoleId = randomUUID();
const principalRowId = randomUUID();
const auditId = randomUUID();

const esc = (v) => `'${String(v).replace(/'/g, "''")}'`;

// All public tables minus control-plane / global-security tables. The tenant
// principal gets DML on org-scoped domain tables; SELECT-only on shared
// reference tables the runtime reads through the tenant connection.
const EXCLUDE_DML = new Set([
  "_prisma_migrations",
  "installation_state",
  "instance_identity",
  "identity_provider_callback_states",
  "identity_provider_configs",
  "identity_subject_bindings",
  "oauth_states",
  "organizations",
  "permissions",
  "platform_invoices",
  "platform_plans",
  "role_permissions",
  "roles",
  "tenant_access_leases",
  "tenant_broker_audit_events",
  "tenant_database_principals",
  "trial_requests",
  "user_permissions",
  "users",
]);
const ALL_TABLES = readFileSync(`${SECRETS}/public-tables.txt`, "utf8")
  .trim()
  .split(",")
  .map((t) => t.trim())
  .filter(Boolean);
const dmlTables = ALL_TABLES.filter((t) => !EXCLUDE_DML.has(t));

const sql = `-- ASAS Day-0 tenant provisioning. Atomic + duplicate-guarded.
\\set ON_ERROR_STOP on
BEGIN;

-- Guard: no duplicate organization / admin / platform anomalies.
DO $guard$
BEGIN
  IF EXISTS (SELECT 1 FROM "organizations" WHERE "name" = ${esc(orgName)}) THEN
    RAISE EXCEPTION 'DAY0_GUARD_ORGANIZATION_EXISTS';
  END IF;
  IF EXISTS (SELECT 1 FROM "users" WHERE lower("email") = ${esc(adminEmail)}) THEN
    RAISE EXCEPTION 'DAY0_GUARD_ADMIN_EXISTS';
  END IF;
  IF (SELECT count(*) FROM "users" WHERE lower("email") = ${esc(platformEmail)} AND "role" = 'SUPER_ADMIN' AND "isActive") <> 1 THEN
    RAISE EXCEPTION 'DAY0_GUARD_PLATFORM_ACCOUNT_INVALID';
  END IF;
  IF EXISTS (SELECT 1 FROM "organization_memberships" m JOIN "users" u ON u.id = m."userId" WHERE lower(u."email") = ${esc(platformEmail)}) THEN
    RAISE EXCEPTION 'DAY0_GUARD_PLATFORM_HAS_MEMBERSHIP';
  END IF;
END
$guard$;

-- Tenant database principal (least-privilege, RLS-bound).
CREATE ROLE ${principal} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ${esc(principalPassword)};
GRANT CONNECT ON DATABASE ${DB} TO ${principal};
GRANT USAGE ON SCHEMA public TO ${principal};
GRANT SELECT,INSERT,UPDATE,DELETE ON TABLE ${dmlTables.map((t) => `"${t}"`).join(",")} TO ${principal};
GRANT SELECT ON TABLE "permissions","organizations","users" TO ${principal};

-- Control plane needs organization metadata for the dashboard layout.
GRANT SELECT ON TABLE "organizations" TO asasplus_production_control;

-- Application records.
INSERT INTO "organizations" ("id","name","createdAt","updatedAt")
VALUES (${esc(orgId)},${esc(orgName)},now(),now());

INSERT INTO "users" ("id","name","email","password","role","isActive","authVersion","activeOrganizationId","createdAt","updatedAt")
VALUES (${esc(adminId)},${esc(adminName)},${esc(adminEmail)},${esc(adminHash)},'ADMIN',true,1,${esc(orgId)},now(),now());

INSERT INTO "organization_memberships" ("id","organizationId","userId","role","isDefault","isActive","policyVersion","createdAt","updatedAt")
VALUES (${esc(membershipId)},${esc(orgId)},${esc(adminId)},'ADMIN',true,true,1,now(),now());

INSERT INTO "organization_roles" ("id","organizationId","name","isSystem","createdAt","updatedAt")
VALUES (${esc(orgRoleId)},${esc(orgId)},'مدير الجمعية',true,now(),now());

INSERT INTO "organization_role_permissions" ("organizationRoleId","permissionId","effect")
SELECT ${esc(orgRoleId)}, p."id", 'ALLOW' FROM "permissions" p;

INSERT INTO "membership_roles" ("membershipId","organizationRoleId","assignedAt")
VALUES (${esc(membershipId)},${esc(orgRoleId)},now());

-- Platform account: correct display name + authorized password, stays tenant-less.
UPDATE "users"
SET "name" = ${esc(platformName)}, "password" = ${esc(platformHash)}, "isActive" = true, "updatedAt" = now()
WHERE lower("email") = ${esc(platformEmail)} AND "role" = 'SUPER_ADMIN' AND "activeOrganizationId" IS NULL;

-- Tenant runtime bindings.
INSERT INTO security.role_to_organization ("role_oid","organization_id","activated_at","created_at")
VALUES (${esc(principal)}::regrole::oid,${esc(orgId)},now(),now());

INSERT INTO "tenant_database_principals" ("id","organizationId","principalName","credentialReference","queueCredentialReference","generation","status","activatedAt","createdAt","updatedAt")
VALUES (${esc(principalRowId)},${esc(orgId)},${esc(principal)},${esc(`file://${credRef}`)},NULL,1,'ACTIVE',now(),now(),now());

INSERT INTO "audit_logs" ("id","organizationId","action","entity","entityId","details","createdAt")
VALUES (${esc(auditId)},${esc(orgId)},'DAY0_TENANT_PROVISIONED','Organization',${esc(orgId)},'{"source":"day0-manual-provisioning"}'::jsonb,now());

COMMIT;
`;

writeFileSync(`${SECRETS}/provision.sql`, sql, { mode: 0o600 });
writeFileSync(credFile, `postgresql://${principal}:${principalPassword}@127.0.0.1:5432/${DB}?schema=public\n`, { mode: 0o640 });
const gid = Number(readFileSync("/etc/group", "utf8").split("\n").find((l) => l.startsWith("asasplus:")).split(":")[2]);
chownSync(credFile, 0, gid);
chmodSync(`${SECRETS}/provision.sql`, 0o600);

console.log(JSON.stringify({ ok: true, principal, credRef, orgId, adminId, membershipId, orgRoleId, dmlTableCount: dmlTables.length }));
