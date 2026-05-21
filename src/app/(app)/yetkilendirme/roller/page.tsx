"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Lock, Loader2, RotateCcw, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_PERMISSIONS, ROLE_META } from "@/lib/permissions";
import type { UserRole, Permission } from "@/types";
import type { InnovationRole } from "@/lib/innovation/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const SYSTEM_ROLES: UserRole[] = [
  "admin", "pm", "member", "approver", "viewer", "end_user", "system_admin",
];

const INNOVATION_ROLES: InnovationRole[] = [
  "innovation_admin", "business_sponsor", "innovation_evaluator",
  "finance", "pmo_manager", "executive",
];

const INNOVATION_ROLE_META: Record<InnovationRole, { label: string; description: string; color: string; bg: string }> = {
  innovation_admin:     { label: "İnovasyon Admin",  description: "Tüm inovasyon işlemlerini yönetir",    color: "text-violet-700", bg: "bg-violet-100" },
  business_sponsor:     { label: "Business Sponsor", description: "POC başlatma ve tamamlama onayı",       color: "text-blue-700",   bg: "bg-blue-100"   },
  innovation_evaluator: { label: "Değerlendirici",   description: "Fikirleri puanlar ve değerlendirir",   color: "text-green-700",  bg: "bg-green-100"  },
  finance:              { label: "Finans",            description: "Bütçe onaylama ve finansal analiz",    color: "text-amber-700",  bg: "bg-amber-100"  },
  pmo_manager:          { label: "PMO Yöneticisi",   description: "Proje portföy yönetimi",               color: "text-indigo-700", bg: "bg-indigo-100" },
  executive:            { label: "Yönetici",          description: "Üst düzey görüntüleme ve onaylama",   color: "text-gray-700",   bg: "bg-gray-100"   },
};

