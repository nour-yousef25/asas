# W02 RLS Tenant Access Broker Audit Proof — Support Matrix

| Model | Broker owner | Credential authority owner | PostgreSQL role owner | Rotation/revocation owner | Incident/DR owner | Audit proof status |
|---|---|---|---|---|---|---|
| Cloud SaaS | not assigned | not assigned | not assigned | not assigned | not assigned | BLOCKED — no production owner assumed |
| Dedicated | not assigned | not assigned | not assigned | not assigned | not assigned | BLOCKED — contract required |
| Self-Hosted | not assigned | not assigned | not assigned | not assigned | not assigned | BLOCKED — operator contract required |
| Local audit harness | disposable test harness | ephemeral in-memory authority | local audit administrator only | harness setup/revocation | disposable database deletion | PASS only for audit fixture |

هذا الجدول لا يفترض Cloud KMS/HSM أو provider-specific PostgreSQL. إن لم يحدد مالك لهذه العناصر في نمط نشر حقيقي فالنمط يبقى `BLOCKED`، ولا يبرر ذلك أي fallback إلى credential عالمية.
