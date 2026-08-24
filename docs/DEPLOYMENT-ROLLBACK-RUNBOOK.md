# ASAS Plus — Staging and Production Rollback Runbook

## Staging Rollback Procedure

The staging web service points to `/opt/asasplus/staging-current`. Releases are immutable directories under `/opt/asasplus/releases`. To revert only staging web traffic, repoint the symlink to the previous verified release and restart only `asasplus-web-staging.service`; then call `/api/health` on loopback with the internal health token. Do not restart the tenant worker while pointing to a release that predates its supervisor implementation.

The rehearsal passed: web staged rollback from `7b48280` to `478c75a` and rollforward back to `7b48280`, with an authorized health response at both points. It did not touch DNS, OpenLiteSpeed, Redis, PostgreSQL, or an existing public website.

## Database Rollback Boundary

Prisma migrations are forward-only. Do not edit or reverse migration history in place. The recovery method is: stop only ASAS services, restore the latest verified `asasplus_staging` custom dump to a newly created dedicated database, verify schema and health, then repoint ASAS runtime configuration under a planned change. Never restore into another project's database.

## Production Change Gate

No production DNS, vhost, listener, or traffic change is authorized by this runbook. The only valid explicit user authorization is:

> `انشر على asasplus.shop الآن`

Before that authorization, retain the current staging topology and keep ASAS on loopback only.
