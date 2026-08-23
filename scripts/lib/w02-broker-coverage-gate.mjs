export const MANDATORY_IDS = Array.from({ length: 60 }, (_, index) => `B${String(index + 1).padStart(2, '0')}`);

export function validateBrokerCoverage(records) {
  const executedIds = records.map((record) => record?.id).filter((id) => typeof id === 'string');
  const idCounts = new Map();
  for (const id of executedIds) idCounts.set(id, (idCounts.get(id) ?? 0) + 1);

  const missingIds = MANDATORY_IDS.filter((id) => !idCounts.has(id));
  const duplicateIds = [...idCounts.entries()].filter(([, count]) => count > 1).map(([id]) => id);
  const unregisteredIds = [...idCounts.keys()].filter((id) => !MANDATORY_IDS.includes(id));
  const invalidIds = records.filter((record) => !record?.id || !/^B\d{2}$/.test(record.id)).map((record) => record?.id ?? 'MISSING_ID');
  const testsWithoutResult = records.filter((record) => !record?.result || !['PASS', 'FAIL', 'BLOCKED'].includes(record.result)).map((record) => record?.id ?? 'MISSING_ID');
  const requiredEvidenceFields = ['id', 'purpose', 'setup', 'command', 'inputClass', 'expected', 'actual', 'result', 'databaseIdentity', 'organization', 'membershipId', 'leaseId', 'tenantRoleId', 'correlationId', 'timestamp', 'failureReason'];
  const evidenceMissingFields = records.filter((record) => requiredEvidenceFields.some((field) => !Object.hasOwn(record ?? {}, field) || (typeof record?.[field] === 'string' && record[field].trim() === ''))).map((record) => record?.id ?? 'MISSING_ID');
  const hardFailures = records.filter((record) => record?.result !== 'PASS').map((record) => record?.id ?? 'MISSING_ID');
  const coverageFailures = [
    ...missingIds.map((id) => `MISSING:${id}`),
    ...duplicateIds.map((id) => `DUPLICATE:${id}`),
    ...unregisteredIds.map((id) => `UNREGISTERED:${id}`),
    ...invalidIds.map((id) => `INVALID:${id}`),
    ...testsWithoutResult.map((id) => `NO_RESULT:${id}`),
    ...evidenceMissingFields.map((id) => `MISSING_EVIDENCE:${id}`),
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
    hardFailures,
    coverageFailures,
    status: hardFailures.length === 0 && coverageFailures.length === 0 ? 'PASS' : 'BLOCKED',
  };
}
