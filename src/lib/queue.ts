import { Queue, Worker } from "bullmq";
import { getRedis } from "@/lib/redis";

function getQueueConnection() {
  return getRedis();
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

export const smsQueue = new Queue<SMSJobData>("sms", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const emailQueue = new Queue<EmailJobData>("email", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 3,
    backoff: { type: "exponential", delay: 2000 },
  },
});

export const notificationQueue = new Queue<NotificationJobData>("notification", {
  connection: getQueueConnection(),
  defaultJobOptions: {
    attempts: 2,
    backoff: { type: "fixed", delay: 1000 },
  },
});

export function createSMSWorker() {
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
  return new Worker<NotificationJobData>(
    "notification",
    async (job) => {
      const { userId, title, message, type } = job.data;
      console.log(`[Notification] ${type}: ${title} -> user ${userId}`);

      // TODO: Save to database and push via WebSocket
      const { prisma } = await import("@/lib/db");
      await prisma.notification.create({
        data: { userId, title, message, type },
      });

      return { success: true };
    },
    { connection: getQueueConnection(), concurrency: 10 }
  );
}
