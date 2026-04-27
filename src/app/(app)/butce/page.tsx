"use client";

import { useRef, useState, useMemo } from "react";
import { Plus, TrendingUp, TrendingDown, AlertTriangle, DollarSign, X, Upload, Download, CheckCircle2, AlertCircle as AlertCircleIcon } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import { ProjectStatusBadge } from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import { PieChart, Pie, Cell, Tooltip, ResponsiveContainer, BarChart, Bar, XAxis, YAxis, CartesianGrid } from "recharts";
import * as XLSX from "xlsx";
import { CURRENCIES, DEFAULT_CURRENCY, formatCurrency, getCurrency } from "@/lib/currencies";

const EXPENSE_CATEGORIES = ["İşgücü", "Yazılım", "Donanım", "Hizmet", "Diğer"];
const PIE_COLORS = ["#4f46e5", "#06b6d4", "#10b981", "#f59e0b", "#ef4444"];

const REQUIRED_COLS = ["Açıklama", "Proje", "Kategori", "Tarih", "Tutar"];

interface FlatExpense {
  id: string;
  projectId: string;
  category: string;
  description: string;
  amount: number;
  date: string;
}


function parseDateValue(raw: unknown): string {
  if (!raw) return new Date().toISOString().slice(0, 10);
  if (typeof raw === "number") {
    // Excel serial date
    const d = XLSX.SSF.parse_date_code(raw);
    return `${d.y}-${String(d.m).padStart(2, "0")}-${String(d.d).padStart(2, "0")}`;
  }
  const s = String(raw).trim();
  // dd.mm.yyyy or dd/mm/yyyy
  const dmY = s.match(/^(\d{1,2})[./](\d{1,2})[./](\d{4})$/);
  if (dmY) return `${dmY[3]}-${dmY[2].padStart(2, "0")}-${dmY[1].padStart(2, "0")}`;
  // yyyy-mm-dd already
  if (s.match(/^\d{4}-\d{2}-\d{2}/)) return s.slice(0, 10);
  const dt = new Date(s);
  if (!isNaN(dt.getTime())) return dt.toISOString().slice(0, 10);
  return new Date().toISOString().slice(0, 10);
}

interface ImportResult {
  imported: number;
  skipped: number;
  errors: string[];
}

