import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runId = process.env.ASAS_BUILD_RUN_ID;
if (process.getuid?.() !== 0) throw new Error("ATOMIC_CLEANUP_REQUIRES_ROOT_OPERATOR");
if (!runId || !/^[0-9]{14}-[a-f0-9]{8}$/.test(runId)) throw new Error("ATOMIC_CLEANUP_INVALID_RUN_ID");
const stageRoot = path.join(root, ".build-tmp", `build-${runId}`);
const ready = JSON.parse(fs.readFileSync(path.join(stageRoot, "READY.json"), "utf8"));
if (!fs.existsSync(path.join(stageRoot, "ACTIVATED.json"))) throw new Error("ATOMIC_CLEANUP_NOT_ACTIVATED");
if (spawnSync("systemctl", ["is-active", "--quiet", "asasplus-web-production.service"]).status !== 0) throw new Error("ATOMIC_CLEANUP_WEB_NOT_ACTIVE");
const activeBuildId = fs.readFileSync(path.join(root, ".next", "BUILD_ID"), "utf8").trim();
if (activeBuildId !== ready.buildId) throw new Error("ATOMIC_CLEANUP_ACTIVE_BUILD_MISMATCH");
fs.rmSync(stageRoot, { recursive: true, force: false });
const tempRoot = path.join(root, ".build-tmp");
if (fs.existsSync(tempRoot) && fs.readdirSync(tempRoot).length === 0) fs.rmdirSync(tempRoot);
console.log(`ATOMIC_CLEANUP_PASS=${runId}`);
