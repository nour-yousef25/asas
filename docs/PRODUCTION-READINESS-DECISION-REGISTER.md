# Production Readiness Decision Register — Reconciliation 54

| Decision | Status | Rationale | Operational effect |
|---|---|---|---|
| D54-01 | Accepted | Bootstrap credentials authentication is the initial auth path. | IdP is optional at launch; Super Admin provisioning remains approval-controlled. |
| D54-02 | Accepted | Local VPS filesystem replaces S3 for initial tenant-private artifacts. | No public path or S3 credential; server-only signed delivery is required. |
| D54-03 | Accepted | Temporary SMTP uses schoolscreen.sa. | No send until provider configuration and sandbox approval. |
| D54-04 | Accepted | Payments are launch-required for platform billing and organization donations. | No exclusion path; gateway/webhook/reconciliation proof required. |
| D54-05 | Accepted | SaaS Plans/Subscriptions/Entitlements replace certificate activation as launch control. | lifecycle is independent from payment provider and self-hosted certificate extension. |
| D54-06 | Accepted | Scheduler is catalogue-governed and activated only job-by-job. | dry-run is proven; live jobs require owner/heartbeat and tenant execution evidence. |
