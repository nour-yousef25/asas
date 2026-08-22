/**
 * W01 runtime integration harness. It deliberately runs through tsx instead
 * of Jest because BullMQ's ESM dependency graph is exercised in the actual
 * Node runtime. It requires a real Redis instance and an isolated audit DB.
 */
import { randomUUID } from "node:crypto";
import { mkdir, writeFile } from "node:fs/promises";
import path from "node:path";
import { createRequire } from "node:module";
import { spawn, type ChildProcess } from "node:child_process";
import { Queue, QueueEvents, Worker } from "bullmq";
import Redis from "ioredis";
import { prisma } from "@/lib/db";
import { collectHealthReport } from "@/lib/health/health-service";
import { createQueueEventsRedisConnection, createWorkerRedisConnection, getRedis, closeRedis } from "@/lib/redis";
import { createNotificationWorker, notificationQueue } from "@/lib/queue";

const timeoutMs = 15_000;
const heartbeatStaleTimeoutMs = 15_000;
const heartbeatKey = "asas:health:worker:communications";
const evidencePath = path.resolve(process.cwd(), "artifacts/w01/redis-bullmq-integration-evidence.json");
const require = createRequire(import.meta.url);
const tsxCliPath = require.resolve("tsx/cli");
const runId = `W01-BULLMQ-${new Date().toISOString().replace(/[:.]/g, "-")}-${randomUUID().slice(0, 8)}`;
const evidence: { runId: string; startedAt: string; stages: Array<Record<string, unknown>>; finalStatus?: "PASS" | "BLOCKED"; error?: string } = {
  runId,
  startedAt: new Date().toISOString(),
  stages: [],
};

let communicationsWorker: ChildProcess | undefined;
let notificationWorker: Worker | undefined;
let retryWorker: Worker | undefined;
let retryEvents: QueueEvents | undefined;
let retryQueue: Queue | undefined;
let testNotificationTitle: string | undefined;
let communicationsWorkerGroupId: number | undefined;
let communicationsWorkerStopped = false;
const communicationsWorkerOutput: string[] = [];

function record(stage: string, status: "PASS" | "FAIL", details: Record<string, unknown> = {}) {
  evidence.stages.push({ stage, timestamp: new Date().toISOString(), ...details, status });
  console.log(`${stage}: ${status}${Object.keys(details).length ? ` ${JSON.stringify(details)}` : ""}`);
}

function requireEnvironment(name: string) {
  if (!process.env[name]) throw new Error(`INFRASTRUCTURE_PRECONDITION_FAILED: ${name} is required.`);
}

function withTimeout<T>(stage: string, task: Promise<T>, stageTimeoutMs = timeoutMs): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    const timer = setTimeout(() => reject(new Error(`TIMEOUT: ${stage}`)), stageTimeoutMs);
    task.then(
      (value) => {
        clearTimeout(timer);
        resolve(value);
      },
      (error) => {
        clearTimeout(timer);
        reject(error);
      },
    );
  });
}

async function waitFor<T>(stage: string, probe: () => Promise<T | undefined>, stageTimeoutMs = timeoutMs): Promise<T> {
  const deadline = Date.now() + stageTimeoutMs;
  while (Date.now() < deadline) {
    const result = await probe();
    if (result !== undefined) return result;
    await new Promise((resolve) => setTimeout(resolve, 150));
  }
  throw new Error(`TIMEOUT: ${stage}`);
}

async function writeEvidence() {
  await mkdir(path.dirname(evidencePath), { recursive: true });
  await writeFile(evidencePath, `${JSON.stringify(evidence, null, 2)}\n`, "utf8");
}

function processGroupExists(processGroupId: number): boolean {
  try {
    process.kill(-processGroupId, 0);
    return true;
  } catch (error) {
    if ((error as NodeJS.ErrnoException).code === "ESRCH") return false;
    throw error;
  }
}

async function stopCommunicationsWorker(): Promise<void> {
  if (communicationsWorkerStopped) return;
  if (!communicationsWorker) return;
  if (!communicationsWorkerGroupId) throw new Error("WORKER_PROCESS_GROUP_MISSING");

  const processGroupId = communicationsWorkerGroupId;
  const heartbeatBeforeStop = await getRedis().get(heartbeatKey);
  let exit = { code: communicationsWorker.exitCode, signal: communicationsWorker.signalCode };
  let terminationMode: "SIGTERM" | "SIGKILL" = "SIGTERM";
  if (communicationsWorker.exitCode === null && processGroupExists(processGroupId)) {
    const exited = new Promise<{ code: number | null; signal: NodeJS.Signals | null }>((resolve) =>
      communicationsWorker?.once("exit", (code, signal) => resolve({ code, signal })),
    );
    process.kill(-processGroupId, "SIGTERM");
    try {
      exit = await withTimeout("communications worker graceful shutdown", exited);
    } catch {
      terminationMode = "SIGKILL";
      if (processGroupExists(processGroupId)) process.kill(-processGroupId, "SIGKILL");
      exit = await withTimeout("communications worker forced shutdown", exited, 5_000);
    }
  }

  await waitFor(
    "communications heartbeat stale detection",
    async () => (await getRedis().get(heartbeatKey)) === null ? true : undefined,
    heartbeatStaleTimeoutMs,
  );

  await waitFor(
    "communications worker process group termination",
    async () => processGroupExists(processGroupId) ? undefined : true,
    5_000,
  );

  record("[12] Worker Stop", "PASS", {
    processGroupId,
    workerExit: exit,
    terminationMode,
    heartbeatBeforeStop,
    heartbeatAfterStop: null,
    processGroupTerminated: true,
    workerOutput: communicationsWorkerOutput.slice(-10),
  });
  communicationsWorkerStopped = true;
}

