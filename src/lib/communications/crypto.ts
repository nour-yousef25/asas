import { createCipheriv, createDecipheriv, randomBytes } from "node:crypto";

const ALGORITHM = "aes-256-gcm";
const VERSION = "v1";

function encryptionKey() {
  const raw = process.env.INTEGRATIONS_ENCRYPTION_KEY;
  if (!raw) {
    throw new Error("مفتاح INTEGRATIONS_ENCRYPTION_KEY مطلوب لتشفير بيانات القنوات.");
  }

  const key = Buffer.from(raw, "base64");
  if (key.length !== 32) {
    throw new Error("يجب أن يكون INTEGRATIONS_ENCRYPTION_KEY مفتاح Base64 بطول 32 بايت.");
  }

  return key;
}

export function encryptSecret(value: string) {
  const iv = randomBytes(12);
  const cipher = createCipheriv(ALGORITHM, encryptionKey(), iv);
  const ciphertext = Buffer.concat([cipher.update(value, "utf8"), cipher.final()]);
  const tag = cipher.getAuthTag();
  return [VERSION, iv.toString("base64url"), tag.toString("base64url"), ciphertext.toString("base64url")].join(".");
}

export function decryptSecret(value: string) {
  const [version, ivPart, tagPart, ciphertextPart] = value.split(".");
  if (version !== VERSION || !ivPart || !tagPart || !ciphertextPart) {
    throw new Error("صيغة السر المشفر غير صالحة.");
  }

  const decipher = createDecipheriv(ALGORITHM, encryptionKey(), Buffer.from(ivPart, "base64url"));
  decipher.setAuthTag(Buffer.from(tagPart, "base64url"));
  return Buffer.concat([decipher.update(Buffer.from(ciphertextPart, "base64url")), decipher.final()]).toString("utf8");
}
