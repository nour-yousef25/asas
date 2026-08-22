import Redis, { type RedisOptions } from "ioredis";

const redisUrl = process.env.REDIS_URL;

let producerRedis: Redis | null = null;

function getRedisUrl(): string {
  if (!redisUrl) {
    throw new Error("REDIS_URL مطلوب لتشغيل اتصال Redis دائم.");
  }
  return redisUrl;
}

function createRedisConnection(role: "producer" | "worker" | "queue-events"): Redis {
  const options: RedisOptions = {
    enableReadyCheck: true,
    lazyConnect: true,
    // BullMQ workers keep blocking commands open and therefore require this value to be null.
    maxRetriesPerRequest: role === "producer" ? 3 : null,
  };
  const client = new Redis(getRedisUrl(), options);

  client.on("error", (err) => {
    console.error(`Redis ${role} connection error:`, err.message);
  });
  client.on("connect", () => {
    console.log(`Redis ${role} connected`);
  });

  return client;
}

export function getRedis(): Redis {
  if (!producerRedis) {
    producerRedis = createRedisConnection("producer");
  }
  return producerRedis;
}

/**
 * Creates a dedicated BullMQ Worker connection. It must never be shared with
 * request producers because BullMQ uses blocking Redis commands for workers.
 */
export function createWorkerRedisConnection(): Redis {
  return createRedisConnection("worker");
}

/** QueueEvents uses blocking Redis commands and follows the same retry contract as workers. */
export function createQueueEventsRedisConnection(): Redis {
  return createRedisConnection("queue-events");
}

export async function closeRedis(): Promise<void> {
  if (producerRedis) {
    await producerRedis.quit();
    producerRedis = null;
  }
}
