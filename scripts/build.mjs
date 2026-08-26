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

const result = spawnSync("npx", ["next", "build", "--webpack"], {
  stdio: "inherit",
  env: { ...process.env, ...localEnv, NODE_ENV: "production" },
});

if (result.status !== 0) {
  process.exit(result.status ?? 1);
}

const standalonePackage = spawnSync("node", ["scripts/package-next-standalone.mjs"], {
  stdio: "inherit",
  env: { ...process.env, ...localEnv, NODE_ENV: "production" },
});

process.exit(standalonePackage.status ?? 1);
