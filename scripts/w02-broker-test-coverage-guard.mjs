import { MANDATORY_IDS, validateBrokerCoverage } from './lib/w02-broker-coverage-gate.mjs';

function record(id, result = 'PASS', overrides = {}) {
  return { id, purpose: 'coverage guard fixture', setup: 'no database', command: 'coverage-gate', inputClass: 'synthetic harness metadata only', expected: 'coverage rule', actual: 'coverage rule', result, databaseIdentity: 'no-database', organization: null, membershipId: null, leaseId: null, tenantRoleId: null, correlationId: `coverage-${id}`, timestamp: '2026-08-23T00:00:00.000Z', failureReason: null, ...overrides };
}

function assertBlocked(name, records) {
  const outcome = validateBrokerCoverage(records);
  if (outcome.status !== 'BLOCKED') throw new Error(`${name} was not blocked`);
  return { name, status: outcome.status, coverageFailures: outcome.coverageFailures, hardFailures: outcome.hardFailures };
}

const complete = MANDATORY_IDS.map((id) => record(id));
const results = [];
const pass = validateBrokerCoverage(complete);
if (pass.status !== 'PASS') throw new Error(`complete coverage did not pass: ${JSON.stringify(pass.coverageFailures)}`);
results.push({ name: 'complete B01-B60', status: pass.status });
results.push(assertBlocked('missing test', complete.filter((item) => item.id !== 'B05')));
results.push(assertBlocked('duplicate ID', [...complete, record('B05')]));
results.push(assertBlocked('unregistered ID', [...complete, record('B99')]));
results.push(assertBlocked('invalid ID', [...complete, record('INVALID')]));
results.push(assertBlocked('test without result', complete.map((item) => item.id === 'B06' ? { ...item, result: undefined } : item)));
results.push(assertBlocked('exception before registration', complete.filter((item) => item.id !== 'B07')));
results.push(assertBlocked('early stop', complete.slice(0, 22)));
results.push(assertBlocked('expected actual mismatch', complete.map((item) => item.id === 'B08' ? record('B08', 'FAIL', { actual: 'mismatch', failureReason: 'EXPECTED_ACTUAL_MISMATCH' }) : item)));
results.push(assertBlocked('hard failure', complete.map((item) => item.id === 'B09' ? record('B09', 'FAIL', { failureReason: 'SECURITY_DENY_EXPECTED_BUT_ALLOWED' }) : item)));
results.push(assertBlocked('missing evidence', complete.map((item) => item.id === 'B10' ? { ...item, expected: '' } : item)));

process.stdout.write(`${JSON.stringify({ status: 'PASS_BROKER_COVERAGE_GUARD', results }, null, 2)}\n`);
