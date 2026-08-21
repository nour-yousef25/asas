/**
 * تشغيل Prisma بمتغيرات بيئة محلية دون طباعة أي قيمة حساسة.
 * يُستخدم محليًا فقط للتحقق والهجرات التي تحتاج DATABASE_URL الفعلي.
 */
import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

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

const args = process.argv.slice(2);
if (args.length === 0) {
  console.error("استخدم: node scripts/prisma-local.mjs <أمر Prisma>");
  process.exit(1);
}

const result = spawnSync("npx", ["prisma", ...args], {
  stdio: "inherit",
  env: { ...process.env, ...localEnv },
});

process.exit(result.status ?? 1);
