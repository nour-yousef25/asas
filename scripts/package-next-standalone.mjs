import fs from "node:fs";
import path from "node:path";

const root = process.cwd();
const nextRoot = path.join(root, ".next");
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

if (!fs.existsSync(sourceStatic) || !fs.existsSync(buildIdPath)) {
  fail("REQUIRED_BUILD_ARTIFACT_MISSING");
}

// Next.js file tracing can preserve the atomic build staging path inside
// the standalone directory. Locate the actual standalone payload and
// normalize it to the canonical .next/standalone root.
let standalonePayload = standaloneRoot;

if (
  !fs.existsSync(path.join(standalonePayload, "server.js")) ||
  !fs.existsSync(path.join(standalonePayload, ".next", "BUILD_ID"))
) {
  const candidates = [];
  const walk = (dir) => {
    if (!fs.existsSync(dir)) return;
    for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
      const full = path.join(dir, entry.name);
      if (entry.isDirectory()) {
        if (
          entry.name === "node_modules" ||
          entry.name === ".next" ||
          entry.name === ".build-tmp"
        ) {
          walk(full);
        } else {
          walk(full);
        }
      } else if (entry.isFile() && entry.name === "server.js") {
        const candidateRoot = path.dirname(full);
        if (
          fs.existsSync(path.join(candidateRoot, ".next", "BUILD_ID")) &&
          fs.existsSync(path.join(candidateRoot, "package.json"))
        ) {
          candidates.push(candidateRoot);
        }
      }
    }
  };

  walk(standaloneRoot);

  if (candidates.length !== 1) {
    fail(`STANDALONE_PAYLOAD_DISCOVERY:${candidates.length}`);
  }

  standalonePayload = candidates[0];

  if (standalonePayload !== standaloneRoot) {
    const entries = fs.readdirSync(standalonePayload);
    for (const entry of entries) {
      const src = path.join(standalonePayload, entry);
      const dst = path.join(standaloneRoot, entry);

      if (entry === ".next" || entry === "node_modules") {
        fs.rmSync(dst, { recursive: true, force: true });
      } else if (fs.existsSync(dst)) {
        fs.rmSync(dst, { recursive: true, force: true });
      }

      fs.renameSync(src, dst);
    }

    fs.rmSync(path.join(standaloneRoot, ".build-tmp"), {
      recursive: true,
      force: true,
    });
  }
}

const standaloneBuildIdPath = path.join(standaloneRoot, ".next", "BUILD_ID");

if (
  !fs.existsSync(standaloneRoot) ||
  !fs.existsSync(path.join(standaloneRoot, "server.js")) ||
  !fs.existsSync(sourceStatic) ||
  !fs.existsSync(standaloneBuildIdPath)
) {
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
