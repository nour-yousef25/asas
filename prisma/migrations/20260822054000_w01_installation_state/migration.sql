-- W01: metadata تشغيلية غير مدمرة لحالة Bootstrap الخاصة بالنسخة.
-- لا تعدل هذا migration جداول نطاقات الجمعية أو تحذف بيانات قائمة.
CREATE TYPE "InstallationStateStatus" AS ENUM ('UNCONFIGURED', 'PREFLIGHT_PASSED', 'COMPLETED', 'RECOVERY_UNLOCKED');

CREATE TABLE "installation_state" (
    "id" TEXT NOT NULL DEFAULT 'singleton',
    "status" "InstallationStateStatus" NOT NULL DEFAULT 'UNCONFIGURED',
    "releaseVersion" TEXT,
    "lastPreflightAt" TIMESTAMP(3),
    "completedAt" TIMESTAMP(3),
    "recoveryUnlockExpiresAt" TIMESTAMP(3),
    "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
    "updatedAt" TIMESTAMP(3) NOT NULL,
    CONSTRAINT "installation_state_pkey" PRIMARY KEY ("id")
);
