import crypto from "node:crypto";
import { prisma } from "@/lib/db";

export class InstanceIdentityError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "InstanceIdentityError";
  }
}

function identitySecret() {
  const secret = process.env.INSTANCE_IDENTITY_HMAC_SECRET ?? process.env.AUTH_SECRET ?? process.env.JWT_SECRET;
  if (!secret || secret.length < 32) throw new InstanceIdentityError("Instance identity integrity secret is not configured.");
  return secret;
}

function tagFor(input: { instanceId: string; keyVersion: string; createdAt: Date }) {
  return crypto.createHmac("sha256", identitySecret())
    .update(`${input.instanceId}:${input.keyVersion}:${input.createdAt.toISOString()}`)
    .digest("hex");
}

export async function getOrCreateInstanceIdentity() {
  const current = await prisma.instanceIdentity.findUnique({ where: { id: "singleton" } });
  if (current) return current;
  const createdAt = new Date();
  const instanceId = crypto.randomUUID();
  const keyVersion = "v1";
  const integrityTag = tagFor({ instanceId, keyVersion, createdAt });
  try {
    const identity = await prisma.instanceIdentity.create({
      data: { id: "singleton", instanceId, keyVersion, integrityTag, createdAt },
    });
    await prisma.auditLog.create({
      data: { action: "INSTANCE_IDENTITY_CREATED", entity: "InstanceIdentity", entityId: identity.instanceId, details: { keyVersion } },
    });
    return identity;
  } catch (error) {
    const recovered = await prisma.instanceIdentity.findUnique({ where: { id: "singleton" } });
    if (recovered) return recovered;
    throw error;
  }
}

export async function verifyInstanceIdentity() {
  const identity = await prisma.instanceIdentity.findUnique({ where: { id: "singleton" } });
  if (!identity) return { valid: false, reason: "MISSING" as const };
  const expected = tagFor(identity);
  const valid = crypto.timingSafeEqual(Buffer.from(expected, "hex"), Buffer.from(identity.integrityTag, "hex"));
  return { valid, reason: valid ? "VALID" as const : "TAMPERED" as const, identity };
}
