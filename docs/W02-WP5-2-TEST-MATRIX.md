# W02 WP5-2 — Test Matrix

| Area | Positive evidence | Negative evidence | Status |
|---|---|---|---|
| Beneficiary list/search/pagination | A returns A only | B rows and spoofed query absent | planned |
| Beneficiary get/update/delete | A owns record | A→B IDOR returns not found/no write | planned |
| BeneficiaryDocument relation | A sees nested A docs | A cannot obtain B nested docs | planned |
| Donor/Donation/Campaign | same-org ownership graph accepted | cross-org parent rejected/no write | planned |
| Client tenant spoofing | context org is persisted | body/query organizationId ignored | planned |
| Audit/security evidence | sensitive denied paths recorded where contract supports it | no secret/PII logging | planned |
| Regression | Prisma/TypeScript/Jest/communications/build | no skipped/new mock security test | planned |
