import type { PrismaClient } from "@prisma/client";
import { BrokerDeniedError, type BrokerContext, type TenantAccessBroker, type TenantCredentialAuthority, type TenantDatabaseOperation, type TenantLeaseDescriptor } from "@/lib/tenant-access-broker";

export type TenantConnectionRequest = Readonly<{
  credentialReference: string;
  principalName: string;
  correlationId: string;
  connectionId: string;
}>;

export type TenantConnectionCheckout = Readonly<{
  prisma: PrismaClient;
  discard: () => Promise<void>;
}>;

/**
 * This boundary belongs to deployment infrastructure, not request input. It may
 * resolve an opaque credential reference through workload identity, but it must
 * never hand a universal database credential to application code.
 */
export interface TenantConnectionProvider {
  checkout(request: TenantConnectionRequest): Promise<TenantConnectionCheckout>;
}

export class TenantBoundPrismaCredentialAuthority implements TenantCredentialAuthority {
  constructor(private readonly provider: TenantConnectionProvider) {}

  async run<T>(input: TenantConnectionRequest, operation: TenantDatabaseOperation<T>): Promise<T> {
    let checkout: TenantConnectionCheckout | undefined;
    try {
      checkout = await this.provider.checkout(input);
      return await operation({ principalName: input.principalName, correlationId: input.correlationId, connectionId: input.connectionId, prisma: checkout.prisma });
    } catch (error) {
      throw error;
    } finally {
      if (checkout) await checkout.discard();
    }
  }
}

export interface BrokerLeaseIssuer {
  issueLease(context: BrokerContext): Promise<TenantLeaseDescriptor>;
  execute<T>(context: BrokerContext, descriptor: TenantLeaseDescriptor, operation: TenantDatabaseOperation<T>): Promise<T>;
}

/** Executes one repository operation through a newly issued, one-time tenant lease. */
export class TenantBoundPrismaExecutor {
  constructor(private readonly broker: BrokerLeaseIssuer) {}

  async execute<T>(context: BrokerContext, operation: (prisma: PrismaClient) => Promise<T>): Promise<T> {
    const descriptor = await this.broker.issueLease(context);
    return this.broker.execute(context, descriptor, async (input) => {
      if (!input.prisma) throw new BrokerDeniedError("TENANT_CONNECTION_AUTHORITY_UNAVAILABLE");
      return operation(input.prisma);
    });
  }
}

let installedExecutor: TenantBoundPrismaExecutor | undefined;

export function installTenantBoundPrismaExecutor(executor: TenantBoundPrismaExecutor) {
  if (installedExecutor) throw new Error("TENANT_CONNECTION_AUTHORITY_ALREADY_INSTALLED");
  installedExecutor = executor;
}

export function requireTenantBoundPrismaExecutor() {
  if (installedExecutor) return installedExecutor;
  // The instrumentation register() hook is not guaranteed to run in every
  // production runtime (e.g. standalone deployments where the instrumentation
  // convention file is not detected). Install lazily on first use; the
  // bootstrap still fails closed when TENANT_CREDENTIAL_DIRECTORY is absent.
  const { bootstrapTenantRuntime } = require("./tenant-runtime-bootstrap") as typeof import("./tenant-runtime-bootstrap");
  bootstrapTenantRuntime();
  if (!installedExecutor) throw new BrokerDeniedError("TENANT_CONNECTION_AUTHORITY_UNCONFIGURED");
  return installedExecutor;
}
