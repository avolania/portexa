import type { Permission, UserRole } from "@/types";

// ─── Rol → Yetki haritası ─────────────────────────────────────────────────────

export const ROLE_PERMISSIONS: Record<UserRole, Permission[]> = {
  viewer: [
    "project.view",
  ],
  admin: [
    "project.create", "project.edit", "project.delete", "project.view",
    "task.create", "task.edit", "task.delete", "task.assign", "task.view",
    "governance.create", "governance.edit", "governance.delete", "governance.approve", "governance.view",
    "report.create", "report.edit", "report.view",
    "team.view", "team.manage",
    "budget.view", "budget.edit",
    "settings.manage",
  ],
  pm: [
    "project.create", "project.edit", "project.view",
    "task.create", "task.edit", "task.delete", "task.assign", "task.view",
    "governance.create", "governance.edit", "governance.approve", "governance.view",
    "report.create", "report.edit", "report.view",
    "team.view",
    "budget.view", "budget.edit",
  ],
  member: [
    "project.view",
    "task.view", "task.edit",
    "governance.view",
    "report.view", "report.create",
    "team.view",
    "budget.view",
  ],
  approver: [
    "project.view",
    "task.view",
    "governance.view", "governance.approve",
    "report.view",
    "team.view",
  ],
};

export const ROLE_META: Record<UserRole, { label: string; description: string; color: string; bg: string }> = {
  admin:    { label: "Admin",              description: "Tüm işlemler ve ayarlara tam erişim",              color: "text-violet-700",  bg: "bg-violet-100"  },
  pm:       { label: "Proje Yöneticisi",   description: "Proje bazlı yönetim ve görev atama",               color: "text-indigo-700",  bg: "bg-indigo-100"  },
  member:   { label: "Proje Üyesi",        description: "Atandığı görevleri görüntüleme ve güncelleme",      color: "text-emerald-700", bg: "bg-emerald-100" },
  approver: { label: "Onaycı",             description: "Sadece onay ve görüntüleme yetkisi",                color: "text-amber-700",   bg: "bg-amber-100"   },
  viewer:   { label: "Görüntüleyici",      description: "Sadece ana sayfa görüntüleme — admin onayı bekler", color: "text-gray-600",    bg: "bg-gray-100"    },
};

// ─── Yetki kontrolü ───────────────────────────────────────────────────────────

export function hasPermission(role: UserRole | undefined, permission: Permission): boolean {
  if (!role) return false;
  return ROLE_PERMISSIONS[role]?.includes(permission) ?? false;
}

export function hasAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}
