import fs from "node:fs";
import http from "node:http";
import path from "node:path";

const probeUrl = process.argv.find((argument) => argument.startsWith("--probe-url="))?.slice("--probe-url=".length);
const canonicalHost = process.argv.find((argument) => argument.startsWith("--canonical-host="))?.slice("--canonical-host=".length);
if (!probeUrl) {
  console.error("STANDALONE_RUNTIME_GATE_FAIL=PROBE_URL_REQUIRED");
  process.exit(1);
}
if (!canonicalHost) {
  console.error("STANDALONE_RUNTIME_GATE_FAIL=CANONICAL_HOST_REQUIRED");
  process.exit(1);
}

const root = process.cwd();
const nextRoot = path.join(root, ".next");
const standaloneRoot = path.join(nextRoot, "standalone");
const fullStatic = path.join(nextRoot, "static");
const standaloneStatic = path.join(standaloneRoot, ".next", "static");
const buildId = fs.readFileSync(path.join(nextRoot, "BUILD_ID"), "utf8").trim();
const standaloneBuildId = fs.readFileSync(path.join(standaloneRoot, ".next", "BUILD_ID"), "utf8").trim();

function fail(message) {
  console.error(`STANDALONE_RUNTIME_GATE_FAIL=${message}`);
  process.exit(1);
}

function countFiles(directory) {
  if (!fs.existsSync(directory)) return 0;
  return fs.readdirSync(directory, { recursive: true, withFileTypes: true }).filter((entry) => entry.isFile()).length;
}

if (!buildId || buildId !== standaloneBuildId || countFiles(fullStatic) === 0 || countFiles(standaloneStatic) === 0) {
  fail("FILESYSTEM_GATE");
}

const base = new URL(probeUrl.endsWith("/") ? probeUrl : `${probeUrl}/`);
const login = new URL("login", base);
const loginResponse = await fetch(login, { redirect: "error" });
if (!loginResponse.ok) fail(`LOGIN_STATUS_${loginResponse.status}`);
const loginHtml = await loginResponse.text();
const scriptPaths = [...loginHtml.matchAll(/src="(\/_next\/static\/[^"?]+\.js(?:\?[^\"]*)?)"/g)].map((match) => match[1]);
if (scriptPaths.length === 0) fail("LOGIN_SCRIPT_LIST_EMPTY");

for (const scriptPath of scriptPaths) {
  const response = await fetch(new URL(scriptPath, base), { redirect: "error" });
  const contentType = response.headers.get("content-type") ?? "";
  if (response.status !== 200 || !/javascript|ecmascript/.test(contentType)) {
    fail(`SCRIPT_${response.status}_${scriptPath}`);
  }
}

const authProviders = await new Promise((resolve, reject) => {
  const request = http.request(
    new URL("api/auth/providers", base),
    {
      headers: {
        host: canonicalHost,
        "x-forwarded-host": canonicalHost,
        "x-forwarded-proto": "https",
        "x-forwarded-port": "443",
      },
    },
    (response) => {
      let body = "";
      response.setEncoding("utf8");
      response.on("data", (chunk) => (body += chunk));
      response.on("end", () => resolve({ status: response.statusCode ?? 0, body }));
    },
  );
  request.on("error", reject);
  request.end();
});
if (authProviders.status !== 200) fail(`AUTH_PROVIDERS_STATUS_${authProviders.status}`);
let providers;
try {
  providers = JSON.parse(authProviders.body);
} catch {
  fail("AUTH_PROVIDERS_JSON");
}
if (!providers.credentials) fail("CREDENTIALS_PROVIDER_MISSING");

console.log(
  JSON.stringify({
    status: "STANDALONE_RUNTIME_GATE_PASS",
    buildId,
    scriptCount: scriptPaths.length,
    loginStatus: loginResponse.status,
    authProvidersStatus: authProviders.status,
    credentialsProvider: true,
  }),
);