export default function ButcePage() {
  const { projects, updateProject } = useProjectStore();
  const [showAddExpense, setShowAddExpense] = useState(false);
  const [showImport, setShowImport] = useState(false);
  const [importResult, setImportResult] = useState<ImportResult | null>(null);
  const [importing, setImporting] = useState(false);
  const [selectedCurrency, setSelectedCurrency] = useState(DEFAULT_CURRENCY);
  const [form, setForm] = useState({ description: "", projectId: projects[0]?.id ?? "", category: EXPENSE_CATEGORIES[0], amount: "", date: new Date().toISOString().slice(0, 10) });
  const fileRef = useRef<HTMLInputElement>(null);

  // Para birimine göre filtrele — currency tanımsız projeleri varsayılan TRY kabul et
  const filteredProjects = projects.filter((p) => (p.currency ?? DEFAULT_CURRENCY) === selectedCurrency);
  const usedCurrencies = Array.from(new Set(projects.map((p) => p.currency ?? DEFAULT_CURRENCY)));

  // Giderler project.expenses'dan gelir (project detail sayfasıyla aynı kaynak)
  const flatExpenses = useMemo<FlatExpense[]>(() => {
    return filteredProjects.flatMap((p) =>
      (p.expenses ?? []).map((e) => ({ ...e, projectId: p.id }))
    );
  }, [filteredProjects]);

  const totalBudget    = filteredProjects.reduce((s, p) => s + (p.budget ?? 0), 0);
  const totalUsed      = filteredProjects.reduce((s, p) => s + (p.budgetUsed ?? 0), 0);
  const totalRemaining = totalBudget - totalUsed;
  const overallPct     = totalBudget > 0 ? Math.round((totalUsed / totalBudget) * 100) : 0;
  const fmt = (n: number) => formatCurrency(n, selectedCurrency);

  // Son 6 ay aylık harcama vs bütçe (gerçek veriden)
  const monthlyData = useMemo(() => {
    return Array.from({ length: 6 }, (_, i) => {
      const d = new Date();
      d.setDate(1);
      d.setMonth(d.getMonth() - (5 - i));
      const key   = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
      const label = d.toLocaleDateString("tr-TR", { month: "short" });
      const harcama = flatExpenses
        .filter((e) => e.date.startsWith(key))
        .reduce((s, e) => s + e.amount, 0);
      return { ay: label, harcama, butce: totalBudget > 0 ? Math.round(totalBudget / 12) : 0 };
    });
  }, [flatExpenses, totalBudget]);

  const categoryData = EXPENSE_CATEGORIES.map((cat) => ({
    name: cat,
    value: flatExpenses.filter((e) => e.category === cat).reduce((s, e) => s + e.amount, 0),
  })).filter((d) => d.value > 0);

  // ── Template download ──────────────────────────────────────────────────────
  function downloadTemplate() {
    const wb = XLSX.utils.book_new();
    const rows = [
      REQUIRED_COLS,
      ["Mart ayı maaşları", projects[0]?.name ?? "Proje Adı", "İşgücü", "2026-03-01", 28000],
      ["AWS aboneliği",      projects[0]?.name ?? "Proje Adı", "Yazılım", "2026-03-05", 4500],
    ];
    const ws = XLSX.utils.aoa_to_sheet(rows);
    ws["!cols"] = [{ wch: 30 }, { wch: 20 }, { wch: 12 }, { wch: 14 }, { wch: 12 }];
    XLSX.utils.book_append_sheet(wb, ws, "Giderler");
    XLSX.writeFile(wb, "gider_sablonu.xlsx");
  }

  // ── Excel import ───────────────────────────────────────────────────────────
  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImporting(true);
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = async (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "binary", cellDates: false });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, unknown>>(ws, { defval: "" });

        if (rows.length === 0) {
          setImportResult({ imported: 0, skipped: 0, errors: ["Dosyada veri bulunamadı."] });
          setImporting(false);
          return;
        }

        // Validate headers
        const headers = Object.keys(rows[0]);
        const missing = REQUIRED_COLS.filter((c) => !headers.includes(c));
        if (missing.length > 0) {
          setImportResult({ imported: 0, skipped: 0, errors: [`Eksik sütunlar: ${missing.join(", ")}. Şablonu kullanın.`] });
          setImporting(false);
          return;
        }

        const newExpenses: FlatExpense[] = [];
        const errors: string[] = [];
        let skipped = 0;

        rows.forEach((row, idx) => {
          const rowNum = idx + 2;
          const description = String(row["Açıklama"] ?? "").trim();
          const projectName = String(row["Proje"] ?? "").trim();
          const category = String(row["Kategori"] ?? "").trim();
          const amount = parseFloat(String(row["Tutar"]).replace(/[^0-9.,]/g, "").replace(",", "."));
          const date = parseDateValue(row["Tarih"]);

          if (!description) { errors.push(`Satır ${rowNum}: Açıklama boş`); skipped++; return; }
          if (isNaN(amount) || amount <= 0) { errors.push(`Satır ${rowNum}: Geçersiz tutar`); skipped++; return; }

          // Match project by name (case-insensitive partial)
          const project = projects.find((p) => p.name.toLowerCase().includes(projectName.toLowerCase()) || projectName.toLowerCase().includes(p.name.toLowerCase()));
          const projectId = project?.id ?? "";

          const normalizedCat = EXPENSE_CATEGORIES.find((c) => c.toLowerCase() === category.toLowerCase()) ?? "Diğer";

          newExpenses.push({
            id: crypto.randomUUID(),
            projectId,
            category: normalizedCat,
            description,
            amount,
            date,
          });
        });

        // Group by project and update each project's expenses list
        const byProject = newExpenses.reduce<Record<string, typeof newExpenses>>((acc, e) => {
          if (!acc[e.projectId]) acc[e.projectId] = [];
          acc[e.projectId].push(e);
          return acc;
        }, {});
        await Promise.all(Object.entries(byProject).map(async ([projectId, expList]) => {
          const proj = projects.find((p) => p.id === projectId);
          const existing = proj?.expenses ?? [];
          const merged = [...expList.map(({ projectId: _pid, ...rest }) => rest), ...existing];
          const newBudgetUsed = merged.reduce((s, e) => s + e.amount, 0);
          await updateProject(projectId, { expenses: merged, budgetUsed: newBudgetUsed });
        }));
        setImportResult({ imported: newExpenses.length, skipped, errors });
      } catch {
        setImportResult({ imported: 0, skipped: 0, errors: ["Dosya okunamadı. Geçerli bir Excel dosyası seçin."] });
      }
      setImporting(false);
    };
    reader.readAsBinaryString(file);
    // reset so same file can be re-uploaded
    e.target.value = "";
  }

  // ── Add single expense ─────────────────────────────────────────────────────
  async function handleAddExpense() {
    const amount = parseFloat(form.amount);
    if (!form.description.trim() || isNaN(amount) || amount <= 0) return;
    const project = projects.find((p) => p.id === form.projectId);
    if (!project) return;
    const newExpense = { id: crypto.randomUUID(), category: form.category, description: form.description.trim(), amount, date: form.date };
    const newList = [newExpense, ...(project.expenses ?? [])];
    const newBudgetUsed = newList.reduce((s, e) => s + e.amount, 0);
    await updateProject(form.projectId, { expenses: newList, budgetUsed: newBudgetUsed });
    setShowAddExpense(false);
    setForm({ description: "", projectId: projects[0]?.id ?? "", category: EXPENSE_CATEGORIES[0], amount: "", date: new Date().toISOString().slice(0, 10) });
  }

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bütçe & Maliyet</h1>
          <p className="text-sm text-gray-500 mt-1">Tüm projelerin finansal durumu</p>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* Para birimi seçici */}
          <div className="flex items-center gap-1.5 bg-white border border-gray-200 rounded-xl px-3 py-2">
            <DollarSign className="w-4 h-4 text-gray-400" />
            <select
              value={selectedCurrency}
              onChange={(e) => setSelectedCurrency(e.target.value)}
              className="text-sm font-medium text-gray-700 focus:outline-none bg-transparent"
            >
              {usedCurrencies.map((code) => {
                const c = getCurrency(code);
                return <option key={code} value={code}>{c.symbol} {code} — {c.label}</option>;
              })}
              {/* Sistemde kullanılmayan para birimlerini de göster */}
              {CURRENCIES.filter((c) => !usedCurrencies.includes(c.code)).map((c) => (
                <option key={c.code} value={c.code} disabled className="text-gray-400">{c.symbol} {c.code} — {c.label}</option>
              ))}
            </select>
          </div>
          <Button variant="outline" onClick={() => setShowImport(true)}>
            <Upload className="w-4 h-4" />
            Excel Yükle
          </Button>
          <Button onClick={() => setShowAddExpense(true)}>
            <Plus className="w-4 h-4" />
            Gider Ekle
          </Button>
        </div>
      </div>

      {/* Summary cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {[
          { label: "Toplam Bütçe",  value: fmt(totalBudget),    icon: DollarSign,    color: "text-indigo-600",                                          bg: "bg-indigo-50"  },
          { label: "Harcanan",      value: fmt(totalUsed),      icon: TrendingUp,    color: "text-amber-600",                                            bg: "bg-amber-50"   },
          { label: "Kalan",         value: fmt(totalRemaining),  icon: TrendingDown,  color: "text-emerald-600",                                          bg: "bg-emerald-50" },
          { label: "Kullanım Oranı",value: `%${overallPct}`,               icon: AlertTriangle, color: overallPct > 80 ? "text-red-600" : "text-gray-600", bg: overallPct > 80 ? "bg-red-50" : "bg-gray-50" },
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
        <div className="card lg:col-span-2">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Aylık Harcama vs Bütçe</h2>
          <ResponsiveContainer width="100%" height={200}>
            <BarChart data={monthlyData} barSize={20}>
              <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
              <XAxis dataKey="ay" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
              <YAxis tick={{ fontSize: 11, fill: "#9ca3af" }} axisLine={false} tickLine={false} tickFormatter={(v) => `${(v / 1000).toFixed(0)}k`} />
              <Tooltip formatter={(v) => [fmt(Number(v))]} />
              <Bar dataKey="butce"   fill="#e0e7ff" radius={[4, 4, 0, 0]} name="Bütçe"   />
              <Bar dataKey="harcama" fill="#4f46e5" radius={[4, 4, 0, 0]} name="Harcama" />
            </BarChart>
          </ResponsiveContainer>
        </div>

        <div className="card">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Kategori Dağılımı</h2>
          <ResponsiveContainer width="100%" height={150}>
            <PieChart>
              <Pie data={categoryData} cx="50%" cy="50%" outerRadius={60} dataKey="value" paddingAngle={3}>
                {categoryData.map((_, i) => <Cell key={i} fill={PIE_COLORS[i % PIE_COLORS.length]} />)}
              </Pie>
              <Tooltip formatter={(v) => [fmt(Number(v))]} />
            </PieChart>
          </ResponsiveContainer>
          <div className="space-y-1.5 mt-2">
            {categoryData.map((d, i) => (
              <div key={d.name} className="flex items-center justify-between text-xs">
                <div className="flex items-center gap-1.5">
                  <div className="w-2 h-2 rounded-full" style={{ background: PIE_COLORS[i] }} />
                  <span className="text-gray-600">{d.name}</span>
                </div>
                <span className="font-medium text-gray-900">{fmt(d.value)}</span>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Per project */}
      <div className="card">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">
          Proje Bazında Bütçe
          <span className="ml-2 text-xs font-normal text-gray-400">({getCurrency(selectedCurrency).symbol} {selectedCurrency})</span>
        </h2>
        {filteredProjects.filter((p) => p.budget).length === 0 ? (
          <p className="text-sm text-gray-400 text-center py-6">{selectedCurrency} para biriminde bütçeli proje yok.</p>
        ) : (
          <div className="space-y-4">
            {filteredProjects.filter((p) => p.budget).map((p) => {
              const pUsed = p.budgetUsed ?? 0;
              const pct   = Math.round((pUsed / (p.budget ?? 1)) * 100);
              return (
                <div key={p.id}>
                  <div className="flex items-center justify-between mb-1.5">
                    <div className="flex items-center gap-2">
                      <span className="text-sm font-medium text-gray-900">{p.name}</span>
                      <ProjectStatusBadge status={p.status} />
                      {pct >= 90 && <span className="text-xs bg-red-100 text-red-600 px-1.5 py-0.5 rounded-full flex items-center gap-1"><AlertTriangle className="w-3 h-3" />Risk</span>}
                    </div>
                    <div className="text-xs text-gray-500">
                      {fmt(pUsed)} / {fmt(p.budget ?? 0)}
                      <span className={`ml-2 font-semibold ${pct >= 90 ? "text-red-600" : pct >= 75 ? "text-amber-600" : "text-emerald-600"}`}>%{pct}</span>
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
        )}
      </div>

      {/* Expense list */}
      <div className="card p-0 overflow-hidden">
        <div className="px-5 py-3 border-b border-gray-200 flex items-center justify-between">
          <h2 className="text-sm font-semibold text-gray-700">Giderler ({flatExpenses.length})</h2>
        </div>
        <div className="overflow-x-auto">
        <table className="w-full min-w-[540px]">
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
            {flatExpenses.map((e) => (
              <tr key={e.id} className="hover:bg-gray-50">
                <td className="px-4 py-3 text-sm text-gray-900">{e.description}</td>
                <td className="px-4 py-3 text-sm text-gray-600">{projects.find((p) => p.id === e.projectId)?.name ?? <span className="text-gray-400">—</span>}</td>
                <td className="px-4 py-3">
                  <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">{e.category}</span>
                </td>
                <td className="px-4 py-3 text-sm text-gray-500">{new Date(e.date).toLocaleDateString("tr-TR")}</td>
                <td className="px-4 py-3 text-sm font-semibold text-gray-900 text-right">{fmt(e.amount)}</td>
              </tr>
            ))}
          </tbody>
        </table>
        </div>
      </div>

      {/* ── Excel Import Modal ─────────────────────────────────────────────────── */}
      {showImport && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowImport(false); setImportResult(null); }} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Excel ile Gider Yükle</h2>
              <button onClick={() => { setShowImport(false); setImportResult(null); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            {/* Template info */}
            <div className="bg-indigo-50 rounded-xl p-4 mb-4">
              <p className="text-sm text-indigo-800 font-medium mb-1">Gerekli sütunlar</p>
              <p className="text-xs text-indigo-600 font-mono">{REQUIRED_COLS.join(" · ")}</p>
              <p className="text-xs text-indigo-500 mt-2">Tarih formatı: gg.aa.yyyy veya yyyy-aa-gg · Tutar: sayısal (₺ işareti olmadan)</p>
            </div>

            <button
              onClick={downloadTemplate}
              className="w-full flex items-center justify-center gap-2 border border-dashed border-gray-300 rounded-xl py-3 text-sm text-gray-600 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors mb-4"
            >
              <Download className="w-4 h-4" />
              Örnek şablonu indir (.xlsx)
            </button>

            {/* Drop zone / file picker */}
            <input ref={fileRef} type="file" accept=".xlsx,.xls,.csv" className="hidden" onChange={handleFileChange} />
            <button
              onClick={() => fileRef.current?.click()}
              disabled={importing}
              className="w-full flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-300 rounded-xl py-8 text-sm text-gray-500 hover:border-indigo-400 hover:text-indigo-600 hover:bg-indigo-50 transition-colors disabled:opacity-50 disabled:cursor-not-allowed"
            >
              <Upload className="w-6 h-6" />
              {importing ? "Dosya okunuyor…" : "Dosya seç veya buraya sürükle"}
              <span className="text-xs text-gray-400">.xlsx, .xls, .csv desteklenir</span>
            </button>

            {/* Import result */}
            {importResult && (
              <div className="mt-4 space-y-2">
                {importResult.imported > 0 && (
                  <div className="flex items-center gap-2 text-sm text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
                    <CheckCircle2 className="w-4 h-4 flex-shrink-0" />
                    <span><strong>{importResult.imported}</strong> gider başarıyla yüklendi.</span>
                  </div>
                )}
                {importResult.skipped > 0 && (
                  <div className="flex items-center gap-2 text-sm text-amber-700 bg-amber-50 rounded-lg px-3 py-2">
                    <AlertTriangle className="w-4 h-4 flex-shrink-0" />
                    <span><strong>{importResult.skipped}</strong> satır atlandı.</span>
                  </div>
                )}
                {importResult.errors.map((err, i) => (
                  <div key={i} className="flex items-start gap-2 text-xs text-red-600 bg-red-50 rounded-lg px-3 py-2">
                    <AlertCircleIcon className="w-3.5 h-3.5 flex-shrink-0 mt-0.5" />
                    <span>{err}</span>
                  </div>
                ))}
              </div>
            )}

            <div className="flex gap-3 mt-5">
              <Button variant="outline" className="flex-1" onClick={() => { setShowImport(false); setImportResult(null); }}>Kapat</Button>
            </div>
          </div>
        </div>
      )}

      {/* ── Add single expense modal ───────────────────────────────────────────── */}
      {showAddExpense && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowAddExpense(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-md p-6">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">Yeni Gider</h2>
              <button onClick={() => setShowAddExpense(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Açıklama</label>
                <input
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Gider açıklaması..."
                  value={form.description}
                  onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                />
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Proje</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.projectId}
                    onChange={(e) => setForm((f) => ({ ...f, projectId: e.target.value }))}
                  >
                    {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                  </select>
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Kategori</label>
                  <select
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.category}
                    onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                  >
                    {EXPENSE_CATEGORIES.map((c) => <option key={c}>{c}</option>)}
                  </select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Tutar (₺)</label>
                  <input
                    type="number"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    placeholder="0"
                    value={form.amount}
                    onChange={(e) => setForm((f) => ({ ...f, amount: e.target.value }))}
                  />
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Tarih</label>
                  <input
                    type="date"
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    value={form.date}
                    onChange={(e) => setForm((f) => ({ ...f, date: e.target.value }))}
                  />
                </div>
              </div>
              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => setShowAddExpense(false)}>İptal</Button>
                <Button className="flex-1" onClick={handleAddExpense}>Gider Ekle</Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
