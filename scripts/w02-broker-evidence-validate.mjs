import { readFileSync } from 'node:fs';
import { MANDATORY_IDS } from './lib/w02-broker-coverage-gate.mjs';
import { REQUIRED_EVIDENCE_FIELDS } from './lib/w02-broker-evidence-recorder.mjs';

const evidencePath = process.argv[2];
if (!evidencePath) throw new Error('Usage: node scripts/w02-broker-evidence-validate.mjs <evidence-json-path>');

const payload = JSON.parse(readFileSync(evidencePath, 'utf8'));
const records = Array.isArray(payload.evidence) ? payload.evidence : [];
const ids = records.map((record) => record?.id);
const counts = new Map();
for (const id of ids) counts.set(id, (counts.get(id) ?? 0) + 1);
const missingIds = MANDATORY_IDS.filter((id) => !counts.has(id));
const duplicateIds = [...counts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
const unregisteredIds = ids.filter((id) => !MANDATORY_IDS.includes(id));
const invalidIds = ids.filter((id) => !/^B\d{2}$/.test(id ?? ''));
const testsWithoutResult = records.filter((record) => record?.result !== 'PASS').map((record) => record?.id ?? 'MISSING_ID');
const evidenceMissingFields = records.filter((record) => REQUIRED_EVIDENCE_FIELDS.some((field) => !Object.hasOwn(record ?? {}, field) || (typeof record?.[field] === 'string' && record[field].trim() === ''))).map((record) => record?.id ?? 'MISSING_ID');
const evidenceRefsMissing = records.filter((record) => !record?.evidenceRef?.startsWith(`${record.id}:`)).map((record) => record?.id ?? 'MISSING_ID');
const expectedActualMismatchIds = records.filter((record) => record?.assertionPassed !== true).map((record) => record?.id ?? 'MISSING_ID');
const serialized = JSON.stringify(payload);
const secretPatternMatches = ['PGPASSWORD=', 'postgresql://', 'password":"', 'token":"', 'privateKey":"'].filter((token) => serialized.includes(token));
const notProvenMandatory = (payload.notProven ?? []).filter((item) => /B\d{2}|mandatory broker/i.test(item));
const failures = [
  ...(payload.status === 'PASS_BROKER_AUDIT_PROOF' ? [] : [`STATUS:${payload.status}`]),
  ...(payload.evidenceComplete === true ? [] : ['EVIDENCE_INCOMPLETE']),
  ...missingIds.map((id) => `MISSING:${id}`),
  ...duplicateIds.map((id) => `DUPLICATE:${id}`),
  ...unregisteredIds.map((id) => `UNREGISTERED:${id}`),
  ...invalidIds.map((id) => `INVALID:${id}`),
  ...testsWithoutResult.map((id) => `NO_RESULT:${id}`),
  ...evidenceMissingFields.map((id) => `MISSING_EVIDENCE:${id}`),
  ...evidenceRefsMissing.map((id) => `MISSING_EVIDENCE_REF:${id}`),
  ...expectedActualMismatchIds.map((id) => `EXPECTED_ACTUAL_MISMATCH:${id}`),
  ...((payload.hardFailures ?? []).map((id) => `HARD_FAILURE:${id}`)),
  ...((payload.securityFailures ?? []).map((id) => `SECURITY_FAILURE:${id}`)),
  ...((payload.coverageFailures ?? []).map((id) => `COVERAGE_FAILURE:${id}`)),
  ...((payload.cleanupFailures ?? []).map((id) => `CLEANUP_FAILURE:${id}`)),
  ...(payload.cleanup?.ok === true ? [] : ['CLEANUP_NOT_OK']),
  ...secretPatternMatches.map((item) => `SECRET_PATTERN:${item}`),
  ...notProvenMandatory.map((item) => `NOT_PROVEN_MANDATORY:${item}`),
];

const output = {
  status: failures.length === 0 ? 'PASS_BROKER_EVIDENCE_VALIDATION' : 'BLOCKED_BROKER_EVIDENCE_VALIDATION',
  evidencePath,
  mandatoryIds: MANDATORY_IDS,
  executedIds: ids,
  missingIds,
  duplicateIds,
  unregisteredIds,
  invalidIds,
  testsWithoutResult,
  evidenceMissingFields,
  evidenceRefsMissing,
  expectedActualMismatchIds,
  hardFailures: payload.hardFailures ?? [],
  securityFailures: payload.securityFailures ?? [],
  coverageFailures: payload.coverageFailures ?? [],
  cleanupFailures: payload.cleanupFailures ?? [],
  cleanup: payload.cleanup,
  secretPatternMatches,
  notProvenMandatory,
  failures,
};
process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
process.exitCode = failures.length === 0 ? 0 : 2;
