"use client";

import { useState, useEffect, useRef } from "react";
import { Play, Pause, Square, Clock, Check, ChevronLeft, ChevronRight } from "lucide-react";
import { useProjectStore } from "@/store/useProjectStore";
import Button from "@/components/ui/Button";
import { cn } from "@/lib/utils";

const DAYS = ["Pzt", "Sal", "Çar", "Per", "Cum", "Cmt", "Paz"];

const PROJECTS: Record<string, string> = {
  "1": "E-Ticaret Platformu",
  "2": "Mobil Uygulama Redesign",
  "3": "CRM Entegrasyonu",
};

type TimesheetRow = {
  id: string;
  projectId: string;
  taskName: string;
  hours: Record<number, string>; // day index -> hours string
};

const initialRows: TimesheetRow[] = [
  { id: "r1", projectId: "1", taskName: "Ana sayfa tasarımı", hours: { 0: "2", 1: "3", 2: "1", 3: "", 4: "", 5: "", 6: "" } },
  { id: "r2", projectId: "1", taskName: "Kullanıcı auth API", hours: { 0: "3", 1: "2", 2: "", 3: "4", 4: "2", 5: "", 6: "" } },
  { id: "r3", projectId: "2", taskName: "UI komponent kütüphanesi", hours: { 0: "", 1: "", 2: "4", 3: "3", 4: "2", 5: "", 6: "" } },
];

function formatTime(seconds: number) {
  const h = Math.floor(seconds / 3600).toString().padStart(2, "0");
  const m = Math.floor((seconds % 3600) / 60).toString().padStart(2, "0");
  const s = (seconds % 60).toString().padStart(2, "0");
  return `${h}:${m}:${s}`;
}

