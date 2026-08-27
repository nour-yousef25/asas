import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const configuredDistDir = process.env.ASAS_NEXT_DIST_DIR ?? ".next";
if (configuredDistDir !== ".next" && (!configuredDistDir.startsWith(".build-tmp/") || configuredDistDir.includes(".."))) {
  fail("INVALID_DIST_DIR");
}
const nextRoot = path.resolve(root, configuredDistDir);
const standaloneRoot = path.join(nextRoot, "standalone");
const sourceStatic = path.join(nextRoot, "static");
const targetStatic = path.join(standaloneRoot, ".next", "static");
const sourcePublic = path.join(root, "public");
const targetPublic = path.join(standaloneRoot, "public");

function fail(message) {
  console.error(`STANDALONE_PACKAGE_FAIL=${message}`);
  process.exit(1);
}

function countFiles(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
}

const buildIdPath = path.join(nextRoot, "BUILD_ID");
const standaloneBuildIdPath = path.join(standaloneRoot, ".next", "BUILD_ID");
if (!fs.existsSync(standaloneRoot) || !fs.existsSync(sourceStatic) || !fs.existsSync(buildIdPath) || !fs.existsSync(standaloneBuildIdPath)) {
  fail("REQUIRED_BUILD_ARTIFACT_MISSING");
}

fs.rmSync(targetStatic, { recursive: true, force: true });
fs.mkdirSync(path.dirname(targetStatic), { recursive: true });
fs.cpSync(sourceStatic, targetStatic, { recursive: true, force: true });

if (fs.existsSync(sourcePublic)) {
  fs.rmSync(targetPublic, { recursive: true, force: true });
  fs.cpSync(sourcePublic, targetPublic, { recursive: true, force: true });
}

const buildId = fs.readFileSync(buildIdPath, "utf8").trim();
const standaloneBuildId = fs.readFileSync(standaloneBuildIdPath, "utf8").trim();
const fullStaticFiles = countFiles(sourceStatic);
const standaloneStaticFiles = countFiles(targetStatic);

if (!buildId || buildId !== standaloneBuildId || fullStaticFiles === 0 || standaloneStaticFiles === 0) {
  fail("STATIC_OR_BUILD_ID_GATE");
}

console.log(
  JSON.stringify({
    status: "STANDALONE_PACKAGE_PASS",
    buildId,
    fullStaticFiles,
    standaloneStaticFiles,
    publicIncluded: fs.existsSync(sourcePublic),
  }),
);
