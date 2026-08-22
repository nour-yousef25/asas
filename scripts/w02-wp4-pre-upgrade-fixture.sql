-- Audit-only fixture for W02-WP4-UPGRADE-REHEARSAL. Apply only after official migrations through WP3.
INSERT INTO "organizations" ("id", "name", "updatedAt") VALUES ('rehearsal-org-a', 'W02 Rehearsal Organization A', NOW()), ('rehearsal-org-b', 'W02 Rehearsal Organization B', NOW());
INSERT INTO "users" ("id", "name", "email", "updatedAt", "activeOrganizationId") VALUES ('rehearsal-user-a', 'Rehearsal User A', 'rehearsal-a@example.invalid', NOW(), 'rehearsal-org-a'), ('rehearsal-user-b', 'Rehearsal User B', 'rehearsal-b@example.invalid', NOW(), 'rehearsal-org-b');
INSERT INTO "beneficiaries" ("id", "name", "phone", "updatedAt") VALUES ('rehearsal-beneficiary-a', 'Beneficiary A', '510000001', NOW()), ('rehearsal-beneficiary-b', 'Beneficiary B', '520000001', NOW());
INSERT INTO "donors" ("id", "name", "updatedAt") VALUES ('rehearsal-donor-a', 'Donor A', NOW()), ('rehearsal-donor-b', 'Donor B', NOW());
INSERT INTO "donation_campaigns" ("id", "title", "targetAmount", "startDate", "updatedAt") VALUES ('rehearsal-campaign-a', 'Campaign A', 1000, NOW(), NOW()), ('rehearsal-campaign-b', 'Campaign B', 1000, NOW(), NOW());
INSERT INTO "projects" ("id", "title", "targetAmount", "startDate", "updatedAt") VALUES ('rehearsal-project-a', 'Project A', 1000, NOW(), NOW()), ('rehearsal-project-b', 'Project B', 1000, NOW(), NOW());
INSERT INTO "donations" ("id", "donorId", "campaignId", "projectId", "amount", "updatedAt") VALUES ('rehearsal-donation-a', 'rehearsal-donor-a', 'rehearsal-campaign-a', 'rehearsal-project-a', 10, NOW()), ('rehearsal-donation-b', 'rehearsal-donor-b', 'rehearsal-campaign-b', 'rehearsal-project-b', 10, NOW());
INSERT INTO "news" ("id", "title", "slug", "content", "updatedAt") VALUES ('rehearsal-news-a', 'News A', 'rehearsal-news-a', 'Audit fixture A', NOW()), ('rehearsal-news-b', 'News B', 'rehearsal-news-b', 'Audit fixture B', NOW());
INSERT INTO "events" ("id", "title", "startDate", "updatedAt") VALUES ('rehearsal-event-a', 'Event A', NOW(), NOW()), ('rehearsal-event-b', 'Event B', NOW(), NOW());
INSERT INTO "tasks" ("id", "title", "assigneeId", "updatedAt") VALUES ('rehearsal-task-a', 'Task A', 'rehearsal-user-a', NOW()), ('rehearsal-task-b', 'Task B', 'rehearsal-user-b', NOW());
INSERT INTO "surveys" ("id", "title", "updatedAt") VALUES ('rehearsal-survey-a', 'Survey A', NOW()), ('rehearsal-survey-b', 'Survey B', NOW());
INSERT INTO "documents" ("id", "name", "fileUrl", "fileType", "size") VALUES ('rehearsal-document-a', 'Document A', 'audit://a', 'text/plain', 1), ('rehearsal-document-b', 'Document B', 'audit://b', 'text/plain', 1);
