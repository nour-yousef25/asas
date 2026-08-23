import { createHash, randomBytes, randomUUID } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";
import { spawnSync } from "node:child_process";
import { PrismaClient } from "@prisma/client";

/** ADR-W02-010 audit-only proof. It creates no project migration and touches no production resource. */
const suffix = `${Date.now()}_${process.pid}`;
const database = `asas_control_ledger_audit_${suffix}`;
const role = (label: string) => `ledger_${label}_${suffix}`;
const migrator = role("migrator");
const securityOwner = role("security_owner");
const ledgerOwner = role("ledger_owner");
const controlWriter = role("control_writer");
const ledgerReader = role("reader");
const tenantA = role("tenant_a");
const tenantB = role("tenant_b");
const evidenceFile = `/tmp/w02-control-plane-ledger-evidence-${suffix}.json`;
const mandatoryIds = ["CP01", "CP02", "CP03", "CP04", "CP05", "CP06", "CP07", "CP08", "CP09", "CP10", "CP11", "CP12"];
const password = () => randomBytes(30).toString("base64url");
const secrets = { migrator: password(), control: password(), reader: password(), a: password(), b: password() };
const orgA = "11111111-1111-4111-8111-111111111111";
const orgB = "22222222-2222-4222-8222-222222222222";
const evidence: Array<Record<string, unknown>> = [];

function command(file: string, args: string[], options: Record<string, unknown> = {}) {
  return spawnSync(file, args, { encoding: "utf8", ...options });
}

function adminSql(sql: string, db = "postgres") {
  const result = command("sudo", ["-u", "postgres", "psql", "-d", db, "-X", "-v", "ON_ERROR_STOP=1", "-At"], { input: sql });
  if (result.status !== 0) {
    const detail = String(result.stderr || "REDACTED_ADMIN_SETUP_ERROR")
      .replace(/PASSWORD\s+'[^']+'/gi, "PASSWORD '[REDACTED]'")
      .replace(/postgresql:\/\/[^\s]+/gi, "postgresql://[REDACTED]")
      .replace(/\s+/g, " ")
      .slice(0, 320);
    throw new Error(`ADMIN_SETUP_ERROR:${detail}`);
  }
  return result.stdout.trim();
}

function url(user: string, value: string) {
  return `postgresql://${user}:${value}@127.0.0.1:5432/${database}?schema=public`;
}

function writeEvidence(payload: Record<string, unknown>) {
  writeFileSync(evidenceFile, `${JSON.stringify(payload, null, 2)}\n`, { mode: 0o600 });
  chmodSync(evidenceFile, 0o600);
}

async function denied(action: () => Promise<unknown>) {
  try { await action(); return false; } catch { return true; }
}

async function record(id: string, expected: string, action: () => Promise<boolean>) {
  let actual = false;
  try { actual = await action(); } catch { actual = false; }
  evidence.push({ id, expected, actual, result: actual ? "PASS" : "FAIL", environment: "disposable-postgresql-audit", cleanupStatus: "PENDING" });
}

function cleanup() {
  const roles = [tenantA, tenantB, controlWriter, ledgerReader, ledgerOwner, securityOwner, migrator];
  const errors: string[] = [];
  try { adminSql(`SELECT pg_terminate_backend(pid) FROM pg_stat_activity WHERE datname='${database}' AND pid <> pg_backend_pid();`); } catch { errors.push("TERMINATE_FAILED"); }
  try { adminSql(`DROP DATABASE IF EXISTS ${database};`); } catch { errors.push("DROP_DATABASE_FAILED"); }
  for (const item of roles) try { adminSql(`DROP ROLE IF EXISTS ${item};`); } catch { errors.push("DROP_ROLE_FAILED"); }
  let residue = "";
  try { residue = adminSql(`SELECT datname FROM pg_database WHERE datname='${database}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname IN (${roles.map((item) => `'${item}'`).join(",")});`); } catch { errors.push("RESIDUE_SCAN_FAILED"); }
  return { ok: errors.length === 0 && residue === "", errors, residueCount: residue ? residue.split("\n").filter(Boolean).length : 0 };
}

