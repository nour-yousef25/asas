import { statSync, readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("EVIDENCE_PATH_REQUIRED");
const payload = JSON.parse(readFileSync(file, "utf8"));
const required = ["INT01", "INT02", "INT03", "INT04", "INT05", "INT06", "INT07", "INT08", "INT09", "INT10", "INT11", "INT12", "INT13", "INT14"];
const rows = Array.isArray(payload.evidence) ? payload.evidence : [];
const ids = rows.map((item) => item?.id);
const missing = required.filter((id) => !ids.includes(id));
const duplicate = ids.filter((id, index) => ids.indexOf(id) !== index);
const failed = rows.filter((item) => item?.result !== "PASS").map((item) => item?.id);
const mode = (statSync(file).mode & 0o777).toString(8);
const valid = payload.status === "PASS_W02_INTERNAL_SECURITY_RUNTIME" && missing.length === 0 && duplicate.length === 0 && failed.length === 0 && rows.length === required.length && payload.cleanup?.ok === true && payload.cleanup?.residueCount === 0 && payload.hygiene?.status === "PASS" && payload.credentialsPersisted === false && payload.productionResourcesTouched === false && payload.rawGucIdentityUsed === false && payload.globalPrismaFallback === false && payload.ownerOrBypassUsedForTenantEvidence === false && mode === "600";
const result = { valid, required, observed: rows.length, missing, duplicate, failed, cleanup: payload.cleanup, mode };
process.stdout.write(`${JSON.stringify(result, null, 2)}\n`);
process.exitCode = valid ? 0 : 2;