async function cleanup() {
  const cleanupErrors: string[] = [];
  if (testNotificationTitle) {
    try {
      await prisma.notification.deleteMany({ where: { title: testNotificationTitle } });
    } catch (error) {
      cleanupErrors.push(`notification cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  const workerClosures = await Promise.allSettled([notificationWorker?.close(), retryWorker?.close(), retryEvents?.close()]);
  for (const result of workerClosures) {
    if (result.status === "rejected") cleanupErrors.push(`worker cleanup: ${String(result.reason)}`);
  }
  if (retryQueue) {
    try {
      await retryQueue.obliterate({ force: true });
      await retryQueue.close();
    } catch (error) {
      cleanupErrors.push(`retry queue cleanup: ${error instanceof Error ? error.message : String(error)}`);
    }
  }
  try {
    await stopCommunicationsWorker();
  } catch (error) {
    cleanupErrors.push(`communications worker cleanup: ${error instanceof Error ? error.message : String(error)}`);
  }
  try {
    await closeRedis();
    await prisma.$disconnect();
  } catch (error) {
    cleanupErrors.push(`connection cleanup: ${error instanceof Error ? error.message : String(error)}`);
  }
  record("[14] Cleanup", cleanupErrors.length === 0 ? "PASS" : "FAIL", { cleanupErrors, noLeakedWorkerGroup: cleanupErrors.length === 0 });
  if (cleanupErrors.length > 0) throw new Error(`CLEANUP_STATUS_FAILED: ${cleanupErrors.join("; ")}`);
}

async function readHealth() {
  return collectHealthReport(
    {
      database: async () => prisma.$queryRaw`SELECT 1`.then(() => undefined),
      redis: async () => getRedis().ping().then(() => undefined),
      workerHeartbeat: async () => Boolean(await getRedis().get(heartbeatKey)),
    },
    { ...process.env, ASAS_INSTANCE_ROLE: "ALL" },
  );
}

async function main() {
  requireEnvironment("REDIS_URL");
  requireEnvironment("DATABASE_URL");
  console.log("W01 REDIS/BULLMQ INTEGRATION");

  await withTimeout("redis precondition", getRedis().ping());
  record("[1] Redis", "PASS", { urlConfigured: true });
  await withTimeout("database precondition", prisma.$queryRaw`SELECT 1`);
  record("[2] Database", "PASS", { auditDatabase: true });

  const user = await prisma.user.findUniqueOrThrow({ where: { email: "admin@asas.sa" } });
  notificationWorker = createNotificationWorker();
  await withTimeout("notification worker ready", notificationWorker.waitUntilReady());
  record("[3] Queue", "PASS", { queue: "notification" });
  record("[4] Worker", "PASS", { worker: "createNotificationWorker" });

  testNotificationTitle = `${runId}-notification`;
  const received = new Promise<void>((resolve, reject) => {
    notificationWorker?.on("completed", (job) => {
      if (job.data.title === testNotificationTitle) resolve();
    });
    notificationWorker?.on("failed", (job, error) => {
      if (job?.data.title === testNotificationTitle) reject(error);
    });
  });
  const job = await notificationQueue.add("w01-integration-notification", {
    userId: user.id,
    title: testNotificationTitle,
    message: "Real Redis/BullMQ integration evidence.",
    type: "INFO",
  });
  record("[5] Job Created", "PASS", { queue: "notification", jobId: job.id });
  await withTimeout("notification job completion", received);
  record("[6] Job Received", "PASS", { jobId: job.id });
  const notification = await prisma.notification.findFirst({ where: { userId: user.id, title: testNotificationTitle } });
  if (!notification) throw new Error("JOB_DATABASE_EFFECT_FAILED: notification record was not persisted.");
  record("[7] DB Effect", "PASS", { table: "notifications", identifier: notification.id, status: notification.type, timestamp: notification.createdAt.toISOString() });
  if ((await job.getState()) !== "completed") throw new Error("JOB_COMPLETION_FAILED: job is not completed.");
  record("[8] Job Complete", "PASS", { jobId: job.id, state: "completed" });

  const retryQueueName = `${runId.toLowerCase()}-retry`;
  retryQueue = new Queue(retryQueueName, { connection: getRedis() });
  retryEvents = new QueueEvents(retryQueueName, { connection: createQueueEventsRedisConnection() });
  const retryQueueEvents: Array<Record<string, unknown>> = [];
  for (const eventName of ["waiting", "active", "failed", "completed"] as const) {
    retryEvents.on(eventName, (event) => retryQueueEvents.push({ eventName, event }));
  }
  let attempts = 0;
  retryWorker = new Worker(
    retryQueueName,
    async () => {
      attempts += 1;
      if (attempts === 1) throw new Error("W01 controlled retry injection");
      return { attempts };
    },
    { connection: createWorkerRedisConnection() },
  );
  await Promise.all([retryEvents.waitUntilReady(), retryWorker.waitUntilReady()]);
  const retryJob = await retryQueue.add("w01-controlled-retry", { runId }, { attempts: 2, backoff: { type: "fixed", delay: 50 } });
  const retryResult = await withTimeout("retry completion", retryJob.waitUntilFinished(retryEvents, timeoutMs));
  if (attempts !== 2 || (await retryJob.getState()) !== "completed") throw new Error("RETRY_FAILED: expected one failure and one successful retry.");
  record("[9] Retry", "PASS", { jobId: retryJob.id, attempts, result: retryResult, queueEvents: retryQueueEvents });

  await getRedis().del(heartbeatKey);
  communicationsWorker = spawn(process.execPath, [tsxCliPath, "src/workers/communications-worker.ts"], {
    cwd: process.cwd(),
    env: { ...process.env, ASAS_INSTANCE_ROLE: "WORKER" },
    stdio: ["ignore", "pipe", "pipe"],
    detached: true,
  });
  communicationsWorkerGroupId = communicationsWorker.pid;
  communicationsWorker.stdout?.on("data", (chunk) => communicationsWorkerOutput.push(chunk.toString().trim()));
  communicationsWorker.stderr?.on("data", (chunk) => communicationsWorkerOutput.push(chunk.toString().trim()));
  if (!communicationsWorkerGroupId) throw new Error("WORKER_PROCESS_GROUP_CREATION_FAILED");
  const heartbeat = await waitFor("worker heartbeat", async () => {
    const value = await getRedis().get(heartbeatKey);
    return value ? JSON.parse(value) as { updatedAt: string; pid: number } : undefined;
  });
  record("[10] Heartbeat", "PASS", { key: heartbeatKey, storage: "Redis", frequencyMs: 30_000, workerPid: heartbeat.pid, updatedAt: heartbeat.updatedAt });

  const normalHealth = await readHealth();
  const normalRelevant = normalHealth.checks.filter((check) => ["redis", "queue", "worker"].includes(check.name));
  if (normalRelevant.some((check) => check.status !== "HEALTHY")) throw new Error("HEALTH_COMPONENTS_FAILED: Redis/Queue/Worker were not healthy.");
  record("[11] Health", "PASS", { componentChecks: normalRelevant, overall: normalHealth.status });

  const unavailableRedis = new Redis("redis://127.0.0.1:6390", { connectTimeout: 500, maxRetriesPerRequest: 1, lazyConnect: true });
  const expectedRedisErrors: string[] = [];
  unavailableRedis.on("error", (error) => expectedRedisErrors.push(error.message));
  const redisFailureHealth = await collectHealthReport(
    { database: async () => prisma.$queryRaw`SELECT 1`.then(() => undefined), redis: async () => unavailableRedis.ping().then(() => undefined), workerHeartbeat: async () => false },
    { ...process.env, ASAS_INSTANCE_ROLE: "ALL" },
  );
  await unavailableRedis.disconnect();
  const redisCheck = redisFailureHealth.checks.find((check) => check.name === "redis");
  if (redisFailureHealth.status === "HEALTHY" || redisCheck?.status === "HEALTHY") throw new Error("REDIS_FAILURE_NOT_DETECTED");
  await stopCommunicationsWorker();
  const workerFailureHealth = await readHealth();
  const workerCheck = workerFailureHealth.checks.find((check) => check.name === "worker");
  if (workerCheck?.status === "HEALTHY") throw new Error("WORKER_FAILURE_NOT_DETECTED");
  record("[13] Failure Test", "PASS", { expectedRedisFailure: "ECONNREFUSED 127.0.0.1:6390", redisErrors: expectedRedisErrors, redisOverall: redisFailureHealth.status, redisStatus: redisCheck?.status, workerStatus: workerCheck?.status });

  evidence.finalStatus = "PASS";
}

main()
  .catch((error: unknown) => {
    evidence.finalStatus = "BLOCKED";
    evidence.error = error instanceof Error ? error.message : String(error);
    record("FINAL STATUS", "FAIL", { error: evidence.error });
    process.exitCode = 1;
  })
  .finally(async () => {
    try {
      await cleanup();
    } catch (error) {
      evidence.finalStatus = "BLOCKED";
      evidence.error ??= error instanceof Error ? error.message : String(error);
      process.exitCode = 1;
    } finally {
      await writeEvidence();
      console.log(`Evidence: ${evidencePath}`);
      console.log(`FINAL STATUS: ${evidence.finalStatus ?? "BLOCKED"}`);
      process.exit(process.exitCode ?? (evidence.finalStatus === "PASS" ? 0 : 1));
    }
  });
