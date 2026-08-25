import { access, readFile, stat } from "node:fs/promises";
import { constants } from "node:fs";
import process from "node:process";

const status = {
  closed: "CLOSED_INTERNAL_IMPLEMENTATION",
  external: "EXTERNAL_INPUT_REQUIRED",
  excluded: "EXPLICITLY_EXCLUDED",
  notApplicable: "NOT_APPLICABLE",
  implementation: "BLOCKED_IMPLEMENTATION",
};

function present(name) { return Boolean(process.env[name]?.trim()); }
function validHttps(name) {
  if (!present(name)) return false;
  try { return new URL(process.env[name]).protocol === "https:"; } catch { return false; }
}
function readableDirectoryPair(left, right) { return present(left) && present(right); }

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

function externalOrClosed(input) {
  return input.ready ? { status: status.closed, requiredInputs: [], summary: input.closedSummary } : { status: status.external, requiredInputs: input.requiredInputs, summary: input.reason };
}

const storageProbe = await rootOnlyJsonRequest("ASAS_STORAGE_AUDIT_PROBE_REQUEST_FILE", ["organizationId", "artifactId", "objectKey", "approvalReference"]);
const bootstrapAdmin = await rootOnlyJsonRequest("ASAS_BOOTSTRAP_ADMIN_REQUEST_FILE", ["requestId", "organizationId", "email", "approvalReference"]);
const bootstrapCompletion = await rootOnlyJsonRequest("ASAS_BOOTSTRAP_ADMIN_COMPLETION_EVIDENCE_FILE", ["requestId", "organizationId", "administratorId", "verificationReference"]);
const idpRequest = await rootOnlyJsonRequest("ASAS_IDP_PRODUCTION_REQUEST_FILE", ["providerKey", "issuer", "redirectUri", "claimsMappingApproval"]);
const mailRequest = await rootOnlyJsonRequest("ASAS_MAIL_PRODUCTION_REQUEST_FILE", ["providerKey", "fromAddress", "fromName", "approvalReference"]);
const paymentExclusion = await rootOnlyJsonRequest("ASAS_PAYMENT_EXCLUSION_APPROVAL_FILE", ["scope", "owner", "approvalReference"]);
const paymentRequest = await rootOnlyJsonRequest("ASAS_PAYMENT_PRODUCTION_REQUEST_FILE", ["providerKey", "webhookUrl", "approvalReference"]);
const licenseRequest = await rootOnlyJsonRequest("ASAS_LICENSE_ACTIVATION_REQUEST_FILE", ["certificateFile", "keyringFile", "revocationFile", "instanceId", "approvalReference"]);
const schedulerRequest = await rootOnlyJsonRequest("ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE", ["owner", "approvalReference", "catalogueVersion"]);
const goNoGo = await rootOnlyJsonRequest("ASAS_GO_NO_GO_APPROVAL_FILE", ["owner", "maintenanceWindowUtc", "approvalReference"]);
const authLaunchMode = process.env.ASAS_AUTH_LAUNCH_MODE;
const paymentsScope = process.env.ASAS_PAYMENTS_LAUNCH_SCOPE;

