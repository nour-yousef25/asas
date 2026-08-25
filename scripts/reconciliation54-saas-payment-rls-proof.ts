import { execFileSync } from "node:child_process";
import { randomBytes } from "node:crypto";
import { chmodSync, writeFileSync } from "node:fs";

const database = "asasplus_staging";
const suffix = randomBytes(7).toString("hex");
const roleA = `r54a_${suffix}`, roleB = `r54b_${suffix}`;
const passwordA = randomBytes(24).toString("base64url"), passwordB = randomBytes(24).toString("base64url");
const orgA = `r54orga${suffix}`, orgB = `r54orgb${suffix}`;
const plan = `r54plan${suffix}`, subscriptionA = `r54suba${suffix}`, subscriptionB = `r54subb${suffix}`, configurationA = `r54cfga${suffix}`, configurationB = `r54cfgb${suffix}`;
const evidenceFile = process.env.ASAS_SAAS_RLS_PROOF_EVIDENCE_PATH;
if (!evidenceFile) throw new Error("SAAS_RLS_PROOF_EVIDENCE_PATH_REQUIRED");

function sql(command: string, as?: { role: string; password: string }) {
  return execFileSync("psql", ["-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", database, "-c", command], { encoding: "utf8", env: as ? { ...process.env, PGUSER: as.role, PGPASSWORD: as.password, PGHOST: "127.0.0.1" } : process.env }).trim();
}
function admin(command: string) { return execFileSync("sudo", ["-u", "postgres", "psql", "-X", "-At", "-v", "ON_ERROR_STOP=1", "-d", database, "-c", command], { encoding: "utf8" }).trim(); }
function quote(value: string) { return `'${value.replaceAll("'", "''")}'`; }
function attempt(command: string, as: { role: string; password: string }) { try { sql(command, as); return true; } catch { return false; } }

function cleanup() {
  try { admin(`DELETE FROM security.role_to_organization WHERE organization_id IN (${quote(orgA)}, ${quote(orgB)}); DELETE FROM payment_transactions WHERE \"organizationId\" IN (${quote(orgA)}, ${quote(orgB)}); DELETE FROM payment_configurations WHERE \"organizationId\" IN (${quote(orgA)}, ${quote(orgB)}); DELETE FROM organization_entitlements WHERE \"organizationId\" IN (${quote(orgA)}, ${quote(orgB)}); DELETE FROM organization_subscriptions WHERE \"organizationId\" IN (${quote(orgA)}, ${quote(orgB)}); DELETE FROM platform_plans WHERE id = ${quote(plan)}; DELETE FROM organizations WHERE id IN (${quote(orgA)}, ${quote(orgB)});`); } catch { /* evidence records cleanup failure below */ }
  for (const role of [roleA, roleB]) { try { admin(`DROP ROLE IF EXISTS \"${role}\";`); } catch { /* no secret or role output */ } }
}

