"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Check, X } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission, ROLE_PERMISSIONS, ROLE_META } from "@/lib/permissions";
import type { UserRole, Permission } from "@/types";

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

export default function RollerPage() {
  const router = useRouter();
  const user = useAuthStore((s) => s.user);
  const loading = useAuthStore((s) => s.loading);
  const [selected, setSelected] = useState<UserRole>("admin");

  useEffect(() => {
    if (user && !hasPermission(user.role, "settings.manage")) {
      router.replace("/dashboard");
    }
  }, [user, router]);

  if (loading) return null;
  if (!user || !hasPermission(user.role, "settings.manage")) return null;

  const selectedPerms = ROLE_PERMISSIONS[selected];

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      <div>
        <h1 className="text-xl font-bold text-gray-900">Roller</h1>
        <p className="text-sm text-gray-500 mt-0.5">
          Sistem rollerini ve yetki kapsamlarını görüntüleyin
        </p>
      </div>

      {/* Role Cards */}
      <div className="flex gap-3 overflow-x-auto pb-1">
        {ROLES_ORDER.map((role) => {
          const meta = ROLE_META[role];
          const count = ROLE_PERMISSIONS[role].length;
          const isSelected = selected === role;
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
                <span className="text-xs text-gray-400 font-medium flex-shrink-0">{count}</span>
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
        <div className="px-5 py-4 border-b border-gray-100 flex items-center gap-3">
          <span className={`inline-flex items-center px-2.5 py-1 rounded-full text-sm font-semibold ${ROLE_META[selected].bg} ${ROLE_META[selected].color}`}>
            {ROLE_META[selected].label}
          </span>
          <span className="text-sm text-gray-500">{ROLE_META[selected].description}</span>
        </div>
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
                    const has = selectedPerms.includes(perm);
                    return (
                      <div key={action} className="flex items-center gap-2">
                        {has ? (
                          <Check className="w-4 h-4 text-emerald-500 flex-shrink-0" />
                        ) : (
                          <X className="w-4 h-4 text-gray-300 flex-shrink-0" />
                        )}
                        <span className={`text-sm ${has ? "text-gray-700" : "text-gray-400"}`}>
                          {ACTION_LABELS[action] ?? action}
                        </span>
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}
        </div>
      </div>
    </div>
  );
}
