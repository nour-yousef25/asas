-- W02 WP3: one random, stable, tamper-evident installation identity.
CREATE TABLE "instance_identity" (
  "id" TEXT NOT NULL DEFAULT 'singleton',
  "instanceId" TEXT NOT NULL,
  "keyVersion" TEXT NOT NULL DEFAULT 'v1',
  "integrityTag" TEXT NOT NULL,
  "createdAt" TIMESTAMP(3) NOT NULL DEFAULT CURRENT_TIMESTAMP,
  "updatedAt" TIMESTAMP(3) NOT NULL,
  CONSTRAINT "instance_identity_pkey" PRIMARY KEY ("id")
);
CREATE UNIQUE INDEX "instance_identity_instanceId_key" ON "instance_identity"("instanceId");
