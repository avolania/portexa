"use client";

import { useState } from "react";
import {
  UserPlus, Trash2, ChevronDown, Shield, Users,
  Mail, Briefcase, Building2, Check, X, FolderKanban, Search, Send,
} from "lucide-react";
import { useTeamStore } from "@/store/useTeamStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import { ROLE_META, ROLE_PERMISSIONS } from "@/lib/permissions";
import { usePermission } from "@/hooks/usePermission";
import Avatar from "@/components/ui/Avatar";
import type { TeamMember, UserRole, Permission } from "@/types";

// ─── Rol badge ────────────────────────────────────────────────────────────────

function RoleBadge({ role }: { role: UserRole }) {
  const m = ROLE_META[role];
  return (
    <span className={`inline-flex items-center gap-1 text-xs font-medium px-2 py-0.5 rounded-full ${m.bg} ${m.color}`}>
      {m.label}
    </span>
  );
}

// ─── Rol seçici ───────────────────────────────────────────────────────────────

function RoleSelector({ value, onChange }: { value: UserRole; onChange: (r: UserRole) => void }) {
  const [open, setOpen] = useState(false);
  const m = ROLE_META[value];
  return (
    <div className="relative">
      <button
        onClick={() => setOpen(!open)}
        className={`flex items-center gap-1.5 text-xs font-medium px-2.5 py-1 rounded-full border ${m.bg} ${m.color} border-current/20`}
      >
        {m.label} <ChevronDown className="w-3 h-3" />
      </button>
      {open && (
        <div className="absolute left-0 top-full mt-1 bg-white border border-gray-200 rounded-xl shadow-lg z-20 w-52 overflow-hidden">
          {(Object.keys(ROLE_META) as UserRole[]).map((r) => {
            const rm = ROLE_META[r];
            return (
              <button
                key={r}
                onClick={() => { onChange(r); setOpen(false); }}
                className="w-full text-left px-4 py-2.5 hover:bg-gray-50 flex items-start gap-2"
              >
                <span className={`text-xs font-medium px-2 py-0.5 rounded-full ${rm.bg} ${rm.color} flex-shrink-0 mt-0.5`}>
                  {rm.label}
                </span>
                <span className="text-xs text-gray-500 leading-tight">{rm.description}</span>
              </button>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Üye kartı ────────────────────────────────────────────────────────────────

function MemberCard({
  member, onChangeRole, onRemove, onToggleProject, projects, canManage,
}: {
  member: TeamMember;
  onChangeRole: (id: string, role: UserRole) => void;
  onRemove: (id: string) => void;
  onToggleProject: (memberId: string, projectId: string, assigned: boolean) => void;
  projects: { id: string; name: string }[];
  canManage: boolean;
}) {
  const [showProjects, setShowProjects] = useState(false);

  return (
    <div className="bg-white border border-gray-200 rounded-2xl p-5 hover:border-gray-300 transition-colors">
      <div className="flex items-start justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <Avatar name={member.name} size="lg" />
          <div className="min-w-0">
            <div className="font-semibold text-gray-900 truncate">{member.name}</div>
            <div className="text-sm text-gray-500 flex items-center gap-1 mt-0.5">
              <Mail className="w-3 h-3 flex-shrink-0" />
              <span className="truncate">{member.email}</span>
            </div>
            {member.title && (
              <div className="text-xs text-gray-400 flex items-center gap-1 mt-0.5">
                <Briefcase className="w-3 h-3" /> {member.title}
                {member.department && <> · <Building2 className="w-3 h-3" /> {member.department}</>}
              </div>
            )}
          </div>
        </div>
        <div className="flex items-center gap-2 flex-shrink-0">
          {canManage
            ? <RoleSelector value={member.role} onChange={(r) => onChangeRole(member.id, r)} />
            : <RoleBadge role={member.role} />
          }
          {canManage && (
            <button
              onClick={() => onRemove(member.id)}
              className="p-1.5 text-gray-400 hover:text-red-500 hover:bg-red-50 rounded-lg transition-colors"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* Proje atamaları */}
      <div className="mt-4 pt-4 border-t border-gray-100">
        <button
          onClick={() => setShowProjects(!showProjects)}
          className="flex items-center gap-2 text-xs text-gray-500 hover:text-gray-700 font-medium"
        >
          <FolderKanban className="w-3.5 h-3.5" />
          {member.projectIds.length > 0 ? `${member.projectIds.length} proje atandı` : "Proje atanmadı"}
          <ChevronDown className={`w-3.5 h-3.5 transition-transform ${showProjects ? "rotate-180" : ""}`} />
        </button>
        {showProjects && projects.length > 0 && (
          <div className="mt-2 space-y-1">
            {projects.map((p) => {
              const assigned = member.projectIds.includes(p.id);
              return (
                <div key={p.id} className="flex items-center justify-between py-1.5 px-2 rounded-lg hover:bg-gray-50">
                  <span className="text-sm text-gray-700">{p.name}</span>
                  {canManage ? (
                    <button
                      onClick={() => onToggleProject(member.id, p.id, assigned)}
                      className={`flex items-center gap-1 text-xs px-2 py-0.5 rounded-full transition-colors ${
                        assigned ? "bg-indigo-100 text-indigo-700 hover:bg-indigo-200" : "bg-gray-100 text-gray-500 hover:bg-gray-200"
                      }`}
                    >
                      {assigned ? <><Check className="w-3 h-3" /> Atandı</> : <>+ Ata</>}
                    </button>
                  ) : (
                    assigned && <Check className="w-3.5 h-3.5 text-indigo-500" />
                  )}
                </div>
              );
            })}
          </div>
        )}
      </div>

      <div className="mt-2 flex items-center gap-2">
        <div className={`w-1.5 h-1.5 rounded-full ${
          member.status === "active" ? "bg-emerald-500" : member.status === "pending" ? "bg-amber-500" : "bg-gray-300"
        }`} />
        <span className="text-xs text-gray-400">
          {member.status === "active" ? "Aktif" : member.status === "pending" ? "Davet Bekleniyor" : "Pasif"}
        </span>
      </div>
    </div>
  );
}

// ─── Üye ekle modal ───────────────────────────────────────────────────────────

function AddMemberModal({
  onClose,
  onAdd,
  existingEmails,
}: {
  onClose: () => void;
  onAdd: (m: TeamMember) => Promise<void>;
  existingEmails: string[];
}) {
  const profiles = useAuthStore((s) => s.profiles);
  const [tab, setTab] = useState<"registered" | "manual">("registered");
  const [search, setSearch] = useState("");
  const [selected, setSelected] = useState<string | null>(null); // email
  const [selectedRole, setSelectedRole] = useState<UserRole>("member");
  const [form, setForm] = useState({ name: "", email: "", title: "", department: "", role: "member" as UserRole });
  const [error, setError] = useState("");
  const [loading, setLoading] = useState(false);

  // Kayıtlı kullanıcılar — ekipte olmayanlar
  const available = Object.values(profiles).filter(
    (p) => !existingEmails.includes(p.email)
  );
  const filteredProfiles = available.filter((p) => {
    const q = search.toLowerCase();
    return (
      !q ||
      p.name.toLowerCase().includes(q) ||
      p.email.toLowerCase().includes(q) ||
      (p.title ?? "").toLowerCase().includes(q)
    );
  });

  const handleAddRegistered = async () => {
    const p = Object.values(profiles).find((p) => p.email === selected);
    if (!p) return;
    setLoading(true);
    setError("");
    try {
      await onAdd({
        id: p.id,
        name: p.name,
        email: p.email,
        title: p.title,
        department: p.department,
        role: selectedRole,
        projectIds: [],
        status: "active",
        joinedAt: new Date().toISOString(),
      });
      onClose();
    } catch {
      setError("Üye eklenirken hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  const handleAddManual = async () => {
    if (!form.name.trim() || !form.email.trim()) { setError("Ad ve e-posta zorunludur."); return; }
    setLoading(true);
    setError("");
    try {
      await onAdd({
        id: crypto.randomUUID(),
        name: form.name.trim(),
        email: form.email.trim(),
        title: form.title.trim() || undefined,
        department: form.department.trim() || undefined,
        role: form.role,
        projectIds: [],
        status: "pending",
        joinedAt: new Date().toISOString(),
      });
      onClose();
    } catch {
      setError("Üye eklenirken hata oluştu. Lütfen tekrar deneyin.");
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md overflow-hidden" onClick={(e) => e.stopPropagation()}>
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">Üye Ekle</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Tab seçici */}
        <div className="flex gap-1 p-3 bg-gray-50 border-b border-gray-100">
          <button
            onClick={() => setTab("registered")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === "registered" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-800"}`}
          >
            Kayıtlı Kullanıcıdan Seç
            {available.length > 0 && (
              <span className="ml-1.5 text-xs bg-indigo-100 text-indigo-600 px-1.5 py-0.5 rounded-full">{available.length}</span>
            )}
          </button>
          <button
            onClick={() => setTab("manual")}
            className={`flex-1 py-2 text-sm font-medium rounded-lg transition-all ${tab === "manual" ? "bg-white shadow-sm text-indigo-700" : "text-gray-500 hover:text-gray-800"}`}
          >
            Manuel Ekle
          </button>
        </div>

        <div className="px-6 py-5 max-h-[60vh] overflow-y-auto">
          {/* Kayıtlı kullanıcılar */}
          {tab === "registered" && (
            <div className="space-y-4">
              {available.length === 0 ? (
                <div className="text-center py-8 text-gray-400">
                  <Users className="w-10 h-10 mx-auto mb-2 opacity-30" />
                  <p className="text-sm">Tüm kayıtlı kullanıcılar zaten ekipte.</p>
                </div>
              ) : (
                <>
                  {/* Arama */}
                  <div className="relative">
                    <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                    <input
                      value={search}
                      onChange={(e) => setSearch(e.target.value)}
                      placeholder="İsim veya e-posta ara..."
                      className="w-full pl-9 pr-3 py-2 text-sm border border-gray-200 rounded-xl focus:outline-none focus:ring-2 focus:ring-indigo-300"
                    />
                  </div>

                  {/* Kullanıcı listesi */}
                  <div className="space-y-1 max-h-48 overflow-y-auto">
                    {filteredProfiles.length === 0 ? (
                      <p className="text-sm text-gray-400 text-center py-4">Eşleşen kullanıcı bulunamadı.</p>
                    ) : (
                      filteredProfiles.map((p) => {
                        const isSelected = selected === p.email;
                        return (
                          <button
                            key={p.email}
                            onClick={() => { setSelected(p.email); setSelectedRole(p.role); }}
                            className={`w-full flex items-center gap-3 px-3 py-2.5 rounded-xl text-left transition-all border-2 ${
                              isSelected ? "border-indigo-400 bg-indigo-50" : "border-transparent hover:bg-gray-50"
                            }`}
                          >
                            <Avatar name={p.name} size="sm" />
                            <div className="flex-1 min-w-0">
                              <div className="text-sm font-medium text-gray-900 truncate">{p.name}</div>
                              <div className="text-xs text-gray-400 truncate">{p.email}</div>
                              {p.title && <div className="text-xs text-gray-400 truncate">{p.title}</div>}
                            </div>
                            <span className={`text-xs font-medium px-2 py-0.5 rounded-full flex-shrink-0 ${ROLE_META[p.role].bg} ${ROLE_META[p.role].color}`}>
                              {ROLE_META[p.role].label}
                            </span>
                            {isSelected && <Check className="w-4 h-4 text-indigo-500 flex-shrink-0" />}
                          </button>
                        );
                      })
                    )}
                  </div>

                  {/* Seçilen kullanıcı için rol ata */}
                  {selected && (
                    <div>
                      <label className="block text-xs font-semibold text-gray-500 mb-1.5 uppercase tracking-wide">Ekipteki Rolü</label>
                      <select
                        value={selectedRole}
                        onChange={(e) => setSelectedRole(e.target.value as UserRole)}
                        className="w-full border border-gray-200 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                      >
                        {(Object.keys(ROLE_META) as UserRole[]).map((r) => (
                          <option key={r} value={r}>{ROLE_META[r].label} — {ROLE_META[r].description}</option>
                        ))}
                      </select>
                    </div>
                  )}
                </>
              )}
            </div>
          )}

          {/* Manuel ekleme */}
          {tab === "manual" && (
            <div className="space-y-3">
              {[
                { label: "Ad Soyad *", key: "name", placeholder: "Ahmet Yılmaz" },
                { label: "E-posta *", key: "email", placeholder: "ahmet@sirket.com" },
                { label: "Unvan", key: "title", placeholder: "Yazılım Geliştirici" },
                { label: "Departman", key: "department", placeholder: "Yazılım" },
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
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
          <button onClick={onClose} disabled={loading} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100 disabled:opacity-50">
            İptal
          </button>
          {tab === "registered" ? (
            <button
              onClick={handleAddRegistered}
              disabled={!selected || loading}
              className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-40 disabled:cursor-not-allowed transition-colors"
            >
              {loading ? "Ekleniyor..." : "Ekibe Ekle"}
            </button>
          ) : (
            <button
              onClick={handleAddManual}
              disabled={loading}
              className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-50 transition-colors"
            >
              {loading ? "Ekleniyor..." : "Ekle"}
            </button>
          )}
        </div>
        {error && <p className="text-sm text-red-500 text-center pb-3">{error}</p>}
      </div>
    </div>
  );
}

// ─── Davet Modal ──────────────────────────────────────────────────────────────

function InviteModal({ onClose, orgId, orgName, invitedBy }: {
  onClose: () => void;
  orgId: string;
  orgName: string;
  invitedBy: string;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState("");
  const [success, setSuccess] = useState(false);

  const handleSend = async () => {
    if (!email.trim()) { setError("E-posta adresi gerekli."); return; }
    setError("");
    setLoading(true);
    try {
      const res = await fetch("/api/invite", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: email.trim(), orgId, orgName, invitedBy }),
      });
      const data = await res.json() as { error?: string };
      if (!res.ok) { setError(data.error ?? "Davet gönderilemedi."); return; }
      setSuccess(true);
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-sm overflow-hidden" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="text-base font-bold text-gray-900">E-posta ile Davet Gönder</h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 text-gray-400">
            <X className="w-5 h-5" />
          </button>
        </div>
        <div className="px-6 py-5">
          {success ? (
            <div className="text-center py-4">
              <Check className="w-10 h-10 text-emerald-500 mx-auto mb-3" />
              <p className="font-semibold text-gray-900">Davet gönderildi!</p>
              <p className="text-sm text-gray-500 mt-1">{email} adresine davet e-postası iletildi.</p>
              <button onClick={onClose} className="mt-4 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700">
                Kapat
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <p className="text-sm text-gray-500">
                Davet bağlantısı e-posta ile gönderilecek. Kullanıcı linke tıklayarak organizasyonunuza katılabilir.
              </p>
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">E-posta Adresi</label>
                <input
                  type="email"
                  value={email}
                  onChange={(e) => setEmail(e.target.value)}
                  onKeyDown={(e) => e.key === "Enter" && handleSend()}
                  placeholder="kisi@sirket.com"
                  className="w-full border border-gray-300 rounded-xl px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-300"
                  autoFocus
                />
              </div>
              {error && <p className="text-sm text-red-500">{error}</p>}
            </div>
          )}
        </div>
        {!success && (
          <div className="flex gap-3 px-6 py-4 border-t border-gray-100 bg-gray-50/50">
            <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-100">
              İptal
            </button>
            <button
              onClick={handleSend}
              disabled={loading}
              className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 disabled:opacity-60 flex items-center justify-center gap-2"
            >
              <Send className="w-4 h-4" />
              {loading ? "Gönderiliyor..." : "Davet Gönder"}
            </button>
          </div>
        )}
      </div>
    </div>
  );
}

// ─── Yetki Matrisi ────────────────────────────────────────────────────────────

const PERMISSION_GROUPS: { label: string; items: { key: Permission; label: string }[] }[] = [
  { label: "Projeler", items: [
    { key: "project.create", label: "Proje Oluştur" }, { key: "project.edit", label: "Proje Düzenle" },
    { key: "project.delete", label: "Proje Sil" },    { key: "project.view", label: "Görüntüle" },
  ]},
  { label: "Görevler", items: [
    { key: "task.create", label: "Görev Oluştur" },   { key: "task.edit", label: "Görev Düzenle" },
    { key: "task.delete", label: "Görev Sil" },       { key: "task.assign", label: "Görev Ata" },
    { key: "task.view", label: "Görüntüle" },
  ]},
  { label: "Yönetişim", items: [
    { key: "governance.create", label: "Kayıt Oluştur" }, { key: "governance.edit", label: "Kayıt Düzenle" },
    { key: "governance.delete", label: "Kayıt Sil" },     { key: "governance.approve", label: "Onayla" },
    { key: "governance.view", label: "Görüntüle" },
  ]},
  { label: "Raporlar", items: [
    { key: "report.create", label: "Oluştur" }, { key: "report.edit", label: "Düzenle" }, { key: "report.view", label: "Görüntüle" },
  ]},
  { label: "Ekip & Diğer", items: [
    { key: "team.view", label: "Ekip Görüntüle" }, { key: "team.manage", label: "Ekip Yönet" },
    { key: "budget.view", label: "Bütçe Gör" },   { key: "budget.edit", label: "Bütçe Düzenle" },
    { key: "settings.manage", label: "Ayarlar" },
  ]},
];

function PermissionMatrix() {
  const roles: UserRole[] = ["admin", "pm", "member", "approver"];
  return (
    <div className="bg-white border border-gray-200 rounded-2xl overflow-hidden">
      <div className="px-6 py-4 border-b border-gray-100">
        <h3 className="font-semibold text-gray-900">Rol Yetki Matrisi</h3>
        <p className="text-sm text-gray-500 mt-0.5">Her rolün sahip olduğu yetkiler</p>
      </div>
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="bg-gray-50 border-b border-gray-100">
              <th className="text-left px-6 py-3 text-xs font-semibold text-gray-500 uppercase w-44">Yetki</th>
              {roles.map((r) => {
                const m = ROLE_META[r];
                return (
                  <th key={r} className="text-center px-4 py-3 w-28">
                    <span className={`text-xs font-medium px-2 py-1 rounded-full ${m.bg} ${m.color}`}>{m.label}</span>
                  </th>
                );
              })}
            </tr>
          </thead>
          <tbody>
            {PERMISSION_GROUPS.map((group) => (
              <>
                <tr key={group.label} className="bg-gray-50/60">
                  <td colSpan={5} className="px-6 py-2 text-xs font-bold text-gray-500 uppercase tracking-wide">{group.label}</td>
                </tr>
                {group.items.map((p) => (
                  <tr key={p.key} className="border-t border-gray-50 hover:bg-gray-50/50">
                    <td className="px-6 py-2.5 text-sm text-gray-700">{p.label}</td>
                    {roles.map((r) => {
                      const has = ROLE_PERMISSIONS[r].includes(p.key);
                      return (
                        <td key={r} className="text-center px-4 py-2.5">
                          {has
                            ? <Check className="w-4 h-4 text-emerald-500 mx-auto" />
                            : <X className="w-4 h-4 text-gray-200 mx-auto" />
                          }
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </>
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function EkipPage() {
  const { members, addMember, changeRole, removeMember, assignProject, unassignProject } = useTeamStore();
  const { projects } = useProjectStore();
  const currentUser = useAuthStore((s) => s.user);
  const canManage = usePermission("team.manage");
  const [tab, setTab] = useState<"members" | "matrix">("members");
  const [showAdd, setShowAdd] = useState(false);
  const [showInvite, setShowInvite] = useState(false);
  const [roleFilter, setRoleFilter] = useState<UserRole | "all">("all");

  const filtered = members.filter((m) => roleFilter === "all" || m.role === roleFilter);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Ekip Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-1">{members.length} üye · {projects.length} proje</p>
        </div>
        {canManage && (
          <div className="flex gap-2">
            <button
              onClick={() => setShowInvite(true)}
              className="flex items-center gap-2 px-4 py-2 border border-indigo-300 text-indigo-700 bg-indigo-50 rounded-xl text-sm font-semibold hover:bg-indigo-100 transition-colors"
            >
              <Send className="w-4 h-4" /> Davet Gönder
            </button>
            <button
              onClick={() => setShowAdd(true)}
              className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors"
            >
              <UserPlus className="w-4 h-4" /> Üye Ekle
            </button>
          </div>
        )}
      </div>

      {/* Kendi rolün banner */}
      {currentUser && (
        <div className={`flex items-center gap-3 p-4 rounded-xl border-2 border-current/10 ${ROLE_META[currentUser.role].bg}`}>
          <Shield className={`w-5 h-5 flex-shrink-0 ${ROLE_META[currentUser.role].color}`} />
          <span className={`text-sm font-semibold ${ROLE_META[currentUser.role].color}`}>
            Rolünüz: {ROLE_META[currentUser.role].label}
          </span>
          <span className="text-sm text-gray-600">— {ROLE_META[currentUser.role].description}</span>
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 bg-gray-100 p-1 rounded-xl w-fit">
        <button
          onClick={() => setTab("members")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "members" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
        >
          <Users className="w-4 h-4" /> Üyeler
          <span className="bg-gray-200 text-gray-600 text-xs px-1.5 py-0.5 rounded-full">{members.length}</span>
        </button>
        <button
          onClick={() => setTab("matrix")}
          className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${tab === "matrix" ? "bg-white shadow-sm text-indigo-700" : "text-gray-600 hover:text-gray-900"}`}
        >
          <Shield className="w-4 h-4" /> Rol Yetkileri
        </button>
      </div>

      {/* Üyeler tab */}
      {tab === "members" && (
        <>
          {/* Rol filtresi */}
          <div className="flex flex-wrap gap-2">
            <button
              onClick={() => setRoleFilter("all")}
              className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${roleFilter === "all" ? "bg-gray-900 text-white border-gray-900" : "border-gray-300 text-gray-600 hover:bg-gray-50"}`}
            >
              Tümü ({members.length})
            </button>
            {(Object.keys(ROLE_META) as UserRole[]).map((r) => {
              const m = ROLE_META[r];
              const count = members.filter((mb) => mb.role === r).length;
              return (
                <button
                  key={r}
                  onClick={() => setRoleFilter(r)}
                  className={`px-3 py-1.5 text-xs font-medium rounded-full border transition-colors ${
                    roleFilter === r ? `${m.bg} ${m.color} border-current/20` : "border-gray-300 text-gray-600 hover:bg-gray-50"
                  }`}
                >
                  {m.label} ({count})
                </button>
              );
            })}
          </div>

          {filtered.length === 0 ? (
            <div className="text-center py-16 text-gray-400">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-30" />
              <p className="text-sm">{members.length === 0 ? "Henüz ekip üyesi eklenmemiş." : "Bu filtreyle eşleşen üye yok."}</p>
              {canManage && members.length === 0 && (
                <button onClick={() => setShowAdd(true)} className="mt-3 text-sm text-indigo-600 hover:underline">İlk üyeyi ekle →</button>
              )}
            </div>
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4">
              {filtered.map((m) => (
                <MemberCard
                  key={m.id}
                  member={m}
                  canManage={canManage}
                  projects={projects}
                  onChangeRole={changeRole}
                  onRemove={removeMember}
                  onToggleProject={(memberId, projectId, assigned) =>
                    assigned ? unassignProject(memberId, projectId) : assignProject(memberId, projectId)
                  }
                />
              ))}
            </div>
          )}
        </>
      )}

      {tab === "matrix" && <PermissionMatrix />}

      {showAdd && (
        <AddMemberModal
          onClose={() => setShowAdd(false)}
          onAdd={(m) => addMember(m)}
          existingEmails={members.map((m) => m.email)}
        />
      )}

      {showInvite && currentUser && (
        <InviteModal
          onClose={() => setShowInvite(false)}
          orgId={currentUser.orgId}
          orgName={currentUser.company ?? "Organizasyon"}
          invitedBy={currentUser.id}
        />
      )}
    </div>
  );
}
