"use client";

import { useEffect, useState, useCallback, useRef } from "react";
import {
  Loader2, Plus, Upload, Eye, X, CheckCircle, XCircle,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  ComplianceDocument, Supplier, DocumentType, DocStatus,
  CreateDocumentDto, ReviewDocumentDto,
} from "@/lib/qms/types";

// ─── Label maps ───────────────────────────────────────────────────────────────

const DOC_TYPE_OPTIONS: { value: DocumentType; label: string }[] = [
  { value: "gfsi_certificate",  label: "GFSI Sertifikası" },
  { value: "haccp_plan",        label: "HACCP Planı" },
  { value: "allergen_statement",label: "Alerjen Beyanı" },
  { value: "kosher_cert",       label: "Koşer Sertifikası" },
  { value: "halal_cert",        label: "Helal Sertifikası" },
  { value: "organic_cert",      label: "Organik Sertifika" },
  { value: "non_gmo",           label: "GDO'suz Belgesi" },
  { value: "letter_of_guarantee","label": "Garanti Mektubu" },
  { value: "coi",               label: "COI" },
  { value: "business_license",  label: "İşletme Lisansı" },
  { value: "food_safety_plan",  label: "Gıda Güvenliği Planı" },
  { value: "third_party_audit", label: "3. Taraf Denetimi" },
  { value: "other",             label: "Diğer" },
];

const DOC_TYPE_LABEL: Record<string, string> = Object.fromEntries(
  DOC_TYPE_OPTIONS.map(o => [o.value, o.label])
);

const STATUS_LABEL: Record<DocStatus, string> = {
  requested: "Talep Edildi",
  uploaded: "Yüklendi",
  in_review: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  expiring: "Süresi Dolmak Üzere",
  expired: "Süresi Doldu",
};

const STATUS_BADGE: Record<DocStatus, string> = {
  requested: "bg-gray-100 text-gray-600",
  uploaded: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expiring: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
};

const EXPIRY_FILTER_OPTIONS = [
  { value: "", label: "Tümü" },
  { value: "7", label: "Bu Hafta" },
  { value: "30", label: "30 Gün" },
  { value: "60", label: "60 Gün" },
];

function formatDate(d: string | null) {
  if (!d) return "—";
  return new Date(d).toLocaleDateString("tr-TR");
}

function expiryColor(expiry: string | null) {
  if (!expiry) return "text-gray-500";
  const today = new Date();
  const exp = new Date(expiry);
  const diff = (exp.getTime() - today.getTime()) / (1000 * 60 * 60 * 24);
  if (diff < 0) return "text-red-600 font-semibold";
  if (diff <= 30) return "text-amber-600 font-semibold";
  return "text-gray-600";
}