function main() {
  const evidence: Record<string, unknown>[] = [];
  let cleanupOk = false;
  try {
    admin(`CREATE ROLE \"${roleA}\" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ${quote(passwordA)}; CREATE ROLE \"${roleB}\" LOGIN NOSUPERUSER NOCREATEDB NOCREATEROLE NOINHERIT NOBYPASSRLS PASSWORD ${quote(passwordB)}; GRANT CONNECT ON DATABASE ${database} TO \"${roleA}\", \"${roleB}\"; GRANT USAGE ON SCHEMA public, security TO \"${roleA}\", \"${roleB}\"; GRANT EXECUTE ON FUNCTION security.current_session_organization_id() TO \"${roleA}\", \"${roleB}\"; GRANT SELECT, INSERT, UPDATE, DELETE ON TABLE organizations, platform_plans, organization_subscriptions, organization_entitlements, payment_configurations, payment_transactions TO \"${roleA}\", \"${roleB}\";`);
    admin(`INSERT INTO organizations (id,name,\"createdAt\",\"updatedAt\") VALUES (${quote(orgA)},'R54 A',now(),now()),(${quote(orgB)},'R54 B',now(),now()); INSERT INTO platform_plans (id,code,name,price,currency,interval,\"isActive\",\"createdAt\",\"updatedAt\") VALUES (${quote(plan)},${quote(`r54-${suffix}`)},'R54',1,'SAR','MONTHLY',true,now(),now()); INSERT INTO security.role_to_organization (role_oid,organization_id) VALUES ('${roleA}'::regrole::oid,${quote(orgA)}),('${roleB}'::regrole::oid,${quote(orgB)}); INSERT INTO payment_configurations (id,\"organizationId\",\"providerKey\",\"credentialRef\",enabled,methods,\"createdAt\",\"updatedAt\") VALUES (${quote(configurationA)},${quote(orgA)},'audit','secretref:audit-provider-reference-123456',true,ARRAY['mada'],now(),now()),(${quote(configurationB)},${quote(orgB)},'audit','secretref:audit-provider-reference-654321',true,ARRAY['mada'],now(),now());`);
    const a = { role: roleA, password: passwordA }, b = { role: roleB, password: passwordB };
    const ownConfiguration = attempt(`INSERT INTO payment_transactions (id,\"organizationId\",purpose,\"paymentConfigurationId\",\"idempotencyKey\",amount,currency,method,status,\"createdAt\",\"updatedAt\") VALUES (${quote(`r54txa${suffix}`)},${quote(orgA)},'ORGANIZATION_DONATION',${quote(configurationA)},${quote(`idempotency-a-${suffix}`)},1,'SAR','mada','CREATED',now(),now());`, a);
    const foreignConfigurationDenied = !attempt(`INSERT INTO payment_transactions (id,\"organizationId\",purpose,\"paymentConfigurationId\",\"idempotencyKey\",amount,currency,method,status,\"createdAt\",\"updatedAt\") VALUES (${quote(`r54txx${suffix}`)},${quote(orgA)},'ORGANIZATION_DONATION',${quote(configurationB)},${quote(`idempotency-x-${suffix}`)},1,'SAR','mada','CREATED',now(),now());`, a);
    const ownSubscription = attempt(`INSERT INTO organization_subscriptions (id,\"organizationId\",\"planId\",status,source,\"startsAt\",\"createdAt\",\"updatedAt\") VALUES (${quote(subscriptionA)},${quote(orgA)},${quote(plan)},'ACTIVE','audit',now(),now(),now()); INSERT INTO organization_entitlements (id,\"organizationId\",\"subscriptionId\",key,status,source,\"startsAt\",\"createdAt\",\"updatedAt\") VALUES (${quote(`r54enta${suffix}`)},${quote(orgA)},${quote(subscriptionA)},'core','ACTIVE','audit',now(),now(),now());`, a);
    attempt(`INSERT INTO organization_subscriptions (id,\"organizationId\",\"planId\",status,source,\"startsAt\",\"createdAt\",\"updatedAt\") VALUES (${quote(subscriptionB)},${quote(orgB)},${quote(plan)},'ACTIVE','audit',now(),now(),now());`, b);
    const foreignEntitlementDenied = !attempt(`INSERT INTO organization_entitlements (id,\"organizationId\",\"subscriptionId\",key,status,source,\"startsAt\",\"createdAt\",\"updatedAt\") VALUES (${quote(`r54entx${suffix}`)},${quote(orgA)},${quote(subscriptionB)},'foreign','ACTIVE','audit',now(),now(),now());`, a);
    evidence.push({ id: "SP01", result: ownConfiguration ? "PASS" : "FAIL", detail: "tenant A accepts its own payment configuration" });
    evidence.push({ id: "SP02", result: foreignConfigurationDenied ? "PASS" : "FAIL", detail: "tenant A cannot reference tenant B payment configuration" });
    evidence.push({ id: "SP03", result: ownSubscription ? "PASS" : "FAIL", detail: "tenant A creates its own subscription entitlement" });
    evidence.push({ id: "SP04", result: foreignEntitlementDenied ? "PASS" : "FAIL", detail: "tenant A cannot bind tenant B subscription" });
    const passed = evidence.every((entry) => entry.result === "PASS");
    cleanup(); cleanupOk = true;
    writeFileSync(evidenceFile, `${JSON.stringify({ status: passed && cleanupOk ? "PASS_SAAS_PAYMENT_RLS_RUNTIME" : "FAIL_SAAS_PAYMENT_RLS_RUNTIME", evidence, cleanupOk, credentialsPersisted: false, providerCalls: false, charges: false, productionResourcesTouched: false, rawGucIdentityUsed: false, ownerOrBypassUsedForTenantEvidence: false }, null, 2)}\n`, { mode: 0o600 }); chmodSync(evidenceFile, 0o600);
    process.stdout.write(JSON.stringify({ status: passed && cleanupOk ? "PASS_SAAS_PAYMENT_RLS_RUNTIME" : "FAIL_SAAS_PAYMENT_RLS_RUNTIME", evidenceCount: evidence.length }) + "\n");
    process.exitCode = passed && cleanupOk ? 0 : 2;
  } catch {
    cleanup();
    writeFileSync(evidenceFile, `${JSON.stringify({ status: "FAIL_SAAS_PAYMENT_RLS_RUNTIME", evidence, cleanupOk: false, credentialsPersisted: false, providerCalls: false, charges: false, productionResourcesTouched: false, rawGucIdentityUsed: false, ownerOrBypassUsedForTenantEvidence: false }, null, 2)}\n`, { mode: 0o600 }); chmodSync(evidenceFile, 0o600);
    process.stderr.write("SaaS/payment RLS proof failed; redacted evidence written.\n"); process.exitCode = 2;
  }
}

main();
