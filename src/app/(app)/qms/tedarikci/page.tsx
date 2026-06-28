"use client";

import { useEffect, useState, useCallback } from "react";
import {
  Loader2, Plus, Search, Building2, X,
  MapPin, FileText, ChevronRight, Users, Copy, Check,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  Supplier, SupplierSite, ComplianceDocument,
  CreateSupplierDto, UpdateSupplierDto, SupplierStatus, RiskTier,
  SupplierUser, SupplierInvite, SupplierPortalRole, CreateInviteDto,
} from "@/lib/qms/types";

// ─── Label maps ───────────────────────────────────────────────────────────────

const STATUS_LABEL: Record<SupplierStatus, string> = {
  prospect: "Aday",
  pending: "Beklemede",
  approved: "Onaylı",
  conditional: "Koşullu",
  suspended: "Askıya Alındı",
  inactive: "Pasif",
};

const STATUS_BADGE: Record<SupplierStatus, string> = {
  prospect: "bg-blue-100 text-blue-700",
  pending: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  conditional: "bg-purple-100 text-purple-700",
  suspended: "bg-red-100 text-red-700",
  inactive: "bg-gray-100 text-gray-500",
};

const RISK_LABEL: Record<RiskTier, string> = {
  low: "Düşük",
  medium: "Orta",
  high: "Yüksek",
};

const RISK_DOT: Record<RiskTier, string> = {
  low: "bg-green-500",
  medium: "bg-amber-500",
  high: "bg-red-500",
};

const DOC_STATUS_BADGE: Record<string, string> = {
  requested: "bg-gray-100 text-gray-600",
  uploaded: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expiring: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
};

const DOC_STATUS_LABEL: Record<string, string> = {
  requested: "Talep Edildi",
  uploaded: "Yüklendi",
  in_review: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  expiring: "Süresi Dolmak Üzere",
  expired: "Süresi Doldu",
};

const DOC_TYPE_LABEL: Record<string, string> = {
  gfsi_certificate: "GFSI Sertifikası",
  haccp_plan: "HACCP Planı",
  allergen_statement: "Alerjen Beyanı",
  kosher_cert: "Koşer",
  halal_cert: "Helal",
  organic_cert: "Organik",
  non_gmo: "GDO'suz",
  letter_of_guarantee: "Garanti Mektubu",
  coi: "COI",
  business_license: "İşletme Lisansı",
  food_safety_plan: "Gıda Güvenliği",
  third_party_audit: "3. Taraf Denetimi",
  other: "Diğer",
};

// ─── Slide-over form ──────────────────────────────────────────────────────────

interface SlideOverProps {
  open: boolean;
  onClose: () => void;
  initial?: Supplier | null;
  onSave: (dto: CreateSupplierDto | UpdateSupplierDto) => Promise<void>;
  saving: boolean;
}

