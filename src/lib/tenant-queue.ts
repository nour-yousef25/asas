/** W02 Queue boundary: tenant workers use injected per-tenant Redis authority; never REDIS_URL/global fallback. */
import { randomUUID } from "node:crypto";
import { Queue, Worker, type JobsOptions, type Job } from "bullmq";
import type Redis from "ioredis";
import type { TenantContext } from "@/lib/tenant-context";
import type { TenantBoundPrismaExecutor } from "@/lib/tenant-bound-prisma-authority";
import { evaluatePermission } from "@/lib/policy";

export const PUBLICATION_DISPATCH_PERMISSION = "communications.publication.schedule";
const envelopeVersion = 1 as const;

export class TenantQueueBoundaryError extends Error {
  constructor(public readonly code: string) { super(code); this.name = "TenantQueueBoundaryError"; }
}

export type TenantQueueConnectionRequest = Readonly<{ organizationId: string; correlationId: string; workload: "publication" }>;
export type TenantQueueCheckout = Readonly<{ principalName: string; redis: Redis; discard: () => Promise<void> }>;
export interface TenantQueueConnectionProvider { checkout(request: TenantQueueConnectionRequest): Promise<TenantQueueCheckout>; }

export type TenantPublicationEnvelope = Readonly<{
  version: typeof envelopeVersion;
  organizationId: string;
  membershipId: string;
  userId: string;
  sessionVersion: number;
  policySnapshotVersion: number;
  correlationId: string;
  dispatchId: string;
  publicationPlanId: string;
}>;

let installedProvider: TenantQueueConnectionProvider | undefined;

export function installTenantQueueConnectionProvider(provider: TenantQueueConnectionProvider) {
  if (installedProvider) throw new TenantQueueBoundaryError("TENANT_QUEUE_PROVIDER_ALREADY_INSTALLED");
  installedProvider = provider;
}

export function requireTenantQueueConnectionProvider() {
  if (!installedProvider) throw new TenantQueueBoundaryError("TENANT_QUEUE_PROVIDER_UNCONFIGURED");
  return installedProvider;
}

export function hasTenantDurableQueue() { return Boolean(installedProvider); }

function assertIdentifier(value: string, field: string) {
  if (!/^[a-zA-Z0-9_-]{8,128}$/.test(value)) throw new TenantQueueBoundaryError(`QUEUE_${field.toUpperCase()}_INVALID`);
  return value;
}

export function publicationQueueName(organizationId: string) {
  return `asas_tenant_${assertIdentifier(organizationId, "organization")}_publication`;
}

export function publicationDeadLetterQueueName(organizationId: string) {
  return `asas_tenant_${assertIdentifier(organizationId, "organization")}_publication_dead_letter`;
}

export function tenantQueueKeyPattern(organizationId: string) {
  return `bull:asas_tenant_${assertIdentifier(organizationId, "organization")}_*`;
}

export function tenantRedisAclKeyPatterns(organizationId: string) {
  const identifier = assertIdentifier(organizationId, "organization");
  return [`~${tenantQueueKeyPattern(identifier)}`, `~asas:tenant:${identifier}:*`] as const;
}

export function tenantCacheKey(organizationId: string, segment: string) {
  if (!/^[a-z0-9:_-]{1,96}$/.test(segment)) throw new TenantQueueBoundaryError("QUEUE_CACHE_SEGMENT_INVALID");
  return `asas:tenant:${assertIdentifier(organizationId, "organization")}:cache:${segment}`;
}

function asContext(job: TenantPublicationEnvelope): TenantContext {
  return Object.freeze({ organizationId: job.organizationId, membershipId: job.membershipId, userId: job.userId, sessionVersion: job.sessionVersion, policySnapshotVersion: job.policySnapshotVersion, correlationId: job.correlationId });
}

function validateEnvelope(data: unknown, expectedOrganizationId: string, jobId: string | undefined): TenantPublicationEnvelope {
  if (!data || typeof data !== "object") throw new TenantQueueBoundaryError("QUEUE_ENVELOPE_INVALID");
  const value = data as Partial<TenantPublicationEnvelope>;
  if (value.version !== envelopeVersion || value.organizationId !== expectedOrganizationId || typeof value.dispatchId !== "string" || value.dispatchId !== jobId || typeof value.membershipId !== "string" || typeof value.userId !== "string" || typeof value.sessionVersion !== "number" || typeof value.policySnapshotVersion !== "number" || typeof value.correlationId !== "string" || typeof value.publicationPlanId !== "string") throw new TenantQueueBoundaryError("QUEUE_ENVELOPE_INVALID");
  assertIdentifier(value.organizationId, "organization");
  return Object.freeze(value as TenantPublicationEnvelope);
}

