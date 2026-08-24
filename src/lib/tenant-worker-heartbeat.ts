/** Dedicated liveness contract for the tenant-scoped publication supervisor. */
export const TENANT_PUBLICATION_SUPERVISOR_HEARTBEAT_KEY = "asas:health:worker:tenant-publication-supervisor";
export const TENANT_PUBLICATION_SUPERVISOR_HEARTBEAT_TTL_SECONDS = 90;
export const TENANT_PUBLICATION_SUPERVISOR_HEARTBEAT_INTERVAL_MS = 30_000;
