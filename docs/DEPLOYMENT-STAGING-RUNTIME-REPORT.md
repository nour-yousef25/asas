# ASAS Plus — VPS Staging Runtime Report

## Decision and Scope

The official VPS staging environment is operational on loopback only. No DNS record, OpenLiteSpeed/CyberPanel vhost, existing website, TLS configuration, firewall policy, or production traffic was changed. The current staging release is `7b4828057180f9923232ea0671e34441ea8e308f` at `/opt/asasplus/releases/20260824T184500Z-7b48280`.

| Layer | Result | Boundary |
|---|---|---|
| Web | `asasplus-web-staging.service` active at `127.0.0.1:3105` | no public listener or DNS switch |
| Redis | `asasplus-redis.service` active at `127.0.0.1:6385` and `::1:6385` | separate instance, password required, no change to existing Redis |
| Worker | `asasplus-worker-staging.service` active | tenant publication supervisor, zero provisioned tenant workers; no legacy fallback |
| Database | `asasplus_staging` | isolated DB and non-superuser/NOBYPASSRLS control and migration roles |
| Runtime identity | `asasplus` service user | non-root; release paths owned by deployment identity |

## W02 Runtime Boundaries

The deployment adds a server-only file authority for the database and queue. A tenant data-plane checkout requires an exact `file://` opaque reference, a local host URL, strict credential-file permissions, and an active broker principal. There is no universal tenant URL fallback. Queue workers require a separately provisioned queue credential reference and remain idle when no tenant is provisioned; the previous global legacy communications worker remains quarantined.

The staging database has applied the W02 migrations through `20260824103000_w02_tenant_queue_authority`. Control-plane grants are limited to broker metadata and lease/audit operations; they do not turn the control role into a tenant principal.

## Health and Verification

The health route is not public. It requires the internally generated `x-asas-health-token`; the unauthenticated result is `401`. The authorized report proved application, database, Redis, queue, security, disk, and memory checks healthy. Its overall state is `DEGRADED`, correctly reflecting absent storage provider/probe, backup manifest integration, tenant worker heartbeat, scheduler, mail, integrations, and license provider configuration.

| Test | Result |
|---|---|
| Canonical checkout / `git fsck` | PASS |
| `pnpm install --frozen-lockfile --ignore-scripts` | PASS |
| Prisma validate / generate / migrate deploy | PASS |
| Next production build | PASS, with existing Edge `process.cwd` warning only |
| Web loopback health with internal token | PASS |
| Unauthenticated health request | DENIED (`401`) |
| Redis unauthenticated request | DENIED (`NOAUTH`) |
| Supervisor | PASS, idle at zero provisioned tenants |

## Backup and Restore Evidence

The post-migration ASAS-only backup is at `/opt/asasplus/backups/20260824T183229Z/`. The PostgreSQL custom dump, checksum, and manifest are root-only. The dump passed checksum verification and a restore to an isolated temporary database; source and restored schemas each contained 93 public tables. The temporary database was removed after the test.

## Known Non-Production Limitations

No tenant database principal, tenant queue credential, external object storage, real IdP enrollment, communications credential, mail provider, or license issuer was provisioned. These are intentionally fail-closed, not simulated. Redis reported the host-level `vm.overcommit_memory` advisory; no global sysctl was changed because the VPS is multi-tenant. Production exposure remains prohibited until the explicit production-switch phrase and a separate review of those external integrations.