export async function enqueuePublication(input: { context: TenantContext; publicationPlanId: string; delay: number; options?: JobsOptions }) {
  const provider = requireTenantQueueConnectionProvider();
  assertIdentifier(input.context.organizationId, "organization");
  assertIdentifier(input.publicationPlanId, "publication_plan");
  const permission = await evaluatePermission(input.context, PUBLICATION_DISPATCH_PERMISSION);
  if (!permission.allowed) throw new TenantQueueBoundaryError(`QUEUE_PERMISSION_${permission.reason}`);
  const envelope: TenantPublicationEnvelope = Object.freeze({ version: envelopeVersion, ...input.context, dispatchId: randomUUID(), publicationPlanId: input.publicationPlanId });
  const checkout = await provider.checkout({ organizationId: input.context.organizationId, correlationId: input.context.correlationId, workload: "publication" });
  const queue = new Queue<TenantPublicationEnvelope>(publicationQueueName(input.context.organizationId), { connection: checkout.redis, defaultJobOptions: { attempts: 4, backoff: { type: "exponential", delay: 30_000 } } });
  try {
    const job = await queue.add("publication", envelope, { ...input.options, jobId: envelope.dispatchId, delay: input.delay });
    return { id: String(job.id), envelope };
  } finally {
    await queue.close();
    await checkout.discard();
  }
}

export type TenantPublicationJobHandler = (input: Readonly<{ context: TenantContext; publicationPlanId: string }>) => Promise<unknown>;

export async function createTenantPublicationWorker(input: Readonly<{ organizationId: string; executor: TenantBoundPrismaExecutor; handler: TenantPublicationJobHandler; provider?: TenantQueueConnectionProvider }>) {
  const provider = input.provider ?? requireTenantQueueConnectionProvider();
  const checkout = await provider.checkout({ organizationId: input.organizationId, correlationId: `queue-worker-${randomUUID()}`, workload: "publication" });
  try {
    const worker = new Worker<TenantPublicationEnvelope>(publicationQueueName(input.organizationId), async (job: Job<TenantPublicationEnvelope>) => {
      const envelope = validateEnvelope(job.data, input.organizationId, job.id ? String(job.id) : undefined);
      const context = asContext(envelope);
      const permission = await evaluatePermission(context, PUBLICATION_DISPATCH_PERMISSION);
      if (!permission.allowed) throw new TenantQueueBoundaryError(`QUEUE_PERMISSION_${permission.reason}`);
      const plan = await input.executor.execute(context, (db) => db.publicationPlan.findFirst({ where: { id: envelope.publicationPlanId, organizationId: context.organizationId }, select: { id: true, scheduledAt: true, status: true } }));
      if (!plan) throw new TenantQueueBoundaryError("QUEUE_RESOURCE_ORGANIZATION_MISMATCH");
      if (plan.scheduledAt && plan.scheduledAt > new Date()) throw new TenantQueueBoundaryError("QUEUE_RESOURCE_NOT_DUE");
      return input.handler({ context, publicationPlanId: plan.id });
    }, { connection: checkout.redis, concurrency: 1 });
    worker.on("failed", async (job) => {
      if (!job || job.attemptsMade + 1 < (job.opts.attempts ?? 1)) return;
      const deadLetter = new Queue<TenantPublicationEnvelope>(publicationDeadLetterQueueName(input.organizationId), { connection: checkout.redis });
      try {
        await deadLetter.add("publication-dead-letter", job.data, { jobId: String(job.id), removeOnComplete: false, removeOnFail: false });
      } finally {
        await deadLetter.close();
      }
    });
    let closed = false;
    return Object.freeze({ worker, close: async () => { if (closed) return; closed = true; await worker.close(); await checkout.discard(); }, principalName: checkout.principalName });
  } catch (error) {
    await checkout.discard();
    throw error;
  }
}
