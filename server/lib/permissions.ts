/**
 * Administrator permission matrix. Administrators get only the permissions of
 * their role; only the super administrator has everything. Enforced on the
 * server via requirePerm().
 */
export const PERMISSIONS = [
  'admins.manage', 'users.manage', 'settings.manage',
  'verify.farmers', 'verify.buyers', 'verify.storage', 'verify.transport', 'documents.view',
  'listings.moderate', 'orders.view', 'bookings.view',
  'disputes.manage', 'payments.view', 'payments.reconcile',
  'fraud.review', 'analytics.view', 'audit.view', 'grading.inspect', 'data.manage',
] as const;
export type Permission = (typeof PERMISSIONS)[number];

export const STAFF_ROLES = [
  'super_admin', 'admin', 'verification_officer', 'marketplace_admin', 'storage_officer',
  'dispute_officer', 'finance_officer', 'content_editor',
] as const;

export const ROLE_PERMISSIONS: Record<string, readonly Permission[]> = {
  super_admin: PERMISSIONS,
  // General platform administrator (pre-existing role): broad operations, but no fee settings,
  // payment reconciliation, or administrator management.
  admin: ['users.manage', 'verify.farmers', 'verify.buyers', 'verify.storage', 'verify.transport', 'documents.view',
    'listings.moderate', 'orders.view', 'bookings.view', 'disputes.manage', 'payments.view', 'fraud.review', 'analytics.view', 'audit.view',
    'grading.inspect', 'data.manage'],
  verification_officer: ['verify.farmers', 'verify.buyers', 'verify.transport', 'documents.view', 'fraud.review'],
  marketplace_admin: ['listings.moderate', 'orders.view', 'bookings.view', 'verify.transport', 'fraud.review', 'analytics.view', 'grading.inspect'],
  storage_officer: ['verify.storage', 'bookings.view', 'documents.view'],
  dispute_officer: ['disputes.manage', 'orders.view', 'bookings.view', 'documents.view'],
  finance_officer: ['payments.view', 'payments.reconcile', 'orders.view', 'analytics.view'],
  content_editor: [],
};

export const permissionsFor = (role: string): Permission[] => [...(ROLE_PERMISSIONS[role] ?? [])];
export const hasPerm = (role: string | undefined, p: Permission) => !!role && (ROLE_PERMISSIONS[role] ?? []).includes(p);
export const isStaffRole = (role?: string) => !!role && (STAFF_ROLES as readonly string[]).includes(role);

export const ROLE_LABELS: Record<string, string> = {
  super_admin: 'Super administrator', admin: 'Platform administrator', verification_officer: 'Verification officer',
  marketplace_admin: 'Marketplace operations administrator', storage_officer: 'Storage verification officer',
  dispute_officer: 'Dispute-resolution officer', finance_officer: 'Finance & reconciliation officer',
  content_editor: 'Content & support administrator',
};
