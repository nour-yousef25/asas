/** تشغيل عامل النشر مع تحميل البيئة المحلية دون طباعة مفاتيح أو رموز حساسة. */
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
    localEnv[line.slice(0, separator).trim()] = line.slice(separator + 1).trim().replace(/^['"]|['"]$/g, "");
  }
}

const result = spawnSync("npx", ["tsx", "src/workers/communications-worker.ts"], {
  stdio: "inherit",
  env: { ...process.env, ...localEnv },
});
process.exit(result.status ?? 1);
