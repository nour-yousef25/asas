const production = process.env.NODE_ENV === "production";
const required = ["DATABASE_URL", "AUTH_SECRET", "INTEGRATIONS_ENCRYPTION_KEY"];
const tenantStorage = ["TENANT_STORAGE_REFERENCE_DIRECTORY", "TENANT_STORAGE_CREDENTIAL_DIRECTORY"];
const missing = [];

for (const name of required) {
  if (!process.env[name]) missing.push(name);
}

if (production) {
  for (const name of tenantStorage) {
    if (!process.env[name]) missing.push(name);
  }
}

if (process.env.ASAS_LICENSE_REQUIRED === "true") {
  for (const name of ["ASAS_LICENSE_CERTIFICATE_PATH", "ASAS_LICENSE_KEYRING_PATH", "ASAS_LICENSE_REVOCATION_PATH", "ASAS_INSTANCE_ID"]) {
    if (!process.env[name]) missing.push(name);
  }
}

if (process.env.ASAS_SCHEDULER_HEARTBEAT_PATH || process.env.ASAS_SCHEDULER_MAX_LAG_SECONDS) {
  for (const name of ["ASAS_SCHEDULER_HEARTBEAT_PATH", "ASAS_SCHEDULER_MAX_LAG_SECONDS"]) {
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

for (const name of ["TENANT_STORAGE_ALLOWED_GROUP_ID", "ASAS_SCHEDULER_MAX_LAG_SECONDS"]) {
  if (process.env[name] && !/^(0|[1-9][0-9]{0,9})$/.test(process.env[name])) {
    console.error(`✗ ${name} يجب أن يكون عدداً صحيحاً موجباً أو صفراً ضمن النطاق المسموح.`);
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
