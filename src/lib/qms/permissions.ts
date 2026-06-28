const QMS_VIEW_ROLES = ['system_admin', 'admin', 'pm', 'member', 'approver'];
const QMS_MANAGE_ROLES = ['system_admin', 'admin', 'pm'];

export function canViewQms(role: string): boolean {
  return QMS_VIEW_ROLES.includes(role);
}

export function canManageQms(role: string): boolean {
  return QMS_MANAGE_ROLES.includes(role);
}
