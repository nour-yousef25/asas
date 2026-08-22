/**
 * W01 Observability — سياق correlation ID خادمي قابل للتمرير بين service وlog.
 */
import { AsyncLocalStorage } from "node:async_hooks";

type CorrelationContext = { correlationId: string };

const correlationStorage = new AsyncLocalStorage<CorrelationContext>();

export function withCorrelationId<T>(correlationId: string, callback: () => T): T {
  return correlationStorage.run({ correlationId }, callback);
}

export function getCorrelationId(): string | undefined {
  return correlationStorage.getStore()?.correlationId;
}
