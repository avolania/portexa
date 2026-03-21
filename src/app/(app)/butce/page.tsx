"use client";

import { useState } from "react";
import { Plus, TrendingUp, TrendingDown, AlertTriangle, DollarSign, X } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { ProjectStatusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";

const EXPENSE_CATEGORIES = ["İşgücü", "Yazılım", "Donanım", "Hizmet", "Diğer"];
const PIE_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

const mockExpenses = [
  { id: "e1", projectId: "1", category: "İşgücü", description: "Mart ayı maaşları", amount: 28000, date: "2026-03-01" },
  { id: "e2", projectId: "1", category: "Yazılım", description: "AWS aboneliği", amount: 4500, date: "2026-03-05" },
  { id: "e3", projectId: "2", category: "İşgücü", description: "Tasarım danışmanlığı", amount: 15000, date: "2026-03-10" },
  { id: "e4", projectId: "2", category: "Hizmet", description: "Figma Pro lisansları", amount: 2400, date: "2026-03-12" },
  { id: "e5", projectId: "3", category: "Yazılım", description: "API entegrasyon aracı", amount: 3200, date: "2026-03-15" },
  { id: "e6", projectId: "1", category: "Donanım", description: "Test cihazları", amount: 8500, date: "2026-03-18" },
];

const monthlyData = [
  { ay: "Oca", harcama: 38000, butce: 41667 },
  { ay: "Şub", harcama: 42000, butce: 41667 },
  { ay: "Mar", harcama: 61600, butce: 41667 },
  { ay: "Nis", harcama: 0, butce: 41667 },
  { ay: "May", harcama: 0, butce: 41667 },
  { ay: "Haz", harcama: 0, butce: 41667 },
];

function formatCurrency(n: number) {
  return n.toLocaleString("tr-TR", { style: "currency", currency: "TRY", maximumFractionDigits: 0 });
}

export default function ButcePage() {
  const { projects } = useProjectStore();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [expenses] = useState(mockExpenses);

  const totalBudget = projects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const totalUsed = projects.reduce((s, p) => s + (p.budgetUsed ?? 0), 0);
  const totalRemaining = totalBudget - totalUsed;
  const overallPct = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0;

  const categoryData = EXPENSE_CATEGORIES.map((cat) => ({
    name: cat,
    value: expenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((d) => d.value > 0);

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bütçe & Maliyet</h1>
          <p className="text-sm text-gray-500 mt-1">Tüm projelerin finansal durumu</p>
        </div>
        <Button onClick={() => setShowAddExpense(true)}>
          <Plus className="w-4 h-4" />
          Gider Ekle
        </Button>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Bütçe", value: formatCurrency(totalBudget), icon: DollarSign, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Harcanan", value: formatCurrency(totalUsed), icon: TrendingUp, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Kalan", value: formatCurrency(totalRemaining), icon: TrendingDown, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Kullanım Oranı", value: `%${overallPct}`, icon: AlertTriangle, color: overallPct > 80 ? "text-red-600" : "text-gray-600", bg: overallPct > 80 ? "bg-red-50" : "bg-gray-50" },
        ].map((c) => {
          const Icon = c.icon;
          return (
            <div key={c.label} className="card">
              <div className={`w-10 h-10 ${c.bg} rounded-xl flex items-center justify-center mb-3`}>
                <Icon className={`w-5 h-5 ${c.color}`} />
              </div>
              <div className={`text-2xl font-bold ${c.color}`}>{c.value}</div>
              <div className="text-xs text-gray-500 mt-1">{c.label}</div>
            </div>
          );
        })}
      </div>

      {/* Charts row */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Monthly bar */}
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Aylık Harcama vs Bütçe</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="ay" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [formatCurrency(Number(v))]} />
              <Bar dataKey="butce" fill="#e0e7ff" radius={[4, 4, 0, 0]} name="Bütçe" />
              <Bar dataKey="harcama" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Harcama" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        {/* Category pie */}
        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Kategori Dağılımı</h2>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={60} dataKey="value" paddingAngle={3}>
                {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [formatCurrency(Number(v))]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {categoryData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-medium text-gray-900">{formatCurrency(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per project */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Proje Bazında Bütçe</h2>
        <div className="space-y-4">
          {projects.filter((p) => p.budget).map((p) => {
            const pct = Math.round(((p.budgetUsed ?? 0) / (p.budget ?? 1)) * 100);
            return (
              <div key={p.id}>
                <div className="flex items-center justify-between mb-1.5">
                  <div className="flex items-center gap-2">
                    <span className="text-sm font-medium text-gray-900">{p.name}</span>
                    <ProjectStatusBadge status={p.status} />
                    {pct >= 90 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Risk</span>}
                  </div>
                  <div className="text-xs text-gray-500">
                    {formatCurrency(p.budgetUsed ?? 0)} / {formatCurrency(p.budget ?? 0)}
                    <span className={`ml-2 font-semibold ${pct >= 90 ? "text-red-600" : pct >= 75 ? "text-amber-600" : "text-emerald-600"}`}>
                      %{pct}
                    </span>
                  </div>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div
                    className={`h-full rounded-full transition-all ${pct >= 90 ? "bg-red-500" : pct >= 75 ? "bg-amber-500" : "bg-emerald-500"}`}
                    style={{ width: `${Math.min(pct, 100)}%` }}
                  />
                </div>
              </div>
            );
          })}
        </div>
      </div>

      {/* Expense list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200">
          <h2 className="text-sm font-semibold text-gray-700">Son Giderler</h2>
        </div>
        <table className="w-full">
          <thead className="bg-gray-50 border-b border-gray-200">
            <tr>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Açıklama</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Proje</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Kategori</th>
              <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Tarih</th>
              <th className="text-right px-4 py-2.5 text-xs font-semibold text-gray-500 uppercase">Tutar</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-100">
            {expenses.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{e.description}</td>
                <td className="px-4 py-3 text-sm text-gray-600">
                  {projects.find((p) => p.id === e.projectId)?.name ?? "—"}
                </td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.category}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">
                  {new Date(e.date).toLocaleDateString("tr-TR")}
                </td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">
                  {formatCurrency(e.amount)}
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* Add expense modal */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddExpense(false)} />
          <div className="relative bg-white rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Yeni Gider</h2>
              <button onClick={() => setShowAddExpense(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Açıklama</label>
                <input className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Gider açıklaması..." />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Proje</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Kategori</label>
                  <select className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500">
                    {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Tutar (₺)</label>
                  <input type="number" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="0" />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Tarih</label>
                  <input type="date" className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddExpense(false)}>İptal</Button>
                <Button className="flex-1" onClick={() => setShowAddExpense(false)}>Gider Ekle</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
