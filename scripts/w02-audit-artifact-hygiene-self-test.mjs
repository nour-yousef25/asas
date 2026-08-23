import { existsSync, readFileSync, rmSync } from 'node:fs';
import { spawnSync } from 'node:child_process';

const harness = new URL('./w02-rls-hybrid-identity-proof.mjs', import.meta.url);
const cases = [
  { id: 'E-HYG-01', env: {}, expected: 'PASS_DATABASE_IDENTITY_PROOF_PARTIAL' },
  { id: 'E-HYG-02', env: { W02_HYGIENE_FORCE_ASSERTION_FAILURE: '1' }, expected: 'FAIL' },
  { id: 'E-HYG-03', env: { W02_HYGIENE_FORCE_EXCEPTION: '1' }, expected: 'FAIL_SETUP_OR_HARNESS' },
  { id: 'E-HYG-04', env: { W02_HYGIENE_SELF_INTERRUPT: '1' }, expected: 'FAIL_INTERRUPTED' },
];

function evidencePath(output) {
  const match = output.match(/redacted evidence: (\/tmp\/w02-rls-hybrid-identity-evidence-[^\s]+)/) || output.match(/"evidenceFile":\s*"([^"]+)"/);
  return match?.[1] ?? null;
}

function assertNoSensitiveTempArtifacts() {
  const scan = spawnSync('find', ['/tmp', '-maxdepth', '1', '-type', 'f', '(', '-iname', 'w02-*pass*', '-o', '-iname', 'w02-*password*', '-o', '-iname', 'w02-*credential*', '-o', '-iname', 'w02-*-setup-*.sql', ')', '-print'], { encoding: 'utf8' });
  if (scan.status !== 0) throw new Error('TEMP_SCAN_FAILED');
  if (scan.stdout.trim()) throw new Error('SENSITIVE_TEMP_ARTIFACT_REMAINS');
}

function assertNoAuditResidues(evidence) {
  const suffix = evidence.databaseAlias.replace('asas_hybrid_identity_audit_', '');
  const query = `SELECT datname FROM pg_database WHERE datname='${evidence.databaseAlias}' UNION ALL SELECT rolname FROM pg_roles WHERE rolname LIKE 'hybrid_%_${suffix}' ORDER BY 1;`;
  const scan = spawnSync('sudo', ['-u', 'postgres', 'psql', '-d', 'postgres', '-At', '-v', 'ON_ERROR_STOP=1', '-c', query], { encoding: 'utf8' });
  if (scan.status !== 0) throw new Error('AUDIT_RESIDUE_SCAN_FAILED');
  if (scan.stdout.trim()) throw new Error('AUDIT_DATABASE_OR_ROLE_RESIDUE_REMAINS');
}

const results = [];
for (const testCase of cases) {
  const run = spawnSync('node', [harness.pathname], { encoding: 'utf8', env: { ...process.env, ...testCase.env } });
  const path = evidencePath(`${run.stdout}\n${run.stderr}`);
  if (!path || !existsSync(path)) throw new Error(`${testCase.id}:MISSING_REDACTED_EVIDENCE`);
  const evidence = JSON.parse(readFileSync(path, 'utf8'));
  const pass = evidence.status === testCase.expected && evidence.cleanup?.ok === true;
  results.push({ id: testCase.id, status: evidence.status, cleanupOk: evidence.cleanup?.ok === true, pass });
  rmSync(path, { force: true });
  if (!pass) throw new Error(`${testCase.id}:UNEXPECTED_STATUS_OR_CLEANUP`);
  assertNoSensitiveTempArtifacts();
  assertNoAuditResidues(evidence);
}

process.stdout.write(`${JSON.stringify({ status: 'PASS_AUDIT_ARTIFACT_HYGIENE_SELF_TEST', results }, null, 2)}\n`);
