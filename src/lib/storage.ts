/** Legacy raw-object API quarantine. Tenant private artifacts live in private-artifact.ts. */
export class LegacyStorageSurfaceQuarantinedError extends Error {}

function denied(): never { throw new LegacyStorageSurfaceQuarantinedError("LEGACY_STORAGE_SURFACE_QUARANTINED"); }

export async function uploadFile(): Promise<never> { return denied(); }
export async function deleteFile(): Promise<never> { return denied(); }
export async function getSignedUrl(): Promise<never> { return denied(); }
