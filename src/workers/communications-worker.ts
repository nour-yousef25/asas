/** W02: legacy global communications worker is intentionally unavailable pending tenant queue provider wiring. */
import { TenantQueueBoundaryError } from "@/lib/tenant-queue";

throw new TenantQueueBoundaryError("QUEUE_LEGACY_WORKER_QUARANTINED");
