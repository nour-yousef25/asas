import { verify } from "node:crypto";
import { readFile } from "node:fs/promises";

const [manifestPath] = process.argv.slice(2);
const serializedKeyring = process.env.ASAS_RELEASE_PUBLIC_KEYS_JSON;

if (!manifestPath || !serializedKeyring) {
  console.error("الاستخدام: ASAS_RELEASE_PUBLIC_KEYS_JSON='<key-id/public-key map>' npm run release:verify -- <manifest.json>");
  process.exit(1);
}

function stableJson(value) {
  if (value === null || typeof value !== "object") return JSON.stringify(value);
  if (Array.isArray(value)) return `[${value.map(stableJson).join(",")}]`;
  return `{${Object.keys(value).sort().map((key) => `${JSON.stringify(key)}:${stableJson(value[key])}`).join(",")}}`;
}

try {
  const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
  const keyring = JSON.parse(serializedKeyring);
  if (!manifest.signature?.keyId || manifest.signature?.algorithm !== "ed25519" || !manifest.signature?.value) {
    throw new Error("Manifest لا يحتوي توقيع ed25519 صالحاً.");
  }
  const publicKey = keyring[manifest.signature.keyId];
  if (typeof publicKey !== "string") throw new Error("معرف مفتاح التوقيع غير موثوق.");
  const { signature, ...payload } = manifest;
  if (!verify(null, Buffer.from(stableJson(payload)), publicKey, Buffer.from(signature.value, "base64"))) {
    throw new Error("توقيع Manifest الإصدار غير صالح.");
  }
  console.log(JSON.stringify({ verified: true, release: manifest.release?.version, keyId: signature.keyId }));
} catch (error) {
  console.error(JSON.stringify({ verified: false, error: error instanceof Error ? error.message : "Release manifest verification failed" }));
  process.exit(1);
}
