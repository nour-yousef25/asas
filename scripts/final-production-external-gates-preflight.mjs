import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import process from "node:process";

const status = { closed: "CLOSED", implementable: "IMPLEMENTABLE_NOW", external: "EXTERNAL_INPUT_REQUIRED", cutover: "PRODUCTION_CUTOVER_ONLY", notApplicable: "NOT_APPLICABLE", implementation: "BLOCKED_IMPLEMENTATION" };
function present(name) { return Boolean(process.env[name]?.trim()); }
async function rootOnlyJsonRequest(name, requiredKeys) {
  const file = process.env[name];
  if (!file) return { ready: false, reason: `${name} is not configured.` };
  try {
    const details = await stat(file);
    if (!details.isFile() || details.uid !== 0 || (details.mode & 0o077) !== 0) return { ready: false, reason: `${name} must reference a root-owned 0600/0640 request file.` };
    await access(file, constants.R_OK);
    const value = JSON.parse(await readFile(file, "utf8"));
    if (!requiredKeys.every((key) => typeof value[key] === "string" && value[key].trim())) return { ready: false, reason: `${name} does not satisfy its non-secret request schema.` };
    return { ready: true, reason: "Root-only non-secret request schema is valid." };
  } catch { return { ready: false, reason: `${name} cannot be validated without exposing its contents.` }; }
}
async function rootOnlyEvidence(name, expectedStatus) {
  const file = process.env[name];
  if (!file) return { ready: false, reason: `${name} is not configured.` };
  try {
    const details = await stat(file);
    if (!details.isFile() || details.uid !== 0 || (details.mode & 0o077) !== 0) return { ready: false, reason: `${name} must reference root-owned 0600 evidence.` };
    const value = JSON.parse(await readFile(file, "utf8"));
    return value.status === expectedStatus && value.environment === "production" && value.credentialsPersisted === false && value.cleanupOk !== false
      ? { ready: true, reason: "Root-only production evidence is valid." }
      : { ready: false, reason: `${name} does not prove ${expectedStatus} with production environment and cleanup evidence.` };
  } catch { return { ready: false, reason: `${name} cannot be validated without exposing its contents.` }; }
}
async function rootOnlyBootstrapClosureEvidence(name) {
  const file = process.env[name];
  if (!file) return { ready: false, reason: `${name} is not configured.` };
  try {
    const details = await stat(file);
    if (!details.isFile() || details.uid !== 0 || (details.mode & 0o077) !== 0) return { ready: false, reason: `${name} must reference root-owned 0600 evidence.` };
    const value = JSON.parse(await readFile(file, "utf8"));
    const keys = Object.keys(value).sort().join(",");
    return value.schema === "ASAS_BOOTSTRAP_SUPER_ADMIN_AUDIT_V1"
      && value.outcome === "PROVISIONED"
      && typeof value.accountFingerprint === "string"
      && typeof value.emailFingerprint === "string"
      && keys === "accountFingerprint,emailFingerprint,outcome,schema"
      ? { ready: true, reason: "Root-only redacted Bootstrap closure evidence is valid." }
      : { ready: false, reason: `${name} does not prove a redacted Bootstrap closure.` };
  } catch { return { ready: false, reason: `${name} cannot be validated without exposing its contents.` }; }
}
function externalOrClosed(input) { return input.ready ? { status: status.closed, requiredInputs: [], summary: input.closedSummary } : { status: status.external, requiredInputs: input.requiredInputs, summary: input.reason }; }

const bootstrapClosure = await rootOnlyBootstrapClosureEvidence("ASAS_BOOTSTRAP_AUTH_CLOSURE_EVIDENCE_FILE");
const mail = await rootOnlyJsonRequest("ASAS_MAIL_PRODUCTION_REQUEST_FILE", ["providerKey", "fromAddress", "fromName", "approvalReference"]);
const payment = await rootOnlyJsonRequest("ASAS_PAYMENT_PRODUCTION_REQUEST_FILE", ["providerKey", "webhookUrl", "approvalReference"]);
const scheduler = await rootOnlyJsonRequest("ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE", ["owner", "approvalReference", "catalogueVersion"]);
const goNoGo = await rootOnlyJsonRequest("ASAS_GO_NO_GO_APPROVAL_FILE", ["owner", "maintenanceWindowUtc", "approvalReference"]);
const localStorageEvidence = await rootOnlyEvidence("ASAS_LOCAL_STORAGE_PROOF_EVIDENCE_FILE", "PASS_LOCAL_VPS_STORAGE_RUNTIME");
const saasEvidence = await rootOnlyEvidence("ASAS_SAAS_RLS_PROOF_EVIDENCE_FILE", "PASS_SAAS_PAYMENT_RLS_RUNTIME");

