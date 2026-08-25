import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import process from "node:process";

const status = {
  closed: "CLOSED_LOCAL",
  external: "BLOCKED_EXTERNAL_INPUT_REQUIRED",
  implementation: "BLOCKED_IMPLEMENTATION_REQUIRED",
  notApplicable: "NOT_APPLICABLE",
};

function present(name) {
  return Boolean(process.env[name]?.trim());
}

function validUrl(name) {
  if (!present(name)) return false;
  try {
    const url = new URL(process.env[name]);
    return url.protocol === "https:";
  } catch {
    return false;
  }
}

async function rootOnlyJsonRequest(name, requiredKeys) {
  const file = process.env[name];
  if (!file) return { ready: false, reason: `${name} is not configured.` };
  try {
    const details = await stat(file);
    if (!details.isFile() || (details.mode & 0o077) !== 0) return { ready: false, reason: `${name} must reference a root-only file.` };
    await access(file, constants.R_OK);
    const value = JSON.parse(await readFile(file, "utf8"));
    if (!requiredKeys.every((key) => typeof value[key] === "string" && value[key].trim())) {
      return { ready: false, reason: `${name} does not satisfy its non-secret request schema.` };
    }
    return { ready: true, reason: "Root-only non-secret request schema is valid." };
  } catch {
    return { ready: false, reason: `${name} cannot be validated without exposing its contents.` };
  }
}

const storageNames = ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET", "ASAS_PREFLIGHT_STORAGE_PROBE_URL"];
const storageMissing = storageNames.filter((name) => !present(name));
const storageUrlValid = validUrl("S3_ENDPOINT") && validUrl("ASAS_PREFLIGHT_STORAGE_PROBE_URL");
const bootstrapAdmin = await rootOnlyJsonRequest("ASAS_BOOTSTRAP_ADMIN_REQUEST_FILE", ["organizationName", "adminName", "adminEmail", "approvalReference", "passwordFile"]);
const licenseRequest = await rootOnlyJsonRequest("ASAS_LICENSE_ACTIVATION_REQUEST_FILE", ["certificateFile", "keyringFile", "approvalReference"]);
const schedulerRequest = await rootOnlyJsonRequest("ASAS_DOMAIN_SCHEDULER_MANIFEST_PATH", ["owner", "approvalReference", "jobCatalogVersion"]);
const goNoGo = await rootOnlyJsonRequest("ASAS_GO_NO_GO_APPROVAL_FILE", ["owner", "maintenanceWindowUtc", "approvalReference"]);

const checks = [
  {
    gate: "storage",
    status: storageMissing.length ? status.external : status.implementation,
    summary: storageMissing.length
      ? "Storage configuration is incomplete."
      : storageUrlValid
        ? "Storage inputs are present, but the tenant storage runtime adapter remains quarantined until an approved provider implementation is installed."
        : "Storage URLs must be HTTPS before an approved provider adapter can be probed.",
    requiredInputs: storageMissing,
    implementationState: "TENANT_ARTIFACT_PROVIDER_UNCONFIGURED",
  },
  {
    gate: "auth_bootstrap_administrator",
    status: bootstrapAdmin.ready ? status.implementation : status.external,
    summary: bootstrapAdmin.ready
      ? "The approved bootstrap request is valid, but no production bootstrap execution is performed by this preflight."
      : bootstrapAdmin.reason,
    requiredInputs: bootstrapAdmin.ready ? [] : ["ASAS_BOOTSTRAP_ADMIN_REQUEST_FILE"],
    security: present("AUTH_SECRET") && process.env.AUTH_SECRET.length >= 32 ? status.closed : status.external,
  },
  {
    gate: "identity_provider",
    status: status.implementation,
    summary: "IdP security contracts fail closed, but no production OIDC/SAML adapter, issuer metadata, or approved claims mapping is installed.",
    requiredInputs: ["OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET_FILE", "OIDC_REDIRECT_URI", "OIDC_CLAIMS_MAPPING_APPROVAL"],
  },
  {
    gate: "mail",
    status: status.implementation,
    summary: "No production mail transport adapter or read-only provider health contract is installed.",
    requiredInputs: ["MAIL_PROVIDER", "MAIL_FROM_ADDRESS", "MAIL_FROM_NAME", "MAIL_CREDENTIAL_FILE", "MAIL_SANDBOX_RECIPIENT", "MAIL_OWNER_APPROVAL"],
  },
  {
    gate: "integrations_payments",
    status: status.implementation,
    summary: "The payment endpoint is a placeholder and the webhook does not persist tenant-bound payment state; credentials alone cannot close this gate.",
    requiredInputs: ["PAYMENTS_LAUNCH_SCOPE_DECISION", "PAYMENT_PROVIDER_CONTRACT", "PAYMENT_API_KEY_FILE", "PAYMENT_SECRET_FILE", "PAYMENT_WEBHOOK_RECONCILIATION_APPROVAL"],
  },
  {
    gate: "license_activation",
    status: licenseRequest.ready ? status.implementation : status.external,
    summary: licenseRequest.ready
      ? "License request schema is valid, but runtime certificate loading and activation enforcement are not installed."
      : licenseRequest.reason,
    requiredInputs: licenseRequest.ready ? [] : ["ASAS_LICENSE_ACTIVATION_REQUEST_FILE"],
  },
  {
    gate: "domain_scheduler",
    status: schedulerRequest.ready ? status.implementation : status.external,
    summary: schedulerRequest.ready
      ? "Scheduler manifest schema is valid, but no domain scheduler adapter is enabled."
      : schedulerRequest.reason,
    requiredInputs: schedulerRequest.ready ? [] : ["ASAS_DOMAIN_SCHEDULER_MANIFEST_PATH"],
  },
  {
    gate: "go_no_go_owner_window",
    status: goNoGo.ready ? status.closed : status.external,
    summary: goNoGo.ready ? "Approved owner/window request is present; this preflight does not authorize deployment." : goNoGo.reason,
    requiredInputs: goNoGo.ready ? [] : ["ASAS_GO_NO_GO_APPROVAL_FILE"],
  },
];

const output = {
  status: checks.every((check) => check.status === status.closed || check.status === status.notApplicable) ? "READY_FOR_PRODUCTION_SWITCH" : "FINAL_PRODUCTION_GO_NO_GO_REVIEW",
  productionTrafficEnabled: false,
  dnsChanged: false,
  publicVhostEnabled: false,
  checks,
};

console.log(JSON.stringify(output));
process.exitCode = output.status === "READY_FOR_PRODUCTION_SWITCH" ? 0 : 2;
