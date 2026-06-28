"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import {
  Check, X, Lock, Loader2, RotateCcw, Users,
  FolderKanban, CheckSquare, Wallet, BarChart3, ShieldCheck, Settings, ClipboardList,
  Pencil, Plus, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_PERMISSIONS, ROLE_META } from "@/lib/permissions";
import type { InnovationPermission } from "@/lib/innovation/permissions";
import type { UserRole, Permission } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_ROLES: UserRole[] = [
  "admin", "pm", "member", "approver", "viewer", "end_user", "system_admin",
];

// All possible color options — listed statically so Tailwind includes them.
const COLOR_OPTIONS = [
  { color: "text-violet-700", bg: "bg-violet-100", label: "Mor" },
  { color: "text-blue-700",   bg: "bg-blue-100",   label: "Mavi" },
  { color: "text-green-700",  bg: "bg-green-100",  label: "Yeşil" },
  { color: "text-amber-700",  bg: "bg-amber-100",  label: "Sarı" },
  { color: "text-indigo-700", bg: "bg-indigo-100", label: "İndigo" },
  { color: "text-gray-700",   bg: "bg-gray-100",   label: "Gri" },
  { color: "text-rose-700",   bg: "bg-rose-100",   label: "Kırmızı" },
  { color: "text-cyan-700",   bg: "bg-cyan-100",   label: "Camgöbeği" },
  { color: "text-teal-700",   bg: "bg-teal-100",   label: "Deniz Yeşili" },
  { color: "text-orange-700", bg: "bg-orange-100", label: "Turuncu" },
];

const GROUPS: { label: string; prefix: string }[] = [
  { label: "Proje",   prefix: "project"    },
  { label: "Görev",   prefix: "task"       },
  { label: "Bütçe",   prefix: "budget"     },
  { label: "Rapor",   prefix: "report"     },
  { label: "Ekip",    prefix: "team"       },
  { label: "Yönetim", prefix: "governance" },
  { label: "Ayarlar", prefix: "settings"   },
];

// Innovation permission groups and labels
const INNOV_PERM_LABELS: Record<InnovationPermission, string> = {
  "ideas.create":       "Fikir Gönder",
  "ideas.view_all":     "Tümünü Görüntüle",
  "ideas.edit_any":     "Herhangi Birini Düzenle",
  "ideas.advance":      "Aşama İlerlet",
  "ideas.evaluate":     "Değerlendir",
  "ideas.status":       "Durum Değiştir",
  "campaigns.create":   "Kampanya Oluştur",
  "campaigns.manage":   "Kampanya Yönet",
  "pocs.manage":        "POC Yönet",
  "pocs.approve":       "POC Onayla",
  "stages.manage":      "Aşama Yönet",
  "criteria.manage":    "Kriter Yönet",
  "users.manage":       "Kullanıcı Yönet",
  "settings.manage":    "Ayarlar Yönet",
};

const INNOV_GROUPS: { label: string; perms: InnovationPermission[] }[] = [
  { label: "Fikirler",        perms: ["ideas.create", "ideas.view_all", "ideas.edit_any", "ideas.advance", "ideas.evaluate", "ideas.status"] },
  { label: "Kampanyalar",     perms: ["campaigns.create", "campaigns.manage"] },
  { label: "POC",             perms: ["pocs.manage", "pocs.approve"] },
  { label: "Aşama / Kriter", perms: ["stages.manage", "criteria.manage"] },
  { label: "Yönetim",         perms: ["users.manage", "settings.manage"] },
];

const ACTION_ORDER = ["create", "edit", "delete", "view", "assign", "approve", "manage"];

const ACTION_LABELS: Record<string, string> = {
  create:  "Oluştur",
  edit:    "Düzenle",
  delete:  "Sil",
  view:    "Görüntüle",
  assign:  "Ata",
  approve: "Onayla",
  manage:  "Yönet",
};

const ACTIONS_BY_PREFIX: Record<string, string[]> = (() => {
  const map: Record<string, string[]> = {};
  for (const perms of Object.values(ROLE_PERMISSIONS)) {
    for (const p of perms) {
      const dot = p.indexOf(".");
      if (dot === -1) continue;
      const prefix = p.slice(0, dot);
      const action = p.slice(dot + 1);
      if (!map[prefix]) map[prefix] = [];
      if (!map[prefix].includes(action)) map[prefix].push(action);
    }
  }
  for (const actions of Object.values(map)) {
    actions.sort((a, b) => ACTION_ORDER.indexOf(a) - ACTION_ORDER.indexOf(b));
  }
  return map;
})();

const GROUP_ICONS: Record<string, React.ElementType> = {
  project:    FolderKanban,
  task:       CheckSquare,
  budget:     Wallet,
  report:     BarChart3,
  team:       Users,
  governance: ClipboardList,
  settings:   Settings,
};

// ─── Types ────────────────────────────────────────────────────────────────────

interface RoleDef {
  role_key: string;
  label: string;
  description: string;
  color: string;
  bg: string;
  is_custom: boolean;
  permissions: InnovationPermission[];
}

type SelectedTab =
  | { type: "system"; role: UserRole }
  | { type: "innovation"; role: string }
  | { type: "innovation-create" };

