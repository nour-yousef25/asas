#!/usr/bin/env bash
set -euo pipefail
export ASAS_PROOF_RELEASE=/opt/asasplus/production-current
export ASAS_PROOF_DATABASE=asasplus_production
export ASAS_PROOF_ENVIRONMENT_FILE=/opt/asasplus/shared/production-runtime-secrets.conf
export ASAS_PROOF_TENANT_CREDENTIAL_DIRECTORY=/opt/asasplus/shared/production-tenant-credentials
export ASAS_PROOF_QUEUE_CREDENTIAL_DIRECTORY=/opt/asasplus/shared/production-queue-credentials
export ASAS_PROOF_WORKER_UNIT=asasplus-worker-production.service
export ASAS_PROOF_DIRECTORY=/opt/asasplus/shared/production-proof
export ASAS_PROOF_LABEL=production
exec /opt/asasplus/production-current/scripts/w02-vps-staging-tenant-proof-run.sh
