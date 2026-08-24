import { readFileSync } from "node:fs";

const evidencePath = process.argv[2];
const required = ["Q01", "Q02", "Q03", "Q04", "Q05", "Q06", "Q07", "Q08", "Q09", "Q10"];
if (!evidencePath) throw new Error("EVIDENCE_PATH_REQUIRED");
const evidence = JSON.parse(readFileSync(evidencePath, "utf8"));
const seen = evidence?.evidence?.map((item) => item?.id) ?? [];
const missing = required.filter((id) => !seen.includes(id));
const duplicates = [...new Set(seen.filter((id, index) => seen.indexOf(id) !== index))];
const failed = evidence?.evidence?.filter((item) => item?.result !== "PASS").map((item) => item.id) ?? [];
const valid = evidence?.status === "PASS_QUEUE_REDIS_RUNTIME" && evidence?.environment === "disposable-redis-postgresql-audit" && missing.length === 0 && duplicates.length === 0 && failed.length === 0 && evidence?.cleanup?.ok === true && evidence?.hygiene?.status === "PASS_AUDIT_ARTIFACT_HYGIENE_SCAN" && evidence?.credentialsPersisted === false && evidence?.productionResourcesTouched === false && evidence?.rawGucIdentityUsed === false && evidence?.globalPrismaFallback === false && evidence?.ownerOrBypassUsedForTenantEvidence === false;
process.stdout.write(`${JSON.stringify({ valid, required, missing, duplicates, failed }, null, 2)}\n`);
process.exitCode = valid ? 0 : 2;
