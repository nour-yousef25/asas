import { createHash } from "node:crypto";
import { readFile } from "node:fs/promises";
import path from "node:path";

const manifestPath = process.argv[2];
const artifactPath = process.argv[3];

if (!manifestPath || !artifactPath) {
  console.error("الاستخدام: npm run backup:verify -- <manifest.json> <backup-artifact>");
  process.exit(1);
}

try {
  const [manifestText, artifact] = await Promise.all([readFile(manifestPath, "utf8"), readFile(artifactPath)]);
  const manifest = JSON.parse(manifestText);
  const requiredFields = ["schemaVersion", "backupId", "createdAt", "verifiedAt", "edition", "owner", "location", "checksum", "encryption", "contents"];
  const missing = requiredFields.filter((field) => manifest[field] === undefined || manifest[field] === null);
  if (missing.length) throw new Error(`Manifest ناقص الحقول: ${missing.join(", ")}`);
  if (manifest.schemaVersion !== 1) throw new Error("إصدار Manifest غير مدعوم.");
  if (!manifest.verifiedAt) throw new Error("Manifest لا يثبت تحققاً سابقاً.");
  if (!manifest.contents.database || !manifest.contents.configuration) throw new Error("Manifest لا يثبت تضمين قاعدة البيانات والإعدادات.");

  const checksum = `sha256:${createHash("sha256").update(artifact).digest("hex")}`;
  if (checksum !== manifest.checksum) throw new Error("Checksum النسخة الاحتياطية لا يطابق Manifest.");

  console.log(JSON.stringify({ verified: true, manifest: path.basename(manifestPath), artifact: path.basename(artifactPath), backupId: manifest.backupId }));
} catch (error) {
  console.error(JSON.stringify({ verified: false, error: error instanceof Error ? error.message : "Backup verification failed" }));
  process.exit(1);
}
