import { readFileSync } from "node:fs";

const path = process.argv[2];
if (!path) throw new Error("VPS_TENANT_EVIDENCE_PATH_REQUIRED");
const payload = JSON.parse(readFileSync(path, "utf8"));
const required = Array.from({ length: 12 }, (_, index) => `VPS${String(index + 1).padStart(2, "0")}`);
const observed = new Map((payload.evidence ?? []).map((entry) => [entry.id, entry.result]));
const failures = required.filter((id) => observed.get(id) !== "PASS");
const legacyEvidence = payload.status === "PASS_VPS_STAGING_TENANT_RUNTIME";
const currentEvidence = payload.status === "PASS_VPS_TENANT_RUNTIME";
const noUnrelatedProductionTouch = payload.unrelatedProductionResourcesTouched ?? payload.productionResourcesTouched;
const valid = (legacyEvidence || currentEvidence)
  && failures.length === 0
  && payload.credentialsPersistedInEvidence === false
  && noUnrelatedProductionTouch === false
  && payload.rawGucIdentityUsed === false
  && payload.globalDataPlaneCredentialUsed === false
  && payload.ownerOrBypassUsedForTenantEvidence === false;
process.stdout.write(`${JSON.stringify({ status: valid ? "PASS_VPS_TENANT_RUNTIME_EVIDENCE" : "FAIL_VPS_TENANT_RUNTIME_EVIDENCE", checked: required.length, failures, environment: payload.environment ?? "staging" })}\n`);
process.exitCode = valid ? 0 : 2;
