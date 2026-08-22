# W02 WP5-2 — Test Matrix

| Area | Positive evidence | Negative evidence | Status |
|---|---|---|---|
| Beneficiary list/search/pagination | A returns A only | B rows and spoofed query absent | PASS |
| Beneficiary get/update/delete | A owns record | A→B IDOR returns not found/no write | PASS |
| BeneficiaryDocument relation | A sees nested A docs | A cannot obtain B nested docs | PASS |
| Donor/Donation/Campaign | same-org ownership graph accepted | cross-org parent rejected/no write | PASS |
| Client tenant spoofing | context org is persisted | body tenant identifier cannot override repository owner | PASS |
| Audit/security evidence | denied repository decisions create redacted audit metadata | no secret/PII logging | PASS |
| Regression | Prisma/TypeScript/Jest/communications/build | no skipped/new mock security test | PASS |
