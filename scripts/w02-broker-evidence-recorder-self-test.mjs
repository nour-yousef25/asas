import { MANDATORY_IDS, validateBrokerCoverage } from './lib/w02-broker-coverage-gate.mjs';
import { REQUIRED_EVIDENCE_FIELDS, recordEvidence } from './lib/w02-broker-evidence-recorder.mjs';

function specification(id, execute, evaluate = ({ output }) => output?.ok === true) {
  return { id, purpose: 'Evidence Recorder self-test', setup: 'no database', command: 'self-test command', inputClass: 'synthetic control path only', expected: 'controlled recorder outcome', execute, evaluate, metadata: { databaseIdentity: 'no-database', tenant: 'no-database' } };
}

function assert(condition, message) {
  if (!condition) throw new Error(message);
}

function completeRecord(id) {
  return recordEvidence(specification(id, () => ({ ok: true })));
}

function expectBlocked(name, records) {
  const verdict = validateBrokerCoverage(records);
  assert(verdict.status !== 'PASS', `${name} unexpectedly passed`);
  return { name, status: verdict.status, coverageFailures: verdict.coverageFailures, hardFailures: verdict.hardFailures };
}

const results = [];
const e1 = recordEvidence(specification('E1', () => ({ ok: true, sessionUser: 'self-test-role' })));
assert(e1.result === 'PASS' && REQUIRED_EVIDENCE_FIELDS.every((field) => Object.hasOwn(e1, field)), 'E1 did not emit complete PASS evidence');
results.push({ name: 'E1 successful command produces complete evidence', result: e1.result });

const commandFailure = new Error('controlled command failure');
commandFailure.code = 'POSTGRES_DENIED';
const e2 = recordEvidence(specification('E2', () => { throw commandFailure; }));
assert(e2.result === 'FAIL' && e2.failureReason === 'POSTGRES_DENIED', 'E2 did not record command failure');
results.push({ name: 'E2 failed command produces FAIL evidence', result: e2.result, reason: e2.failureReason });

const beforeCommandFailure = new Error('controlled pre-command exception');
beforeCommandFailure.code = 'PRE_COMMAND_EXCEPTION';
const e3 = recordEvidence(specification('E3', () => { throw beforeCommandFailure; }));
assert(e3.result === 'FAIL' && e3.failureReason === 'PRE_COMMAND_EXCEPTION', 'E3 did not record pre-command exception');
results.push({ name: 'E3 exception before command produces evidence', result: e3.result, reason: e3.failureReason });

const e4 = recordEvidence(specification('E4', () => undefined));
assert(e4.result === 'FAIL' && e4.failureReason === 'EVIDENCE_OUTPUT_UNDEFINED', 'E4 did not fail closed for missing output');
results.push({ name: 'E4 missing output is controlled failure', result: e4.result, reason: e4.failureReason });

const e5 = recordEvidence(specification('E5', () => { throw new ReferenceError('out is not defined'); }));
assert(e5.result === 'FAIL' && e5.failureReason === 'REFERENCE_ERROR', 'E5 did not preserve ReferenceError as FAIL');
results.push({ name: 'E5 undefined internal variable fails visibly', result: e5.result, reason: e5.failureReason });

const complete = MANDATORY_IDS.map(completeRecord);
const missingField = complete.map((record) => record.id === 'B01' ? { ...record, evidenceRef: '' } : record);
results.push(expectBlocked('E6 missing required evidence field', missingField));
results.push(expectBlocked('E7 duplicate test ID', [...complete, completeRecord('B01')]));
results.push(expectBlocked('E8 unregistered test ID', [...complete, completeRecord('B99')]));

process.stdout.write(`${JSON.stringify({ status: 'PASS_BROKER_EVIDENCE_RECORDER_SELF_TEST', results }, null, 2)}\n`);
