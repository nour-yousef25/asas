/** Shared W02 queue boundary error; kept dependency-free for authority bootstrap and tests. */
export class TenantQueueBoundaryError extends Error {
  constructor(public readonly code: string) {
    super(code);
    this.name = "TenantQueueBoundaryError";
  }
}
