# W02 WP0 — Permission Catalog

**الحالة:** `CLOSED — DESIGN CATALOG`
**قاعدة التفسير:** جميع permissions membership-scoped داخل `Organization`; default deny، وdeny-over-allow، وSoD/Classification قد يمنعان allow. لا تنفذ هذه الوثيقة صلاحيات runtime في WP0.

| Permission | Purpose | Resource | Action | Risk | SoD Restriction | Default Role Assignment | Audit Requirement |
|---|---|---|---|---|---|---|---|
| `beneficiary.read` | خدمة الحالة | Beneficiary | read | HIGH PII | لا يقرأ RESTRICTED إلا purpose مصرح | CASE_MANAGER, PROGRAM_MANAGER | sensitive read عند RESTRICTED |
| `beneficiary.create` | تسجيل حالة | Beneficiary | create | HIGH PII | لا يعتمد حالته النهائية | CASE_MANAGER | create |
| `beneficiary.update` | تحديث حالة | Beneficiary | update | HIGH PII | لا يغير classification دون permission منفصل | CASE_MANAGER | update fields redacted |
| `beneficiary.delete` | أرشفة/حذف قانوني | Beneficiary | delete/archive | CRITICAL | creator لا يقر الحذف؛ legal hold يمنع | ORG_ADMIN | request/approve/outcome |
| `beneficiary.export` | مشاركة مشروعة | Beneficiary dataset | export | CRITICAL | purpose + approval لبيانات RESTRICTED | PROGRAM_MANAGER | export manifest/purpose |
| `donor.read` | إدارة مانحين | Donor | read | HIGH PII | classification applies | FUNDRAISING_MANAGER | sensitive read |
| `donor.create` | تسجيل مانح | Donor | create | HIGH PII | لا يعتمد refund | FUNDRAISING_MANAGER | create |
| `donor.update` | تحديث مانح | Donor | update | HIGH PII | لا يغير financial ownership | FUNDRAISING_MANAGER | update |
| `donor.export` | تقرير مرخص | Donor dataset | export | CRITICAL | purpose/approval حسب policy | ORG_ADMIN | export/purpose |
| `donation.read` | تشغيل مالي | Donation | read | HIGH financial | classification applies | FINANCE_OFFICER | read for RESTRICTED |
| `donation.create` | تسجيل تبرع | Donation | create | HIGH financial | creator لا يعتمد/refund | FINANCE_OFFICER | create |
| `donation.approve` | اعتماد تسوية | Donation | approve | CRITICAL | distinct from creator/refund actor | FINANCE_APPROVER | approval/SoD decision |
| `donation.refund` | استرداد | Donation | refund | CRITICAL | distinct approver + threshold policy | FINANCE_APPROVER | request/approval/outcome |
| `donation.export` | تقرير مالي | Donation dataset | export | CRITICAL | purpose + finance policy | ORG_ADMIN | export manifest |
| `identity.membership.read` | إدارة وصول | Membership | read | HIGH security | support boundary applies | ORG_ADMIN | read when support |
| `identity.membership.manage` | منح/تعطيل عضوية | Membership | manage | CRITICAL | actor لا يمنح نفسه أعلى privilege | ORG_ADMIN | grant/revoke/reason |
| `identity.role.manage` | تعيين أدوار | Role/Permission Binding | manage | CRITICAL | no self-escalation; dual control for ORG_ADMIN | ORG_ADMIN | before/after/redacted |
| `secret.read` | استخدام secret runtime | SecretRecord | read/use | CRITICAL | لا plaintext export؛ support denied default | SECRET_OPERATOR | access attempt/outcome |
| `secret.create` | إعداد integration | SecretRecord | create | CRITICAL | creator لا يوافق production use | SECRET_OPERATOR | create/fingerprint only |
| `secret.rotate` | تدوير آمن | SecretRecord | rotate | CRITICAL | distinct review عند production | SECRET_OPERATOR | rotation/version/outcome |
| `secret.revoke` | إيقاف اعتماد | SecretRecord | revoke | CRITICAL | immediate revoke allowed، audit mandatory | SECRET_OPERATOR | revoke/reason |
| `report.generate` | تحليل تشغيلي | Report | generate | HIGH | data policy applies | ANALYST | parameters redacted |
| `report.export` | إخراج بيانات | Report Export | export | CRITICAL | purpose/approval/classification | ORG_ADMIN | manifest/purpose/expiry |
| `audit.read` | تحقيق/رقابة | AuditEvent | read | HIGH security | no mutation; restricted audit needs purpose | AUDITOR | audit-read event |
| `support.access.request` | طلب دعم مقيد | SupportAccess | request | HIGH | requester لا يوافق لنفسه | SUPPORT_AGENT | request/scope/expiry |
| `support.access.approve` | موافقة دعم | SupportAccess | approve | CRITICAL | distinct approver; no secret/RESTRICTED default | ORG_ADMIN | approval/expiry |
| `support.access.revoke` | إلغاء دعم | SupportAccess | revoke | CRITICAL | no SoD needed for emergency revoke | ORG_ADMIN | revoke/reason |
| `settings.read` | قراءة إعدادات منظمة | Organization Setting | read | MEDIUM | secret settings excluded | ORG_ADMIN, SETTINGS_MANAGER | read when sensitive |
| `settings.manage` | تعديل إعدادات منظمة | Organization Setting | manage | HIGH | security settings require review policy | SETTINGS_MANAGER | before/after redacted |

## Role Baseline

`ORG_ADMIN` يدير العضويات والسياسات ولا يملك `secret.read` افتراضياً. `FINANCE_OFFICER` ينشئ/يقرأ؛ `FINANCE_APPROVER` يعتمد/refund وفق SoD. `CASE_MANAGER` يدير الحالات؛ `PROGRAM_MANAGER` يقرأ ويصدر وفق purpose. `AUDITOR` يقرأ audit فقط. `SUPPORT_AGENT` يطلب ولا يوافق. `SECRET_OPERATOR` يدير الأسرار ولا يملك export. يلزم Product/Security Owner اعتماد أي role إضافي قبل WP1.
