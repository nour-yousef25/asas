import { readFileSync } from "node:fs";

const file = process.argv[2];
if (!file) throw new Error("EVIDENCE_PATH_REQUIRED");
const evidence = JSON.parse(readFileSync(file, "utf8"));
const required = ["S01", "S02", "S03", "S04", "S05", "S06", "S07", "S08", "S09", "S10"];
const ids = Array.isArray(evidence.evidence) ? evidence.evidence.map((entry) => entry.id) : [];
const missing = required.filter((id) => !ids.includes(id));
const duplicates = required.filter((id) => ids.filter((candidate) => candidate === id).length !== 1);
const failed = (evidence.evidence ?? []).filter((entry) => entry.result !== "PASS").map((entry) => entry.id);
const valid = evidence.status === "PASS_STORAGE_RUNTIME" && evidence.environment === "disposable-postgresql-memory-artifact-audit" && evidence.cleanup?.ok === true && evidence.hygiene?.status === "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" && evidence.credentialsPersisted === false && evidence.productionResourcesTouched === false && evidence.rawGucIdentityUsed === false && evidence.globalPrismaFallback === false && evidence.ownerOrBypassUsedForTenantEvidence === false && missing.length === 0 && duplicates.length === 0 && failed.length === 0;
process.stdout.write(`${JSON.stringify({ valid, required, missing, duplicates, failed }, null, 2)}\n`);
process.exitCode = valid ? 0 : 2;
