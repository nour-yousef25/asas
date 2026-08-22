/**
 * W01 INST-001 — آلة حالة Bootstrap صغيرة ومدققة وقابلة للاسترداد.
 */
import { InstallationStateStatus } from "@prisma/client";
import { prisma } from "@/lib/db";
import { logger } from "@/lib/logger";

const INSTALLATION_STATE_ID = "singleton";

export async function getInstallationState() {
  return prisma.installationState.findUnique({ where: { id: INSTALLATION_STATE_ID } });
}

export async function assertInstallerAvailable() {
  const state = await getInstallationState();
  if (!state || state.status === InstallationStateStatus.UNCONFIGURED || state.status === InstallationStateStatus.RECOVERY_UNLOCKED) {
    return state;
  }

  throw new Error("المثبت مقفل بعد اكتمال التهيئة؛ استخدم مسار الاسترداد الموقّع فقط.");
}

export async function recordPreflightSuccess(releaseVersion: string) {
  return prisma.installationState.upsert({
    where: { id: INSTALLATION_STATE_ID },
    create: {
      id: INSTALLATION_STATE_ID,
      status: InstallationStateStatus.PREFLIGHT_PASSED,
      releaseVersion,
      lastPreflightAt: new Date(),
    },
    update: {
      status: InstallationStateStatus.PREFLIGHT_PASSED,
      releaseVersion,
      lastPreflightAt: new Date(),
    },
  });
}

export async function unlockInstallerForRecovery(releaseVersion: string) {
  const expiresAt = new Date(Date.now() + 15 * 60 * 1000);
  const state = await prisma.installationState.upsert({
    where: { id: INSTALLATION_STATE_ID },
    create: {
      id: INSTALLATION_STATE_ID,
      status: InstallationStateStatus.RECOVERY_UNLOCKED,
      releaseVersion,
      recoveryUnlockExpiresAt: expiresAt,
    },
    update: {
      status: InstallationStateStatus.RECOVERY_UNLOCKED,
      releaseVersion,
      recoveryUnlockExpiresAt: expiresAt,
    },
  });

  await prisma.auditLog.create({
    data: {
      action: "INSTALLER_RECOVERY_UNLOCKED",
      entity: "InstallationState",
      entityId: INSTALLATION_STATE_ID,
      details: { expiresAt: expiresAt.toISOString() },
    },
  });
  logger.warn("Installer recovery unlock granted", { expiresAt: expiresAt.toISOString() });
  return state;
}

export async function markInstallationCompleted(releaseVersion: string) {
  return prisma.installationState.upsert({
    where: { id: INSTALLATION_STATE_ID },
    create: { id: INSTALLATION_STATE_ID, status: InstallationStateStatus.COMPLETED, releaseVersion, completedAt: new Date() },
    update: { status: InstallationStateStatus.COMPLETED, releaseVersion, completedAt: new Date(), recoveryUnlockExpiresAt: null },
  });
}
