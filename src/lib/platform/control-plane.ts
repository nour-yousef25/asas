/**
 * W01 DEP-002 — نموذج metadata الأدنى المسموح به في Control Plane.
 * يمنع هذا العقد تمرير أي بيانات مستفيدين أو معاملات أو أسرار تشغيلية إلى طبقة الترخيص/الإصدار.
 */
import { z } from "zod";
import { DEPLOYMENT_EDITIONS } from "@/lib/platform/contracts";

export const controlPlaneInstanceMetadataSchema = z
  .object({
    installationId: z.string().uuid(),
    edition: z.enum(DEPLOYMENT_EDITIONS),
    releaseVersion: z.string().min(1),
    releaseChannel: z.enum(["DEVELOPMENT", "BETA", "STABLE"]),
    supportContractRef: z.string().min(1).optional(),
    approvedDomain: z.string().min(1).optional(),
    observedAt: z.string().datetime({ offset: true }),
  })
  .strict();

export type ControlPlaneInstanceMetadata = z.infer<typeof controlPlaneInstanceMetadataSchema>;

export function validateControlPlaneMetadata(input: unknown): ControlPlaneInstanceMetadata {
  return controlPlaneInstanceMetadataSchema.parse(input);
}
