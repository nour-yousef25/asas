/**
 * يولّد SQL للهجرة من حالة قاعدة البيانات المحلية الحالية إلى prisma/schema.prisma.
 * يستخدم عند منع صلاحيات PostgreSQL إنشاء قاعدة ظل في بيئات التطوير المحدودة.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const migrationName = process.argv[2];
if (!migrationName) {
  console.error("استخدم: node scripts/create-migration-from-current.mjs <اسم_الهجرة>");
  process.exit(1);
}

const envPath = path.resolve(process.cwd(), ".env");
const localEnv = {};
if (fs.existsSync(envPath)) {
  for (const rawLine of fs.readFileSync(envPath, "utf8").split(/\r?\n/)) {
    const line = rawLine.trim();
    if (!line || line.startsWith("#") || !line.includes("=")) continue;
    const separator = line.indexOf("=");
    const key = line.slice(0, separator).trim();
    const value = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
    localEnv[key] = value;
  }
}

if (!localEnv.DATABASE_URL) {
  console.error("DATABASE_URL غير متاح للهجرة المحلية.");
  process.exit(1);
}

const stamp = new Date().toISOString().replace(/[-:TZ.]/g, "").slice(0, 14);
const migrationDir = path.resolve(process.cwd(), "prisma", "migrations", `${stamp}_${migrationName}`);

const result = spawnSync(
  "npx",
  [
    "prisma",
    "migrate",
    "diff",
    "--from-url",
    localEnv.DATABASE_URL,
    "--to-schema-datamodel",
    "prisma/schema.prisma",
    "--script",
  ],
  { encoding: "utf8", env: { ...process.env, ...localEnv } },
);

if (result.status !== 0) {
  process.stderr.write(result.stderr || "تعذر توليد فرق الهجرة.\n");
  process.exit(result.status ?? 1);
}

fs.mkdirSync(migrationDir, { recursive: true });
fs.writeFileSync(path.join(migrationDir, "migration.sql"), result.stdout);
console.log(`تم إنشاء هجرة SQL: ${path.relative(process.cwd(), migrationDir)}`);
