/**
 * W01 OBS-001 / HEALTH-001 — عامل النشر الدائم مع heartbeat صريح.
 * لا يبدأ من دون Redis حتى لا يقدم in-memory fallback نفسه كعامل إنتاجي.
 */
import { createPublicationWorker } from "@/lib/queue";
import { getRedis, closeRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";

const HEARTBEAT_KEY = "asas:health:worker:communications";
const HEARTBEAT_TTL_SECONDS = 90;
const HEARTBEAT_INTERVAL_MS = 30_000;

if (!process.env.REDIS_URL) {
  logger.error("Communications worker cannot start without REDIS_URL");
  process.exit(1);
}

const worker = createPublicationWorker();
let heartbeatTimer: NodeJS.Timeout | undefined;

async function publishHeartbeat() {
  await getRedis().set(
    HEARTBEAT_KEY,
    JSON.stringify({ role: "communications", updatedAt: new Date().toISOString(), pid: process.pid }),
    "EX",
    HEARTBEAT_TTL_SECONDS,
  );
}

async function shutdown(signal: string) {
  logger.info("Stopping communications worker", { signal });
  if (heartbeatTimer) clearInterval(heartbeatTimer);
  await getRedis().del(HEARTBEAT_KEY);
  await worker.close();
  await closeRedis();
  process.exit(0);
}

worker.on("failed", (job, error) => {
  logger.error("Publication job failed", error, { jobId: job?.id, publicationPlanId: job?.data.publicationPlanId });
});

worker.on("error", (error) => {
  logger.error("Communications worker error", error);
});

void publishHeartbeat()
  .then(() => {
    heartbeatTimer = setInterval(() => {
      void publishHeartbeat().catch((error) => logger.error("Worker heartbeat failed", error));
    }, HEARTBEAT_INTERVAL_MS);
    logger.info("Communications worker started", { heartbeatKey: HEARTBEAT_KEY });
  })
  .catch((error) => {
    logger.error("Communications worker failed to publish initial heartbeat", error);
    process.exit(1);
  });

process.on("SIGTERM", () => void shutdown("SIGTERM"));
process.on("SIGINT", () => void shutdown("SIGINT"));