const GROUPS: { label: string; prefix: string }[] = [
  { label: "Proje",   prefix: "project"    },
  { label: "Görev",   prefix: "task"       },
  { label: "Bütçe",   prefix: "budget"     },
  { label: "Rapor",   prefix: "report"     },
  { label: "Ekip",    prefix: "team"       },
  { label: "Yönetim", prefix: "governance" },
  { label: "Ayarlar", prefix: "settings"   },
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

// ─── Types ────────────────────────────────────────────────────────────────────

type SelectedTab =
  | { type: "system"; role: UserRole }
  | { type: "innovation"; role: InnovationRole };

interface InnovUser {
  id: string;
  name: string;
  email: string;
  department: string | null;
  innovation_roles: InnovationRole[];
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

  // Innovation role state
  const [innovUsers, setInnovUsers] = useState<InnovUser[]>([]);
  const [innovLoading, setInnovLoading] = useState(false);
  const [innovLoadError, setInnovLoadError] = useState("");
  const [innovToggles, setInnovToggles] = useState<Record<string, boolean>>({});
  const [innovErrors, setInnovErrors] = useState<Record<string, string>>({});

  // Loading / saving
  const [apiLoading, setApiLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

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

      const res = await fetch("/api/yetkilendirme/roller", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) {
        const json = await res.json() as {
          permissions: Record<string, Permission[]>;
          customized: string[];
        };
        setEffectivePerms(json.permissions);
        setCustomized(new Set(json.customized as UserRole[]));
      } else {
        setLoadError("Yetki verileri yüklenemedi. Sayfayı yenileyin.");
      }
      setApiLoading(false);
    }
    init();
  }, [user, router, effectivePermissions]);

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

  // Load innovation users when switching to innovation tab for the first time
  useEffect(() => {
    if (selected.type === "innovation" && token && innovUsers.length === 0 && !innovLoading) {
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

  // ── Innovation role handlers ─────────────────────────────────────────────────

  const handleToggleInnovRole = useCallback(async (userId: string, role: InnovationRole, has: boolean) => {
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

  // ── Guards ──────────────────────────────────────────────────────────────────

  if (authLoading) return null;
  if (!user || !effectivePermissions.includes("settings.manage")) return null;

  // ── Derived ─────────────────────────────────────────────────────────────────

  const selectedSystemRole = selected.type === "system" ? selected.role : null;
  const selectedInnovRole = selected.type === "innovation" ? selected.role : null;

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
                  onClick={() => setSelected({ type: "system", role })}
                  className={`w-full flex items-center justify-between gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-blue-50 text-blue-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <div className="flex items-center gap-2 min-w-0">
                    <span className={`w-2 h-2 rounded-full flex-shrink-0 ${meta.bg.replace("bg-", "bg-")}`}
                      style={{ background: isActive ? undefined : undefined }}
                    >
                      <span className={`block w-2 h-2 rounded-full ${meta.bg}`} />
                    </span>
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
            {INNOVATION_ROLES.map((role) => {
              const meta = INNOVATION_ROLE_META[role];
              const isActive = selected.type === "innovation" && selected.role === role;
              return (
                <button
                  key={role}
                  onClick={() => setSelected({ type: "innovation", role })}
                  className={`w-full flex items-center gap-2 px-2 py-2 rounded-lg text-left transition-colors ${
                    isActive
                      ? "bg-violet-50 text-violet-700"
                      : "text-gray-700 hover:bg-gray-50"
                  }`}
                >
                  <span className={`block w-2 h-2 rounded-full flex-shrink-0 ${meta.bg}`} />
                  <span className="text-sm font-medium truncate">{meta.label}</span>
                </button>
              );
            })}
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
              {selectedInnovRole && (
                <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${INNOVATION_ROLE_META[selectedInnovRole].bg} ${INNOVATION_ROLE_META[selectedInnovRole].color}`}>
                  {INNOVATION_ROLE_META[selectedInnovRole].label}
                </span>
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
              {selectedInnovRole && (
                <span className="text-xs text-gray-400 flex items-center gap-1">
                  <Users className="w-3 h-3" />
                  {innovUsers.filter((u) => u.innovation_roles.includes(selectedInnovRole)).length} kullanıcı
                </span>
              )}
            </div>
            {canReset && selectedSystemRole && (
              <button
                onClick={() => handleReset(selectedSystemRole)}
                disabled={resetting || saving}
                className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
              >
                {resetting ? <Loader2 className="w-3 h-3 animate-spin" /> : <RotateCcw className="w-3 h-3" />}
                Varsayılana sıfırla
              </button>
            )}
          </div>

          {/* System role: permission matrix */}
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
                  return (
                    <div key={prefix} className="px-5 py-4">
                      <h3 className="text-xs font-semibold text-gray-400 uppercase tracking-wider mb-3">
                        {label}
                      </h3>
                      <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                        {actions.map((action) => {
                          const perm = `${prefix}.${action}` as Permission;
                          const has = displayPerms.includes(perm);
                          const wasHas = (effectivePerms[selectedSystemRole] ?? ROLE_PERMISSIONS[selectedSystemRole]).includes(perm);
                          const changed = isSelectedPending && has !== wasHas;
                          return (
                            <label
                              key={action}
                              htmlFor={isSystemAdmin ? undefined : `perm-${perm}`}
                              className={`flex items-center gap-2 rounded-md px-2 py-1 transition-colors ${
                                isSystemAdmin ? "cursor-not-allowed" : "cursor-pointer hover:bg-gray-50"
                              } ${changed ? "border-l-2 border-yellow-400 pl-1.5" : ""}`}
                            >
                              {isSystemAdmin ? (
                                has ? (
                                  <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                                ) : (
                                  <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
                                )
                              ) : (
                                <input
                                  id={`perm-${perm}`}
                                  type="checkbox"
                                  checked={has}
                                  disabled={saving || resetting}
                                  onChange={(e) => handleTogglePerm(perm, e.target.checked)}
                                  className="w-4 h-4 rounded border-gray-300 text-blue-600 focus:ring-blue-500 disabled:opacity-50 flex-shrink-0"
                                />
                              )}
                              <span className={`text-sm ${has ? "text-gray-700" : "text-gray-400"}`}>
                                {ACTION_LABELS[action] ?? action}
                              </span>
                            </label>
                          );
                        })}
                      </div>
                    </div>
                  );
                })}
              </div>
            )
          )}

          {/* Innovation role: user list */}
          {selectedInnovRole && (
            innovLoading ? (
              <div className="flex items-center justify-center py-12">
                <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
              </div>
            ) : innovLoadError ? (
              <div className="px-5 py-12 text-center">
                <p className="text-sm text-red-500 mb-3">{innovLoadError}</p>
                <button
                  onClick={() => loadInnovUsers(token)}
                  className="text-xs text-blue-600 hover:underline"
                >
                  Tekrar dene
                </button>
              </div>
            ) : (
              <div>
                <div className="px-5 py-3 border-b border-gray-50 bg-gray-50">
                  <p className="text-xs text-gray-500">{INNOVATION_ROLE_META[selectedInnovRole].description}</p>
                </div>
                {innovUsers.length === 0 ? (
                  <div className="px-5 py-12 text-center text-sm text-gray-400">
                    Henüz kullanıcı yok
                  </div>
                ) : (
                  <div className="divide-y divide-gray-100">
                    {innovUsers.map((u) => {
                      const has = u.innovation_roles.includes(selectedInnovRole);
                      const key = `${u.id}:${selectedInnovRole}`;
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
                              {errMsg && (
                                <p className="text-xs text-red-500 mt-0.5">{errMsg}</p>
                              )}
                            </div>
                          </div>
                          <button
                            onClick={() => handleToggleInnovRole(u.id, selectedInnovRole, has)}
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
                            <span className={has ? "group-hover:hidden" : ""}>
                              {has ? "Atandı" : "Ata"}
                            </span>
                            {has && (
                              <span className="hidden group-hover:inline">Kaldır</span>
                            )}
                          </button>
                        </div>
                      );
                    })}
                  </div>
                )}
              </div>
            )
          )}
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