interface InnovUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
  innovation_roles: string[];
}

interface RoleFormState {
  label: string;
  description: string;
  color: string;
  bg: string;
}

// ─── Helpers ──────────────────────────────────────────────────────────────────

function permsEqual(a: Permission[], b: Permission[]): boolean {
  if (a.length !== b.length) return false;
  const setA = new Set(a);
  return b.every((p) => setA.has(p));
}

function apiCall(url: string, method: string, token: string, body?: unknown) {
  return fetch(url, {
    method,
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: body ? JSON.stringify(body) : undefined,
  });
}

const EMPTY_FORM: RoleFormState = {
  label: "",
  description: "",
  color: "text-violet-700",
  bg: "bg-violet-100",
};

// ─── Color Picker ─────────────────────────────────────────────────────────────

function ColorPicker({
  value,
  onChange,
}: {
  value: { color: string; bg: string };
  onChange: (color: string, bg: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      {COLOR_OPTIONS.map((opt) => {
        const active = opt.color === value.color && opt.bg === value.bg;
        return (
          <button
            key={opt.color}
            type="button"
            title={opt.label}
            onClick={() => onChange(opt.color, opt.bg)}
            className={`w-6 h-6 rounded-full border-2 transition-all ${opt.bg} ${
              active ? "border-gray-700 scale-110 ring-2 ring-offset-1 ring-gray-400" : "border-transparent hover:scale-110"
            }`}
          />
        );
      })}
    </div>
  );
}

// ─── Role Form (shared by edit and create) ────────────────────────────────────

function RoleForm({
  form,
  onChange,
  onSave,
  onCancel,
  onDelete,
  saving,
  error,
  isCreate,
}: {
  form: RoleFormState;
  onChange: (f: RoleFormState) => void;
  onSave: () => void;
  onCancel: () => void;
  onDelete?: () => void;
  saving: boolean;
  error: string;
  isCreate?: boolean;
}) {
  return (
    <div className="px-5 py-5 space-y-5">
      {/* Label */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Rol Adı {isCreate && <span className="text-red-400">*</span>}
        </label>
        <input
          type="text"
          value={form.label}
          onChange={(e) => onChange({ ...form, label: e.target.value })}
          placeholder="Örn: İç Denetçi"
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>

      {/* Description */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1.5">
          Açıklama
        </label>
        <textarea
          rows={2}
          value={form.description}
          onChange={(e) => onChange({ ...form, description: e.target.value })}
          placeholder="Bu rolün sorumlulukları..."
          className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm resize-none focus:outline-none focus:ring-2 focus:ring-blue-300 focus:border-blue-400"
        />
      </div>

      {/* Color */}
      <div>
        <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
          Renk
        </label>
        <ColorPicker
          value={{ color: form.color, bg: form.bg }}
          onChange={(color, bg) => onChange({ ...form, color, bg })}
        />
        <div className="mt-2">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-xs font-semibold ${form.bg} ${form.color}`}>
            {form.label || "Önizleme"}
          </span>
        </div>
      </div>

      {error && <p className="text-xs text-red-500">{error}</p>}

      {/* Actions */}
      <div className="flex items-center justify-between pt-1">
        <div>
          {onDelete && (
            <button
              onClick={onDelete}
              disabled={saving}
              className="flex items-center gap-1.5 text-xs text-red-500 hover:text-red-700 disabled:opacity-50 transition-colors"
            >
              <Trash2 className="w-3.5 h-3.5" />
              Rolü Sil
            </button>
          )}
        </div>
        <div className="flex gap-2">
          <button
            onClick={onCancel}
            disabled={saving}
            className="px-3 py-1.5 text-xs border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
          >
            İptal
          </button>
          <button
            onClick={onSave}
            disabled={saving}
            className="px-3 py-1.5 text-xs bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
          >
            {saving && <Loader2 className="w-3 h-3 animate-spin" />}
            {isCreate ? "Oluştur" : "Kaydet"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Component ────────────────────────────────────────────────────────────────

export default function RollerPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const authLoading = useAuthStore((s) => s.loading);
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);

  const [token, setToken] = useState("");
  const [selected, setSelected] = useState<SelectedTab>({ type: "system", role: "admin" });

  // System role state
  const [effectivePerms, setEffectivePerms] = useState<Record<string, Permission[]>>(
    Object.fromEntries(SYSTEM_ROLES.map((r) => [r, [...ROLE_PERMISSIONS[r]]]))
  );
  const [customized, setCustomized] = useState<Set<UserRole>>(new Set());
  const [pendingChanges, setPendingChanges] = useState<Record<string, Permission[]>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  // Innovation role definitions
  const [roleDefs, setRoleDefs] = useState<RoleDef[]>([]);
  const [roleDefsLoading, setRoleDefsLoading] = useState(false);

  // Innovation user list state
  const [innovUsers, setInnovUsers] = useState<InnovUser[]>([]);
  const [innovLoading, setInnovLoading] = useState(false);
  const [innovLoadError, setInnovLoadError] = useState("");
  const [innovToggles, setInnovToggles] = useState<Record<string, boolean>>({});
  const [innovErrors, setInnovErrors] = useState<Record<string, string>>({});

  // Edit role state
  const [editingRole, setEditingRole] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<RoleFormState>(EMPTY_FORM);
  const [editSaving, setEditSaving] = useState(false);
  const [editError, setEditError] = useState("");

  // Create role state
  const [createForm, setCreateForm] = useState<RoleFormState>(EMPTY_FORM);
  const [createSaving, setCreateSaving] = useState(false);
  const [createError, setCreateError] = useState("");

  // Delete state
  const [deletingRole, setDeletingRole] = useState<string | null>(null);
  const [deleteError, setDeleteError] = useState("");

  // Innovation permission edit state
  const [innovPendingPerms, setInnovPendingPerms] = useState<Record<string, InnovationPermission[]>>({});
  const [innovPermSaving, setInnovPermSaving] = useState(false);
  const [innovPermError, setInnovPermError] = useState("");

  // Global loading / saving
  const [apiLoading, setApiLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Data loaders ────────────────────────────────────────────────────────────

  const loadRoleDefs = useCallback(async (tok: string) => {
    setRoleDefsLoading(true);
    try {
      const res = await fetch("/api/yetkilendirme/innovation-role-definitions", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json() as RoleDef[];
        setRoleDefs(data);
      }
    } finally {
      setRoleDefsLoading(false);
    }
  }, []);

  const loadInnovUsers = useCallback(async (tok: string) => {
    setInnovLoading(true);
    setInnovLoadError("");
    try {
      const res = await fetch("/api/yetkilendirme/innovation-roles", {
        headers: { Authorization: `Bearer ${tok}` },
      });
      if (res.ok) {
        const data = await res.json() as InnovUser[];
        setInnovUsers(data);
      } else {
        setInnovLoadError("Kullanıcılar yüklenemedi.");
      }
    } finally {
      setInnovLoading(false);
    }
  }, []);

  // ── Init ────────────────────────────────────────────────────────────────────

  useEffect(() => {
    if (user && !effectivePermissions.includes("settings.manage")) {
      router.replace("/dashboard");
      return;
    }
    if (!user) return;

    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.replace("/giris"); return; }
      setToken(session.access_token);

      const [rolesRes] = await Promise.all([
        fetch("/api/yetkilendirme/roller", {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
      ]);

      if (rolesRes.ok) {
        const json = await rolesRes.json() as {
          permissions: Record<string, Permission[]>;
          customized: string[];
        };
        setEffectivePerms(json.permissions);
        setCustomized(new Set(json.customized as UserRole[]));
      } else {
        setLoadError("Yetki verileri yüklenemedi. Sayfayı yenileyin.");
      }

      await loadRoleDefs(session.access_token);
      setApiLoading(false);
    }
    init();
  }, [user, router, effectivePermissions, loadRoleDefs]);

  // Load innovation users when switching to innovation tab for the first time
  useEffect(() => {
    const isInnovTab = selected.type === "innovation" || selected.type === "innovation-create";
    if (isInnovTab && token && innovUsers.length === 0 && !innovLoading) {
      loadInnovUsers(token);
    }
  }, [selected, token, innovUsers.length, innovLoading, loadInnovUsers]);

  // ── System role handlers ────────────────────────────────────────────────────

  const handleTogglePerm = useCallback((perm: Permission, checked: boolean) => {
    if (selected.type !== "system") return;
    const role = selected.role;
    const current = pendingChanges[role] ?? effectivePerms[role] ?? ROLE_PERMISSIONS[role];
    const next = checked ? [...current, perm] : current.filter((p) => p !== perm);
    const effective = effectivePerms[role] ?? ROLE_PERMISSIONS[role];
    if (permsEqual(next, effective)) {
      setPendingChanges((prev) => { const n = { ...prev }; delete n[role]; return n; });
    } else {
      setPendingChanges((prev) => ({ ...prev, [role]: next }));
    }
  }, [selected, pendingChanges, effectivePerms]);

  const handleSave = useCallback(async () => {
    setSaving(true);
    try {
      const entries = Object.entries(pendingChanges) as [UserRole, Permission[]][];
      const results = await Promise.all(
        entries.map(async ([role, permissions]) => {
          const res = await apiCall("/api/yetkilendirme/roller", "PATCH", token, { role, permissions });
          if (res.ok) return { role, ok: true as const, error: null };
          const err = await res.json().catch(() => ({}));
          return { role, ok: false as const, error: ((err as { error?: string }).error ?? "Hata") as string };
        })
      );

      const succeeded: [UserRole, Permission[]][] = [];
      const failed: Record<string, string> = {};
      for (const r of results) {
        if (r.ok) succeeded.push([r.role as UserRole, pendingChanges[r.role]]);
        else failed[r.role] = r.error!;
      }

      setEffectivePerms((prev) => {
        const next = { ...prev };
        for (const [role, perms] of succeeded) next[role] = perms;
        return next;
      });
      setCustomized((prev) => {
        const next = new Set(prev);
        for (const [role, perms] of succeeded) {
          if (permsEqual(perms, ROLE_PERMISSIONS[role as UserRole])) next.delete(role as UserRole);
          else next.add(role as UserRole);
        }
        return next;
      });
      setPendingChanges((prev) => {
        const next = { ...prev };
        for (const [role] of succeeded) delete next[role];
        return next;
      });
      setSaveErrors(failed);
    } finally {
      setSaving(false);
    }
  }, [pendingChanges, token]);

  const handleReset = useCallback(async (role: UserRole) => {
    setResetting(true);
    try {
      const res = await apiCall("/api/yetkilendirme/roller", "PATCH", token, { role, permissions: null });
      if (res.ok) {
        setEffectivePerms((prev) => ({ ...prev, [role]: [...ROLE_PERMISSIONS[role]] }));
        setCustomized((prev) => { const next = new Set(prev); next.delete(role); return next; });
        setPendingChanges((prev) => { const next = { ...prev }; delete next[role]; return next; });
        setSaveErrors((prev) => { const next = { ...prev }; delete next[role]; return next; });
      } else {
        const err = await res.json().catch(() => ({}));
        setSaveErrors((prev) => ({ ...prev, [role]: ((err as { error?: string }).error ?? "Sıfırlanamadı") as string }));
      }
    } finally {
      setResetting(false);
    }
  }, [token]);

  const handleCancel = useCallback(() => {
    setPendingChanges({});
    setSaveErrors({});
  }, []);

  // ── Innovation user toggle handler ──────────────────────────────────────────

  const handleToggleInnovRole = useCallback(async (userId: string, role: string, has: boolean) => {
    const key = `${userId}:${role}`;
    setInnovToggles((prev) => ({ ...prev, [key]: true }));
    setInnovErrors((prev) => { const n = { ...prev }; delete n[key]; return n; });
    try {
      const action = has ? "remove" : "add";
      const res = await apiCall(
        `/api/yetkilendirme/innovation-roles/${userId}`,
        "PATCH",
        token,
        { role, action }
      );
      if (res.ok) {
        setInnovUsers((prev) =>
          prev.map((u) => {
            if (u.id !== userId) return u;
            const roles = has
              ? u.innovation_roles.filter((r) => r !== role)
              : [...u.innovation_roles, role];
            return { ...u, innovation_roles: roles };
          })
        );
      } else {
        const err = await res.json().catch(() => ({}));
        const msg = (err as { error?: string }).error ?? "İşlem başarısız";
        setInnovErrors((prev) => ({ ...prev, [key]: msg }));
      }
    } catch {
      setInnovErrors((prev) => ({ ...prev, [key]: "Bağlantı hatası" }));
    } finally {
      setInnovToggles((prev) => { const n = { ...prev }; delete n[key]; return n; });
    }
  }, [token]);

  // ── Innovation role edit handlers ───────────────────────────────────────────

  const startEdit = useCallback((def: RoleDef) => {
    setEditingRole(def.role_key);
    setEditForm({ label: def.label, description: def.description, color: def.color, bg: def.bg });
    setEditError("");
    setDeleteError("");
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingRole(null);
    setEditError("");
  }, []);

  const handleSaveEdit = useCallback(async () => {
    if (!editingRole) return;
    if (!editForm.label.trim()) { setEditError("Rol adı gerekli"); return; }
    setEditSaving(true);
    setEditError("");
    try {
      const res = await fetch("/api/yetkilendirme/innovation-role-definitions", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role_key: editingRole, ...editForm }),
      });
      if (res.ok) {
        setRoleDefs((prev) =>
          prev.map((r) => r.role_key === editingRole ? { ...r, ...editForm } : r)
        );
        setEditingRole(null);
      } else {
        const err = await res.json().catch(() => ({}));
        setEditError((err as { error?: string }).error ?? "Kaydedilemedi");
      }
    } catch {
      setEditError("Bağlantı hatası");
    } finally {
      setEditSaving(false);
    }
  }, [editingRole, editForm, token]);

  // ── Innovation role create handler ──────────────────────────────────────────

  const handleCreateRole = useCallback(async () => {
    if (!createForm.label.trim()) { setCreateError("Rol adı gerekli"); return; }
    setCreateSaving(true);
    setCreateError("");
    try {
      const res = await fetch("/api/yetkilendirme/innovation-role-definitions", {
        method: "POST",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify(createForm),
      });
      if (res.ok) {
        const newRole = await res.json() as RoleDef;
        setRoleDefs((prev) => [...prev, newRole]);
        setCreateForm(EMPTY_FORM);
        setSelected({ type: "innovation", role: newRole.role_key });
      } else {
        const err = await res.json().catch(() => ({}));
        setCreateError((err as { error?: string }).error ?? "Oluşturulamadı");
      }
    } catch {
      setCreateError("Bağlantı hatası");
    } finally {
      setCreateSaving(false);
    }
  }, [createForm, token]);

  // ── Innovation role delete handler ──────────────────────────────────────────

  const handleDeleteRole = useCallback(async (roleKey: string) => {
    setDeletingRole(roleKey);
    setDeleteError("");
    try {
      const res = await fetch(
        `/api/yetkilendirme/innovation-role-definitions?role_key=${encodeURIComponent(roleKey)}`,
        { method: "DELETE", headers: { Authorization: `Bearer ${token}` } }
      );
      if (res.ok) {
        setRoleDefs((prev) => prev.filter((r) => r.role_key !== roleKey));
        setEditingRole(null);
        const remaining = roleDefs.filter((r) => r.role_key !== roleKey);
        if (remaining.length > 0) {
          setSelected({ type: "innovation", role: remaining[0].role_key });
        } else {
          setSelected({ type: "system", role: "admin" });
        }
      } else {
        const err = await res.json().catch(() => ({}));
        setDeleteError((err as { error?: string }).error ?? "Silinemedi");
      }
    } catch {
      setDeleteError("Bağlantı hatası");
    } finally {
      setDeletingRole(null);
    }
  }, [token, roleDefs]);

  // ── Innovation permission handlers ─────────────────────────────────────────

  const handleToggleInnovPerm = useCallback((roleKey: string, perm: InnovationPermission, checked: boolean) => {
    const def = roleDefs.find((r) => r.role_key === roleKey);
    const base = innovPendingPerms[roleKey] ?? def?.permissions ?? [];
    const next = checked ? [...base, perm] : base.filter((p) => p !== perm);
    setInnovPendingPerms((prev) => ({ ...prev, [roleKey]: next }));
    setInnovPermError("");
  }, [roleDefs, innovPendingPerms]);

  const handleSaveInnovPerms = useCallback(async (roleKey: string) => {
    const permissions = innovPendingPerms[roleKey];
    if (!permissions) return;
    setInnovPermSaving(true);
    setInnovPermError("");
    try {
      const res = await fetch("/api/yetkilendirme/innovation-role-definitions", {
        method: "PATCH",
        headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
        body: JSON.stringify({ role_key: roleKey, permissions }),
      });
      if (res.ok) {
        setRoleDefs((prev) => prev.map((r) => r.role_key === roleKey ? { ...r, permissions } : r));
        setInnovPendingPerms((prev) => { const n = { ...prev }; delete n[roleKey]; return n; });
      } else {
        const err = await res.json().catch(() => ({}));
        setInnovPermError((err as { error?: string }).error ?? "Kaydedilemedi");
      }
    } catch {
      setInnovPermError("Bağlantı hatası");
    } finally {
      setInnovPermSaving(false);
    }
  }, [innovPendingPerms, token]);

  const handleCancelInnovPerms = useCallback((roleKey: string) => {
    setInnovPendingPerms((prev) => { const n = { ...prev }; delete n[roleKey]; return n; });
    setInnovPermError("");
  }, []);

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (authLoading) return null;
  if (!user || !effectivePermissions.includes("settings.manage")) return null;

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedSystemRole = selected.type === "system" ? selected.role : null;
  const selectedInnovRoleKey = selected.type === "innovation" ? selected.role : null;
  const isCreatingRole = selected.type === "innovation-create";

  const selectedRoleDef = roleDefs.find((r) => r.role_key === selectedInnovRoleKey) ?? null;
  const isEditingThis = editingRole !== null && editingRole === selectedInnovRoleKey;

  const displayPerms = selectedSystemRole
    ? (pendingChanges[selectedSystemRole] ?? effectivePerms[selectedSystemRole] ?? ROLE_PERMISSIONS[selectedSystemRole])
    : [];
  const isSystemAdmin = selectedSystemRole === "system_admin";
  const hasPending = Object.keys(pendingChanges).length > 0;
  const isSelectedPending = selectedSystemRole ? selectedSystemRole in pendingChanges : false;
  const isSelectedCustomized = selectedSystemRole ? customized.has(selectedSystemRole) : false;
  const canReset = (isSelectedCustomized || isSelectedPending) && !isSystemAdmin;

  // ── Render ──────────────────────────────────────────────────────────────────

  return (
    <div className="space-y-4 pb-24">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Roller</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Sistem ve inovasyon rollerini görüntüleyin, yetki kapsamlarını düzenleyin
        </p>
      </div>

      <div className="flex gap-5 items-start">
        {/* ── Left sidebar ──────────────────────────────────────────────────── */}
        <div className="w-52 flex-shrink-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Sistem section */}
          <div className="px-3 pt-3 pb-1">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">Sistem</p>
            {SYSTEM_ROLES.map((role) => {
              const meta = ROLE_META[role];
              const isPending = role in pendingChanges;
              const isCustom = customized.has(role);
              const isActive = selected.type === "system" && selected.role === role;
              return (
                <button
                  key={role}
                  onClick={() => { setSelected({ type: "system", role }); setEditingRole(null); }}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`block w-2 h-2 rounded-full flex-shrink-0 ${meta.bg}`} />
                    <span className="text-sm font-medium truncate">{meta.label}</span>
                  </div>
                  <div className="flex items-center gap-1 flex-shrink-0">
                    {isPending && <span className="w-1.5 h-1.5 rounded-full bg-yellow-400" />}
                    {isCustom && !isPending && <span className="text-[9px] font-semibold text-amber-600">özel</span>}
                  </div>
                </button>
              );
            })}
          </div>

          {/* Divider */}
          <div className="mx-3 my-2 border-t border-gray-100" />

          {/* İnovasyon section */}
          <div className="px-3 pb-3">
            <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider px-2 mb-1">İnovasyon</p>
            {roleDefsLoading ? (
              <div className="flex justify-center py-3">
                <Loader2 className="w-4 h-4 animate-spin text-gray-300" />
              </div>
            ) : (
              <>
                {roleDefs.map((def) => {
                  const isActive = selected.type === "innovation" && selected.role === def.role_key;
                  return (
                    <div key={def.role_key} className="group relative">
                      <button
                        onClick={() => { setSelected({ type: "innovation", role: def.role_key }); setEditingRole(null); }}
                        className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors pr-7 ${
                          isActive
                            ? "bg-violet-50 text-violet-700"
                            : "text-gray-700 hover:bg-gray-50"
                        }`}
                      >
                        <span className={`block w-2 h-2 rounded-full flex-shrink-0 ${def.bg}`} />
                        <span className="text-sm font-medium truncate">{def.label}</span>
                        {def.is_custom && (
                          <span className="text-[9px] font-semibold text-violet-400 flex-shrink-0">yeni</span>
                        )}
                      </button>
                      {/* Edit pencil — visible on hover or when active */}
                      <button
                        title="Rolü düzenle"
                        onClick={(e) => {
                          e.stopPropagation();
                          setSelected({ type: "innovation", role: def.role_key });
                          startEdit(def);
                        }}
                        className={`absolute right-1.5 top-1/2 -translate-y-1/2 p-1 rounded transition-opacity ${
                          isActive ? "opacity-60 hover:opacity-100" : "opacity-0 group-hover:opacity-50 hover:!opacity-100"
                        } text-gray-500 hover:text-violet-600`}
                      >
                        <Pencil className="w-3 h-3" />
                      </button>
                    </div>
                  );
                })}

                {/* New Role button */}
                <button
                  onClick={() => { setSelected({ type: "innovation-create" }); setEditingRole(null); setCreateForm(EMPTY_FORM); setCreateError(""); }}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors mt-1 ${
                    isCreatingRole
                      ? "bg-violet-50 text-violet-700"
                      : "text-gray-400 hover:bg-gray-50 hover:text-gray-600"
                  }`}
                >
                  <Plus className="w-3.5 h-3.5 flex-shrink-0" />
                  <span className="text-sm font-medium">Yeni Rol</span>
                </button>
              </>
            )}
          </div>
        </div>

        {/* ── Right content panel ───────────────────────────────────────────── */}
        <div className="flex-1 min-w-0 bg-white rounded-xl border border-gray-200 overflow-hidden">
          {/* Panel header */}
          <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
            <div className="flex items-center gap-2 min-w-0">
              {selectedSystemRole && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${ROLE_META[selectedSystemRole].bg} ${ROLE_META[selectedSystemRole].color}`}>
                  {ROLE_META[selectedSystemRole].label}
                </span>
              )}
              {selectedRoleDef && !isEditingThis && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${selectedRoleDef.bg} ${selectedRoleDef.color}`}>
                  {selectedRoleDef.label}
                </span>
              )}
              {isEditingThis && editForm.label && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${editForm.bg} ${editForm.color}`}>
                  {editForm.label}
                </span>
              )}
              {isCreatingRole && (
                <span className="text-sm font-semibold text-gray-500">Yeni İnovasyon Rolü</span>
              )}
              {isSystemAdmin && (
                <span className="flex items-center gap-1 text-xs text-gray-400">
                  <Lock className="w-3 h-3" />
                  Bu rol düzenlenemez
                </span>
              )}
              {selectedSystemRole && saveErrors[selectedSystemRole] && (
                <span className="text-xs text-red-600">{saveErrors[selectedSystemRole]}</span>
              )}
              {selectedRoleDef && !isEditingThis && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {innovUsers.filter((u) => u.innovation_roles.includes(selectedRoleDef.role_key)).length} kullanıcı
                </span>
              )}
              {deleteError && <span className="text-xs text-red-500">{deleteError}</span>}
            </div>

            <div className="flex items-center gap-2 flex-shrink-0">
              {canReset && selectedSystemRole && (
                <button
                  onClick={() => handleReset(selectedSystemRole)}
                  disabled={resetting || saving}
                  className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50 transition-colors"
                >
                  {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                  Varsayılana sıfırla
                </button>
              )}
              {selectedRoleDef && !isEditingThis && (
                <button
                  onClick={() => startEdit(selectedRoleDef)}
                  className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-violet-50 hover:text-violet-700 hover:border-violet-200 transition-colors"
                >
                  <Pencil className="w-3 h-3" />
                  Düzenle
                </button>
              )}
            </div>
          </div>

          {/* ── System role: permission matrix ───────────────────────────────── */}
          {selectedSystemRole && (
            apiLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : loadError ? (
              <div className="px-5 py-12 text-center text-sm text-red-500">{loadError}</div>
            ) : (
              <div className="divide-y divide-gray-100">
                {GROUPS.map(({ label, prefix }) => {
                  const actions = ACTIONS_BY_PREFIX[prefix] ?? [];
                  if (actions.length === 0) return null;
                  const GroupIcon = GROUP_ICONS[prefix] ?? ShieldCheck;
                  const activeCount = actions.filter(
                    (a) => displayPerms.includes(`${prefix}.${a}` as Permission)
                  ).length;
                  const allActive = activeCount === actions.length;
                  return (
                    <div key={prefix} className="px-5 py-4">
                      <div className="flex items-center justify-between mb-3">
                        <div className="flex items-center gap-2">
                          <GroupIcon className="w-3.5 h-3.5 text-gray-400" />
                          <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider">{label}</h3>
                        </div>
                        <span className={`text-xs font-medium tabular-nums ${allActive ? "text-indigo-500" : "text-gray-400"}`}>
                          {activeCount}/{actions.length}
                        </span>
                      </div>
                      <div className="flex flex-wrap gap-2">
                        {actions.map((action) => {
                          const perm = `${prefix}.${action}` as Permission;
                          const has = displayPerms.includes(perm);
                          const wasHas = (effectivePerms[selectedSystemRole] ?? ROLE_PERMISSIONS[selectedSystemRole]).includes(perm);
                          const changed = isSelectedPending && has !== wasHas;

                          if (isSystemAdmin) {
                            return (
                              <span
                                key={action}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold ${
                                  has ? "bg-gray-700 text-white" : "bg-gray-50 text-gray-300 border border-gray-200"
                                }`}
                              >
                                {has && <Check className="w-3 h-3" />}
                                {ACTION_LABELS[action] ?? action}
                              </span>
                            );
                          }

                          return (
                            <button
                              key={action}
                              onClick={() => handleTogglePerm(perm, !has)}
                              disabled={saving || resetting}
                              className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${
                                changed
                                  ? has
                                    ? "bg-amber-400 text-white ring-2 ring-amber-300 ring-offset-1"
                                    : "bg-white text-amber-600 border-2 border-amber-400"
                                  : has
                                    ? "bg-indigo-600 text-white hover:bg-indigo-700"
                                    : "bg-white text-gray-400 border border-gray-200 hover:border-indigo-300 hover:text-indigo-600 hover:bg-indigo-50"
                              }`}
                            >
                              {has && <Check className="w-3 h-3" />}
                              {ACTION_LABELS[action] ?? action}
                            </button>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* ── Innovation role: edit form ─────────────────────────────────── */}
          {isEditingThis && selectedRoleDef && (
            <RoleForm
              form={editForm}
              onChange={setEditForm}
              onSave={handleSaveEdit}
              onCancel={cancelEdit}
              onDelete={
                selectedRoleDef.is_custom
                  ? () => handleDeleteRole(selectedRoleDef.role_key)
                  : undefined
              }
              saving={editSaving || deletingRole === selectedRoleDef.role_key}
              error={editError || (deletingRole === selectedRoleDef.role_key ? "" : deleteError)}
            />
          )}

          {/* ── Innovation role: create form ──────────────────────────────── */}
          {isCreatingRole && (
            <RoleForm
              form={createForm}
              onChange={setCreateForm}
              onSave={handleCreateRole}
              onCancel={() => {
                setSelected(roleDefs.length > 0
                  ? { type: "innovation", role: roleDefs[0].role_key }
                  : { type: "system", role: "admin" });
                setCreateError("");
              }}
              saving={createSaving}
              error={createError}
              isCreate
            />
          )}

          {/* ── Innovation role: permissions + user list ─────────────────── */}
          {selectedRoleDef && !isEditingThis && (() => {
            const roleKey = selectedRoleDef.role_key;
            const hasPendingPerms = roleKey in innovPendingPerms;
            const displayPermsInnov = innovPendingPerms[roleKey] ?? selectedRoleDef.permissions;
            return (
              <div>
                {/* Description */}
                {selectedRoleDef.description && (
                  <div className="px-5 py-3 border-b border-gray-100 bg-gray-50">
                    <p className="text-xs text-gray-500">{selectedRoleDef.description}</p>
                  </div>
                )}

                {/* Permission Matrix */}
                <div className="px-5 py-4 border-b border-gray-100">
                  <div className="flex items-center justify-between mb-3">
                    <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider flex items-center gap-1.5">
                      <ShieldCheck className="w-3.5 h-3.5" />
                      İzinler
                    </h3>
                    {hasPendingPerms && (
                      <div className="flex items-center gap-2">
                        {innovPermError && <span className="text-xs text-red-500">{innovPermError}</span>}
                        <button
                          onClick={() => handleCancelInnovPerms(roleKey)}
                          disabled={innovPermSaving}
                          className="text-xs text-gray-500 hover:text-gray-700 disabled:opacity-50 transition-colors"
                        >
                          İptal
                        </button>
                        <button
                          onClick={() => handleSaveInnovPerms(roleKey)}
                          disabled={innovPermSaving}
                          className="flex items-center gap-1.5 px-2.5 py-1 text-xs bg-violet-600 text-white rounded-md hover:bg-violet-700 disabled:opacity-50 transition-colors"
                        >
                          {innovPermSaving && <Loader2 className="w-3 h-3 animate-spin" />}
                          Kaydet
                        </button>
                      </div>
                    )}
                  </div>
                  <div className="space-y-3">
                    {INNOV_GROUPS.map((group) => (
                      <div key={group.label}>
                        <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1.5">{group.label}</p>
                        <div className="flex flex-wrap gap-2">
                          {group.perms.map((perm) => {
                            const has = displayPermsInnov.includes(perm);
                            const origHas = selectedRoleDef.permissions.includes(perm);
                            const changed = hasPendingPerms && has !== origHas;
                            return (
                              <button
                                key={perm}
                                onClick={() => handleToggleInnovPerm(roleKey, perm, !has)}
                                disabled={innovPermSaving}
                                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-semibold transition-all disabled:opacity-50 ${
                                  changed
                                    ? has
                                      ? "bg-amber-400 text-white ring-2 ring-amber-300 ring-offset-1"
                                      : "bg-white text-amber-600 border-2 border-amber-400"
                                    : has
                                      ? "bg-violet-600 text-white hover:bg-violet-700"
                                      : "bg-white text-gray-400 border border-gray-200 hover:border-violet-300 hover:text-violet-600 hover:bg-violet-50"
                                }`}
                              >
                                {has && <Check className="w-3 h-3" />}
                                {INNOV_PERM_LABELS[perm]}
                              </button>
                            );
                          })}
                        </div>
                      </div>
                    ))}
                  </div>
                </div>

                {/* User list */}
                <div>
                  <div className="px-5 py-2.5 border-b border-gray-100 bg-gray-50 flex items-center gap-1.5">
                    <Users className="w-3.5 h-3.5 text-gray-400" />
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanıcılar</p>
                  </div>
                  {innovLoading ? (
                    <div className="flex items-center justify-center py-8">
                      <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
                    </div>
                  ) : innovLoadError ? (
                    <div className="px-5 py-8 text-center">
                      <p className="text-sm text-red-500 mb-3">{innovLoadError}</p>
                      <button onClick={() => loadInnovUsers(token)} className="text-xs text-blue-600 hover:underline">
                        Tekrar dene
                      </button>
                    </div>
                  ) : innovUsers.length === 0 ? (
                    <div className="px-5 py-8 text-center text-sm text-gray-400">Henüz kullanıcı yok</div>
                  ) : (
                    <div className="divide-y divide-gray-100">
                      {innovUsers.map((u) => {
                        const has = u.innovation_roles.includes(roleKey);
                        const key = `${u.id}:${roleKey}`;
                        const toggling = !!innovToggles[key];
                        const errMsg = innovErrors[key];
                        return (
                          <div key={u.id} className="flex items-center justify-between px-5 py-3 hover:bg-gray-50 transition-colors">
                            <div className="flex items-center gap-3 min-w-0">
                              <div className="w-8 h-8 rounded-full bg-indigo-100 flex items-center justify-center flex-shrink-0">
                                <span className="text-xs font-semibold text-indigo-700">
                                  {u.name.split(" ").map((n) => n[0]).slice(0, 2).join("").toUpperCase()}
                                </span>
                              </div>
                              <div className="min-w-0">
                                <p className="text-sm font-medium text-gray-900 truncate">{u.name}</p>
                                <p className="text-xs text-gray-400 truncate">{u.department ?? u.email}</p>
                                {errMsg && <p className="text-xs text-red-500 mt-0.5">{errMsg}</p>}
                              </div>
                            </div>
                            <button
                              onClick={() => handleToggleInnovRole(u.id, roleKey, has)}
                              disabled={toggling}
                              title={has ? "Rolü kaldır" : "Rol ata"}
                              className={`group flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors disabled:opacity-50 flex-shrink-0 ${
                                has
                                  ? "bg-violet-100 text-violet-700 hover:bg-red-50 hover:text-red-600"
                                  : "bg-gray-100 text-gray-500 hover:bg-violet-50 hover:text-violet-700"
                              }`}
                            >
                              {toggling ? (
                                <Loader2 className="w-3 h-3 animate-spin" />
                              ) : has ? (
                                <>
                                  <Check className="w-3 h-3 group-hover:hidden" />
                                  <X className="w-3 h-3 hidden group-hover:block" />
                                </>
                              ) : (
                                <span className="w-3 h-3 flex items-center justify-center text-base leading-none">+</span>
                              )}
                              <span className={has ? "group-hover:hidden" : ""}>{has ? "Atandı" : "Ata"}</span>
                              {has && <span className="hidden group-hover:inline">Kaldır</span>}
                            </button>
                          </div>
                        );
                      })}
                    </div>
                  )}
                </div>
              </div>
            );
          })()}
        </div>
      </div>

      {/* Sticky Save Bar (system roles only) */}
      {hasPending && (
        <div className="fixed bottom-0 left-0 right-0 z-50 flex justify-center pointer-events-none">
          <div className="mb-6 bg-white border border-gray-200 rounded-xl shadow-lg px-5 py-3 flex items-center gap-4 pointer-events-auto">
            <span className="text-sm text-gray-600">
              {Object.keys(pendingChanges).length} rol için değişiklik var
            </span>
            <div className="flex gap-2">
              <button
                onClick={handleCancel}
                disabled={saving}
                className="px-3 py-1.5 text-sm border border-gray-200 rounded-md text-gray-600 hover:bg-gray-50 disabled:opacity-50 transition-colors"
              >
                İptal
              </button>
              <button
                onClick={handleSave}
                disabled={saving}
                className="px-3 py-1.5 text-sm bg-blue-600 text-white rounded-md hover:bg-blue-700 disabled:opacity-50 flex items-center gap-1.5 transition-colors"
              >
                {saving && <Loader2 className="w-3.5 h-3.5 animate-spin" />}
                Değişiklikleri Kaydet
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
