/** W02 queue quarantine: global legacy queues are compatibility exports that fail closed. */
import type { JobsOptions } from "bullmq";
import { TenantQueueBoundaryError } from "@/lib/tenant-queue";

type QueueLike<T> = { add(name: string, data: T, options?: JobsOptions): Promise<{ id: string }> };

class QuarantinedQueue<T> implements QueueLike<T> {
  async add(_name: string, _data: T, _options?: JobsOptions): Promise<{ id: string }> {
    throw new TenantQueueBoundaryError("QUEUE_LEGACY_SURFACE_QUARANTINED");
  }
}

export interface SMSJobData { phones: string[]; templateId?: string; phrases: Record<string, string>; userId?: string; }
export interface EmailJobData { to: string; subject: string; html: string; }
export interface NotificationJobData { userId: string; title: string; message: string; type: "INFO" | "SUCCESS" | "WARNING" | "ERROR"; }
export interface PublicationJobData { publicationPlanId: string; }

export const smsQueue = new QuarantinedQueue<SMSJobData>();
export const emailQueue = new QuarantinedQueue<EmailJobData>();
export const notificationQueue = new QuarantinedQueue<NotificationJobData>();
export const publicationQueue = new QuarantinedQueue<PublicationJobData>();

/** Legacy durability was only REDIS_URL presence; it must never be treated as tenant queue readiness. */
export function hasDurableQueue() { return false; }
export function createSMSWorker(): never { throw new TenantQueueBoundaryError("QUEUE_LEGACY_SURFACE_QUARANTINED"); }
export function createNotificationWorker(): never { throw new TenantQueueBoundaryError("QUEUE_LEGACY_SURFACE_QUARANTINED"); }
export function createPublicationWorker(): never { throw new TenantQueueBoundaryError("QUEUE_LEGACY_SURFACE_QUARANTINED"); }