const checks = [
  {
    gate: "storage",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: readableDirectoryPair("TENANT_STORAGE_REFERENCE_DIRECTORY", "TENANT_STORAGE_CREDENTIAL_DIRECTORY") && storageProbe.ready,
      requiredInputs: ["TENANT_STORAGE_REFERENCE_DIRECTORY", "TENANT_STORAGE_CREDENTIAL_DIRECTORY", "ASAS_STORAGE_AUDIT_PROBE_REQUEST_FILE"],
      reason: "Tenant S3 adapter is installed; it requires per-tenant root-only secret-reference and credential directories plus an approved read-only audit probe request.",
      closedSummary: "Tenant S3 adapter, key isolation and approved storage audit probe request are present; provider probing remains a separate, non-secret execution step.",
    }),
  },
  (() => {
    if (authLaunchMode === "IDP") return { gate: "auth_bootstrap_administrator", status: status.notApplicable, internalImplementation: status.closed, requiredInputs: [], summary: "Owner selected IdP launch mode; bootstrap-admin remains audit-only and is not a production authentication path." };
    return {
      gate: "auth_bootstrap_administrator",
      internalImplementation: status.closed,
      ...externalOrClosed({
        ready: authLaunchMode === "BOOTSTRAP" && bootstrapAdmin.ready && bootstrapCompletion.ready && present("AUTH_SECRET") && process.env.AUTH_SECRET.length >= 32,
        requiredInputs: ["ASAS_AUTH_LAUNCH_MODE=BOOTSTRAP or IDP", "ASAS_BOOTSTRAP_ADMIN_REQUEST_FILE", "ASAS_BOOTSTRAP_ADMIN_COMPLETION_EVIDENCE_FILE", "AUTH_SECRET"],
        reason: bootstrapAdmin.ready ? "Bootstrap harness is audit-only; choose a launch mode and provide root-only completion evidence from an approved human-controlled provision/login procedure." : bootstrapAdmin.reason,
        closedSummary: "Owner selected bootstrap launch mode and supplied approved completion evidence; this preflight did not create or modify an administrator.",
      }),
    };
  })(),
  (() => {
    if (authLaunchMode === "BOOTSTRAP") return { gate: "identity_provider", status: status.notApplicable, internalImplementation: status.closed, requiredInputs: [], summary: "Owner selected bootstrap launch mode; OIDC/SAML is not a launch dependency." };
    return {
      gate: "identity_provider",
      internalImplementation: status.closed,
      ...externalOrClosed({
        ready: authLaunchMode === "IDP" && idpRequest.ready && validHttps("OIDC_ISSUER") && validHttps("OIDC_REDIRECT_URI") && present("OIDC_CLIENT_ID") && present("OIDC_CLIENT_SECRET_FILE"),
        requiredInputs: ["ASAS_AUTH_LAUNCH_MODE=BOOTSTRAP or IDP", "ASAS_IDP_PRODUCTION_REQUEST_FILE", "OIDC_ISSUER", "OIDC_CLIENT_ID", "OIDC_CLIENT_SECRET_FILE", "OIDC_REDIRECT_URI"],
        reason: idpRequest.ready ? "OIDC/SAML contract is installed; select IdP launch mode and provide issuer/client/secret reference/allow-listed redirect." : idpRequest.reason,
        closedSummary: "Owner selected IdP launch mode and provided the OIDC reference inputs; this preflight does not contact an issuer.",
      }),
    };
  })(),
  {
    gate: "mail",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: mailRequest.ready && present("ASAS_MAIL_TRANSPORT_CONFIG_PATH") && process.env.ASAS_MAIL_DELIVERY_ENABLED === "true",
      requiredInputs: ["ASAS_MAIL_PRODUCTION_REQUEST_FILE", "ASAS_MAIL_TRANSPORT_CONFIG_PATH", "ASAS_MAIL_DELIVERY_ENABLED=true"],
      reason: mailRequest.ready ? "Mail transport contract is installed; approved transport config and an explicit delivery switch are still required." : mailRequest.reason,
      closedSummary: "Mail transport request/config and explicit delivery switch are present; no message is sent by this preflight.",
    }),
  },
  (() => {
    if (paymentsScope === "EXCLUDED" && paymentExclusion.ready) return { gate: "integrations_payments", status: status.excluded, internalImplementation: status.closed, requiredInputs: [], summary: "Payments are explicitly excluded by an approved launch-scope decision; payment intake remains fail-closed." };
    if (paymentsScope === "EXCLUDED") return { gate: "integrations_payments", status: status.external, internalImplementation: status.closed, requiredInputs: ["ASAS_PAYMENT_EXCLUSION_APPROVAL_FILE"], summary: paymentExclusion.reason };
    return {
      gate: "integrations_payments",
      internalImplementation: status.closed,
      ...externalOrClosed({
        ready: paymentsScope === "REQUIRED" && paymentRequest.ready && present("PAYMENT_PROVIDER_CONFIG_FILE") && present("PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE"),
        requiredInputs: ["ASAS_PAYMENTS_LAUNCH_SCOPE=REQUIRED or EXCLUDED", "ASAS_PAYMENT_PRODUCTION_REQUEST_FILE", "PAYMENT_PROVIDER_CONFIG_FILE", "PAYMENT_WEBHOOK_LEDGER_APPROVAL_FILE"],
        reason: paymentRequest.ready ? "Payment gateway/webhook contracts are installed; an approved launch scope and tenant-bound provider/ledger configuration are still required." : "Payment launch scope is not approved or payment provider request is missing.",
        closedSummary: "Approved payment provider/ledger request is present; this preflight does not call a payment provider.",
      }),
    };
  })(),
  {
    gate: "license_activation",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: licenseRequest.ready && process.env.ASAS_LICENSE_REQUIRED === "true" && present("ASAS_LICENSE_CERTIFICATE_PATH") && present("ASAS_LICENSE_KEYRING_PATH") && present("ASAS_LICENSE_REVOCATION_PATH") && present("ASAS_INSTANCE_ID"),
      requiredInputs: ["ASAS_LICENSE_ACTIVATION_REQUEST_FILE", "ASAS_LICENSE_REQUIRED=true", "ASAS_LICENSE_CERTIFICATE_PATH", "ASAS_LICENSE_KEYRING_PATH", "ASAS_LICENSE_REVOCATION_PATH", "ASAS_INSTANCE_ID"],
      reason: licenseRequest.ready ? "Runtime certificate/keyring/revocation loader is installed; approved root-only license files and instance binding are still required." : licenseRequest.reason,
      closedSummary: "License request and runtime file references are present; the preflight does not expose certificates or keyring values.",
    }),
  },
  {
    gate: "domain_scheduler",
    internalImplementation: status.closed,
    ...externalOrClosed({
      ready: schedulerRequest.ready && present("ASAS_DOMAIN_SCHEDULER_CATALOGUE_PATH") && present("ASAS_SCHEDULER_HEARTBEAT_PATH") && present("ASAS_SCHEDULER_MAX_LAG_SECONDS"),
      requiredInputs: ["ASAS_DOMAIN_SCHEDULER_APPROVAL_FILE", "ASAS_DOMAIN_SCHEDULER_CATALOGUE_PATH", "ASAS_SCHEDULER_HEARTBEAT_PATH", "ASAS_SCHEDULER_MAX_LAG_SECONDS"],
      reason: schedulerRequest.ready ? "Approved scheduler catalogue/dry-run/lag contract is installed; owner-approved catalogue and heartbeat path are still required." : schedulerRequest.reason,
      closedSummary: "Scheduler approval and heartbeat configuration are present; this preflight does not execute jobs.",
    }),
  },
  {
    gate: "go_no_go_owner_window",
    internalImplementation: status.notApplicable,
    ...externalOrClosed({ ready: goNoGo.ready, requiredInputs: ["ASAS_GO_NO_GO_APPROVAL_FILE"], reason: goNoGo.reason, closedSummary: "Approved owner/window request is present; this preflight never authorizes deployment." }),
  },
];

const readyStatuses = new Set([status.closed, status.excluded, status.notApplicable]);
const output = {
  status: checks.every((check) => readyStatuses.has(check.status)) ? "READY_FOR_PRODUCTION_SWITCH" : "FINAL_PRODUCTION_GO_NO_GO_REVIEW",
  productionTrafficEnabled: false,
  dnsChanged: false,
  publicVhostEnabled: false,
  checks,
};

console.log(JSON.stringify(output));
process.exitCode = output.status === "READY_FOR_PRODUCTION_SWITCH" ? 0 : 2;
