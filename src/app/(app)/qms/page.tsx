"use client";

import { useEffect, useState } from "react";
import { Loader2, Package, CheckCircle2, AlertTriangle, XCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { AuditReadinessReport, ComplianceDocument, SupplierStatus } from "@/lib/qms/types";

const DOC_TYPE_LABEL: Record<string, string> = {
  gfsi_certificate: "GFSI Sertifikası",
  haccp_plan: "HACCP Planı",
  allergen_statement: "Alerjen Beyanı",
  kosher_cert: "Koşer Sertifikası",
  halal_cert: "Helal Sertifikası",
  organic_cert: "Organik Sertifika",
  non_gmo: "GDO'suz Belgesi",
  letter_of_guarantee: "Garanti Mektubu",
  coi: "COI",
  business_license: "İşletme Lisansı",
  food_safety_plan: "Gıda Güvenliği Planı",
  third_party_audit: "3. Taraf Denetimi",
  other: "Diğer",
};

const STATUS_LABEL: Record<string, string> = {
  requested: "Talep Edildi",
  uploaded: "Yüklendi",
  in_review: "İncelemede",
  approved: "Onaylandı",
  rejected: "Reddedildi",
  expiring: "Süresi Dolmak Üzere",
  expired: "Süresi Doldu",
};

const STATUS_COLORS: Record<string, string> = {
  requested: "bg-gray-100 text-gray-600",
  uploaded: "bg-blue-100 text-blue-700",
  in_review: "bg-amber-100 text-amber-700",
  approved: "bg-green-100 text-green-700",
  rejected: "bg-red-100 text-red-700",
  expiring: "bg-orange-100 text-orange-700",
  expired: "bg-red-100 text-red-700",
};

const SUPPLIER_STATUS_LABEL: Record<SupplierStatus, string> = {
  prospect: "Aday",
  pending: "Beklemede",
  approved: "Onaylı",
  conditional: "Koşullu",
  suspended: "Askıya Alındı",
  inactive: "Pasif",
};

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

export default function QMSDashboard() {
  const [report, setReport] = useState<AuditReadinessReport | null>(null);
  const [expiringDocs, setExpiringDocs] = useState<ComplianceDocument[]>([]);
  const [supplierStatusCounts, setSupplierStatusCounts] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;

      const headers = { Authorization: `Bearer ${session.access_token}` };

      const [reportRes, docsRes, suppliersRes] = await Promise.all([
        fetch("/api/qms/compliance/audit-readiness", { headers }),
        fetch("/api/qms/compliance/documents?expiringWithin=60", { headers }),
        fetch("/api/qms/suppliers", { headers }),
      ]);

      if (reportRes.ok) setReport(await reportRes.json());
      if (docsRes.ok) setExpiringDocs(await docsRes.json());
      if (suppliersRes.ok) {
        const suppliers = await suppliersRes.json();
        const counts: Record<string, number> = {};
        for (const s of suppliers) {
          counts[s.status] = (counts[s.status] ?? 0) + 1;
        }
        setSupplierStatusCounts(counts);
      }

      setLoading(false);
    }
    load();
  }, []);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  const statCards = [
    {
      label: "Toplam Tedarikçi",
      value: report?.total_suppliers ?? 0,
      icon: Package,
      color: "#3B82F6",
    },
    {
      label: "Onaylı Tedarikçi",
      value: report?.approved_suppliers ?? 0,
      icon: CheckCircle2,
      color: "#059669",
    },
    {
      label: "30 Gün İçinde Dolacak",
      value: report?.expiring_docs ?? 0,
      icon: AlertTriangle,
      color: "#D97706",
    },
    {
      label: "Süresi Dolmuş",
      value: report?.expired_docs ?? 0,
      icon: XCircle,
      color: "#DC2626",
    },
  ];

  const statusOrder: SupplierStatus[] = ["approved", "pending", "prospect", "conditional", "suspended", "inactive"];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl font-bold text-gray-900">Kalite Yönetimi (QMS)</h1>
        <p className="text-sm text-gray-500 mt-0.5">Tedarikçi uyum durumu ve denetim hazırlık özeti</p>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-xl border border-gray-200 p-5 relative overflow-hidden"
            >
              <div className="absolute left-0 top-0 bottom-0 w-1" style={{ background: card.color }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs text-gray-500 uppercase font-semibold tracking-wider">
                    {card.label}
                  </p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <Icon className="w-5 h-5 text-gray-300 mt-1" />
              </div>
            </div>
          );
        })}
      </div>

      {/* Two-column section */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Expiring documents table */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Süresi Dolmak Üzere</h2>
            <p className="text-xs text-gray-500 mt-0.5">Önümüzdeki 60 gün içinde</p>
          </div>
          {expiringDocs.length === 0 ? (
            <div className="flex items-center justify-center h-32 text-sm text-gray-400 italic">
              Yakında süresi dolacak doküman yok
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-gray-50 border-b border-gray-100">
                  <tr>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Doküman Tipi</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Başlık</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Son Tarih</th>
                    <th className="px-4 py-2.5 text-left font-semibold text-gray-500 uppercase tracking-wider">Durum</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-gray-50">
                  {expiringDocs.slice(0, 10).map((doc) => (
                    <tr key={doc.id} className="hover:bg-gray-50 transition-colors">
                      <td className="px-4 py-2.5 text-gray-700">
                        {DOC_TYPE_LABEL[doc.type] ?? doc.type}
                      </td>
                      <td className="px-4 py-2.5 text-gray-900 font-medium max-w-[140px] truncate">
                        {doc.title}
                      </td>
                      <td className={`px-4 py-2.5 ${expiryColor(doc.expiry_date)}`}>
                        {formatDate(doc.expiry_date)}
                      </td>
                      <td className="px-4 py-2.5">
                        <span className={`inline-flex px-2 py-0.5 rounded text-[10px] font-semibold ${STATUS_COLORS[doc.status] ?? ""}`}>
                          {STATUS_LABEL[doc.status] ?? doc.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>

        {/* Supplier status breakdown */}
        <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
          <div className="px-5 py-4 border-b border-gray-100">
            <h2 className="font-semibold text-gray-900 text-sm">Tedarikçi Durumu</h2>
            <p className="text-xs text-gray-500 mt-0.5">Statüye göre dağılım</p>
          </div>
          <div className="p-5 space-y-3">
            {statusOrder.map((status) => {
              const count = supplierStatusCounts[status] ?? 0;
              const total = report?.total_suppliers || 1;
              const pct = Math.round((count / total) * 100);
              const colors: Record<SupplierStatus, string> = {
                approved: "bg-green-500",
                pending: "bg-amber-500",
                prospect: "bg-blue-500",
                conditional: "bg-purple-500",
                suspended: "bg-red-500",
                inactive: "bg-gray-400",
              };
              return (
                <div key={status}>
                  <div className="flex items-center justify-between mb-1">
                    <span className="text-xs font-medium text-gray-700">
                      {SUPPLIER_STATUS_LABEL[status]}
                    </span>
                    <span className="text-xs text-gray-500">{count}</span>
                  </div>
                  <div className="h-1.5 bg-gray-100 rounded-full overflow-hidden">
                    <div
                      className={`h-full rounded-full transition-all duration-500 ${colors[status]}`}
                      style={{ width: `${pct}%` }}
                    />
                  </div>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