const checks = [
  (() => {
    if (process.env.ASAS_STORAGE_PROVIDER !== "LOCAL_VPS") return { gate: "storage_local_vps", status: status.implementable, internalImplementation: status.closed, requiredInputs: ["ASAS_STORAGE_PROVIDER=LOCAL_VPS", "ASAS_LOCAL_STORAGE_ROOT", "ASAS_LOCAL_STORAGE_DELIVERY_SECRET"], summary: "Local VPS provider is implemented but is not selected/configured on the runtime yet." };
    if (!present("ASAS_LOCAL_STORAGE_ROOT") || !present("ASAS_LOCAL_STORAGE_DELIVERY_SECRET")) return { gate: "storage_local_vps", status: status.implementable, internalImplementation: status.closed, requiredInputs: ["ASAS_LOCAL_STORAGE_ROOT", "ASAS_LOCAL_STORAGE_DELIVERY_SECRET"], summary: "Local VPS adapter is selected but root-owned storage path or server-only delivery secret is absent; neither is an external S3 provider input." };
    if (!localStorageEvidence.ready) return { gate: "storage_local_vps", status: status.implementable, internalImplementation: status.closed, requiredInputs: ["ASAS_LOCAL_STORAGE_PROOF_EVIDENCE_FILE"], summary: localStorageEvidence.reason };
    return { gate: "storage_local_vps", status: status.closed, internalImplementation: status.closed, requiredInputs: [], summary: "Local VPS tenant-private storage configuration and cleaned runtime A/B proof are present; no S3 provider is used." };
  })(),
  {
    gate: "bootstrap_authentication",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: bootstrapClosure.ready && present("AUTH_SECRET"),
      requiredInputs: ["ASAS_BOOTSTRAP_AUTH_CLOSURE_EVIDENCE_FILE", "AUTH_SECRET"],
      reason: bootstrapClosure.ready ? "Bootstrap closure evidence is valid; the server auth secret is absent." : bootstrapClosure.reason,
      closedSummary: "Redacted Bootstrap closure evidence and credential-auth secret are present; this preflight does not provision or rotate an administrator.",
    }),
  },
  { gate: "identity_provider", status: status.notApplicable, internalImplementation: status.closed, requiredInputs: [], summary: "IdP is a provider-neutral extension, not a dependency for the Bootstrap launch mode." },
  {
    gate: "temporary_smtp_mail",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: mail.ready && present("ASAS_MAIL_TRANSPORT_CONFIG_PATH") && process.env.ASAS_MAIL_DELIVERY_ENABLED === "true",
      requiredInputs: ["ASAS_MAIL_PRODUCTION_REQUEST_FILE", "ASAS_MAIL_TRANSPORT_CONFIG_PATH", "ASAS_MAIL_DELIVERY_ENABLED=true"],
      reason: mail.ready ? "SMTP abstraction is installed; schoolscreen.sa SMTP configuration and an explicit delivery switch are still required." : mail.reason,
      closedSummary: "Approved SMTP request/config and explicit delivery switch are present; this preflight sends no email.",
    }),
  },
  {
    gate: "payments_mada_required",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: process.env.ASAS_PAYMENTS_LAUNCH_SCOPE === "REQUIRED" && payment.ready && present("PAYMENT_PROVIDER_CONFIG_FILE") && present("PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE"),
      requiredInputs: ["ASAS_PAYMENTS_LAUNCH_SCOPE=REQUIRED", "ASAS_PAYMENT_PRODUCTION_REQUEST_FILE", "PAYMENT_PROVIDER_CONFIG_FILE", "PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE"],
      reason: payment.ready ? "Platform billing/donation ledger contracts are installed; a Mada-compatible provider configuration, webhook secret reference and UAT approval are still required." : "Payments are required at launch, but provider request/scope/ledger approval is absent.",
      closedSummary: "Required payment provider/ledger request is present; this preflight does not charge or contact a gateway.",
    }),
  },
  (() => saasEvidence.ready
    ? { gate: "saas_entitlements", status: status.closed, internalImplementation: status.closed, requiredInputs: [], summary: "SaaS Plan/Subscription/Entitlement migration and cleaned tenant RLS runtime proof are present; certificate activation is not a SaaS launch gate." }
    : { gate: "saas_entitlements", status: status.implementable, internalImplementation: status.closed, requiredInputs: ["ASAS_SAAS_RLS_PROOF_EVIDENCE_FILE"], summary: saasEvidence.reason })(),
  {
    gate: "domain_scheduler",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: scheduler.ready && present("ASAS_DOMAIN_SCHEDULER_CATALOGUE_PATH") && present("ASAS_SCHEDULER_HEARTBEAT_PATH") && present("ASAS_SCHEDULER_MAX_LAG_SECONDS"),
      requiredInputs: ["ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE", "ASAS_DOMAIN_SCHEDULER_CATALOGUE_PATH", "ASAS_SCHEDULER_HEARTBEAT_PATH", "ASAS_SCHEDULER_MAX_LAG_SECONDS"],
      reason: scheduler.ready ? "Catalogue dry-run/guard/heartbeat contracts are installed; owner-approved catalogue and runtime heartbeat configuration are still required." : scheduler.reason,
      closedSummary: "Scheduler approval and heartbeat configuration are present; this preflight executes no job.",
    }),
  },
  { gate: "go_no_go_owner_window", internalImplementation: status.notApplicable, ...externalOrClosed({ ready: goNoGo.ready, requiredInputs: ["ASAS_GO_NO_GO_APPROVAL_FILE"], reason: goNoGo.reason, closedSummary: "Owner/window approval is present; this preflight never authorizes deployment." }) },
  { gate: "dns_public_vhost_traffic", status: status.cutover, internalImplementation: status.closed, requiredInputs: ["Explicit phrase: انشر على asasplus.shop الآن"], summary: "DNS/public vhost/traffic are intentionally out of scope until a future Go decision." },
];

const readyStatuses = new Set([status.closed, status.notApplicable]);
const output = { status: checks.every((check) => readyStatuses.has(check.status)) ? "READY_FOR_PRODUCTION_SWITCH" : "FINAL_PRODUCTION_GO_NO_GO_REVIEW", productionTrafficEnabled: false, dnsChanged: false, publicVhostEnabled: false, checks };
console.log(JSON.stringify(output));
process.exitCode = output.status === "READY_FOR_PRODUCTION_SWITCH" ? 0 : 2;
