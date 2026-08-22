import { createPrivateKey, sign } from "node:crypto";
import { readFile, writeFile } from "node:fs/promises";

const [inputPath, outputPath] = process.argv.slice(2);
const keyPath = process.env.ASAS_RELEASE_SIGNING_KEY_PATH;
const keyId = process.env.ASAS_RELEASE_SIGNING_KEY_ID;

if (!inputPath || !outputPath || !keyPath || !keyId) {
  console.error("الاستخدام: ASAS_RELEASE_SIGNING_KEY_PATH=<pem> ASAS_RELEASE_SIGNING_KEY_ID=<id> npm run release:sign -- <payload.json> <manifest.json>");
  process.exit(1);
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

try {
  const [payloadText, privateKeyText] = await Promise.all([readFile(inputPath, "utf8"), readFile(keyPath, "utf8")]);
  const payload = JSON.parse(payloadText);
  if (payload.signature) throw new Error("Payload الإدخال يجب ألا يحتوي حقل signature.");
  const signature = sign(null, Buffer.from(stableJson(payload)), createPrivateKey(privateKeyText)).toString("base64");
  const manifest = { ...payload, signature: { keyId, algorithm: "ed25519", value: signature } };
  await writeFile(outputPath, `${JSON.stringify(manifest, null, 2)}\n`, { mode: 0o600 });
  console.log(JSON.stringify({ signed: true, release: payload.release?.version, keyId, outputPath }));
} catch (error) {
  console.error(JSON.stringify({ signed: false, error: error instanceof Error ? error.message : "Release manifest signing failed" }));
  process.exit(1);
}
