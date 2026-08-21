const production = process.env.NODE_ENV === "production";
const required = ["DATABASE_URL", "AUTH_SECRET", "INTEGRATIONS_ENCRYPTION_KEY"];
const storage = ["S3_ENDPOINT", "S3_ACCESS_KEY", "S3_SECRET_KEY", "S3_BUCKET"];
const missing = [];

for (const name of required) {
  if (!process.env[name]) missing.push(name);
}

if (production) {
  for (const name of storage) {
    if (!process.env[name]) missing.push(name);
  }
}

if (process.env.DATABASE_URL && !/^postgres(?:ql)?:\/\//.test(process.env.DATABASE_URL)) {
  console.error("✗ DATABASE_URL يجب أن يبدأ بـ postgresql:// أو postgres://");
  process.exitCode = 1;
}

if (process.env.AUTH_SECRET && process.env.AUTH_SECRET.length < 32) {
  console.error("✗ AUTH_SECRET يجب أن يتكون من 32 محرفاً على الأقل.");
  process.exitCode = 1;
}

if (process.env.INTEGRATIONS_ENCRYPTION_KEY) {
  const keyLength = Buffer.from(process.env.INTEGRATIONS_ENCRYPTION_KEY, "base64").length;
  if (keyLength !== 32) {
    console.error("✗ INTEGRATIONS_ENCRYPTION_KEY يجب أن يفك إلى 32 بايت Base64.");
    process.exitCode = 1;
  }
}

if (missing.length) {
  console.error(`✗ متغيرات البيئة المطلوبة مفقودة: ${missing.join(", ")}`);
  process.exitCode = 1;
}

if (!process.exitCode) {
  console.log(`✓ عقد البيئة صالح لوضع ${production ? "الإنتاج" : "التطوير"}.`);
}