export default function ZamanTakibiPage() {
  const { projects } = useProjectStore();
  const [rows, setRows] = useState<TimesheetRow[]>(initialRows);
  const [running, setRunning] = useState(false);
  const [elapsed, setElapsed] = useState(0);
  const [timerTask, setTimerTask] = useState("");
  const [timerProject, setTimerProject] = useState("1");
  const intervalRef = useRef<ReturnType<typeof setInterval> | null>(null);
  const [weekOffset, setWeekOffset] = useState(0);

  // Timer
  useEffect(() => {
    if (running) {
      intervalRef.current = setInterval(() => setElapsed((e) => e + 1), 1000);
    } else {
      if (intervalRef.current) clearInterval(intervalRef.current);
    }
    return () => { if (intervalRef.current) clearInterval(intervalRef.current); };
  }, [running]);

  const handleStop = () => {
    setRunning(false);
    if (elapsed > 0 && timerTask) {
      const hours = (elapsed / 3600).toFixed(1);
      setRows((prev) => [...prev, {
        id: crypto.randomUUID(),
        projectId: timerProject,
        taskName: timerTask,
        hours: { 0: hours, 1: "", 2: "", 3: "", 4: "", 5: "", 6: "" },
      }]);
    }
    setElapsed(0);
    setTimerTask("");
  };

  const updateHours = (rowId: string, dayIdx: number, value: string) => {
    setRows((prev) => prev.map((r) =>
      r.id === rowId ? { ...r, hours: { ...r.hours, [dayIdx]: value } } : r
    ));
  };

  const addRow = () => {
    setRows((prev) => [...prev, {
      id: crypto.randomUUID(),
      projectId: "1",
      taskName: "",
      hours: {},
    }]);
  };

  const getDayTotal = (dayIdx: number) =>
    rows.reduce((sum, r) => sum + parseFloat(r.hours[dayIdx] || "0"), 0);

  const getRowTotal = (row: TimesheetRow) =>
    Object.values(row.hours).reduce((sum, v) => sum + parseFloat(v || "0"), 0);

  const weekTotal = rows.reduce((sum, r) => sum + getRowTotal(r), 0);

  // Week label
  const now = new Date();
  const weekStart = new Date(now);
  weekStart.setDate(now.getDate() - now.getDay() + 1 + weekOffset * 7);
  const weekEnd = new Date(weekStart);
  weekEnd.setDate(weekStart.getDate() + 6);
  const weekLabel = `${weekStart.toLocaleDateString("tr-TR", { day: "numeric", month: "short" })} – ${weekEnd.toLocaleDateString("tr-TR", { day: "numeric", month: "short", year: "numeric" })}`;

  return (
    <div className="max-w-6xl mx-auto space-y-6">
      <div>
        <h1 className="text-2xl font-bold text-gray-900">Zaman Takibi</h1>
        <p className="text-sm text-gray-500 mt-1">Çalışılan süreleri kaydedin ve takip edin.</p>
      </div>

      {/* Timer */}
      <div className="card border-indigo-200 bg-indigo-50">
        <div className="flex flex-col sm:flex-row items-start sm:items-center gap-4">
          <div className="flex-1 space-y-3 w-full">
            <div className="flex gap-3">
              <input
                type="text"
                placeholder="Ne üzerinde çalışıyorsunuz?"
                value={timerTask}
                onChange={(e) => setTimerTask(e.target.value)}
                className="flex-1 text-sm border border-indigo-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              />
              <select
                value={timerProject}
                onChange={(e) => setTimerProject(e.target.value)}
                className="text-sm border border-indigo-200 bg-white rounded-lg px-3 py-2 focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
              </select>
            </div>
          </div>

          <div className="flex items-center gap-3 flex-shrink-0">
            <span className="text-2xl font-mono font-bold text-indigo-900 w-28 text-center">
              {formatTime(elapsed)}
            </span>
            {!running ? (
              <button
                onClick={() => setRunning(true)}
                disabled={!timerTask}
                className="w-10 h-10 bg-indigo-600 text-white rounded-full flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors"
              >
                <Play className="w-4 h-4 ml-0.5" />
              </button>
            ) : (
              <button
                onClick={() => setRunning(false)}
                className="w-10 h-10 bg-amber-500 text-white rounded-full flex items-center justify-center hover:bg-amber-600 transition-colors"
              >
                <Pause className="w-4 h-4" />
              </button>
            )}
            {elapsed > 0 && (
              <button
                onClick={handleStop}
                className="w-10 h-10 bg-red-500 text-white rounded-full flex items-center justify-center hover:bg-red-600 transition-colors"
              >
                <Square className="w-4 h-4" />
              </button>
            )}
          </div>
        </div>
      </div>

      {/* Timesheet */}
      <div className="card p-0 overflow-hidden">
        {/* Week navigator */}
        <div className="flex items-center justify-between px-5 py-3 border-b border-gray-200">
          <button onClick={() => setWeekOffset((o) => o - 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronLeft className="w-4 h-4" />
          </button>
          <div className="text-sm font-semibold text-gray-700">{weekLabel}</div>
          <button onClick={() => setWeekOffset((o) => o + 1)} className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-500">
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>

        <div className="overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="text-left px-4 py-2.5 text-xs font-semibold text-gray-500 min-w-48">Proje / Görev</th>
                {DAYS.map((d, i) => (
                  <th key={d} className={cn(
                    "text-center px-2 py-2.5 text-xs font-semibold w-14",
                    i >= 5 ? "text-gray-400" : "text-gray-500"
                  )}>
                    {d}
                  </th>
                ))}
                <th className="text-center px-3 py-2.5 text-xs font-semibold text-gray-500 w-14">Toplam</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-gray-100">
              {rows.map((row) => (
                <tr key={row.id} className="hover:bg-gray-50">
                  <td className="px-4 py-2">
                    <div className="text-xs text-indigo-600 font-medium mb-0.5">{PROJECTS[row.projectId] ?? row.projectId}</div>
                    <input
                      type="text"
                      value={row.taskName}
                      onChange={(e) => setRows((prev) => prev.map((r) => r.id === row.id ? { ...r, taskName: e.target.value } : r))}
                      placeholder="Görev adı..."
                      className="text-sm text-gray-700 w-full bg-transparent focus:outline-none focus:text-indigo-700 placeholder:text-gray-300"
                    />
                  </td>
                  {DAYS.map((_, i) => (
                    <td key={i} className={cn("px-2 py-2 text-center", i >= 5 && "bg-gray-50/50")}>
                      <input
                        type="number"
                        min="0"
                        max="24"
                        step="0.5"
                        value={row.hours[i] ?? ""}
                        onChange={(e) => updateHours(row.id, i, e.target.value)}
                        placeholder="—"
                        className="w-12 text-center text-sm rounded-md border-0 bg-transparent focus:bg-indigo-50 focus:outline-none focus:ring-1 focus:ring-indigo-400 px-1 py-1 placeholder:text-gray-300"
                      />
                    </td>
                  ))}
                  <td className="px-3 py-2 text-center">
                    <span className={cn(
                      "text-sm font-semibold",
                      getRowTotal(row) > 0 ? "text-indigo-700" : "text-gray-300"
                    )}>
                      {getRowTotal(row) > 0 ? getRowTotal(row).toFixed(1) : "—"}
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
            <tfoot className="bg-gray-50 border-t border-gray-200">
              <tr>
                <td className="px-4 py-2.5 text-xs font-semibold text-gray-600">Günlük Toplam</td>
                {DAYS.map((_, i) => (
                  <td key={i} className={cn("text-center px-2 py-2.5", i >= 5 && "bg-gray-100/50")}>
                    <span className={cn(
                      "text-sm font-bold",
                      getDayTotal(i) > 8 ? "text-red-600" :
                      getDayTotal(i) > 0 ? "text-gray-900" : "text-gray-300"
                    )}>
                      {getDayTotal(i) > 0 ? getDayTotal(i).toFixed(1) : "—"}
                    </span>
                  </td>
                ))}
                <td className="text-center px-3 py-2.5">
                  <span className="text-sm font-bold text-indigo-700">{weekTotal.toFixed(1)}</span>
                </td>
              </tr>
            </tfoot>
          </table>
        </div>

        <div className="flex items-center justify-between px-5 py-3 border-t border-gray-200">
          <button onClick={addRow} className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
            + Satır ekle
          </button>
          <div className="flex gap-3">
            <Button variant="secondary" size="sm">Taslak Kaydet</Button>
            <Button size="sm">
              <Check className="w-4 h-4" />
              Gönder & Onay İste
            </Button>
          </div>
        </div>
      </div>

      {/* Summary */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Bu Hafta", value: `${weekTotal.toFixed(1)}s`, color: "text-indigo-700" },
          { label: "Bu Ay", value: "142.5s", color: "text-gray-900" },
          { label: "Onaylanan", value: "98.0s", color: "text-emerald-700" },
          { label: "Onay Bekleyen", value: "44.5s", color: "text-amber-700" },
        ].map((s) => (
          <div key={s.label} className="card py-3">
            <div className="text-xs text-gray-500 mb-1">{s.label}</div>
            <div className={`text-2xl font-bold ${s.color}`}>{s.value}</div>
          </div>
        ))}
      </div>
    </div>
  );
}
