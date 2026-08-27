import { spawnSync } from "node:child_process";
import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const runId = process.env.ASAS_BUILD_RUN_ID;
const webUnit = "asasplus-web-production.service";
const buildIdPattern = /^[0-9]{14}-[a-f0-9]{8}$/;
function fail(message) { throw new Error(`ATOMIC_ACTIVATION_FAIL=${message}`); }
function command(name, args, allowFailure = false) {
  const result = spawnSync(name, args, { cwd: root, stdio: "inherit" });
  if (result.status !== 0 && !allowFailure) fail(`${name}:${args.join(" ")}`);
  return result.status === 0;
}
if (process.getuid?.() !== 0) fail("ACTIVATION_REQUIRES_ROOT_OPERATOR");
if (!runId || !buildIdPattern.test(runId)) fail("INVALID_BUILD_RUN_ID");
const stageRoot = path.join(root, ".build-tmp", `build-${runId}`);
const stagedNext = path.join(stageRoot, ".next");
const readyPath = path.join(stageRoot, "READY.json");
const activeNext = path.join(root, ".next");
const previousNext = path.join(stageRoot, "previous-active-next");
const failedNext = path.join(stageRoot, "failed-activation-next");
if (!fs.existsSync(readyPath) || !fs.existsSync(stagedNext) || !fs.existsSync(activeNext) || fs.existsSync(previousNext)) fail("ARTIFACT_NOT_READY");
const ready = JSON.parse(fs.readFileSync(readyPath, "utf8"));
if (ready.contract !== "ASAS_ATOMIC_WORKING_TREE_BUILD_V1") fail("UNRECOGNIZED_ARTIFACT");
const currentHead = command("git", ["rev-parse", "HEAD"], true) ? spawnSync("git", ["rev-parse", "HEAD"], { cwd: root, encoding: "utf8" }).stdout.trim() : "";
if (currentHead !== ready.gitHead) fail("GIT_PROVENANCE_MISMATCH");
const stagedBuildId = fs.readFileSync(path.join(stagedNext, "BUILD_ID"), "utf8").trim();
const standaloneBuildId = fs.readFileSync(path.join(stagedNext, "standalone", ".next", "BUILD_ID"), "utf8").trim();
if (!stagedBuildId || stagedBuildId !== ready.buildId || stagedBuildId !== standaloneBuildId || !fs.existsSync(path.join(stagedNext, "standalone", "server.js"))) fail("ARTIFACT_VERIFICATION_FAILED");
if (!command("systemctl", ["is-active", "--quiet", webUnit], true)) fail("WEB_SERVICE_NOT_ACTIVE_BEFORE_ACTIVATION");
let swapped = false;
try {
  command("systemctl", ["stop", webUnit]);
  fs.renameSync(activeNext, previousNext);
  fs.renameSync(stagedNext, activeNext);
  swapped = true;
  command("systemctl", ["start", webUnit]);
  if (!command("systemctl", ["is-active", "--quiet", webUnit], true)) fail("WEB_SERVICE_NOT_ACTIVE_AFTER_ACTIVATION");
  fs.writeFileSync(path.join(stageRoot, "ACTIVATED.json"), `${JSON.stringify({ runId, buildId: ready.buildId, activatedAt: new Date().toISOString() }, null, 2)}\n`, { mode: 0o640 });
  console.log(`ATOMIC_ACTIVATION_PASS=${runId}`);
} catch (error) {
  if (swapped) {
    command("systemctl", ["stop", webUnit], true);
    if (fs.existsSync(activeNext) && !fs.existsSync(failedNext)) fs.renameSync(activeNext, failedNext);
    if (fs.existsSync(previousNext)) fs.renameSync(previousNext, activeNext);
    command("systemctl", ["start", webUnit], true);
  }
  throw error;
}
