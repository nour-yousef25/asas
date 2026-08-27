import { spawnSync } from "node:child_process";
import { randomUUID } from "node:crypto";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const tempRoot = path.join(root, ".build-tmp");
const runId = `${new Date().toISOString().replace(/[-:.TZ]/g, "").slice(0, 14)}-${randomUUID().slice(0, 8)}`;
const stageRoot = path.join(tempRoot, `build-${runId}`);
const sourceRoot = path.join(stageRoot, "source");
const nextRoot = path.join(sourceRoot, ".next");
const standaloneRoot = path.join(nextRoot, "standalone");
const excludedTopLevel = new Set([".git", ".next", ".build-tmp", "node_modules"]);

function fail(message) { console.error(`ATOMIC_BUILD_FAIL=${message}`); process.exit(1); }
function run(command, args, cwd, env = process.env) {
  const result = spawnSync(command, args, { cwd, stdio: "inherit", env });
  if (result.status !== 0) fail(`${command}:${args.join(" ")}`);
}
function text(command, args) {
  const result = spawnSync(command, args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) fail(`${command}:${args.join(" ")}`);
  return result.stdout.trim();
}
function countFiles(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
}
function insideTemp(candidate) { return path.resolve(candidate).startsWith(`${path.resolve(tempRoot)}${path.sep}`); }

if (process.getuid?.() === 0) fail("BUILD_MUST_NOT_RUN_AS_ROOT");
if (process.env.ASAS_NEXT_DIST_DIR) fail("ASAS_NEXT_DIST_DIR_MUST_BE_UNSET_AT_ENTRY");
if (text("git", ["status", "--porcelain", "--untracked-files=all"])) fail("GIT_WORKING_TREE_NOT_CLEAN");
fs.mkdirSync(sourceRoot, { recursive: true, mode: 0o750 });
if (!insideTemp(stageRoot) || !insideTemp(sourceRoot)) fail("TEMP_BUILD_PATH_ESCAPE");
for (const entry of fs.readdirSync(root)) {
  if (excludedTopLevel.has(entry)) continue;
  fs.cpSync(path.join(root, entry), path.join(sourceRoot, entry), { recursive: true });
}
fs.cpSync(
  path.join(root, "node_modules"),
  path.join(sourceRoot, "node_modules"),
  { recursive: true, dereference: true },
);
const buildEnv = { ...process.env, NODE_ENV: "production", NEXT_TELEMETRY_DISABLED: "1" };
run(process.execPath, ["node_modules/next/dist/bin/next", "build", "--webpack"], sourceRoot, buildEnv);
run(process.execPath, ["scripts/package-next-standalone.mjs"], sourceRoot, buildEnv);
const buildIdPath = path.join(nextRoot, "BUILD_ID");
const standaloneBuildIdPath = path.join(standaloneRoot, ".next", "BUILD_ID");
const sourceStatic = path.join(nextRoot, "static");
const targetStatic = path.join(standaloneRoot, ".next", "static");
const sourcePublic = path.join(sourceRoot, "public");
const targetPublic = path.join(standaloneRoot, "public");
const required = [path.join(standaloneRoot, "server.js"), buildIdPath, standaloneBuildIdPath, sourceStatic, targetStatic];
if (required.some((entry) => !fs.existsSync(entry))) fail("REQUIRED_ARTIFACT_MISSING");
const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
const standaloneBuildId = fs.readFileSync(standaloneBuildIdPath, "utf8").trim();
const sourceStaticFiles = countFiles(sourceStatic);
const targetStaticFiles = countFiles(targetStatic);
if (!buildId || buildId !== standaloneBuildId || sourceStaticFiles === 0 || sourceStaticFiles !== targetStaticFiles) fail("BUILD_ID_OR_STATIC_GATE");
if (fs.existsSync(sourcePublic) && !fs.existsSync(targetPublic)) fail("PUBLIC_ASSET_GATE");
if (!fs.existsSync(path.join(standaloneRoot, "node_modules"))) fail("STANDALONE_DEPENDENCY_GATE");
const manifest = { contract: "ASAS_ATOMIC_WORKING_TREE_BUILD_V1", runId, gitHead: text("git", ["rev-parse", "HEAD"]), buildId, sourceStaticFiles, standaloneStaticFiles: targetStaticFiles, publicIncluded: fs.existsSync(sourcePublic), createdAt: new Date().toISOString() };
fs.writeFileSync(path.join(stageRoot, "READY.json"), `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o640 });
console.log(JSON.stringify({ status: "ATOMIC_BUILD_READY", ...manifest }));