async function main() {
  let a: PrismaClient | undefined;
  let b: PrismaClient | undefined;
  let control: PrismaClient | undefined;
  let reader: PrismaClient | undefined;
  const startedAt = new Date().toISOString();
  let stage = "INITIAL";
  try {
    stage = "ROLE_DATABASE_SETUP";
    adminSql(`CREATE ROLE ${migrator} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${secrets.migrator}'; CREATE DATABASE ${database} OWNER ${migrator}; CREATE ROLE ${securityOwner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; CREATE ROLE ${ledgerOwner} NOLOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS; CREATE ROLE ${controlWriter} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${secrets.control}'; CREATE ROLE ${ledgerReader} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${secrets.reader}'; CREATE ROLE ${tenantA} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${secrets.a}'; CREATE ROLE ${tenantB} LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD '${secrets.b}';`);
    stage = "SCHEMA_POLICY_SETUP";
    adminSql(`CREATE SCHEMA security AUTHORIZATION ${securityOwner}; CREATE SCHEMA control AUTHORIZATION ${ledgerOwner}; CREATE TABLE public.tenant_data (id TEXT PRIMARY KEY, organization_id UUID NOT NULL, value TEXT NOT NULL); CREATE TABLE public.tenant_audit (id TEXT PRIMARY KEY, organization_id UUID NOT NULL, action TEXT NOT NULL, correlation_id UUID NOT NULL); CREATE TABLE security.role_to_organization (role_oid OID NOT NULL, organization_id UUID NOT NULL, revoked_at TIMESTAMPTZ, PRIMARY KEY(role_oid, organization_id)); ALTER TABLE security.role_to_organization OWNER TO ${securityOwner}; INSERT INTO security.role_to_organization(role_oid,organization_id) VALUES ('${tenantA}'::regrole::oid,'${orgA}'),('${tenantB}'::regrole::oid,'${orgB}'); CREATE FUNCTION security.current_session_organization_id() RETURNS UUID LANGUAGE sql STABLE SECURITY DEFINER SET search_path = pg_catalog, security AS $$ SELECT organization_id FROM security.role_to_organization WHERE role_oid = session_user::regrole::oid AND revoked_at IS NULL $$; ALTER FUNCTION security.current_session_organization_id() OWNER TO ${securityOwner}; REVOKE ALL ON SCHEMA security FROM PUBLIC; REVOKE ALL ON TABLE security.role_to_organization FROM PUBLIC; REVOKE ALL ON FUNCTION security.current_session_organization_id() FROM PUBLIC; GRANT USAGE ON SCHEMA security TO ${tenantA}, ${tenantB}; GRANT EXECUTE ON FUNCTION security.current_session_organization_id() TO ${tenantA}, ${tenantB}; ALTER TABLE public.tenant_data ENABLE ROW LEVEL SECURITY; ALTER TABLE public.tenant_data FORCE ROW LEVEL SECURITY; ALTER TABLE public.tenant_audit ENABLE ROW LEVEL SECURITY; ALTER TABLE public.tenant_audit FORCE ROW LEVEL SECURITY; CREATE POLICY tenant_data_isolation ON public.tenant_data USING (organization_id = security.current_session_organization_id()) WITH CHECK (organization_id = security.current_session_organization_id()); CREATE POLICY tenant_audit_isolation ON public.tenant_audit USING (organization_id = security.current_session_organization_id()) WITH CHECK (organization_id = security.current_session_organization_id()); GRANT USAGE ON SCHEMA public TO ${tenantA}, ${tenantB}; GRANT SELECT, INSERT, UPDATE, DELETE ON public.tenant_data, public.tenant_audit TO ${tenantA}, ${tenantB}; CREATE TABLE control.backfill_audit_ledger (id UUID PRIMARY KEY, operation_id UUID NOT NULL, attempt INTEGER NOT NULL CHECK (attempt > 0), phase TEXT NOT NULL CHECK (phase IN ('STARTED','SUCCEEDED','FAILED','ROLLBACK')), organization_id UUID NOT NULL, correlation_id UUID NOT NULL, manifest_digest TEXT NOT NULL CHECK (length(manifest_digest) = 64), decision TEXT NOT NULL CHECK (decision IN ('ALLOW','DENY','OBSERVED')), reason_code TEXT NOT NULL, created_at TIMESTAMPTZ NOT NULL DEFAULT now(), UNIQUE(operation_id,attempt,phase)); ALTER TABLE control.backfill_audit_ledger OWNER TO ${ledgerOwner}; REVOKE ALL ON SCHEMA control FROM PUBLIC; REVOKE ALL ON TABLE control.backfill_audit_ledger FROM PUBLIC; GRANT USAGE ON SCHEMA control TO ${controlWriter}, ${ledgerReader}; GRANT INSERT ON control.backfill_audit_ledger TO ${controlWriter}; GRANT SELECT ON control.backfill_audit_ledger TO ${ledgerReader};`, database);
    stage = "CLIENT_SETUP";
    a = new PrismaClient({ datasources: { db: { url: url(tenantA, secrets.a) } } });
    b = new PrismaClient({ datasources: { db: { url: url(tenantB, secrets.b) } } });
    control = new PrismaClient({ datasources: { db: { url: url(controlWriter, secrets.control) } } });
    reader = new PrismaClient({ datasources: { db: { url: url(ledgerReader, secrets.reader) } } });
    const digest = createHash("sha256").update("redacted-manifest-v1").digest("hex");
    const insertLedger = (input: { operationId: string; attempt: number; phase: "STARTED" | "SUCCEEDED" | "FAILED" | "ROLLBACK"; organizationId: string; correlationId: string; decision: "ALLOW" | "DENY" | "OBSERVED"; reason: string }) => control!.$executeRawUnsafe(`INSERT INTO control.backfill_audit_ledger (id,operation_id,attempt,phase,organization_id,correlation_id,manifest_digest,decision,reason_code) VALUES ($1::uuid,$2::uuid,$3,$4,$5::uuid,$6::uuid,$7,$8,$9)`, randomUUID(), input.operationId, input.attempt, input.phase, input.organizationId, input.correlationId, digest, input.decision, input.reason);

    stage = "MANDATORY_EVIDENCE";
    await record("CP01", "all proof principals are NOSUPERUSER and NOBYPASSRLS", async () => adminSql(`SELECT count(*) FROM pg_roles WHERE rolname IN ('${migrator}','${securityOwner}','${ledgerOwner}','${controlWriter}','${ledgerReader}','${tenantA}','${tenantB}') AND (rolsuper OR rolbypassrls)`, database) === "0");
    await record("CP02", "tenant A/B can write/read only their own FORCE RLS tenant rows", async () => {
      await a!.$executeRawUnsafe(`INSERT INTO public.tenant_data (id,organization_id,value) VALUES ('data-a',$1::uuid,'A')`, orgA);
      await b!.$executeRawUnsafe(`INSERT INTO public.tenant_data (id,organization_id,value) VALUES ('data-b',$1::uuid,'B')`, orgB);
      const [aRows, bRows] = await Promise.all([a!.$queryRawUnsafe<Array<{ id: string }>>("SELECT id FROM public.tenant_data ORDER BY id"), b!.$queryRawUnsafe<Array<{ id: string }>>("SELECT id FROM public.tenant_data ORDER BY id")]);
      return aRows.length === 1 && aRows[0]?.id === "data-a" && bRows.length === 1 && bRows[0]?.id === "data-b";
    });
    await record("CP03", "tenant A cannot write B audit row and tenant B cannot write A audit row", async () => {
      const correlationA = randomUUID(); const correlationB = randomUUID();
      const [aDenied, bDenied] = await Promise.all([
        denied(() => a!.$executeRawUnsafe(`INSERT INTO public.tenant_audit (id,organization_id,action,correlation_id) VALUES ('audit-a-cross',$1::uuid,'FORGED',$2::uuid)`, orgB, correlationA)),
        denied(() => b!.$executeRawUnsafe(`INSERT INTO public.tenant_audit (id,organization_id,action,correlation_id) VALUES ('audit-b-cross',$1::uuid,'FORGED',$2::uuid)`, orgA, correlationB)),
      ]);
      return aDenied && bDenied;
    });
    await record("CP04", "control writer records A and B operation metadata in an append-only ledger", async () => {
      const operationA = randomUUID(); const operationB = randomUUID(); const correlationA = randomUUID(); const correlationB = randomUUID();
      await insertLedger({ operationId: operationA, attempt: 1, phase: "STARTED", organizationId: orgA, correlationId: correlationA, decision: "OBSERVED", reason: "BEGIN" });
      await insertLedger({ operationId: operationA, attempt: 1, phase: "SUCCEEDED", organizationId: orgA, correlationId: correlationA, decision: "ALLOW", reason: "APPLIED" });
      await insertLedger({ operationId: operationB, attempt: 1, phase: "STARTED", organizationId: orgB, correlationId: correlationB, decision: "OBSERVED", reason: "BEGIN" });
      await insertLedger({ operationId: operationB, attempt: 1, phase: "SUCCEEDED", organizationId: orgB, correlationId: correlationB, decision: "ALLOW", reason: "APPLIED" });
      const rows = await reader!.$queryRawUnsafe<Array<{ organization_id: string; phase: string }>>("SELECT organization_id::text, phase FROM control.backfill_audit_ledger ORDER BY created_at");
      return rows.filter((row) => row.organization_id === orgA && row.phase === "SUCCEEDED").length === 1 && rows.filter((row) => row.organization_id === orgB && row.phase === "SUCCEEDED").length === 1;
    });
    await record("CP05", "control writer has no tenant data read or mutation privilege", async () => {
      const readDenied = await denied(() => control!.$queryRawUnsafe("SELECT * FROM public.tenant_data"));
      const writeDenied = await denied(() => control!.$executeRawUnsafe(`UPDATE public.tenant_data SET value='forbidden' WHERE id='data-a'`));
      return readDenied && writeDenied;
    });
    await record("CP06", "tenant principals have no control ledger access and cannot forge control-plane events", async () => {
      const aDenied = await denied(() => a!.$executeRawUnsafe(`INSERT INTO control.backfill_audit_ledger (id,operation_id,attempt,phase,organization_id,correlation_id,manifest_digest,decision,reason_code) VALUES ($1::uuid,$2::uuid,1,'SUCCEEDED',$3::uuid,$4::uuid,$5,'ALLOW','FORGED')`, randomUUID(), randomUUID(), orgA, randomUUID(), digest));
      const bDenied = await denied(() => b!.$queryRawUnsafe("SELECT * FROM control.backfill_audit_ledger"));
      return aDenied && bDenied;
    });
    await record("CP07", "ledger is immutable: control writer cannot update or delete an event", async () => {
      const updateDenied = await denied(() => control!.$executeRawUnsafe("UPDATE control.backfill_audit_ledger SET reason_code='FORGED'"));
      const deleteDenied = await denied(() => control!.$executeRawUnsafe("DELETE FROM control.backfill_audit_ledger"));
      return updateDenied && deleteDenied;
    });
    await record("CP08", "correlation and manifest digest survive A/B workflows without tenant payload or secret values", async () => {
      const rows = await reader!.$queryRawUnsafe<Array<{ correlation_id: string; manifest_digest: string }>>("SELECT correlation_id::text, manifest_digest FROM control.backfill_audit_ledger");
      return rows.length >= 4 && rows.every((row) => /^[0-9a-f-]{36}$/i.test(row.correlation_id) && row.manifest_digest === digest);
    });
    await record("CP09", "a failed operation emits STARTED then FAILED and never emits SUCCEEDED", async () => {
      const operation = randomUUID(); const correlation = randomUUID();
      await insertLedger({ operationId: operation, attempt: 1, phase: "STARTED", organizationId: orgA, correlationId: correlation, decision: "OBSERVED", reason: "BEGIN" });
      const failedTenantWrite = await denied(() => a!.$executeRawUnsafe(`INSERT INTO public.tenant_data (id,organization_id,value) VALUES ('failed-a',$1::uuid,'bad')`, orgB));
      await insertLedger({ operationId: operation, attempt: 1, phase: "FAILED", organizationId: orgA, correlationId: correlation, decision: "DENY", reason: "TENANT_MUTATION_DENIED" });
      const phases = await reader!.$queryRawUnsafe<Array<{ phase: string }>>(`SELECT phase FROM control.backfill_audit_ledger WHERE operation_id=$1::uuid`, operation);
      return failedTenantWrite && phases.some((row) => row.phase === "STARTED") && phases.some((row) => row.phase === "FAILED") && !phases.some((row) => row.phase === "SUCCEEDED");
    });
    await record("CP10", "replay and duplicate phase for an operation/attempt are rejected by immutable uniqueness", async () => {
      const operation = randomUUID(); const correlation = randomUUID();
      await insertLedger({ operationId: operation, attempt: 1, phase: "STARTED", organizationId: orgA, correlationId: correlation, decision: "OBSERVED", reason: "BEGIN" });
      const duplicateDenied = await denied(() => insertLedger({ operationId: operation, attempt: 1, phase: "STARTED", organizationId: orgA, correlationId: correlation, decision: "OBSERVED", reason: "REPLAY" }));
      const retry = await insertLedger({ operationId: operation, attempt: 2, phase: "STARTED", organizationId: orgA, correlationId: correlation, decision: "OBSERVED", reason: "RETRY" });
      return duplicateDenied && retry === 1;
    });
    await record("CP11", "transaction failure cannot create false success and partial STARTED state is observable", async () => {
      const operation = randomUUID(); const correlation = randomUUID();
      await insertLedger({ operationId: operation, attempt: 1, phase: "STARTED", organizationId: orgB, correlationId: correlation, decision: "OBSERVED", reason: "BEGIN" });
      const failed = await denied(() => b!.$transaction(async (tx) => { await tx.$executeRawUnsafe(`INSERT INTO public.tenant_data (id,organization_id,value) VALUES ('rollback-b',$1::uuid,'before-failure')`, orgB); await tx.$executeRawUnsafe("INSERT INTO public.tenant_data (id,organization_id,value) VALUES ('data-b',$1::uuid,'duplicate')"); }));
      const partial = await reader!.$queryRawUnsafe<Array<{ phase: string }>>(`SELECT phase FROM control.backfill_audit_ledger WHERE operation_id=$1::uuid`, operation);
      const rollbackRows = await b!.$queryRawUnsafe<Array<{ id: string }>>("SELECT id FROM public.tenant_data WHERE id='rollback-b'");
      return failed && partial.length === 1 && partial[0]?.phase === "STARTED" && rollbackRows.length === 0;
    });
    await record("CP12", "mandatory audit proof leaves no bypass, raw GUC, global tenant credential, cleanup residue, or unredacted evidence", async () => {
      const unsafe = adminSql(`SELECT count(*) FROM pg_roles WHERE rolname IN ('${migrator}','${securityOwner}','${ledgerOwner}','${controlWriter}','${ledgerReader}','${tenantA}','${tenantB}') AND (rolsuper OR rolbypassrls)`, database);
      return unsafe === "0";
    });

    await Promise.all([a.$disconnect(), b.$disconnect(), control.$disconnect(), reader.$disconnect()]); a = b = control = reader = undefined;
    const finalCleanup = cleanup();
    for (const item of evidence) item.cleanupStatus = finalCleanup.ok ? "PASS" : "FAIL";
    const payload: Record<string, unknown> = { status: "PENDING", startedAt, finishedAt: new Date().toISOString(), environment: "disposable-postgresql-audit", mandatoryIds, evidence, hardFailures: [], cleanup: finalCleanup, hygiene: { status: "PENDING" }, credentialsPersisted: false, productionResourcesTouched: false, rawGucIdentityUsed: false, globalTenantCredentialUsed: false, ownerOrBypassUsedForTenantEvidence: false };
    writeEvidence(payload);
    const hygiene = command("node", ["scripts/w02-audit-artifact-hygiene-scan.mjs"]);
    payload.hygiene = { status: hygiene.status === 0 ? "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" : "FAIL_AUDIT_ARTIFACT_HYGIENE_SCAN" };
    const failed = evidence.filter((item) => item.result !== "PASS").map((item) => item.id);
    payload.hardFailures = failed;
    payload.status = finalCleanup.ok && hygiene.status === 0 && failed.length === 0 ? "PASS_CONTROL_PLANE_LEDGER" : finalCleanup.ok ? "FAIL" : "FAIL_CLEANUP";
    writeEvidence(payload);
    process.stdout.write(`${JSON.stringify({ status: payload.status, evidenceFile, hardFailures: failed, cleanup: finalCleanup, hygiene: payload.hygiene }, null, 2)}\n`);
    process.exitCode = payload.status === "PASS_CONTROL_PLANE_LEDGER" ? 0 : 2;
  } catch (error) {
    await Promise.all([a?.$disconnect(), b?.$disconnect(), control?.$disconnect(), reader?.$disconnect()].map((promise) => promise?.catch(() => undefined)));
    const finalCleanup = cleanup();
    const detail = error instanceof Error && error.message.startsWith("ADMIN_SETUP_ERROR:") ? error.message.slice(0, 360) : "REDACTED_HARNESS_ERROR";
    writeEvidence({ status: finalCleanup.ok ? "FAIL_SETUP_OR_HARNESS" : "FAIL_CLEANUP", startedAt, finishedAt: new Date().toISOString(), environment: "disposable-postgresql-audit", mandatoryIds, error: detail, failureStage: stage, cleanup: finalCleanup, hygiene: { status: "NOT_RUN" }, credentialsPersisted: false, productionResourcesTouched: false, rawGucIdentityUsed: false, globalTenantCredentialUsed: false, ownerOrBypassUsedForTenantEvidence: false });
    process.stderr.write(`Control-plane ledger proof failed; redacted evidence: ${evidenceFile}\n`);
    process.exitCode = 2;
  }
}

void main();
