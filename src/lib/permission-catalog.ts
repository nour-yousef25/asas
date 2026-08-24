export const W02_PERMISSION_CATALOG = [
  ["beneficiary.read", "beneficiary", "read"], ["beneficiary.create", "beneficiary", "create"], ["beneficiary.update", "beneficiary", "update"], ["beneficiary.delete", "beneficiary", "delete"], ["beneficiary.export", "beneficiary", "export"],
  ["donor.read", "donor", "read"], ["donor.create", "donor", "create"], ["donor.update", "donor", "update"], ["donor.export", "donor", "export"],
  ["donation.read", "donation", "read"], ["donation.create", "donation", "create"], ["donation.approve", "donation", "approve"], ["donation.refund", "donation", "refund"], ["donation.export", "donation", "export"],
  ["budget.read", "budget", "read"], ["budget.create", "budget", "create"], ["budget.update", "budget", "update"], ["budget.delete", "budget", "delete"],
  ["expense.read", "expense", "read"], ["expense.create", "expense", "create"], ["expense.update", "expense", "update"], ["expense.delete", "expense", "delete"],
  ["dashboard.read", "dashboard", "read"],
  ["member.read", "member", "read"], ["member.create", "member", "create"], ["member.update", "member", "update"],
  ["kpi.read", "kpi", "read"], ["kpi.create", "kpi", "create"], ["kpi.update", "kpi", "update"],
  ["identity.membership.read", "identity", "membership.read"], ["identity.membership.manage", "identity", "membership.manage"], ["identity.role.manage", "identity", "role.manage"],
  ["secret.read", "secret", "read"], ["secret.create", "secret", "create"], ["secret.rotate", "secret", "rotate"], ["secret.revoke", "secret", "revoke"],
  ["report.generate", "report", "generate"], ["report.export", "report", "export"], ["audit.read", "audit", "read"],
  ["support.access.request", "support", "access.request"], ["support.access.approve", "support", "access.approve"], ["support.access.revoke", "support", "access.revoke"],
  ["settings.read", "settings", "read"], ["settings.manage", "settings", "manage"],
  ["communications.publication.schedule", "communications", "publication.schedule"],
] as const;

export type W02PermissionName = (typeof W02_PERMISSION_CATALOG)[number][0];
