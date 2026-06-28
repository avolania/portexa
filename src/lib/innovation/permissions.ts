export type InnovationPermission =
  | 'ideas.create'
  | 'ideas.view_all'
  | 'ideas.edit_any'
  | 'ideas.advance'
  | 'ideas.evaluate'
  | 'ideas.status'
  | 'campaigns.create'
  | 'campaigns.manage'
  | 'pocs.approve'
  | 'pocs.manage'
  | 'stages.manage'
  | 'criteria.manage'
  | 'users.manage'
  | 'settings.manage';

export interface InnovPermGroup {
  label: string;
  permissions: Array<{ key: InnovationPermission; label: string }>;
}

export const INNOV_PERM_GROUPS: InnovPermGroup[] = [
  {
    label: 'Fikirler',
    permissions: [
      { key: 'ideas.create',    label: 'Oluştur' },
      { key: 'ideas.view_all',  label: 'Tümünü Gör' },
      { key: 'ideas.edit_any',  label: 'Düzenle' },
      { key: 'ideas.advance',   label: 'Aşama İlerlet' },
      { key: 'ideas.evaluate',  label: 'Değerlendir' },
      { key: 'ideas.status',    label: 'Durum Güncelle' },
    ],
  },
  {
    label: 'Kampanyalar',
    permissions: [
      { key: 'campaigns.create', label: 'Oluştur' },
      { key: 'campaigns.manage', label: 'Yönet' },
    ],
  },
  {
    label: 'POC',
    permissions: [
      { key: 'pocs.approve', label: 'Onayla' },
      { key: 'pocs.manage',  label: 'Yönet' },
    ],
  },
  {
    label: 'Sistem',
    permissions: [
      { key: 'stages.manage',   label: 'Aşamalar' },
      { key: 'criteria.manage', label: 'Kriterler' },
      { key: 'users.manage',    label: 'Kullanıcı Rolleri' },
      { key: 'settings.manage', label: 'Ayarlar' },
    ],
  },
];

export const ALL_INNOV_PERMS: InnovationPermission[] = INNOV_PERM_GROUPS.flatMap((g) =>
  g.permissions.map((p) => p.key)
);

export const INNOV_ROLE_PERM_DEFAULTS: Record<string, InnovationPermission[]> = {
  innovation_admin:     [...ALL_INNOV_PERMS],
  business_sponsor:     ['ideas.view_all', 'ideas.edit_any', 'pocs.approve', 'pocs.manage'],
  innovation_evaluator: ['ideas.view_all', 'ideas.evaluate'],
  finance:              ['ideas.view_all'],
  pmo_manager:          ['ideas.view_all', 'ideas.advance', 'stages.manage'],
  executive:            ['ideas.view_all'],
};

export function resolveInnovPermissions(
  userRoles: string[],
  rolePermsMap: Map<string, InnovationPermission[]>
): Set<InnovationPermission> {
  const result = new Set<InnovationPermission>();
  for (const role of userRoles) {
    const perms = rolePermsMap.get(role) ?? INNOV_ROLE_PERM_DEFAULTS[role] ?? [];
    for (const p of perms) result.add(p);
  }
  return result;
}

export function hasInnovPerm(
  perms: Set<InnovationPermission>,
  perm: InnovationPermission
): boolean {
  return perms.has(perm);
}
