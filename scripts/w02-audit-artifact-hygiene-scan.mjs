import { lstatSync, readdirSync, readFileSync } from 'node:fs';
import { join, relative } from 'node:path';

const root = process.cwd();
const sensitiveName = /(pass(word)?|credential|secret|setup-.*\.sql)/i;
const secretPatterns = [
  /PGPASSWORD=[^\s]+/i,
  /postgres(?:ql)?:\/\/[^\s:@]+:[^\s@]+@/i,
  /"(?:password|accessToken|refreshToken|privateKey)"\s*:\s*"[^"\n]+"/i,
];
const exclusions = new Set(['.git', 'node_modules', '.next', 'coverage']);

function walk(dir, files = []) {
  for (const entry of readdirSync(dir, { withFileTypes: true })) {
    if (exclusions.has(entry.name)) continue;
    const file = join(dir, entry.name);
    if (entry.isDirectory()) walk(file, files);
    else if (entry.isFile()) files.push(file);
  }
  return files;
}

function safeReadHasSecret(file) {
  try {
    const text = readFileSync(file, 'utf8');
    return secretPatterns.some((pattern) => pattern.test(text));
  } catch {
    return true;
  }
}

const findings = [];
for (const name of readdirSync('/tmp')) {
  const file = join('/tmp', name);
  let stat;
  try { stat = lstatSync(file); } catch { continue; }
  if (!stat.isFile()) continue;
  if (sensitiveName.test(name)) {
    findings.push({ category: 'SENSITIVE_TEMP_NAME', path: file, mode: (stat.mode & 0o777).toString(8), size: stat.size });
  }
  if (/^w02-.*evidence-.*\.json$/i.test(name)) {
    if ((stat.mode & 0o077) !== 0) findings.push({ category: 'UNSAFE_TEMP_EVIDENCE_PERMISSION', path: file, mode: (stat.mode & 0o777).toString(8), size: stat.size });
    if (safeReadHasSecret(file)) findings.push({ category: 'SECRET_PATTERN_IN_TEMP_EVIDENCE', path: file, mode: (stat.mode & 0o777).toString(8), size: stat.size });
  }
}

for (const file of walk(root)) {
  const rel = relative(root, file);
  const isEvidenceOrReport = /(?:evidence|report)/i.test(rel) && /\.(?:json|md|txt)$/i.test(rel);
  if (isEvidenceOrReport && safeReadHasSecret(file)) findings.push({ category: 'SECRET_PATTERN_IN_EVIDENCE_OR_REPORT', path: rel });
  const stat = lstatSync(file);
  if (/\.(?:sql|txt|json)$/i.test(rel) && sensitiveName.test(rel) && (stat.mode & 0o077) !== 0) {
    findings.push({ category: 'UNSAFE_SENSITIVE_FILE_PERMISSION', path: rel, mode: (stat.mode & 0o777).toString(8) });
  }
}

const summary = { status: findings.length === 0 ? 'PASS_AUDIT_ARTIFACT_HYGIENE_SCAN' : 'FAIL_AUDIT_ARTIFACT_HYGIENE_SCAN', findingCount: findings.length, findings };
process.stdout.write(`${JSON.stringify(summary, null, 2)}\n`);
process.exitCode = findings.length === 0 ? 0 : 2;
