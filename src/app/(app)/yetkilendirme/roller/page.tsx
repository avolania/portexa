"use client";

import { useEffect, useState, useCallback } from "react";
import { useRouter } from "next/navigation";
import { Check, X, Lock, Loader2, RotateCcw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_PERMISSIONS, ROLE_META } from "@/lib/permissions";
import type { UserRole, Permission } from "@/types";

// ─── Constants ────────────────────────────────────────────────────────────────

const ROLES_ORDER: UserRole[] = [
  "admin", "pm", "member", "approver", "viewer", "end_user", "system_admin",
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
  const [selected, setSelected] = useState<UserRole>("admin");

  // Server state
  const [effectivePerms, setEffectivePerms] = useState<Record<string, Permission[]>>(
    Object.fromEntries(ROLES_ORDER.map((r) => [r, [...ROLE_PERMISSIONS[r]]]))
  );
  const [customized, setCustomized] = useState<Set<UserRole>>(new Set());

  // Pending (unsaved) state
  const [pendingChanges, setPendingChanges] = useState<Record<string, Permission[]>>({});
  const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});

  // Loading / saving
  const [apiLoading, setApiLoading] = useState(true);
  const [loadError, setLoadError] = useState("");
  const [saving, setSaving] = useState(false);
  const [resetting, setResetting] = useState(false);

  // ── Init ──────────────────────────────────────────────────────────────────

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

  // ── Handlers ──────────────────────────────────────────────────────────────

  const handleTogglePerm = useCallback((perm: Permission, checked: boolean) => {
    const current = pendingChanges[selected] ?? effectivePerms[selected] ?? ROLE_PERMISSIONS[selected];
    const next = checked
      ? [...current, perm]
      : current.filter((p) => p !== perm);
    const effective = effectivePerms[selected] ?? ROLE_PERMISSIONS[selected];
    if (permsEqual(next, effective)) {
      setPendingChanges((prev) => { const n = { ...prev }; delete n[selected]; return n; });
    } else {
      setPendingChanges((prev) => ({ ...prev, [selected]: next }));
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
          if (permsEqual(perms, ROLE_PERMISSIONS[role as UserRole])) {
            next.delete(role as UserRole);
          } else {
            next.add(role as UserRole);
          }
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
        const msg = ((err as { error?: string }).error ?? "Sıfırlanamadı") as string;
        setSaveErrors((prev) => ({ ...prev, [role]: msg }));
      }
    } finally {
      setResetting(false);
    }
  }, [token]);

  const handleCancel = useCallback(() => {
    setPendingChanges({});
    setSaveErrors({});
  }, []);

  // ── Guards ────────────────────────────────────────────────────────────────

  if (authLoading) return null;
  if (!user || !effectivePermissions.includes("settings.manage")) return null;

  // ── Derived ───────────────────────────────────────────────────────────────

  const displayPerms = pendingChanges[selected] ?? effectivePerms[selected] ?? ROLE_PERMISSIONS[selected];
  const isSystemAdmin = selected === "system_admin";
  const hasPending = Object.keys(pendingChanges).length > 0;
  const isSelectedPending = selected in pendingChanges;
  const isSelectedCustomized = customized.has(selected);
  const canReset = (isSelectedCustomized || isSelectedPending) && !isSystemAdmin;

  // ── Render ────────────────────────────────────────────────────────────────

  return (
    <div className="max-w-5xl mx-auto space-y-6 pb-24">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Roller</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Sistem rollerini görüntüleyin ve yetki kapsamlarını düzenleyin
        </p>
      </div>

      {/* Role Cards */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {ROLES_ORDER.map((role) => {
          const meta = ROLE_META[role];
          const effective = effectivePerms[role] ?? ROLE_PERMISSIONS[role];
          const count = effective.length;
          const isSelected = selected === role;
          const isPending = role in pendingChanges;
          const isCustom = customized.has(role as UserRole);
          return (
            <button
              key={role}
              onClick={() => setSelected(role)}
              className={`flex-shrink-0 w-44 text-left p-4 rounded-xl border-2 transition-all bg-white ${
                isSelected
                  ? "border-blue-500 shadow-md"
                  : "border-gray-200 hover:border-gray-300 hover:shadow-sm"
              }`}
            >
              <div className="flex items-start justify-between gap-2 mb-2">
                <span className={`inline-flex items-center px-2 py-0.5 rounded-full text-xs font-semibold ${meta.bg} ${meta.color}`}>
                  {meta.label}
                </span>
                <div className="flex items-center gap-1 flex-shrink-0">
                  {isPending && (
                    <span className="w-2 h-2 rounded-full bg-yellow-400 flex-shrink-0" title="Kaydedilmemiş değişiklik" />
                  )}
                  {isCustom && !isPending && (
                    <span className="text-[10px] font-semibold text-amber-600 bg-amber-50 border border-amber-200 rounded px-1">
                      özel
                    </span>
                  )}
                  <span className="text-xs text-gray-400 font-medium">{count}</span>
                </div>
              </div>
              <p className="text-xs text-gray-500 line-clamp-2 leading-relaxed">
                {meta.description}
              </p>
            </button>
          );
        })}
      </div>

      {/* Permission Detail Panel */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {/* Panel Header */}
        <div className="px-5 py-4 border-b border-gray-100 flex items-center justify-between gap-3">
          <div className="flex items-center gap-2 min-w-0">
            <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold flex-shrink-0 ${ROLE_META[selected].bg} ${ROLE_META[selected].color}`}>
              {ROLE_META[selected].label}
            </span>
            {isSystemAdmin && (
              <span className="flex items-center gap-1 text-xs text-gray-400">
                <Lock className="w-3 h-3" />
                Bu rol düzenlenemez
              </span>
            )}
            {saveErrors[selected] && (
              <span className="text-xs text-red-600">{saveErrors[selected]}</span>
            )}
          </div>
          {canReset && (
            <button
              onClick={() => handleReset(selected)}
              disabled={resetting || saving}
              className="flex items-center gap-1.5 text-xs text-gray-500 border border-gray-200 rounded-md px-2.5 py-1.5 hover:bg-gray-50 disabled:opacity-50 transition-colors flex-shrink-0"
            >
              {resetting ? (
                <Loader2 className="w-3 h-3 animate-spin" />
              ) : (
                <RotateCcw className="w-3 h-3" />
              )}
              Varsayılana sıfırla
            </button>
          )}
        </div>

        {/* Permission Groups */}
        {apiLoading ? (
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
                      const wasHas = (effectivePerms[selected] ?? ROLE_PERMISSIONS[selected]).includes(perm);
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
        )}
      </div>

      {/* Sticky Save Bar */}
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
