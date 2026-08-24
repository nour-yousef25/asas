# W02 — DT01–DT06 Target Environment Audit

> **النتيجة:** لا تتوفر في البيئة الحالية target-like non-production topology مملوكة للنشر يمكنها إثبات DT01–DT06. هذا ليس فشلاً في harness محلي؛ إنه حد موضوعي موثق بعد فحص repository وCI/GitHub/connectors وhost المحلي.

## ما فُحص

| مصدر الفحص | النتيجة الفعلية | أثرها على DT01–DT06 |
|---|---|---|
| `docker-compose.yml` | app وworker وPostgreSQL وRedis أحادية العقد مع URLs مباشرة في environment؛ لا pooler أو workload identity أو failover أو backup/restore job | لا يصلح كـtarget-like proof حتى لو توفر Docker |
| sandbox | Docker غير متاح | لا يمكن إنشاء topology حاويات متعددة العقد محلياً |
| PostgreSQL local | 16.15، listener `localhost`، `pg_is_in_recovery=false`، replication senders=0، slots=0، `archive_mode=off` | لا replica/failover أو archived recovery/restore evidence لـDT04–DT05 |
| Redis local | master واحد، `connected_slaves=0`، لا Sentinel | لا Redis failover topology؛ ليس بديلاً لـprovider pool/partition proof |
| IaC/manifests | لا Terraform/Kubernetes/Helm/Ansible؛ الموجود compose وCI فقط | لا تعريف environment مستقل يمكن provision/review/rehearse |
| GitHub CI | lint/typecheck/test/build وDocker image build فقط؛ لا deploy/staging/restore/failover workflow | لا target environment أو runbook execution في CI |
| GitHub environments/deployments | لا environments ولا deployments ظاهرة للـrepository token؛ repository variables API أعاد 403 | لا دليل environment متاح؛ 403 لا يفسر كغياب credentials بل يمنع الاستكشاف الإضافي بهذا token |
| Connectors | لا provider deployment connector مفعّل؛ AWS Knowledge/Marketplace وCloudflare وغيرها disabled | لا يجوز تمكين أو افتراض provider/account/credentials |

## تصنيف DT01–DT06

| ID | الحالة | السبب |
|---|---|---|
| DT01 — tenant principals/pool reuse | `EXTERNAL TARGET REQUIRED` | local harness يثبت tenant logins و`session_user` فقط، لا deployment pool topology |
| DT02 — workload identity/rotation | `EXTERNAL TARGET REQUIRED` | لا opaque credential resolver أو workload identity مملوك للنشر |
| DT03 — outage/health recovery/partition | `SIMULATION ONLY` محلياً | Broker provider outage المحلي لا يثبت pool/partition أو health routing provider-owned |
| DT04 — failover | `EXTERNAL TARGET REQUIRED` | لا PostgreSQL replica، replication slot، failover router أو Redis Sentinel |
| DT05 — backup/restore | `EXTERNAL TARGET REQUIRED` | لا archive/WAL أو target backup service أو RPO/RTO owner-approved |
| DT06 — capacity/scale | `EXTERNAL TARGET REQUIRED` | لا capacity limits أو multi-node/role-scale/pool benchmarks deployment-owned |

## البدائل التي لم تُقبل كدليل

لا يقبل PostgreSQL audit disposable، Docker Compose أحادي العقد، app URL مباشر، CI image build، أو local provider outage harness كـprovider/HA/DR/scale PASS. يمكن وصفها فقط بـ**SIMULATION ONLY** ولا تغلق DT01–DT06.

## أقل prerequisite خارجي

يلزم deployment owner توفير environment non-production منفصل يحتوي على topology مرجعي، tenant role provisioning وprotected role-OID mapping، workload identity/opaque resolver، pool/health/failover settings، backup/restore service وحدود capacity/runbooks. لا يلزم ولا يُطلب production access أو credentials في المحادثة؛ owner يشغّل أو يتيح rehearsal وفق [عقد target](./W02-DEPLOYMENT-TARGET-CONTRACT.md).