function formatBytes(bytes: number | null) {
  if (!bytes) return "—";
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

// ─── Request document modal ───────────────────────────────────────────────────

interface RequestModalProps {
  open: boolean;
  onClose: () => void;
  suppliers: Supplier[];
  onSave: (dto: CreateDocumentDto) => Promise<void>;
  saving: boolean;
}

function RequestDocModal({ open, onClose, suppliers, onSave, saving }: RequestModalProps) {
  const [form, setForm] = useState<CreateDocumentDto>({
    supplier_id: "",
    type: "other",
    title: "",
    expiry_date: "",
    issue_date: "",
  });

  useEffect(() => {
    if (open) {
      setForm({ supplier_id: "", type: "other", title: "", expiry_date: "", issue_date: "" });
    }
  }, [open]);

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[440px] bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm">Doküman Talep Et</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-6 py-5 space-y-4">
          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Tedarikçi *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
              value={form.supplier_id}
              onChange={e => setForm(f => ({ ...f, supplier_id: e.target.value }))}
            >
              <option value="">Tedarikçi seçin</option>
              {suppliers.map(s => (
                <option key={s.id} value={s.id}>{s.display_name}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Doküman Tipi *
            </label>
            <select
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
              value={form.type}
              onChange={e => setForm(f => ({ ...f, type: e.target.value as DocumentType }))}
            >
              {DOC_TYPE_OPTIONS.map(o => (
                <option key={o.value} value={o.value}>{o.label}</option>
              ))}
            </select>
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Başlık *
            </label>
            <input
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={form.title}
              onChange={e => setForm(f => ({ ...f, title: e.target.value }))}
              placeholder="Doküman başlığı"
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Son Kullanma Tarihi
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={form.expiry_date ?? ""}
              onChange={e => setForm(f => ({ ...f, expiry_date: e.target.value }))}
            />
          </div>

          <div>
            <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wider mb-1">
              Düzenleme Tarihi
            </label>
            <input
              type="date"
              className="w-full px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 focus:ring-1 focus:ring-blue-100"
              value={form.issue_date ?? ""}
              onChange={e => setForm(f => ({ ...f, issue_date: e.target.value }))}
            />
          </div>
        </div>

        <div className="px-6 py-4 border-t border-gray-100 flex items-center gap-3">
          <button
            onClick={() => onSave(form)}
            disabled={saving || !form.supplier_id || !form.title.trim()}
            className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {saving ? <Loader2 className="w-4 h-4 animate-spin mx-auto" /> : "Talep Oluştur"}
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

// ─── Detail side panel ────────────────────────────────────────────────────────

interface DetailPanelProps {
  doc: ComplianceDocument;
  supplierName: string;
  onClose: () => void;
  onReview: (dto: ReviewDocumentDto) => Promise<void>;
  onUpload: (file: File) => Promise<void>;
  uploading: boolean;
  reviewing: boolean;
}

function DetailPanel({ doc, supplierName, onClose, onReview, onUpload, uploading, reviewing }: DetailPanelProps) {
  const fileRef = useRef<HTMLInputElement>(null);
  const [reviewNotes, setReviewNotes] = useState("");

  const canUpload = ["requested", "rejected", "uploaded"].includes(doc.status);
  const canReview = ["uploaded", "in_review"].includes(doc.status);

  return (
    <>
      <div className="fixed inset-0 bg-black/20 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-[420px] bg-white shadow-xl z-50 flex flex-col">
        <div className="flex items-center justify-between px-5 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900 text-sm truncate pr-4">{doc.title}</h2>
          <button onClick={onClose} className="text-gray-400 hover:text-gray-600 transition-colors flex-shrink-0">
            <X className="w-4 h-4" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto px-5 py-4 space-y-5">
          {/* Status */}
          <div className="flex items-center gap-2">
            <span className={`px-2.5 py-1 rounded-lg text-xs font-semibold ${STATUS_BADGE[doc.status] ?? ""}`}>
              {STATUS_LABEL[doc.status] ?? doc.status}
            </span>
          </div>

          {/* Metadata grid */}
          <div className="bg-gray-50 rounded-lg p-4 space-y-3">
            <div className="grid grid-cols-2 gap-3">
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tedarikçi</p>
                <p className="text-xs text-gray-900 mt-0.5">{supplierName}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Tip</p>
                <p className="text-xs text-gray-900 mt-0.5">{DOC_TYPE_LABEL[doc.type] ?? doc.type}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Versiyon</p>
                <p className="text-xs text-gray-900 mt-0.5">v{doc.version}</p>
              </div>
              <div>
                <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Son Kullanma</p>
                <p className={`text-xs mt-0.5 ${expiryColor(doc.expiry_date)}`}>
                  {formatDate(doc.expiry_date)}
                </p>
              </div>
              {doc.issue_date && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Düzenleme</p>
                  <p className="text-xs text-gray-900 mt-0.5">{formatDate(doc.issue_date)}</p>
                </div>
              )}
              {doc.file_name && (
                <div>
                  <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider">Dosya</p>
                  <p className="text-xs text-gray-900 mt-0.5 truncate">{doc.file_name}</p>
                  <p className="text-[10px] text-gray-400">{formatBytes(doc.file_size_bytes)}</p>
                </div>
              )}
            </div>
          </div>

          {/* Review notes */}
          {doc.review_notes && (
            <div>
              <p className="text-[10px] font-semibold text-gray-400 uppercase tracking-wider mb-1">İnceleme Notları</p>
              <p className="text-xs text-gray-700 bg-gray-50 rounded-lg p-3">{doc.review_notes}</p>
            </div>
          )}

          {/* Upload section */}
          {canUpload && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">Dosya Yükle</p>
              <input
                ref={fileRef}
                type="file"
                className="hidden"
                accept=".pdf,.doc,.docx,.png,.jpg,.jpeg"
                onChange={e => {
                  const file = e.target.files?.[0];
                  if (file) onUpload(file);
                }}
              />
              <button
                onClick={() => fileRef.current?.click()}
                disabled={uploading}
                className="w-full flex items-center justify-center gap-2 px-4 py-2.5 border-2 border-dashed border-gray-200 rounded-lg text-xs text-gray-500 hover:border-blue-300 hover:text-blue-500 transition-colors disabled:opacity-50"
              >
                {uploading ? (
                  <Loader2 className="w-4 h-4 animate-spin" />
                ) : (
                  <Upload className="w-4 h-4" />
                )}
                {uploading ? "Yükleniyor..." : "PDF veya belge seçin"}
              </button>
            </div>
          )}

          {/* Review section */}
          {canReview && (
            <div>
              <p className="text-xs font-semibold text-gray-700 mb-2">İnceleme Kararı</p>
              <textarea
                className="w-full px-3 py-2 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 resize-none mb-3"
                rows={3}
                placeholder="İnceleme notu (isteğe bağlı)..."
                value={reviewNotes}
                onChange={e => setReviewNotes(e.target.value)}
              />
              <div className="flex gap-2">
                <button
                  onClick={() => onReview({ decision: "approve", notes: reviewNotes })}
                  disabled={reviewing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-green-600 text-white rounded-lg text-xs font-semibold hover:bg-green-700 disabled:opacity-50 transition-colors"
                >
                  <CheckCircle className="w-3.5 h-3.5" />
                  Onayla
                </button>
                <button
                  onClick={() => onReview({ decision: "reject", notes: reviewNotes })}
                  disabled={reviewing}
                  className="flex-1 flex items-center justify-center gap-1.5 px-3 py-2 bg-red-600 text-white rounded-lg text-xs font-semibold hover:bg-red-700 disabled:opacity-50 transition-colors"
                >
                  <XCircle className="w-3.5 h-3.5" />
                  Reddet
                </button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
}

// ─── Main page ────────────────────────────────────────────────────────────────

export default function CompliancePage() {
  const [docs, setDocs] = useState<ComplianceDocument[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");

  // Filters
  const [supplierFilter, setSupplierFilter] = useState("");
  const [typeFilter, setTypeFilter] = useState("");
  const [statusFilter, setStatusFilter] = useState("");
  const [expiryFilter, setExpiryFilter] = useState("");

  // UI state
  const [requestOpen, setRequestOpen] = useState(false);
  const [detailDoc, setDetailDoc] = useState<ComplianceDocument | null>(null);
  const [saving, setSaving] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [reviewing, setReviewing] = useState(false);

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const loadDocs = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const params = new URLSearchParams();
    if (supplierFilter) params.set("supplierId", supplierFilter);
    if (typeFilter) params.set("type", typeFilter);
    if (statusFilter) params.set("status", statusFilter);
    if (expiryFilter) params.set("expiringWithin", expiryFilter);

    const [docsRes, suppliersRes] = await Promise.all([
      fetch(`/api/qms/compliance/documents?${params}`, {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/qms/suppliers", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (docsRes.ok) setDocs(await docsRes.json());
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    setLoading(false);
  }, [token, supplierFilter, typeFilter, statusFilter, expiryFilter]);

  useEffect(() => {
    if (token) loadDocs();
  }, [token, loadDocs]);

  const supplierMap = new Map(suppliers.map(s => [s.id, s.display_name]));

  const handleRequest = async (dto: CreateDocumentDto) => {
    setSaving(true);
    const res = await fetch("/api/qms/compliance/documents", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      await loadDocs();
      setRequestOpen(false);
    }
    setSaving(false);
  };

  const handleUpload = async (file: File) => {
    if (!detailDoc) return;
    setUploading(true);
    const formData = new FormData();
    formData.append("file", file);
    const res = await fetch(`/api/qms/compliance/documents/${detailDoc.id}/upload`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}` },
      body: formData,
    });
    if (res.ok) {
      const updated: ComplianceDocument = await res.json();
      setDetailDoc(updated);
      await loadDocs();
    }
    setUploading(false);
  };

  const handleReview = async (dto: ReviewDocumentDto) => {
    if (!detailDoc) return;
    setReviewing(true);
    const res = await fetch(`/api/qms/compliance/documents/${detailDoc.id}/review`, {
      method: "POST",
      headers: {
        Authorization: `Bearer ${token}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify(dto),
    });
    if (res.ok) {
      const updated: ComplianceDocument = await res.json();
      setDetailDoc(updated);
      await loadDocs();
    }
    setReviewing(false);
  };

  return (
    <div className="space-y-5">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Doküman Merkezi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Uyum dokümanlarını yönetin ve takip edin</p>
        </div>
        <button
          onClick={() => setRequestOpen(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Doküman Talep Et
        </button>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-xl border border-gray-200 p-4">
        <div className="flex gap-3 flex-wrap">
          <select
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white min-w-[160px]"
            value={supplierFilter}
            onChange={e => setSupplierFilter(e.target.value)}
          >
            <option value="">Tüm Tedarikçiler</option>
            {suppliers.map(s => (
              <option key={s.id} value={s.id}>{s.display_name}</option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white min-w-[160px]"
            value={typeFilter}
            onChange={e => setTypeFilter(e.target.value)}
          >
            <option value="">Tüm Tipler</option>
            {DOC_TYPE_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white min-w-[140px]"
            value={statusFilter}
            onChange={e => setStatusFilter(e.target.value)}
          >
            <option value="">Tüm Durumlar</option>
            {Object.entries(STATUS_LABEL).map(([v, l]) => (
              <option key={v} value={v}>{l}</option>
            ))}
          </select>

          <select
            className="px-3 py-1.5 border border-gray-200 rounded-lg text-xs focus:outline-none focus:border-blue-500 bg-white min-w-[120px]"
            value={expiryFilter}
            onChange={e => setExpiryFilter(e.target.value)}
          >
            {EXPIRY_FILTER_OPTIONS.map(o => (
              <option key={o.value} value={o.value}>{o.label}</option>
            ))}
          </select>
        </div>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-32">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : docs.length === 0 ? (
          <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">
            Doküman bulunamadı
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-gray-50 border-b border-gray-100">
                <tr>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Tedarikçi</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Tip</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Başlık</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Versiyon</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">Son Tarih</th>
                  <th className="px-4 py-3 text-left font-semibold text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-50">
                {docs.map(doc => (
                  <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                    <td className="px-4 py-3 text-gray-700 max-w-[160px] truncate">
                      {supplierMap.get(doc.supplier_id) ?? "—"}
                    </td>
                    <td className="px-4 py-3 text-gray-600">
                      {DOC_TYPE_LABEL[doc.type] ?? doc.type}
                    </td>
                    <td className="px-4 py-3 font-medium text-gray-900 max-w-[200px] truncate">
                      {doc.title}
                    </td>
                    <td className="px-4 py-3 text-gray-500">
                      v{doc.version}
                    </td>
                    <td className="px-4 py-3">
                      <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_BADGE[doc.status] ?? ""}`}>
                        {STATUS_LABEL[doc.status] ?? doc.status}
                      </span>
                    </td>
                    <td className={`px-4 py-3 ${expiryColor(doc.expiry_date)}`}>
                      {formatDate(doc.expiry_date)}
                    </td>
                    <td className="px-4 py-3">
                      <div className="flex items-center gap-1.5">
                        <button
                          onClick={() => setDetailDoc(doc)}
                          className="flex items-center gap-1 px-2 py-1 border border-gray-200 text-gray-600 rounded text-[10px] font-semibold hover:bg-gray-50 transition-colors"
                        >
                          <Eye className="w-3 h-3" />
                          İncele
                        </button>
                        {["requested", "rejected", "uploaded"].includes(doc.status) && (
                          <button
                            onClick={() => setDetailDoc(doc)}
                            className="flex items-center gap-1 px-2 py-1 border border-blue-200 text-blue-600 rounded text-[10px] font-semibold hover:bg-blue-50 transition-colors"
                          >
                            <Upload className="w-3 h-3" />
                            Yükle
                          </button>
                        )}
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </div>

      {/* Request modal */}
      <RequestDocModal
        open={requestOpen}
        onClose={() => setRequestOpen(false)}
        suppliers={suppliers}
        onSave={handleRequest}
        saving={saving}
      />

      {/* Detail panel */}
      {detailDoc && (
        <DetailPanel
          doc={detailDoc}
          supplierName={supplierMap.get(detailDoc.supplier_id) ?? "—"}
          onClose={() => setDetailDoc(null)}
          onReview={handleReview}
          onUpload={handleUpload}
          uploading={uploading}
          reviewing={reviewing}
        />
      )}
    </div>
  );
}
