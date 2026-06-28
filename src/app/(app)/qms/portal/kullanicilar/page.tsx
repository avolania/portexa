"use client";

import { useEffect, useState, useCallback } from "react";
import { Loader2, Search, Users } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { SupplierUser, SupplierPortalRole, Supplier } from "@/lib/qms/types";

const PORTAL_ROLE_LABEL: Record<SupplierPortalRole, string> = {
  viewer: "Görüntüleyici",
  uploader: "Yükleyici",
  responder: "Yanıtlayıcı",
};

export default function PortalKullanicilarPage() {
  const [users, setUsers] = useState<SupplierUser[]>([]);
  const [suppliers, setSuppliers] = useState<Supplier[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [search, setSearch] = useState("");
  const [supplierFilter, setSupplierFilter] = useState("");

  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (session) setToken(session.access_token);
    });
  }, []);

  const load = useCallback(async () => {
    if (!token) return;
    setLoading(true);
    const [usersRes, suppliersRes] = await Promise.all([
      fetch("/api/qms/portal/users", {
        headers: { Authorization: `Bearer ${token}` },
      }),
      fetch("/api/qms/suppliers", {
        headers: { Authorization: `Bearer ${token}` },
      }),
    ]);
    if (usersRes.ok) setUsers(await usersRes.json());
    if (suppliersRes.ok) setSuppliers(await suppliersRes.json());
    setLoading(false);
  }, [token]);

  useEffect(() => {
    if (token) load();
  }, [token, load]);

  const handleDeactivate = async (id: string) => {
    const res = await fetch("/api/qms/portal/users", {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ id, is_active: false }),
    });
    if (res.ok) load();
  };

  const getSupplierName = (supplierId: string) => {
    return suppliers.find(s => s.id === supplierId)?.display_name ?? supplierId.slice(0, 8) + "...";
  };

  const filtered = users.filter(u => {
    const matchSupplier = !supplierFilter || u.supplier_id === supplierFilter;
    const matchSearch = !search
      || u.name.toLowerCase().includes(search.toLowerCase())
      || u.email.toLowerCase().includes(search.toLowerCase());
    return matchSupplier && matchSearch;
  });

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Portal Kullanıcıları</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tüm tedarikçi portal erişimlerini yönetin</p>
        </div>
        <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 rounded-lg">
          <Users className="w-4 h-4 text-blue-600" />
          <span className="text-sm font-semibold text-blue-700">{users.length} kullanıcı</span>
        </div>
      </div>

      {/* Filters */}
      <div className="flex items-center gap-3">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            className="w-full pl-8 pr-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500"
            placeholder="Ad veya e-posta ara..."
            value={search}
            onChange={e => setSearch(e.target.value)}
          />
        </div>
        <select
          className="px-3 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:border-blue-500 bg-white"
          value={supplierFilter}
          onChange={e => setSupplierFilter(e.target.value)}
        >
          <option value="">Tüm Tedarikçiler</option>
          {suppliers.map(s => (
            <option key={s.id} value={s.id}>{s.display_name}</option>
          ))}
        </select>
      </div>

      {/* Table */}
      <div className="bg-white rounded-xl border border-gray-200 overflow-hidden">
        {loading ? (
          <div className="flex items-center justify-center h-40">
            <Loader2 className="w-5 h-5 animate-spin text-gray-400" />
          </div>
        ) : filtered.length === 0 ? (
          <div className="text-center py-16 text-sm text-gray-400 italic">
            Kullanıcı bulunamadı
          </div>
        ) : (
          <table className="w-full border-collapse">
            <thead>
              <tr className="bg-gray-50">
                {["Tedarikçi", "Ad", "E-posta", "Rol", "Durum", "Oluşturulma", "İşlem"].map(h => (
                  <th
                    key={h}
                    className="px-4 py-3 text-left text-[10px] font-semibold text-gray-400 uppercase tracking-wider border-b border-gray-200"
                  >
                    {h}
                  </th>
                ))}
              </tr>
            </thead>
            <tbody>
              {filtered.map((u, i) => (
                <tr
                  key={u.id}
                  className="border-b border-gray-50 hover:bg-gray-50 transition-colors"
                  style={{ animation: `rowIn 0.2s ease ${i * 0.02}s both` }}
                >
                  <td className="px-4 py-3 text-sm font-medium text-gray-900">
                    {getSupplierName(u.supplier_id)}
                  </td>
                  <td className="px-4 py-3 text-sm text-gray-700">{u.name}</td>
                  <td className="px-4 py-3 text-sm text-gray-500">{u.email}</td>
                  <td className="px-4 py-3">
                    <span className="px-2 py-0.5 bg-blue-50 text-blue-700 rounded text-[10px] font-semibold">
                      {PORTAL_ROLE_LABEL[u.role]}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    <span
                      className={`px-2 py-0.5 rounded text-[10px] font-semibold ${
                        u.is_active
                          ? "bg-green-100 text-green-700"
                          : "bg-gray-100 text-gray-500"
                      }`}
                    >
                      {u.is_active ? "Aktif" : "Pasif"}
                    </span>
                  </td>
                  <td className="px-4 py-3 text-xs text-gray-400">
                    {new Date(u.created_at).toLocaleDateString("tr-TR")}
                  </td>
                  <td className="px-4 py-3">
                    {u.is_active && (
                      <button
                        onClick={() => handleDeactivate(u.id)}
                        className="px-3 py-1 border border-red-200 text-red-600 rounded text-xs font-semibold hover:bg-red-50 transition-colors"
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
    </div>
  );
}
