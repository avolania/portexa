"use client";

import { useState, useMemo, useEffect } from "react";
import {
  Shield, ShieldCheck, Search, Check,
  Users, AlertTriangle, Save, RotateCcw, X,
  UserPlus, Pencil, Trash2, Building2, Globe, ChevronDown, ChevronUp, Link2,
} from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import { useOrgStore } from "@/store/useOrgStore";
import { ROLE_META, ROLE_PERMISSIONS } from "@/lib/permissions";
import { usePermission } from "@/hooks/usePermission";
import Avatar from "@/components/ui/Avatar";
import type { UserRole, Permission, Organization } from "@/types";
import { dbLoadAllOrgs } from "@/lib/db";

// ─── Birleşik kullanıcı tipi ──────────────────────────────────────────────────

interface AuthUser {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  department?: string;
  source: "registered" | "team";
  projectIds: string[];
  status: "active" | "pending" | "inactive";
  orgId?: string;
}

// ─── Silme onay dialogu ───────────────────────────────────────────────────────

function DeleteConfirmDialog({
  user,
  onClose,
  onConfirm,
}: {
  user: AuthUser;
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center gap-3 mb-4">
          <div className="w-10 h-10 rounded-xl bg-red-100 flex items-center justify-center flex-shrink-0">
            <Trash2 className="w-5 h-5 text-red-600" />
          </div>
          <div>
            <h2 className="text-base font-bold text-gray-900">Kullanıcıyı Sil</h2>
            <p className="text-sm text-gray-500">Bu işlem geri alınamaz.</p>
          </div>
        </div>
        <div className="bg-gray-50 rounded-xl p-3 mb-5">
          <div className="flex items-center gap-2">
            <Avatar name={user.name} size="sm" />
            <div>
              <div className="text-sm font-medium text-gray-900">{user.name}</div>
              <div className="text-xs text-gray-400">{user.email}</div>
            </div>
          </div>
        </div>
        <p className="text-sm text-gray-600 mb-5">
          Bu kullanıcıyı sistemden silmek istediğinizden emin misiniz? Kullanıcının ekip üyeliği ve proje atamaları kaldırılacak.
        </p>
        <div className="flex gap-3">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">
            İptal
          </button>
          <button
            onClick={() => { onConfirm(); onClose(); }}
            className="flex-1 py-2.5 text-sm bg-red-600 text-white rounded-xl font-semibold hover:bg-red-700 transition-colors"
          >
            Evet, Sil
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Kullanıcı düzenleme modal ────────────────────────────────────────────────

const PERM_SHORT: Partial<Record<Permission, string>> = {
  "project.create": "Proje oluştur", "project.edit": "Proje düzenle", "project.delete": "Proje sil",
  "task.create": "Görev oluştur", "task.edit": "Görev düzenle", "task.delete": "Görev sil", "task.assign": "Görev ata",
  "governance.create": "Yönetişim ekle", "governance.approve": "Onayla", "governance.delete": "Yönetişim sil",
  "team.manage": "Ekip yönet", "budget.edit": "Bütçe düzenle", "settings.manage": "Ayarlar yönet",
};

function UserEditModal({
  user,
  projects,
  onClose,
  onSave,
}: {
  user: AuthUser;
  projects: { id: string; name: string }[];
  onClose: () => void;
  onSave: (userId: string, updates: { role: UserRole; name: string; title?: string; department?: string }) => void;
}) {
  const [form, setForm] = useState({
    name: user.name,
    title: user.title ?? "",
    department: user.department ?? "",
    role: user.role,
  });

  const perms = ROLE_PERMISSIONS[form.role];
  const keyPerms = (Object.entries(PERM_SHORT) as [Permission, string][]).filter(([k]) => perms.includes(k));

  const handleSave = () => {
    onSave(user.id, {
      role: form.role,
      name: form.name.trim() || user.name,
      title: form.title.trim() || undefined,
      department: form.department.trim() || undefined,
    });
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50" onClick={onClose}>
      <div
        className="bg-white rounded-2xl shadow-2xl w-full max-w-xl overflow-hidden"
        onClick={(e) => e.stopPropagation()}
      >
        {/* Modal header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <Avatar name={user.name} size="md" />
            <div>
              <h2 className="text-base font-bold text-gray-900">{user.name}</h2>
              <p className="text-xs text-gray-400">{user.email}</p>
            </div>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400 hover:text-gray-700">
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="px-6 py-5 space-y-5 max-h-[70vh] overflow-y-auto">
          {/* Temel bilgiler */}
          <div className="grid grid-cols-2 gap-3">
            <div className="col-span-2">
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Ad Soyad</label>
              <input
                value={form.name}
                onChange={(e) => setForm((s) => ({ ...s, name: e.target.value }))}
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Unvan</label>
              <input
                value={form.title}
                onChange={(e) => setForm((s) => ({ ...s, title: e.target.value }))}
                placeholder="Yazılım Geliştirici"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Departman</label>
              <input
                value={form.department}
                onChange={(e) => setForm((s) => ({ ...s, department: e.target.value }))}
                placeholder="Yazılım"
                className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          </div>

          {/* Rol seçimi */}
          <div>
            <label className="block text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Rol</label>
            <div className="grid grid-cols-1 gap-2">
              {(Object.keys(ROLE_META) as UserRole[]).map((r) => {
                const m = ROLE_META[r];
                const active = form.role === r;
                return (
                  <button
                    key={r}
                    onClick={() => setForm((s) => ({ ...s, role: r }))}
                    className={`w-full text-left flex items-center gap-3 px-4 py-3 rounded-xl border-2 transition-all ${
                      active
                        ? "border-indigo-400 bg-indigo-50"
                        : "border-gray-100 bg-white hover:border-gray-200 hover:bg-gray-50"
                    }`}
                  >
                    <span className={`text-xs font-bold px-2.5 py-1 rounded-full flex-shrink-0 ${m.bg} ${m.color}`}>
                      {m.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm text-gray-700">{m.description}</p>
                      <p className="text-xs text-gray-400 mt-0.5">{ROLE_PERMISSIONS[r].length} yetki</p>
                    </div>
                    {active && (
                      <div className="w-5 h-5 rounded-full bg-indigo-500 flex items-center justify-center flex-shrink-0">
                        <Check className="w-3 h-3 text-white" />
                      </div>
                    )}
                  </button>
                );
              })}
            </div>
          </div>

          {/* Seçilen rol yetkileri */}
          <div className={`rounded-xl p-4 ${ROLE_META[form.role].bg}`}>
            <p className={`text-xs font-semibold mb-2 ${ROLE_META[form.role].color}`}>
              {ROLE_META[form.role].label} — Aktif Yetkiler
            </p>
            <div className="flex flex-wrap gap-1.5">
              {keyPerms.length > 0
                ? keyPerms.map(([, label]) => (
                    <span key={label} className="text-xs bg-white/70 border border-current/10 px-2 py-0.5 rounded-full text-gray-700">
                      {label}
                    </span>
                  ))
                : <span className="text-xs text-gray-500">Sadece ana sayfa görüntüleme</span>
              }
            </div>
          </div>

          {/* Atandığı projeler */}
          {user.projectIds.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-gray-500 mb-2 uppercase tracking-wide">Atandığı Projeler</p>
              <div className="flex flex-wrap gap-1.5">
                {user.projectIds.map((pid) => {
                  const p = projects.find((pr) => pr.id === pid);
                  return p ? (
                    <span key={pid} className="text-xs bg-indigo-50 text-indigo-600 border border-indigo-100 px-2.5 py-1 rounded-full">
                      {p.name}
                    </span>
                  ) : null;
                })}
              </div>
            </div>
          )}
        </div>

        {/* Modal footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button
            onClick={onClose}
            className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 font-medium transition-colors"
          >
            İptal
          </button>
          <button
            onClick={handleSave}
            className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2"
          >
            <Save className="w-4 h-4" />
            Kaydet
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Yeni kullanıcı modal ─────────────────────────────────────────────────────

function AddUserModal({ onClose, onAdd }: {
  onClose: () => void;
  onAdd: (name: string, email: string, role: UserRole, title?: string) => void;
}) {
  const [form, setForm] = useState({ name: "", email: "", role: "member" as UserRole, title: "" });
  const [err, setErr] = useState("");

  const submit = () => {
    if (!form.name.trim() || !form.email.trim()) { setErr("Ad ve e-posta zorunludur."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.email)) { setErr("Geçerli bir e-posta girin."); return; }
    onAdd(form.name.trim(), form.email.trim(), form.role, form.title.trim() || undefined);
    onClose();
  };

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-base font-bold text-gray-900">Kullanıcı Ekle</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400"><X className="w-5 h-5" /></button>
        </div>
        <div className="space-y-3">
          {[
            { key: "name",  label: "Ad Soyad *",   placeholder: "Ahmet Yılmaz" },
            { key: "email", label: "E-posta *",     placeholder: "ahmet@sirket.com" },
            { key: "title", label: "Unvan",         placeholder: "Yazılım Geliştirici" },
          ].map((f) => (
            <div key={f.key}>
              <label className="block text-sm font-medium text-gray-700 mb-1">{f.label}</label>
              <input
                value={form[f.key as keyof typeof form]}
                onChange={(e) => setForm((s) => ({ ...s, [f.key]: e.target.value }))}
                placeholder={f.placeholder}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
              />
            </div>
          ))}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Rol</label>
            <select
              value={form.role}
              onChange={(e) => setForm((s) => ({ ...s, role: e.target.value as UserRole }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
            >
              {(Object.keys(ROLE_META) as UserRole[]).map((r) => (
                <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].description}</option>
              ))}
            </select>
          </div>
          {err && <p className="text-xs text-red-500">{err}</p>}
        </div>
        <div className="flex gap-3 mt-5">
          <button onClick={onClose} className="flex-1 py-2 text-sm border border-gray-300 rounded-lg text-gray-700 hover:bg-gray-50">İptal</button>
          <button onClick={submit} className="flex-1 py-2 text-sm bg-indigo-600 text-white rounded-lg font-medium hover:bg-indigo-700">Ekle</button>
        </div>
      </div>
    </div>
  );
}

// ─── Rol stat kartı ───────────────────────────────────────────────────────────

function RoleStatCard({ role, count, total }: { role: UserRole; count: number; total: number }) {
  const m = ROLE_META[role];
  return (
    <div className={`rounded-2xl border-2 border-current/10 p-4 ${m.bg}`}>
      <div className="flex items-center justify-between mb-1">
        <span className={`text-sm font-semibold ${m.color}`}>{m.label}</span>
        <span className={`text-2xl font-bold ${m.color}`}>{count}</span>
      </div>
      <div className="h-1.5 bg-white/50 rounded-full overflow-hidden mt-2">
        <div
          className="h-full rounded-full bg-current opacity-40"
          style={{ width: total > 0 ? `${(count / total) * 100}%` : "0%" }}
        />
      </div>
      <p className={`text-xs mt-1.5 opacity-70 ${m.color}`}>{m.description}</p>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const PLAN_META: Record<string, { label: string; color: string; bg: string }> = {
  free:       { label: "Ücretsiz", color: "text-gray-600",   bg: "bg-gray-100" },
  starter:    { label: "Starter",  color: "text-blue-700",   bg: "bg-blue-100" },
  pro:        { label: "Pro",      color: "text-indigo-700", bg: "bg-indigo-100" },
  enterprise: { label: "Kurumsal", color: "text-amber-700",  bg: "bg-amber-100" },
};

const STATUS_META: Record<string, { label: string; color: string }> = {
  active:    { label: "Aktif",    color: "text-emerald-600" },
  trial:     { label: "Deneme",   color: "text-amber-600" },
  suspended: { label: "Askıda",   color: "text-red-600" },
};

export default function YetkilendirmePage() {
  const authStore = useAuthStore();
  const { members, addMember, removeMember } = useTeamStore();
  const { projects } = useProjectStore();
  const { org, update: updateOrg } = useOrgStore();
  const canEdit = usePermission("team.manage");
  const currentUser = authStore.user;
  const isSystemAdmin = currentUser?.role === "system_admin";

  const [allOrgs, setAllOrgs] = useState<Organization[]>([]);
  const [selectedOrgId, setSelectedOrgId] = useState<string | null>(null);
  const [extraProfiles, setExtraProfiles] = useState<Record<string, import("@/types").User>>({});

  // Sayfa açıldığında profilleri taze yükle (davet kabul eden yeni kullanıcıları görmek için)
  useEffect(() => {
    authStore.loadProfiles();
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (!isSystemAdmin) return;
    dbLoadAllOrgs().then((orgs) => {
      setAllOrgs(orgs);
    }).catch(() => {});
  }, [isSystemAdmin]);

  // system_admin seçili org değişince o org'un profillerini yükle
  useEffect(() => {
    if (!isSystemAdmin || !selectedOrgId) return;
    import("@/lib/db").then(({ dbLoadProfiles }) => {
      dbLoadProfiles(selectedOrgId).then(setExtraProfiles).catch(() => {});
    });
  }, [isSystemAdmin, selectedOrgId]);

  const [search, setSearch] = useState("");
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");
  const [saved, setSaved] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [editUser, setEditUser] = useState<AuthUser | null>(null);
  const [deleteUser, setDeleteUser] = useState<AuthUser | null>(null);
  const [showOrgEdit, setShowOrgEdit] = useState(false);
  const [orgForm, setOrgForm] = useState({ name: "", industry: "", website: "", address: "" });
  const [orgSaved, setOrgSaved] = useState(false);
  const [showAssign, setShowAssign] = useState(false);
  const [assignEmail, setAssignEmail] = useState("");
  const [assignRole, setAssignRole] = useState<UserRole>("member");
  const [assignLoading, setAssignLoading] = useState(false);
  const [assignError, setAssignError] = useState("");
  const [assignSuccess, setAssignSuccess] = useState("");

  const [showInvite, setShowInvite] = useState(false);
  const [inviteEmail, setInviteEmail] = useState("");
  const [inviteLoading, setInviteLoading] = useState(false);
  const [inviteError, setInviteError] = useState("");
  const [inviteSuccess, setInviteSuccess] = useState("");

  // Hangi profil kaynağını kullanacağız: system_admin + seçili org → extraProfiles, aksi → kendi profiles
  const activeProfiles = isSystemAdmin && selectedOrgId ? extraProfiles : authStore.profiles;

  // Birleşik kullanıcı listesi: profiles (kayıtlı) + teamStore (manuel eklenen)
  const allUsers = useMemo<AuthUser[]>(() => {
    const map = new Map<string, AuthUser>();

    Object.values(activeProfiles).forEach((p) => {
      if (!p.id || !p.email) return; // sahte / eksik kayıtları atla
      const member = members.find((m) => m.email === p.email);
      map.set(p.email, {
        id: p.id,
        name: p.name,
        email: p.email,
        role: p.role,
        title: p.title ?? member?.title,
        department: p.department ?? member?.department,
        source: "registered",
        projectIds: member?.projectIds ?? [],
        status: "active",
        orgId: p.orgId,
      });
    });

    // teamStore üyeleri sadece kendi org'umuzda göster
    if (!isSystemAdmin || !selectedOrgId) {
      members.forEach((m) => {
        if (!map.has(m.email)) {
          map.set(m.email, {
            id: m.id,
            name: m.name,
            email: m.email,
            role: m.role,
            title: m.title,
            department: m.department,
            source: "team",
            projectIds: m.projectIds,
            status: m.status,
          });
        }
      });
    }

    return Array.from(map.values()).sort((a, b) => a.name.localeCompare(b.name, "tr"));
  }, [activeProfiles, members, isSystemAdmin, selectedOrgId]);

  // Arama + rol filtresi
  const filtered = useMemo(() => {
    const q = search.trim().toLowerCase();
    return allUsers
      .filter((u) => roleFilter === "all" || u.role === roleFilter)
      .filter((u) =>
        !q ||
        u.name.toLowerCase().includes(q) ||
        u.email.toLowerCase().includes(q) ||
        (u.title ?? "").toLowerCase().includes(q) ||
        (u.department ?? "").toLowerCase().includes(q)
      );
  }, [allUsers, roleFilter, search]);

  const handleSaveUser = (
    userId: string,
    updates: { role: UserRole; name: string; title?: string; department?: string }
  ) => {
    const user = allUsers.find((u) => u.id === userId);
    if (!user) return;

    const teamState = useTeamStore.getState();

    // Profili bul: UUID veya email ile eşleştir (key türü farklı olabilir)
    const sourceProfiles = isSystemAdmin && selectedOrgId ? extraProfiles : useAuthStore.getState().profiles;
    const profileEntry = Object.values(sourceProfiles).find(
      (p) => p.id === userId || p.email === user.email
    );

    if (profileEntry) {
      const updated = { ...profileEntry, ...updates };
      // Doğrudan DB'ye UUID ile yaz
      import("@/lib/db").then(({ dbUpsertProfile }) => dbUpsertProfile(profileEntry.id, updated));
      // Local state güncelle
      if (isSystemAdmin && selectedOrgId) {
        setExtraProfiles((prev) => ({ ...prev, [user.email]: updated }));
      } else {
        useAuthStore.setState((state) => ({
          profiles: Object.fromEntries(
            Object.entries(state.profiles).map(([k, v]) =>
              v.id === profileEntry.id ? [k, updated] : [k, v]
            )
          ),
          user: state.user?.id === profileEntry.id ? { ...state.user, ...updates } : state.user,
        }));
      }
    }

    const member = teamState.members.find((m) => m.id === userId || m.email === user.email);
    if (member) {
      teamState.changeRole(member.id, updates.role);
    }

    setSaved(true);
    setTimeout(() => setSaved(false), 2500);
  };

  const handleAddUser = (name: string, email: string, role: UserRole, title?: string) => {
    const id = crypto.randomUUID();
    addMember({
      id, name, email, role,
      title: title ?? undefined,
      projectIds: [],
      status: "pending",
      joinedAt: new Date().toISOString(),
    });
    useAuthStore.setState((state) => ({
      profiles: {
        ...state.profiles,
        [email]: { id, name, email, role, language: "tr" as const, title, orgId: useAuthStore.getState().user?.orgId ?? "" },
      },
    }));
  };

  const handleDeleteUser = (user: AuthUser) => {
    // Team store'dan sil
    const member = members.find((m) => m.id === user.id || m.email === user.email);
    if (member) removeMember(member.id);
    // Auth profiles'dan sil
    useAuthStore.setState((state) => {
      const updated = { ...state.profiles };
      delete updated[user.email];
      return { profiles: updated };
    });
  };

  const handleAssignToOrg = async () => {
    const email = assignEmail.trim().toLowerCase();
    if (!email) { setAssignError("E-posta adresi gerekli."); return; }
    const orgId = authStore.user?.orgId;
    if (!orgId) return;
    setAssignLoading(true);
    setAssignError("");
    setAssignSuccess("");
    try {
      const { dbAssignUserToOrg } = await import("@/lib/db");
      const result = await dbAssignUserToOrg(email, orgId);
      if (!result.ok) { setAssignError(result.error ?? "Atama başarısız."); return; }
      // Profilleri yeniden yükle
      await authStore.loadProfiles();
      setAssignSuccess(`${email} başarıyla organizasyona atandı.`);
      setAssignEmail("");
    } finally {
      setAssignLoading(false);
    }
  };

  const handleInvite = async () => {
    const email = inviteEmail.trim().toLowerCase();
    if (!email) { setInviteError("E-posta adresi gerekli."); return; }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) { setInviteError("Geçerli bir e-posta girin."); return; }
    const orgId = authStore.user?.orgId;
    const orgName = org?.name ?? "Organizasyon";
    if (!orgId) return;
    setInviteLoading(true);
    setInviteError("");
    setInviteSuccess("");
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email, orgId, orgName, invitedBy: authStore.user?.name ?? "Admin" }),
      });
      const body = await res.json().catch(() => ({}));
      if (!res.ok) { setInviteError(body.error ?? "Davet gönderilemedi."); return; }
      setInviteSuccess(`${email} adresine davet gönderildi.`);
      setInviteEmail("");
    } finally {
      setInviteLoading(false);
    }
  };

  if (!canEdit) {
    return (
      <div className="max-w-lg mx-auto mt-20 text-center">
        <div className="w-16 h-16 bg-red-50 rounded-2xl flex items-center justify-center mx-auto mb-4">
          <Shield className="w-8 h-8 text-red-400" />
        </div>
        <h2 className="text-lg font-bold text-gray-900 mb-2">Yetkisiz Erişim</h2>
        <p className="text-sm text-gray-500">Bu sayfa yalnızca <strong>Admin</strong> rolüne sahip kullanıcılar tarafından görüntülenebilir.</p>
      </div>
    );
  }

  const handleOrgSave = async () => {
    const orgId = useAuthStore.getState().user?.orgId;
    if (!orgId) return;
    const { dbUpsertOrg } = await import("@/lib/db");
    const { useOrgStore: _orgStore } = await import("@/store/useOrgStore");
    const now = new Date().toISOString();
    const updated = {
      id: orgId,
      name: orgForm.name.trim() || org?.name || "Organizasyon",
      industry: orgForm.industry || org?.industry,
      size: org?.size,
      plan: org?.plan ?? "free" as const,
      status: org?.status ?? "trial" as const,
      website: orgForm.website.trim() || org?.website,
      address: orgForm.address.trim() || org?.address,
      createdAt: org?.createdAt ?? now,
    };
    await dbUpsertOrg(orgId, updated);
    _orgStore.setState({ org: updated });
    setShowOrgEdit(false);
    setOrgSaved(true);
    setTimeout(() => setOrgSaved(false), 2500);
  };

  return (
    <div className="max-w-6xl mx-auto space-y-6">

      {/* ── Organizasyon Profili ── */}
      <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
        {/* Başlık */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <div className="flex items-center gap-3">
            <div className="w-10 h-10 bg-indigo-100 rounded-xl flex items-center justify-center">
              <Building2 className="w-5 h-5 text-indigo-600" />
            </div>
            <div>
              <h2 className="text-base font-bold text-gray-900">
                {org ? org.name : "Organizasyon Tanımlanmamış"}
              </h2>
              {org && (
                <div className="flex items-center gap-2 mt-0.5">
                  <span className={`text-xs font-semibold px-2 py-0.5 rounded-full ${PLAN_META[org.plan]?.bg} ${PLAN_META[org.plan]?.color}`}>
                    {PLAN_META[org.plan]?.label}
                  </span>
                  <span className={`text-xs font-medium ${STATUS_META[org.status]?.color}`}>
                    · {STATUS_META[org.status]?.label}
                  </span>
                </div>
              )}
            </div>
          </div>
          <button
            onClick={() => {
              setOrgForm({
                name: org?.name ?? "",
                industry: org?.industry ?? "",
                website: org?.website ?? "",
                address: org?.address ?? "",
              });
              setShowOrgEdit((v) => !v);
            }}
            className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-indigo-600 transition-colors px-3 py-1.5 rounded-lg hover:bg-indigo-50"
          >
            <Pencil className="w-3.5 h-3.5" />
            {org ? "Düzenle" : "Tanımla"}
            {showOrgEdit ? <ChevronUp className="w-3.5 h-3.5" /> : <ChevronDown className="w-3.5 h-3.5" />}
          </button>
        </div>

        {/* Org kayıt yok uyarısı */}
        {!org && !showOrgEdit && (
          <div className="px-6 py-5 flex items-center gap-3 bg-amber-50">
            <AlertTriangle className="w-5 h-5 text-amber-500 flex-shrink-0" />
            <div>
              <p className="text-sm font-medium text-amber-800">Organizasyon bilgileri henüz girilmemiş.</p>
              <p className="text-xs text-amber-600 mt-0.5">Yukarıdaki "Tanımla" butonuna tıklayarak organizasyonunuzu kayıt edin.</p>
            </div>
          </div>
        )}

        {/* Org meta — var ve düzenleme kapalıysa */}
        {org && !showOrgEdit && (
          <div className="px-6 py-4 grid grid-cols-2 sm:grid-cols-4 gap-4 text-sm">
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Sektör</p>
              <p className="font-medium text-gray-700">{org.industry || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Çalışan</p>
              <p className="font-medium text-gray-700">{org.size || "—"}</p>
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Web Sitesi</p>
              {org.website
                ? <a href={org.website} target="_blank" rel="noreferrer" className="font-medium text-indigo-600 hover:underline flex items-center gap-1"><Globe className="w-3 h-3" />{org.website.replace(/^https?:\/\//, "")}</a>
                : <p className="font-medium text-gray-700">—</p>
              }
            </div>
            <div>
              <p className="text-xs text-gray-400 uppercase tracking-wide mb-0.5">Kayıt Tarihi</p>
              <p className="font-medium text-gray-700">{org.createdAt ? new Date(org.createdAt).toLocaleDateString("tr-TR") : "—"}</p>
            </div>
          </div>
        )}

        {/* Form: hem oluşturma hem düzenleme */}
        {showOrgEdit && (
          <div className="px-6 py-5 space-y-4">
            {!org && (
              <p className="text-sm text-gray-500 bg-indigo-50 border border-indigo-100 rounded-xl px-4 py-3">
                Organizasyon bilgilerini girerek sistemdeki tüm kullanıcılar için kurumsal profili oluşturun.
              </p>
            )}
            <div className="grid grid-cols-2 gap-4">
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Organizasyon Adı *</label>
                <input
                  value={orgForm.name}
                  onChange={(e) => setOrgForm((s) => ({ ...s, name: e.target.value }))}
                  placeholder="Şirket Adı A.Ş."
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div className="col-span-2 sm:col-span-1">
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Sektör</label>
                <select
                  value={orgForm.industry}
                  onChange={(e) => setOrgForm((s) => ({ ...s, industry: e.target.value }))}
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  <option value="">— Seçin —</option>
                  {["Yazılım / IT","Finans ve Bankacılık","Üretim / Endüstri","Sağlık","Eğitim","Perakende / E-ticaret","İnşaat / Gayrimenkul","Medya / Reklam","Lojistik / Ulaşım","Enerji","Danışmanlık","Diğer"].map((i) => (
                    <option key={i} value={i}>{i}</option>
                  ))}
                </select>
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Web Sitesi</label>
                <input
                  value={orgForm.website}
                  onChange={(e) => setOrgForm((s) => ({ ...s, website: e.target.value }))}
                  placeholder="https://sirket.com"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1.5">Adres</label>
                <input
                  value={orgForm.address}
                  onChange={(e) => setOrgForm((s) => ({ ...s, address: e.target.value }))}
                  placeholder="İstanbul, Türkiye"
                  className="w-full border border-gray-200 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>
            </div>
            <div className="flex gap-3 pt-1">
              <button
                onClick={() => setShowOrgEdit(false)}
                className="px-4 py-2 text-sm border border-gray-200 rounded-xl text-gray-600 hover:bg-gray-50"
              >
                İptal
              </button>
              <button
                onClick={handleOrgSave}
                disabled={!orgForm.name.trim()}
                className="flex items-center gap-2 px-4 py-2 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-40"
              >
                <Save className="w-4 h-4" />
                {org ? "Güncelle" : "Organizasyonu Kaydet"}
              </button>
            </div>
          </div>
        )}
      </div>

      {/* system_admin org seçici */}
      {isSystemAdmin && allOrgs.length > 0 && (
        <div className="flex items-center gap-3 p-3 bg-rose-50 border border-rose-200 rounded-xl">
          <Building2 className="w-4 h-4 text-rose-500 shrink-0" />
          <span className="text-sm font-medium text-rose-700 shrink-0">Organizasyon:</span>
          <select
            className="flex-1 px-3 py-1.5 border border-rose-200 rounded-lg text-sm bg-white focus:outline-none focus:ring-2 focus:ring-rose-400"
            value={selectedOrgId ?? ""}
            onChange={(e) => setSelectedOrgId(e.target.value || null)}
          >
            <option value="">Kendi organizasyonum ({org?.name ?? "—"})</option>
            {allOrgs.map((o) => (
              <option key={o.id} value={o.id}>{o.name}</option>
            ))}
          </select>
        </div>
      )}

      {/* Header */}
      <div className="flex items-center justify-between gap-4 flex-wrap">
        <div>
          <div className="flex items-center gap-2 mb-0.5">
            {(() => {
              const displayOrg = selectedOrgId ? allOrgs.find((o) => o.id === selectedOrgId) : org;
              return displayOrg && <span className="text-sm font-medium text-indigo-600 bg-indigo-50 px-2.5 py-0.5 rounded-full">{displayOrg.name}</span>;
            })()}
          </div>
          <h1 className="text-2xl font-bold text-gray-900">Yetkilendirme</h1>
          <p className="text-sm text-gray-500 mt-1">
            {allUsers.length} kullanıcı · Organizasyon bazlı rol ve erişim yönetimi
          </p>
        </div>

        <div className="flex items-center gap-3 flex-wrap">
          {(saved || orgSaved) && (
            <div className="flex items-center gap-2 bg-emerald-50 border border-emerald-200 text-emerald-700 text-sm font-medium px-4 py-2 rounded-xl">
              <Check className="w-4 h-4" /> Kaydedildi
            </div>
          )}
          <button
            onClick={() => { setAssignEmail(""); setAssignError(""); setAssignSuccess(""); setShowAssign(true); }}
            className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors"
          >
            <Link2 className="w-4 h-4" /> Organizasyona Ata
          </button>
          <button
            onClick={() => { setInviteEmail(""); setInviteError(""); setInviteSuccess(""); setShowInvite(true); }}
            className="flex items-center gap-2 px-4 py-2 border border-emerald-300 text-emerald-700 bg-emerald-50 rounded-xl text-sm font-semibold hover:bg-emerald-100 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Davet Gönder
          </button>
          <button
            onClick={() => setShowAdd(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
          >
            <UserPlus className="w-4 h-4" /> Kullanıcı Ekle
          </button>
        </div>
      </div>

      {/* Rol istatistikleri */}
      <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
        {(Object.keys(ROLE_META) as UserRole[]).map((r) => (
          <RoleStatCard
            key={r}
            role={r}
            count={allUsers.filter((u) => u.role === r).length}
            total={allUsers.length}
          />
        ))}
      </div>

      {/* Arama + Filtre */}
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-[220px] max-w-sm">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            placeholder="Ad, e-posta veya unvan ara..."
            className="w-full pl-9 pr-3 py-2.5 text-sm border border-gray-300 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
          />
          {search && (
            <button onClick={() => setSearch("")} className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600">
              <X className="w-3.5 h-3.5" />
            </button>
          )}
        </div>

        <div className="flex gap-1 bg-gray-100 p-1 rounded-xl flex-wrap">
          <button
            onClick={() => setRoleFilter("all")}
            className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${roleFilter === "all" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
          >
            Tümü ({allUsers.length})
          </button>
          {(Object.keys(ROLE_META) as UserRole[]).map((r) => {
            const count = allUsers.filter((u) => u.role === r).length;
            return (
              <button
                key={r}
                onClick={() => setRoleFilter(r)}
                className={`px-3 py-1.5 text-xs font-medium rounded-lg transition-all ${roleFilter === r ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
              >
                {ROLE_META[r].label} ({count})
              </button>
            );
          })}
        </div>
      </div>

      {search && (
        <p className="text-sm text-gray-500">&ldquo;{search}&rdquo; için {filtered.length} sonuç</p>
      )}

      {/* Tablo */}
      {filtered.length === 0 ? (
        <div className="text-center py-20 bg-white border border-gray-200 rounded-2xl text-gray-400">
          <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
          <p className="text-sm font-medium">
            {allUsers.length === 0
              ? "Henüz kullanıcı yok. Kullanıcı Ekle butonuyla başlayın."
              : "Aramanızla eşleşen kullanıcı bulunamadı."}
          </p>
          {search && (
            <button onClick={() => setSearch("")} className="mt-2 text-sm text-indigo-600 hover:underline">
              Aramayı temizle
            </button>
          )}
        </div>
      ) : (
        <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                {["Kullanıcı", "Unvan / Dep.", "Rol", "Projeler", "Org Üyeliği", "Durum", ""].map((h) => (
                  <th key={h} className="text-left px-4 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wide whitespace-nowrap">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {filtered.map((u) => {
                const m = ROLE_META[u.role];
                return (
                  <tr
                    key={u.id}
                    className="hover:bg-gray-50 transition-colors cursor-pointer"
                    onClick={() => canEdit && setEditUser(u)}
                  >
                    {/* Kullanıcı */}
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-3">
                        <Avatar name={u.name} size="sm" />
                        <div>
                          <div className="text-sm font-medium text-gray-900">{u.name}</div>
                          <div className="text-xs text-gray-400">{u.email}</div>
                        </div>
                      </div>
                    </td>

                    {/* Unvan */}
                    <td className="px-4 py-3">
                      <div className="text-sm text-gray-600">{u.title ?? "—"}</div>
                      {u.department && <div className="text-xs text-gray-400">{u.department}</div>}
                    </td>

                    {/* Rol — sadece badge, dropdown yok */}
                    <td className="px-4 py-3">
                      <span className={`text-xs font-semibold px-2.5 py-1 rounded-full ${m.bg} ${m.color}`}>
                        {m.label}
                      </span>
                    </td>

                    {/* Projeler */}
                    <td className="px-4 py-3">
                      {u.projectIds.length > 0 ? (
                        <span className="text-sm text-indigo-600 font-medium">{u.projectIds.length} proje</span>
                      ) : (
                        <span className="text-sm text-gray-300">—</span>
                      )}
                    </td>

                    {/* Org Üyeliği */}
                    <td className="px-4 py-3">
                      {(() => {
                        const userOrg = u.orgId ? allOrgs.find((o) => o.id === u.orgId) : null;
                        return userOrg ? (
                          <div className="flex items-center gap-1.5">
                            <div className="w-1.5 h-1.5 rounded-full bg-emerald-500" />
                            <span className="text-xs text-emerald-700 font-medium truncate max-w-[120px]">{userOrg.name}</span>
                          </div>
                        ) : (
                          <span className="text-xs text-gray-400">—</span>
                        );
                      })()}
                    </td>

                    {/* Durum */}
                    <td className="px-4 py-3">
                      <div className={`flex items-center gap-1.5 text-xs ${
                        u.status === "active" ? "text-emerald-600" :
                        u.status === "pending" ? "text-amber-600" : "text-gray-400"
                      }`}>
                        <div className={`w-1.5 h-1.5 rounded-full ${
                          u.status === "active" ? "bg-emerald-500" :
                          u.status === "pending" ? "bg-amber-500" : "bg-gray-300"
                        }`} />
                        {u.status === "active" ? "Aktif" : u.status === "pending" ? "Beklemede" : "Pasif"}
                      </div>
                    </td>

                    {/* Düzenle / Sil */}
                    <td className="px-4 py-3">
                      {canEdit && (
                        <div className="flex items-center gap-1">
                          <button
                            onClick={(e) => { e.stopPropagation(); setEditUser(u); }}
                            className="flex items-center gap-1 text-xs text-gray-400 hover:text-indigo-600 transition-colors whitespace-nowrap px-2.5 py-1.5 rounded-lg hover:bg-indigo-50"
                          >
                            <Pencil className="w-3.5 h-3.5" />
                            Düzenle
                          </button>
                          {u.id !== authStore.user?.id && (
                            <button
                              onClick={(e) => { e.stopPropagation(); setDeleteUser(u); }}
                              className="flex items-center gap-1 text-xs text-gray-400 hover:text-red-600 transition-colors whitespace-nowrap px-2.5 py-1.5 rounded-lg hover:bg-red-50"
                            >
                              <Trash2 className="w-3.5 h-3.5" />
                              Sil
                            </button>
                          )}
                        </div>
                      )}
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {/* Rol açıklama kartları */}
      <div className="bg-white border border-gray-200 rounded-2xl p-6">
        <div className="flex items-center gap-2 mb-4">
          <ShieldCheck className="w-5 h-5 text-indigo-600" />
          <h3 className="font-semibold text-gray-900">Rol Tanımları</h3>
        </div>
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-3">
          {(Object.keys(ROLE_META) as UserRole[]).map((r) => {
            const m = ROLE_META[r];
            return (
              <div key={r} className={`p-4 rounded-xl border-2 border-current/10 ${m.bg}`}>
                <div className="flex items-center justify-between mb-1">
                  <span className={`text-sm font-bold ${m.color}`}>{m.label}</span>
                  <span className={`text-xs ${m.color} opacity-60`}>{ROLE_PERMISSIONS[r].length} yetki</span>
                </div>
                <p className={`text-xs ${m.color} opacity-80 mb-2`}>{m.description}</p>
                <div className="flex flex-wrap gap-1">
                  {(Object.entries(PERM_SHORT) as [Permission, string][])
                    .filter(([k]) => ROLE_PERMISSIONS[r].includes(k))
                    .slice(0, 4)
                    .map(([, label]) => (
                      <span key={label} className={`text-xs px-1.5 py-0.5 rounded bg-white/60 ${m.color} font-medium`}>
                        {label}
                      </span>
                    ))}
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Modals */}
      {editUser && (
        <UserEditModal
          user={editUser}
          projects={projects}
          onClose={() => setEditUser(null)}
          onSave={handleSaveUser}
        />
      )}
      {showAdd && (
        <AddUserModal onClose={() => setShowAdd(false)} onAdd={handleAddUser} />
      )}
      {deleteUser && (
        <DeleteConfirmDialog
          user={deleteUser}
          onClose={() => setDeleteUser(null)}
          onConfirm={() => handleDeleteUser(deleteUser)}
        />
      )}

      {/* Organizasyona Ata Modal */}
      {showAssign && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50" onClick={() => setShowAssign(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-indigo-100 rounded-lg flex items-center justify-center">
                  <Link2 className="w-4 h-4 text-indigo-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Organizasyona Ata</h2>
                  {org && <p className="text-xs text-gray-400">{org.name}</p>}
                </div>
              </div>
              <button onClick={() => setShowAssign(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">
                Sistemde kayıtlı bir kullanıcının e-postasını girin. Kullanıcı bu organizasyona atanacak.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta Adresi</label>
                <input
                  type="email"
                  value={assignEmail}
                  onChange={(e) => { setAssignEmail(e.target.value); setAssignError(""); setAssignSuccess(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleAssignToOrg()}
                  placeholder="kullanici@sirket.com"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">Rol</label>
                <select
                  value={assignRole}
                  onChange={(e) => setAssignRole(e.target.value as UserRole)}
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300 bg-white"
                >
                  {(Object.keys(ROLE_META) as UserRole[]).map((r) => (
                    <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].description}</option>
                  ))}
                </select>
              </div>

              {assignError && (
                <div className="flex items-center gap-2 text-sm text-red-600 bg-red-50 rounded-xl px-3 py-2.5">
                  <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                  {assignError}
                </div>
              )}
              {assignSuccess && (
                <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-xl px-3 py-2.5">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {assignSuccess}
                </div>
              )}
            </div>

            <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
              <button onClick={() => setShowAssign(false)} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100">
                {assignSuccess ? "Kapat" : "İptal"}
              </button>
              {!assignSuccess && (
                <button
                  onClick={handleAssignToOrg}
                  disabled={assignLoading || !assignEmail.trim()}
                  className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                >
                  <Link2 className="w-4 h-4" />
                  {assignLoading ? "Atanıyor..." : "Organizasyona Ata"}
                </button>
              )}
            </div>
          </div>
        </div>
      )}

      {/* Davet Gönder Modal */}
      {showInvite && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4 bg-black/50" onClick={() => setShowInvite(false)}>
          <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
            <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
              <div className="flex items-center gap-2">
                <div className="w-8 h-8 bg-emerald-100 rounded-lg flex items-center justify-center">
                  <UserPlus className="w-4 h-4 text-emerald-600" />
                </div>
                <div>
                  <h2 className="text-base font-bold text-gray-900">Davet Gönder</h2>
                  {org && <p className="text-xs text-gray-400">{org.name}</p>}
                </div>
              </div>
              <button onClick={() => setShowInvite(false)} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
                <X className="w-5 h-5" />
              </button>
            </div>

            <div className="px-6 py-5 space-y-4">
              <p className="text-sm text-gray-500">
                E-posta adresine davet linki gönderilecek. Kullanıcı linke tıklayarak hesap oluşturup hemen giriş yapabilecek.
              </p>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1.5">E-posta Adresi</label>
                <input
                  type="email"
                  value={inviteEmail}
                  onChange={(e) => { setInviteEmail(e.target.value); setInviteError(""); setInviteSuccess(""); }}
                  onKeyDown={(e) => e.key === "Enter" && handleInvite()}
                  placeholder="kullanici@sirket.com"
                  autoFocus
                  className="w-full border border-gray-300 rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-emerald-300"
                />
              </div>

              {inviteError && (
                <div className="text-sm text-red-600 bg-red-50 border border-red-200 rounded-xl px-3 py-2.5">
                  {inviteError}
                </div>
              )}
              {inviteSuccess && (
                <div className="text-sm text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-xl px-3 py-2.5 flex items-center gap-2">
                  <Check className="w-4 h-4 flex-shrink-0" />
                  {inviteSuccess}
                </div>
              )}

              <div className="flex gap-3">
                <button
                  onClick={() => setShowInvite(false)}
                  className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium"
                >
                  {inviteSuccess ? "Kapat" : "İptal"}
                </button>
                {!inviteSuccess && (
                  <button
                    onClick={handleInvite}
                    disabled={inviteLoading || !inviteEmail.trim()}
                    className="flex-1 py-2.5 text-sm bg-emerald-600 text-white rounded-xl font-semibold hover:bg-emerald-700 disabled:opacity-40 flex items-center justify-center gap-2 transition-colors"
                  >
                    <UserPlus className="w-4 h-4" />
                    {inviteLoading ? "Gönderiliyor..." : "Davet Gönder"}
                  </button>
                )}
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
