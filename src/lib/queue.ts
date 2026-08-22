import { JobsOptions, Queue, Worker } from "bullmq";
import { getRedis } from "@/lib/redis";
import { logger } from "@/lib/logger";
import { publishPlanById } from "@/lib/communications/publisher";

function getQueueConnection() {
  return getRedis();
}

type QueueLike<T> = {
  add(name: string, data: T, options?: JobsOptions): Promise<{ id: string }>;
};

class InMemoryQueue<T> implements QueueLike<T> {
  constructor(private readonly queueName: string) {}

  async add(name: string, _data: T, _options?: JobsOptions) {
    return { id: `${this.queueName}-${name}-${crypto.randomUUID()}` };
  }
}

function createQueue<T>(name: string): QueueLike<T> {
  if (!process.env.REDIS_URL) return new InMemoryQueue<T>(name);
  return new Queue<T>(name, {
    connection: getQueueConnection(),
    defaultJobOptions: {
      attempts: 3,
      backoff: { type: "exponential", delay: 2000 },
    },
  }) as unknown as QueueLike<T>;
}

export interface SMSJobData {
  phones: string[];
  templateId?: string;
  phrases: Record<string, string>;
  userId?: string;
}

export interface EmailJobData {
  to: string;
  subject: string;
  html: string;
}

export interface NotificationJobData {
  userId: string;
  title: string;
  message: string;
  type: "INFO" | "SUCCESS" | "WARNING" | "ERROR";
}

export interface PublicationJobData {
  publicationPlanId: string;
}

export function hasDurableQueue() {
  return Boolean(process.env.REDIS_URL);
}

export const smsQueue = createQueue<SMSJobData>("sms");
export const emailQueue = createQueue<EmailJobData>("email");
export const notificationQueue = createQueue<NotificationJobData>("notification");
export const publicationQueue = createQueue<PublicationJobData>("communications-publication");

export function createSMSWorker() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL مطلوب لتشغيل عامل الرسائل في الخلفية.");
  }
  return new Worker<SMSJobData>(
    "sms",
    async (job) => {
      const { phones, templateId, phrases } = job.data;
      console.log(`Processing SMS job ${job.id} for ${phones.length} phones`);

      let sent = 0;
      let failed = 0;

      for (const phone of phones) {
        try {
          // TODO: Integrate with real SMS provider (Mobily, etc.)
          console.log(`[SMS] Sending to ${phone}: template=${templateId}`, phrases);
          sent++;
          await job.updateProgress(sent / phones.length);
        } catch (error) {
          console.error(`[SMS] Failed to send to ${phone}:`, error);
          failed++;
        }
      }

      return { sent, failed, total: phones.length };
    },
    { connection: getQueueConnection(), concurrency: 5 }
  );
}

export function createNotificationWorker() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL مطلوب لتشغيل عامل الإشعارات في الخلفية.");
  }
  return new Worker<NotificationJobData>(
    "notification",
    async (job) => {
      const { userId, title, message, type } = job.data;
      console.log(`[Notification] ${type}: ${title} -> user ${userId}`);

      // TODO: Save to database and push via WebSocket
      const { prisma } = await import("@/lib/db");
      await prisma.notification.create({
        data: { userId, title, content: message, type },
      });

      return { success: true };
    },
    { connection: getQueueConnection(), concurrency: 10 }
  );
}

export function createPublicationWorker() {
  if (!process.env.REDIS_URL) {
    throw new Error("REDIS_URL مطلوب لتشغيل عامل النشر في الخلفية.");
  }

  return new Worker<PublicationJobData>(
    "communications-publication",
    async (job) => {
      logger.info("Processing publication job", { jobId: job.id, publicationPlanId: job.data.publicationPlanId });
      return publishPlanById(job.data.publicationPlanId);
    },
    { connection: getQueueConnection(), concurrency: 3 },
  );
}
