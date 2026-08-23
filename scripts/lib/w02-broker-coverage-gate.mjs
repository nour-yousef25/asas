import { REQUIRED_EVIDENCE_FIELDS } from './w02-broker-evidence-recorder.mjs';

export const MANDATORY_IDS = Array.from({ length: 60 }, (_, index) => `B${String(index + 1).padStart(2, '0')}`);

export function validateBrokerCoverage(records, { cleanup = { ok: true } } = {}) {
  const executedIds = records.map((record) => record?.id).filter((id) => typeof id === 'string');
  const idCounts = new Map();
  for (const id of executedIds) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);

  const missingIds = MANDATORY_IDS.filter((id) => !idCounts.has(id));
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  const unregisteredIds = [...idCounts.keys()].filter((id) => !MANDATORY_IDS.includes(id));
  const invalidIds = records.filter((record) => !record?.id || !/^B\d{2}$/.test(record.id)).map((record) => record?.id ?? 'MISSING_ID');
  const testsWithoutResult = records.filter((record) => !record?.result || !['PASS', 'FAIL', 'BLOCKED'].includes(record.result)).map((record) => record?.id ?? 'MISSING_ID');
  const evidenceMissingFields = records.filter((record) => REQUIRED_EVIDENCE_FIELDS.some((field) => !Object.hasOwn(record ?? {}, field) || (typeof record?.[field] === 'string' && record[field].trim() === ''))).map((record) => record?.id ?? 'MISSING_ID');
  const expectedActualMismatchIds = records.filter((record) => record?.result === 'PASS' && record?.assertionPassed !== true).map((record) => record?.id ?? 'MISSING_ID');
  const hardFailures = records.filter((record) => record?.result !== 'PASS').map((record) => record?.id ?? 'MISSING_ID');
  const cleanupFailures = cleanup?.ok === true ? [] : ['AUDIT_CLEANUP_FAILED'];
  const coverageFailures = [
    ...missingIds.map((id) => `MISSING:${id}`),
    ...duplicateIds.map((id) => `DUPLICATE:${id}`),
    ...unregisteredIds.map((id) => `UNREGISTERED:${id}`),
    ...invalidIds.map((id) => `INVALID:${id}`),
    ...testsWithoutResult.map((id) => `NO_RESULT:${id}`),
    ...evidenceMissingFields.map((id) => `MISSING_EVIDENCE:${id}`),
    ...expectedActualMismatchIds.map((id) => `EXPECTED_ACTUAL_MISMATCH:${id}`),
    ...cleanupFailures,
  ];

  return {
    mandatoryIds: MANDATORY_IDS,
    executedIds,
    missingIds,
    duplicateIds,
    unregisteredIds,
    invalidIds,
    testsWithoutResult,
    evidenceMissingFields,
    expectedActualMismatchIds,
    hardFailures,
    cleanupFailures,
    coverageFailures,
    status: coverageFailures.length > 0 ? 'BLOCKED_COVERAGE' : (hardFailures.length > 0 ? 'FAIL_SECURITY' : 'PASS'),
  };
}