function SupplierSlideOver({ open, onClose, initial, onSave, saving }: SlideOverProps) {
  const [form, setForm] = useState({
    display_name: "",
    legal_name: "",
    status: "prospect" as SupplierStatus,
    risk_tier: "medium" as RiskTier,
    categories: "",
    notes: "",
    contact_name: "",
    contact_email: "",
    contact_phone: "",
  });

  useEffect(() => {
    if (initial) {
      setForm({
        display_name: initial.display_name,
        legal_name: initial.legal_name,
        status: initial.status,
        risk_tier: initial.risk_tier,
        categories: initial.categories.join(", "),
        notes: initial.notes,
        contact_name: initial.primary_contact?.name ?? "",
        contact_email: initial.primary_contact?.email ?? "",
        contact_phone: initial.primary_contact?.phone ?? "",
      });
    } else {
      setForm({
        display_name: "",
        legal_name: "",
        status: "prospect",
        risk_tier: "medium",
        categories: "",
        notes: "",
        contact_name: "",
        contact_email: "",
        contact_phone: "",
      });
    }
  }, [initial, open]);

  const handleSave = () => {
    const dto: CreateSupplierDto = {
      display_name: form.display_name,
      legal_name: form.legal_name,
      status: form.status,
      risk_tier: form.risk_tier,
      categories: form.categories.split(",").map(c => c.trim()).filter(Boolean),
      notes: form.notes,
      primary_contact: {
        name: form.contact_name,
        email: form.contact_email,
        phone: form.contact_phone,
      },
    };
    onSave(dto);
  };

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 bg-black/30 z-40"
        onClick={onClose}
      />
      <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">
            {initial ? "Tedarikçi Düzenle" : "Yeni Tedarikçi"}
          </h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Görünen Ad *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={form.display_name}
              onChange={e => setForm(f => ({ ...f, display_name: e.target.value }))}
              placeholder="Tedarikçi adı"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Yasal Unvan *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={form.legal_name}
              onChange={e => setForm(f => ({ ...f, legal_name: e.target.value }))}
              placeholder="Yasal unvan"
            />
          </div>

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Durum
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                value={form.status}
                onChange={e => setForm(f => ({ ...f, status: e.target.value as SupplierStatus }))}
              >
                {Object.entries(STATUS_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
                Risk Seviyesi
              </label>
              <select
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
                value={form.risk_tier}
                onChange={e => setForm(f => ({ ...f, risk_tier: e.target.value as RiskTier }))}
              >
                {Object.entries(RISK_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Kategoriler (virgülle ayırın)
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={form.categories}
              onChange={e => setForm(f => ({ ...f, categories: e.target.value }))}
              placeholder="Gıda, Ambalaj, Kimyasal..."
            />
          </div>

          <div className="border-t border-gray-100 pt-4">
            <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-3">
              Birincil İletişim
            </p>
            <div className="space-y-3">
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                value={form.contact_name}
                onChange={e => setForm(f => ({ ...f, contact_name: e.target.value }))}
                placeholder="Ad Soyad"
              />
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                value={form.contact_email}
                onChange={e => setForm(f => ({ ...f, contact_email: e.target.value }))}
                placeholder="E-posta"
                type="email"
              />
              <input
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
                value={form.contact_phone}
                onChange={e => setForm(f => ({ ...f, contact_phone: e.target.value }))}
                placeholder="Telefon"
              />
            </div>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Notlar
            </label>
            <textarea
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100 resize-none"
              rows={3}
              value={form.notes}
              onChange={e => setForm(f => ({ ...f, notes: e.target.value }))}
              placeholder="Ek bilgiler..."
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={handleSave}
            disabled={saving || !form.display_name.trim() || !form.legal_name.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Kaydet"}
          </button>
          <button
            onClick={onClose}
            className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-sm font-semibold hover:bg-gray-50 transition-colors"
          >
            İptal
          </button>
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

type StatusFilter = "all" | SupplierStatus;
type ActiveTab = "info" | "sites" | "docs" | "access";

// ─── Role labels ──────────────────────────────────────────────────────────────

const PORTAL_ROLE_LABEL: Record<SupplierPortalRole, string> = {
  viewer: "Görüntüleyici",
  uploader: "Yükleyici",
  responder: "Yanıtlayıcı",
};

// ─── Portal Access Tab ────────────────────────────────────────────────────────

interface PortalAccessTabProps {
  supplierId: string;
  token: string;
}

function PortalAccessTab({ supplierId, token }: PortalAccessTabProps) {
  const [users, setUsers] = useState<SupplierUser[]>([]);
  const [invites, setInvites] = useState<SupplierInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [showInviteForm, setShowInviteForm] = useState(false);
  const [inviteForm, setInviteForm] = useState({ email: "", name: "", role: "uploader" as SupplierPortalRole });
  const [saving, setSaving] = useState(false);
  const [createdToken, setCreatedToken] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    const [usersRes, invitesRes] = await Promise.all([
      fetch(`/api/qms/portal/users?supplierId=${supplierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/qms/portal/invites?supplierId=${supplierId}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (invitesRes.ok) setInvites(await invitesRes.json());
    setLoading(false);
  }, [supplierId, token]);

  useEffect(() => {
    if (supplierId && token) load();
  }, [supplierId, token, load]);

  const handleDeactivate = async (id: string) => {
    const res = await fetch("/api/qms/portal/users", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: false }),
    });
    if (res.ok) load();
  };

  const handleSendInvite = async () => {
    if (!inviteForm.email.trim() || !inviteForm.name.trim()) return;
    setSaving(true);
    const dto: CreateInviteDto = {
      supplier_id: supplierId,
      email: inviteForm.email,
      name: inviteForm.name,
      role: inviteForm.role,
    };
    const res = await fetch("/api/qms/portal/invites", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      const invite = await res.json() as SupplierInvite;
      setCreatedToken(invite.token);
      setInviteForm({ email: "", name: "", role: "uploader" });
      setShowInviteForm(false);
      load();
    }
    setSaving(false);
  };

  const handleCopy = (text: string) => {
    navigator.clipboard.writeText(text);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center h-20">
        <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
      </div>
    );
  }

  const inviteLink = (t: string) => `${window.location.origin}/portal/davet/${t}`;

  return (
    <div className="max-w-3xl space-y-6">
      {/* Created token banner */}
      {createdToken && (
        <div className="bg-green-50 border border-green-200 rounded-lg p-4">
          <p className="text-xs font-semibold text-green-700 mb-2">Davet oluşturuldu! Aşağıdaki bağlantıyı tedarikçiyle paylaşın:</p>
          <div className="flex items-center gap-2">
            <code className="flex-1 text-xs bg-green-100 px-3 py-2 rounded text-green-800 truncate">
              {inviteLink(createdToken)}
            </code>
            <button
              onClick={() => handleCopy(inviteLink(createdToken))}
              className="flex items-center gap-1 px-3 py-2 bg-green-600 text-white rounded text-xs font-semibold hover:bg-green-700 transition-colors"
            >
              {copied ? <Check className="w-3 h-3" /> : <Copy className="w-3 h-3" />}
              {copied ? "Kopyalandı" : "Kopyala"}
            </button>
            <button
              onClick={() => setCreatedToken(null)}
              className="text-green-500 hover:text-green-700"
            >
              <X className="w-4 h-4" />
            </button>
          </div>
        </div>
      )}

      {/* Active Users */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <p className="text-sm font-semibold text-gray-700">Portal Kullanıcıları</p>
          <button
            onClick={() => setShowInviteForm(!showInviteForm)}
            className="flex items-center gap-1 px-3 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Davet Gönder
          </button>
        </div>

        {/* Invite Form */}
        {showInviteForm && (
          <div className="bg-gray-50 border border-gray-200 rounded-lg p-4 mb-4 space-y-3">
            <p className="text-xs font-semibold text-gray-600">Yeni Davet</p>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">E-posta *</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  value={inviteForm.email}
                  onChange={e => setInviteForm(f => ({ ...f, email: e.target.value }))}
                  placeholder="ornek@tedarikci.com"
                  type="email"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Ad Soyad *</label>
                <input
                  className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
                  value={inviteForm.name}
                  onChange={e => setInviteForm(f => ({ ...f, name: e.target.value }))}
                  placeholder="Ad Soyad"
                />
              </div>
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">Rol</label>
              <select
                className="px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white"
                value={inviteForm.role}
                onChange={e => setInviteForm(f => ({ ...f, role: e.target.value as SupplierPortalRole }))}
              >
                {Object.entries(PORTAL_ROLE_LABEL).map(([v, l]) => (
                  <option key={v} value={v}>{l}</option>
                ))}
              </select>
            </div>
            <div className="flex gap-2">
              <button
                onClick={handleSendInvite}
                disabled={saving || !inviteForm.email.trim() || !inviteForm.name.trim()}
                className="px-4 py-2 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
              >
                {saving ? <Loader2 className="w-3.5 h-3.5 animate-spin" /> : "Davet Gönder"}
              </button>
              <button
                onClick={() => setShowInviteForm(false)}
                className="px-4 py-2 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                İptal
              </button>
            </div>
          </div>
        )}

        {users.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
            Aktif portal kullanıcısı yok
          </div>
        ) : (
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-xs">
            <thead className="bg-gray-50">
              <tr>
                {["Ad", "E-posta", "Rol", "Durum", "İşlem"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {users.map(u => (
                <tr key={u.id} className="border-t border-gray-100">
                  <td className="px-3 py-2 font-medium text-gray-900">{u.name}</td>
                  <td className="px-3 py-2 text-gray-500">{u.email}</td>
                  <td className="px-3 py-2">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                      {PORTAL_ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${u.is_active ? "bg-green-100 text-green-700" : "bg-gray-100 text-gray-500"}`}>
                      {u.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-3 py-2">
                    {u.is_active && (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="px-2 py-1 border border-red-200 text-red-600 rounded text-[10px] font-semibold hover:bg-red-50 transition-colors"
                      >
                        Devre Dışı
                      </button>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {/* Invites */}
      <div>
        <p className="text-sm font-semibold text-gray-700 mb-3">Davetler</p>
        {invites.length === 0 ? (
          <div className="text-center py-6 text-xs text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
            Gönderilmiş davet yok
          </div>
        ) : (
          <table className="w-full border border-gray-200 rounded-lg overflow-hidden text-xs">
            <thead className="bg-gray-50">
              <tr>
                {["E-posta", "Ad", "Rol", "Son Tarih", "Durum"].map(h => (
                  <th key={h} className="px-3 py-2 text-left text-[10px] font-semibold text-gray-500 uppercase tracking-wider">
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {invites.map(inv => {
                const isExpired = new Date(inv.expires_at) < new Date();
                const isAccepted = !!inv.accepted_at;
                const statusLabel = isAccepted ? "Kabul Edildi" : isExpired ? "Süresi Doldu" : "Bekleniyor";
                const statusClass = isAccepted
                  ? "bg-green-100 text-green-700"
                  : isExpired
                  ? "bg-red-100 text-red-700"
                  : "bg-amber-100 text-amber-700";
                return (
                  <tr key={inv.id} className="border-t border-gray-100">
                    <td className="px-3 py-2 text-gray-700">{inv.email}</td>
                    <td className="px-3 py-2 text-gray-500">{inv.name}</td>
                    <td className="px-3 py-2">
                      <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                        {PORTAL_ROLE_LABEL[inv.role]}
                      </span>
                    </td>
                    <td className="px-3 py-2 text-gray-500">
                      {new Date(inv.expires_at).toLocaleDateString("tr-TR")}
                    </td>
                    <td className="px-3 py-2">
                      <span className={`px-2 py-0.5 rounded text-[10px] font-semibold ${statusClass}`}>
                        {statusLabel}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        )}
      </div>
    </div>
  );
}

export default function TedarikciPage() {
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [search, setSearch] = useState("");
  const [statusFilter, setStatusFilter] = useState<StatusFilter>("all");
  const [selected, setSelected] = useState<Supplier | null>(null);
  const [sites, setSites] = useState<SupplierSite[]>([]);
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [activeTab, setActiveTab] = useState<ActiveTab>("info");
  const [slideOpen, setSlideOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<Supplier | null>(null);
  const [saving, setSaving] = useState(false);
  const [token, setToken] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const loadSuppliers = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const res = await fetch("/api/qms/suppliers", {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.ok) setSuppliers(await res.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) loadSuppliers();
  }, [token, loadSuppliers]);

  const loadSupplierDetail = useCallback(async (supplier: Supplier) => {
    if (!token) return;
    const [sitesRes, docsRes] = await Promise.all([
      fetch(`/api/qms/suppliers/${supplier.id}/sites`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch(`/api/qms/compliance/documents?supplierId=${supplier.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (sitesRes.ok) setSites(await sitesRes.json());
    if (docsRes.ok) setDocs(await docsRes.json());
  }, [token]);

  const handleSelect = (s: Supplier) => {
    setSelected(s);
    setActiveTab("info");
    loadSupplierDetail(s);
  };

  const handleSave = async (dto: CreateSupplierDto | UpdateSupplierDto) => {
    setSaving(true);
    const url = editTarget
      ? `/api/qms/suppliers/${editTarget.id}`
      : "/api/qms/suppliers";
    const method = editTarget ? "PATCH" : "POST";
    const res = await fetch(url, {
      method,
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      await loadSuppliers();
      setSlideOpen(false);
      setEditTarget(null);
    }
    setSaving(false);
  };

  const filteredSuppliers = suppliers.filter(s => {
    const matchStatus = statusFilter === "all" || s.status === statusFilter;
    const matchSearch =
      !search ||
      s.display_name.toLowerCase().includes(search.toLowerCase()) ||
      s.legal_name.toLowerCase().includes(search.toLowerCase());
    return matchStatus && matchSearch;
  });

  const tabs: { key: StatusFilter; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "approved", label: "Onaylı" },
    { key: "pending", label: "Beklemede" },
    { key: "suspended", label: "Askıya Alındı" },
  ];

  return (
    <div className="flex h-full overflow-hidden -m-6">
      {/* Left panel */}
      <div className="w-72 flex-shrink-0 border-r border-gray-200 bg-white flex flex-col">
        {/* Header */}
        <div className="px-4 py-4 border-b border-gray-100 flex items-center justify-between">
          <h2 className="font-semibold text-gray-900 text-sm">Tedarikçiler</h2>
          <button
            onClick={() => { setEditTarget(null); setSlideOpen(true); }}
            className="flex items-center gap-1 px-2.5 py-1.5 bg-blue-600 text-white rounded-lg text-xs font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-3.5 h-3.5" />
            Yeni
          </button>
        </div>

        {/* Search */}
        <div className="px-3 py-2 border-b border-gray-100">
          <div className="relative">
            <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
            <input
              className="w-full pl-8 pr-3 py-1.5 bg-gray-50 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500"
              placeholder="Tedarikçi ara..."
              value={search}
              onChange={e => setSearch(e.target.value)}
            />
          </div>
        </div>

        {/* Status tabs */}
        <div className="px-3 py-2 border-b border-gray-100 flex gap-1 flex-wrap">
          {tabs.map(tab => (
            <button
              key={tab.key}
              onClick={() => setStatusFilter(tab.key)}
              className={`px-2 py-0.5 rounded text-[11px] font-semibold transition-colors ${
                statusFilter === tab.key
                  ? "bg-blue-600 text-white"
                  : "bg-gray-100 text-gray-500 hover:bg-gray-200"
              }`}
            >
              {tab.label}
            </button>
          ))}
        </div>

        {/* List */}
        <div className="flex-1 overflow-y-auto">
          {loading ? (
            <div className="flex items-center justify-center h-20">
              <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
            </div>
          ) : filteredSuppliers.length === 0 ? (
            <div className="text-center py-8 text-xs text-gray-400 italic">
              Tedarikçi bulunamadı
            </div>
          ) : (
            filteredSuppliers.map(s => (
              <button
                key={s.id}
                onClick={() => handleSelect(s)}
                className={`w-full text-left px-4 py-3 border-b border-gray-50 transition-colors ${
                  selected?.id === s.id
                    ? "bg-blue-50 border-l-2 border-l-blue-500"
                    : "hover:bg-gray-50 border-l-2 border-l-transparent"
                }`}
              >
                <div className="flex items-center gap-2">
                  <span
                    className={`w-2 h-2 rounded-full flex-shrink-0 ${RISK_DOT[s.risk_tier]}`}
                  />
                  <span className="text-sm font-medium text-gray-900 truncate">
                    {s.display_name}
                  </span>
                </div>
                <div className="flex items-center gap-2 mt-1 pl-4">
                  <span className="text-xs text-gray-400 truncate">{s.legal_name}</span>
                  <span className={`ml-auto flex-shrink-0 px-1.5 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[s.status]}`}>
                    {STATUS_LABEL[s.status]}
                  </span>
                </div>
              </button>
            ))
          )}
        </div>
      </div>

      {/* Right panel */}
      <div className="flex-1 overflow-y-auto bg-gray-50">
        {!selected ? (
          <div className="flex items-center justify-center h-full text-gray-400 text-sm italic">
            Bir tedarikçi seçin
          </div>
        ) : (
          <div className="h-full flex flex-col">
            {/* Detail header */}
            <div className="bg-white border-b border-gray-200 px-6 py-4 flex items-center justify-between">
              <div className="flex items-center gap-3">
                <Building2 className="w-5 h-5 text-gray-400" />
                <div>
                  <h2 className="font-semibold text-gray-900">{selected.display_name}</h2>
                  <p className="text-xs text-gray-500">{selected.legal_name}</p>
                </div>
                <span className={`px-2 py-0.5 rounded text-xs font-semibold ${STATUS_BADGE[selected.status]}`}>
                  {STATUS_LABEL[selected.status]}
                </span>
                <div className="flex items-center gap-1">
                  <span className={`w-2 h-2 rounded-full ${RISK_DOT[selected.risk_tier]}`} />
                  <span className="text-xs text-gray-500">{RISK_LABEL[selected.risk_tier]} Risk</span>
                </div>
              </div>
              <button
                onClick={() => { setEditTarget(selected); setSlideOpen(true); }}
                className="px-3 py-1.5 border border-gray-200 text-gray-600 rounded-lg text-xs font-semibold hover:bg-gray-50 transition-colors"
              >
                Düzenle
              </button>
            </div>

            {/* Tabs */}
            <div className="bg-white border-b border-gray-200 px-6 flex gap-0">
              {([
                { key: "info", label: "Genel Bilgi" },
                { key: "sites", label: "Lokasyonlar" },
                { key: "docs", label: "Dokümanlar" },
                { key: "access", label: "Erişim" },
              ] as { key: ActiveTab; label: string }[]).map(tab => (
                <button
                  key={tab.key}
                  onClick={() => setActiveTab(tab.key)}
                  className={`px-4 py-3 text-xs font-semibold border-b-2 transition-colors ${
                    activeTab === tab.key
                      ? "border-blue-600 text-blue-600"
                      : "border-transparent text-gray-500 hover:text-gray-700"
                  }`}
                >
                  {tab.label}
                </button>
              ))}
            </div>

            {/* Tab content */}
            <div className="flex-1 p-6">
              {activeTab === "info" && (
                <div className="space-y-6 max-w-2xl">
                  {/* Categories */}
                  {selected.categories.length > 0 && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Kategoriler</p>
                      <div className="flex flex-wrap gap-1.5">
                        {selected.categories.map(c => (
                          <span key={c} className="px-2 py-0.5 bg-gray-100 text-gray-600 rounded text-xs font-medium">
                            {c}
                          </span>
                        ))}
                      </div>
                    </div>
                  )}

                  {/* Contact */}
                  <div>
                    <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Birincil İletişim</p>
                    <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-2">
                      {selected.primary_contact?.name && (
                        <div className="flex gap-3">
                          <span className="text-xs text-gray-400 w-16">Ad</span>
                          <span className="text-xs text-gray-900">{selected.primary_contact.name}</span>
                        </div>
                      )}
                      {selected.primary_contact?.email && (
                        <div className="flex gap-3">
                          <span className="text-xs text-gray-400 w-16">E-posta</span>
                          <span className="text-xs text-gray-900">{selected.primary_contact.email}</span>
                        </div>
                      )}
                      {selected.primary_contact?.phone && (
                        <div className="flex gap-3">
                          <span className="text-xs text-gray-400 w-16">Telefon</span>
                          <span className="text-xs text-gray-900">{selected.primary_contact.phone}</span>
                        </div>
                      )}
                      {!selected.primary_contact?.name && !selected.primary_contact?.email && (
                        <p className="text-xs text-gray-400 italic">İletişim bilgisi girilmemiş</p>
                      )}
                    </div>
                  </div>

                  {/* Notes */}
                  {selected.notes && (
                    <div>
                      <p className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">Notlar</p>
                      <p className="text-sm text-gray-700 bg-white rounded-lg border border-gray-200 p-4">
                        {selected.notes}
                      </p>
                    </div>
                  )}

                  {/* Portal */}
                  <div className="flex items-center gap-3">
                    <div className={`w-9 h-5 rounded-full transition-colors ${selected.portal_enabled ? "bg-green-500" : "bg-gray-200"}`}>
                      <div className={`w-3.5 h-3.5 bg-white rounded-full mt-0.5 shadow transition-transform ${selected.portal_enabled ? "translate-x-4" : "translate-x-0.5"}`} />
                    </div>
                    <span className="text-xs text-gray-600">Tedarikçi Portalı {selected.portal_enabled ? "Aktif" : "Pasif"}</span>
                  </div>
                </div>
              )}

              {activeTab === "sites" && (
                <div className="max-w-2xl space-y-3">
                  <div className="flex items-center justify-between mb-4">
                    <p className="text-sm font-semibold text-gray-700">Lokasyonlar</p>
                  </div>
                  {sites.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
                      Lokasyon eklenmemiş
                    </div>
                  ) : (
                    sites.map(site => (
                      <div key={site.id} className="bg-white rounded-lg border border-gray-200 p-4">
                        <div className="flex items-center gap-2 mb-2">
                          <MapPin className="w-4 h-4 text-gray-400" />
                          <span className="font-medium text-sm text-gray-900">{site.name}</span>
                          {site.country && (
                            <span className="ml-auto text-xs text-gray-400">{site.country}</span>
                          )}
                        </div>
                        {site.gfsi_certified && (
                          <div className="flex items-center gap-1.5 mt-1">
                            <span className="px-1.5 py-0.5 bg-green-100 text-green-700 rounded text-[10px] font-semibold">
                              GFSI
                            </span>
                            {site.gfsi_scheme && (
                              <span className="text-xs text-gray-500">{site.gfsi_scheme}</span>
                            )}
                          </div>
                        )}
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "docs" && (
                <div className="max-w-3xl space-y-2">
                  {docs.length === 0 ? (
                    <div className="text-center py-8 text-sm text-gray-400 italic border border-dashed border-gray-200 rounded-lg">
                      Bu tedarikçiye ait doküman yok
                    </div>
                  ) : (
                    docs.map(doc => (
                      <div key={doc.id} className="bg-white rounded-lg border border-gray-200 px-4 py-3 flex items-center gap-3">
                        <FileText className="w-4 h-4 text-gray-400 flex-shrink-0" />
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-gray-900 truncate">{doc.title}</p>
                          <p className="text-xs text-gray-400">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</p>
                        </div>
                        <span className={`flex-shrink-0 px-2 py-0.5 rounded text-[10px] font-semibold ${DOC_STATUS_BADGE[doc.status] ?? ""}`}>
                          {DOC_STATUS_LABEL[doc.status] ?? doc.status}
                        </span>
                        {doc.expiry_date && (
                          <span className="text-xs text-gray-400 flex-shrink-0">
                            {new Date(doc.expiry_date).toLocaleDateString("tr-TR")}
                          </span>
                        )}
                        <ChevronRight className="w-4 h-4 text-gray-300 flex-shrink-0" />
                      </div>
                    ))
                  )}
                </div>
              )}

              {activeTab === "access" && (
                <PortalAccessTab supplierId={selected.id} token={token} />
              )}
            </div>
          </div>
        )}
      </div>

      {/* Slide-over */}
      <SupplierSlideOver
        open={slideOpen}
        onClose={() => { setSlideOpen(false); setEditTarget(null); }}
        initial={editTarget}
        onSave={handleSave}
        saving={saving}
      />
    </div>
  );
}
