"use client";

import { useState, useEffect, useCallback } from "react";
import {
  Building2, Plus, Search, Globe, Check, X,
  Users, AlertCircle, Pencil, Save, Crown, ArrowLeftRight,
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { dbLoadAllOrgs, dbUpsertOrg, dbAssignUserToOrg, dbUpdateUserOrgInTables, dbLoadProfiles } from "@/lib/db";
import { ROLE_META } from "@/lib/permissions";
import type { Organization, User, UserRole } from "@/types";
import { useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";

// ─── Meta ──────────────────────────────────────────────────────────────────────

const PLAN_META: Record<Organization["plan"], { label: string; color: string; bg: string }> = {
  free:       { label: "Free",       color: "text-gray-600",    bg: "bg-gray-100"    },
  starter:    { label: "Starter",    color: "text-blue-700",    bg: "bg-blue-100"    },
  pro:        { label: "Pro",        color: "text-indigo-700",  bg: "bg-indigo-100"  },
  enterprise: { label: "Enterprise", color: "text-violet-700",  bg: "bg-violet-100"  },
};

const STATUS_META: Record<Organization["status"], { label: string; color: string; dot: string }> = {
  active:    { label: "Aktif",         color: "text-emerald-700", dot: "bg-emerald-500" },
  trial:     { label: "Deneme",        color: "text-amber-700",   dot: "bg-amber-400"   },
  suspended: { label: "Askıya Alındı", color: "text-red-700",     dot: "bg-red-500"     },
};

const INDUSTRIES = [
  "Teknoloji", "Finans", "Sağlık", "Eğitim", "İnşaat",
  "Üretim", "Perakende", "Enerji", "Lojistik", "Medya",
  "Danışmanlık", "Diğer",
];

const SIZES: Organization["size"][] = ["1-10", "11-50", "51-200", "201-500", "500+"];

// ─── Org form modal ────────────────────────────────────────────────────────────

function OrgFormModal({
  initial,
  onClose,
  onSave,
}: {
  initial?: Organization;
  onClose: () => void;
  onSave: (org: Organization) => void;
}) {
  const [form, setForm] = useState({
    name:     initial?.name     ?? "",
    industry: initial?.industry ?? "",
    size:     initial?.size     ?? "" as Organization["size"] | "",
    plan:     initial?.plan     ?? "free" as Organization["plan"],
    status:   initial?.status   ?? "active" as Organization["status"],
    website:  initial?.website  ?? "",
    address:  initial?.address  ?? "",
  });
  const [error, setError] = useState("");

  const set = <K extends keyof typeof form>(k: K, v: typeof form[K]) =>
    setForm((s) => ({ ...s, [k]: v }));

  const handleSave = () => {
    if (!form.name.trim()) { setError("Organizasyon adı gereklidir."); return; }
    const now = new Date().toISOString();
    onSave({
      id: initial?.id ?? crypto.randomUUID(),
      createdAt: initial?.createdAt ?? now,
      name: form.name.trim(),
      industry: form.industry || undefined,
      size: (form.size || undefined) as Organization["size"] | undefined,
      plan: form.plan,
      status: form.status,
      website: form.website || undefined,
      address: form.address || undefined,
    });
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-gray-900">
            {initial ? "Organizasyonu Düzenle" : "Yeni Organizasyon"}
          </h2>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
            <X className="w-4 h-4 text-gray-500" />
          </button>
        </div>

        <div className="space-y-4">
          {error && (
            <div className="flex items-center gap-2 p-3 bg-red-50 border border-red-200 rounded-lg text-sm text-red-700">
              <AlertCircle className="w-4 h-4 shrink-0" />{error}
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Organizasyon Adı *</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.name} onChange={(e) => set("name", e.target.value)} placeholder="Şirket Adı A.Ş." />
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Sektör</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.industry} onChange={(e) => set("industry", e.target.value)}>
                <option value="">Seçin</option>
                {INDUSTRIES.map((i) => <option key={i} value={i}>{i}</option>)}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Büyüklük</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.size} onChange={(e) => set("size", e.target.value as Organization["size"] | "")}>
                <option value="">Seçin</option>
                {SIZES.map((s) => <option key={s} value={s}>{s}</option>)}
              </select>
            </div>
          </div>
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Plan</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.plan} onChange={(e) => set("plan", e.target.value as Organization["plan"])}>
                {(["free","starter","pro","enterprise"] as Organization["plan"][]).map((p) => (
                  <option key={p} value={p}>{PLAN_META[p].label}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
              <select className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                value={form.status} onChange={(e) => set("status", e.target.value as Organization["status"])}>
                {(["active","trial","suspended"] as Organization["status"][]).map((s) => (
                  <option key={s} value={s}>{STATUS_META[s].label}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Web Sitesi</label>
            <input className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={form.website} onChange={(e) => set("website", e.target.value)} placeholder="https://sirket.com" />
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Adres</label>
            <textarea rows={2} className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
              value={form.address} onChange={(e) => set("address", e.target.value)} placeholder="Şirket adresi..." />
          </div>
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">İptal</button>
          <button onClick={handleSave} className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors flex items-center justify-center gap-2">
            <Save className="w-4 h-4" />{initial ? "Güncelle" : "Oluştur"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Assign user modal ─────────────────────────────────────────────────────────

function AssignUserModal({
  org,
  onClose,
  onSuccess,
}: {
  org: Organization;
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [email, setEmail] = useState("");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const handleAssign = async () => {
    if (!email.trim()) return;
    setLoading(true);
    setResult(null);
    const res = await dbAssignUserToOrg(email.trim(), org.id);
    setResult(res.ok
      ? { ok: true, msg: `Kullanıcı "${org.name}" organizasyonuna atandı.` }
      : { ok: false, msg: res.error ?? "Atama başarısız." }
    );
    if (res.ok) onSuccess();
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Kullanıcı Ata</h2>
            <p className="text-xs text-gray-500 mt-0.5">{org.name}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>
        <div className="space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">E-posta</label>
            <input type="email" className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={email} onChange={(e) => setEmail(e.target.value)} placeholder="kullanici@sirket.com" />
          </div>
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {result.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {result.msg}
            </div>
          )}
        </div>
        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">Kapat</button>
          <button onClick={handleAssign} disabled={loading || !email.trim()}
            className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <Users className="w-4 h-4" />{loading ? "Atanıyor..." : "Ata"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Change org modal ──────────────────────────────────────────────────────────

function ChangeOrgModal({
  user: targetUser,
  orgs,
  onClose,
  onSuccess,
}: {
  user: User;
  orgs: Organization[];
  onClose: () => void;
  onSuccess: () => void;
}) {
  const [selectedOrgId, setSelectedOrgId] = useState(targetUser.orgId ?? "");
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ ok: boolean; msg: string } | null>(null);

  const currentOrg = orgs.find((o) => o.id === targetUser.orgId);

  const handleSave = async () => {
    if (!selectedOrgId || selectedOrgId === targetUser.orgId) return;
    setLoading(true);
    setResult(null);
    const res = await dbAssignUserToOrg(targetUser.email, selectedOrgId);
    if (res.ok) {
      // auth_profiles güncellendi — diğer tablolardaki org_id'yi de güncelle
      await dbUpdateUserOrgInTables(targetUser.id, selectedOrgId);
      onSuccess();
    }
    const newOrg = orgs.find((o) => o.id === selectedOrgId);
    setResult(res.ok
      ? { ok: true, msg: `Kullanıcı "${newOrg?.name ?? selectedOrgId}" organizasyonuna taşındı.` }
      : { ok: false, msg: res.error ?? "İşlem başarısız." }
    );
    setLoading(false);
  };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 p-4" onClick={onClose}>
      <div className="bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between mb-5">
          <div>
            <h2 className="text-base font-bold text-gray-900">Organizasyon Değiştir</h2>
            <p className="text-xs text-gray-500 mt-0.5">{targetUser.name} — {targetUser.email}</p>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100"><X className="w-4 h-4 text-gray-500" /></button>
        </div>

        <div className="space-y-4">
          {currentOrg && (
            <div className="flex items-center gap-2 p-3 bg-gray-50 rounded-lg text-sm text-gray-600">
              <Building2 className="w-4 h-4 text-gray-400 shrink-0" />
              Mevcut org: <span className="font-medium text-gray-800">{currentOrg.name}</span>
            </div>
          )}
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Yeni Organizasyon</label>
            <select
              className="w-full px-3 py-2 border border-gray-300 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
              value={selectedOrgId}
              onChange={(e) => setSelectedOrgId(e.target.value)}
            >
              <option value="">Seçin</option>
              {orgs.map((o) => (
                <option key={o.id} value={o.id}>{o.name}</option>
              ))}
            </select>
          </div>
          {result && (
            <div className={`flex items-center gap-2 p-3 rounded-lg text-sm ${result.ok ? "bg-emerald-50 border border-emerald-200 text-emerald-700" : "bg-red-50 border border-red-200 text-red-700"}`}>
              {result.ok ? <Check className="w-4 h-4 shrink-0" /> : <AlertCircle className="w-4 h-4 shrink-0" />}
              {result.msg}
            </div>
          )}
        </div>

        <div className="flex gap-3 mt-6">
          <button onClick={onClose} className="flex-1 py-2.5 text-sm border border-gray-200 rounded-xl text-gray-700 hover:bg-gray-50 font-medium">İptal</button>
          <button onClick={handleSave} disabled={loading || !selectedOrgId || selectedOrgId === targetUser.orgId}
            className="flex-1 py-2.5 text-sm bg-indigo-600 text-white rounded-xl font-semibold hover:bg-indigo-700 transition-colors disabled:opacity-50 flex items-center justify-center gap-2">
            <ArrowLeftRight className="w-4 h-4" />{loading ? "Taşınıyor..." : "Taşı"}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Page ──────────────────────────────────────────────────────────────────────

type Tab = "orgs" | "users";

export default function PlatformPage() {
  const currentUser = useAuthStore((s) => s.user);
  const router = useRouter();

  const [tab, setTab] = useState<Tab>("orgs");
  const [orgs, setOrgs] = useState<Organization[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [showOrgForm, setShowOrgForm] = useState(false);
  const [editOrg, setEditOrg] = useState<Organization | null>(null);
  const [assignOrg, setAssignOrg] = useState<Organization | null>(null);
  const [changeOrgUser, setChangeOrgUser] = useState<User | null>(null);

  useEffect(() => {
    if (currentUser && currentUser.role !== "system_admin") {
      router.replace("/dashboard");
    }
  }, [currentUser, router]);

  const loadData = useCallback(async () => {
    setLoading(true);
    const [orgData, profileMap] = await Promise.all([
      dbLoadAllOrgs(),
      dbLoadProfiles(),
    ]);
    setOrgs(orgData);
    setUsers(Object.values(profileMap));
    setLoading(false);
  }, []);

  useEffect(() => { loadData(); }, [loadData]);

  const handleSaveOrg = async (org: Organization) => {
    await dbUpsertOrg(org.id, org);
    setShowOrgForm(false);
    setEditOrg(null);
    await loadData();
  };

  const filteredOrgs = orgs.filter((o) =>
    o.name.toLowerCase().includes(search.toLowerCase())
  );

  const filteredUsers = users.filter((u) =>
    u.name.toLowerCase().includes(search.toLowerCase()) ||
    u.email.toLowerCase().includes(search.toLowerCase())
  );

  if (currentUser?.role !== "system_admin") return null;

  return (
    <div className="p-6 max-w-6xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="w-10 h-10 rounded-xl bg-rose-100 flex items-center justify-center">
            <Globe className="w-5 h-5 text-rose-600" />
          </div>
          <div>
            <h1 className="text-xl font-bold text-gray-900">Platform Yönetimi</h1>
            <p className="text-sm text-gray-500">Tüm organizasyonları ve kullanıcıları yönetin</p>
          </div>
        </div>
        {tab === "orgs" && (
          <button onClick={() => setShowOrgForm(true)}
            className="flex items-center gap-2 px-4 py-2 bg-indigo-600 text-white rounded-xl text-sm font-semibold hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />Yeni Organizasyon
          </button>
        )}
      </div>

      {/* Stats */}
      <div className="grid grid-cols-4 gap-4">
        {[
          { label: "Toplam Org",       value: orgs.length,                                    color: "text-indigo-600", bg: "bg-indigo-50"  },
          { label: "Aktif",            value: orgs.filter((o) => o.status === "active").length, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Deneme",           value: orgs.filter((o) => o.status === "trial").length,  color: "text-amber-600",   bg: "bg-amber-50"   },
          { label: "Toplam Kullanıcı", value: users.length,                                    color: "text-violet-600",  bg: "bg-violet-50"  },
        ].map((s) => (
          <div key={s.label} className={`rounded-xl p-4 ${s.bg}`}>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
            <div className="text-sm text-gray-600 mt-0.5">{s.label}</div>
          </div>
        ))}
      </div>

      {/* Tabs + Search */}
      <div className="flex items-center gap-4">
        <div className="flex gap-1 p-1 bg-gray-100 rounded-xl">
          {([["orgs", "Organizasyonlar"], ["users", "Kullanıcılar"]] as [Tab, string][]).map(([t, label]) => (
            <button key={t} onClick={() => { setTab(t); setSearch(""); }}
              className={`px-4 py-1.5 text-sm font-medium rounded-lg transition-colors ${tab === t ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}>
              {label}
            </button>
          ))}
        </div>
        <div className="relative flex-1">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input className="w-full pl-9 pr-4 py-2.5 border border-gray-200 rounded-xl text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
            placeholder={tab === "orgs" ? "Organizasyon ara..." : "Kullanıcı ara..."}
            value={search} onChange={(e) => setSearch(e.target.value)} />
        </div>
      </div>

      {/* Org Table */}
      {tab === "orgs" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
          ) : filteredOrgs.length === 0 ? (
            <div className="p-12 text-center">
              <Building2 className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{search ? "Sonuç bulunamadı." : "Henüz organizasyon yok."}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizasyon</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Sektör / Büyüklük</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Plan</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanıcı</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredOrgs.map((org) => {
                  const plan = PLAN_META[org.plan];
                  const status = STATUS_META[org.status];
                  const memberCount = users.filter((u) => u.orgId === org.id).length;
                  return (
                    <tr key={org.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <div className="w-9 h-9 rounded-lg bg-indigo-100 flex items-center justify-center flex-shrink-0">
                            <Building2 className="w-4 h-4 text-indigo-600" />
                          </div>
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{org.name}</div>
                            {org.website && <div className="text-xs text-gray-400 truncate max-w-[180px]">{org.website}</div>}
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        <div>{org.industry ?? "—"}</div>
                        {org.size && <div className="text-xs text-gray-400">{org.size} kişi</div>}
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${plan.bg} ${plan.color}`}>{plan.label}</span>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center gap-1.5 text-xs font-medium ${status.color}`}>
                          <span className={`w-1.5 h-1.5 rounded-full ${status.dot}`} />{status.label}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {memberCount} kullanıcı
                      </td>
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-2 justify-end">
                          <button onClick={() => setAssignOrg(org)}
                            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                            <Crown className="w-3.5 h-3.5" />Kullanıcı Ata
                          </button>
                          <button onClick={() => setEditOrg(org)}
                            className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                            <Pencil className="w-3.5 h-3.5" />
                          </button>
                        </div>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Users Table */}
      {tab === "users" && (
        <div className="bg-white rounded-2xl border border-gray-200 overflow-hidden">
          {loading ? (
            <div className="p-12 text-center text-gray-400 text-sm">Yükleniyor...</div>
          ) : filteredUsers.length === 0 ? (
            <div className="p-12 text-center">
              <Users className="w-10 h-10 text-gray-300 mx-auto mb-3" />
              <p className="text-gray-500 text-sm">{search ? "Sonuç bulunamadı." : "Henüz kullanıcı yok."}</p>
            </div>
          ) : (
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-100 bg-gray-50">
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Kullanıcı</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Organizasyon</th>
                  <th className="text-left px-5 py-3 text-xs font-semibold text-gray-500 uppercase tracking-wider">Departman</th>
                  <th className="px-5 py-3" />
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {filteredUsers.map((u) => {
                  const roleMeta = ROLE_META[u.role];
                  const org = orgs.find((o) => o.id === u.orgId);
                  return (
                    <tr key={u.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-5 py-4">
                        <div className="flex items-center gap-3">
                          <Avatar name={u.name} size="sm" />
                          <div>
                            <div className="text-sm font-semibold text-gray-900">{u.name}</div>
                            <div className="text-xs text-gray-400">{u.email}</div>
                          </div>
                        </div>
                      </td>
                      <td className="px-5 py-4">
                        <span className={`inline-flex items-center px-2.5 py-1 rounded-lg text-xs font-semibold ${roleMeta?.bg ?? "bg-gray-100"} ${roleMeta?.color ?? "text-gray-600"}`}>
                          {roleMeta?.label ?? u.role}
                        </span>
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-600">
                        {org ? (
                          <span className="flex items-center gap-1.5">
                            <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 shrink-0" />
                            {org.name}
                          </span>
                        ) : (
                          <span className="text-gray-400 text-xs">Atanmamış</span>
                        )}
                      </td>
                      <td className="px-5 py-4 text-sm text-gray-500">{u.department ?? "—"}</td>
                      <td className="px-5 py-4">
                        <button onClick={() => setChangeOrgUser(u)}
                          className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium text-indigo-700 bg-indigo-50 rounded-lg hover:bg-indigo-100 transition-colors">
                          <ArrowLeftRight className="w-3.5 h-3.5" />Org Değiştir
                        </button>
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          )}
        </div>
      )}

      {/* Modals */}
      {(showOrgForm || editOrg) && (
        <OrgFormModal
          initial={editOrg ?? undefined}
          onClose={() => { setShowOrgForm(false); setEditOrg(null); }}
          onSave={handleSaveOrg}
        />
      )}
      {assignOrg && (
        <AssignUserModal org={assignOrg} onClose={() => setAssignOrg(null)} onSuccess={loadData} />
      )}
      {changeOrgUser && (
        <ChangeOrgModal user={changeOrgUser} orgs={orgs} onClose={() => setChangeOrgUser(null)} onSuccess={loadData} />
      )}
    </div>
  );
}
