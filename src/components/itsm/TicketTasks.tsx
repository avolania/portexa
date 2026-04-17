"use client";

import { useState } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import type { ItsmTask, ItsmTaskPriority, ItsmTaskStatus } from "@/types";
import { cn } from "@/lib/utils";
import { format } from "date-fns";
import { tr } from "date-fns/locale";
import { CheckCircle2, Circle, Clock, Plus, Trash2, ChevronDown } from "lucide-react";

// ─── Sabitler ────────────────────────────────────────────────────────────────

const PRIORITY_MAP: Record<ItsmTaskPriority, { label: string; badge: string }> = {
  high:   { label: "Yüksek", badge: "bg-red-100 text-red-700"    },
  medium: { label: "Orta",   badge: "bg-amber-100 text-amber-700" },
  low:    { label: "Düşük",  badge: "bg-gray-100 text-gray-600"  },
};

const STATUS_MAP: Record<ItsmTaskStatus, { label: string; icon: React.ReactNode; badge: string }> = {
  open:        { label: "Açık",       icon: <Circle className="w-4 h-4 text-gray-400" />,         badge: "bg-gray-100 text-gray-600"    },
  in_progress: { label: "Devam Ediyor", icon: <Clock className="w-4 h-4 text-amber-500" />,       badge: "bg-amber-100 text-amber-700"  },
  done:        { label: "Tamamlandı", icon: <CheckCircle2 className="w-4 h-4 text-emerald-500" />, badge: "bg-emerald-100 text-emerald-700" },
};

const STATUS_CYCLE: Record<ItsmTaskStatus, ItsmTaskStatus> = {
  open: "in_progress",
  in_progress: "done",
  done: "open",
};

// ─── Props ────────────────────────────────────────────────────────────────────

interface TicketTasksProps {
  tasks: ItsmTask[];
  onAdd: (task: ItsmTask) => Promise<void>;
  onUpdate: (taskId: string, patch: Partial<ItsmTask>) => Promise<void>;
  onDelete: (taskId: string) => Promise<void>;
  readonly?: boolean;
}

// ─── Form boş state ───────────────────────────────────────────────────────────

const EMPTY_FORM = {
  title: "",
  description: "",
  assignedUnit: "",
  assignedUserId: "",
  assignedUserName: "",
  dueDate: "",
  priority: "medium" as ItsmTaskPriority,
};

// ─── Component ────────────────────────────────────────────────────────────────

export default function TicketTasks({ tasks, onAdd, onUpdate, onDelete, readonly }: TicketTasksProps) {
  const { user, profiles } = useAuthStore();
  const [showForm, setShowForm] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  const [deletingId, setDeletingId] = useState<string | null>(null);
  const [filterStatus, setFilterStatus] = useState<ItsmTaskStatus | "all">("all");

  // Birim listesi: profiles'daki benzersiz department değerleri
  const units = Array.from(
    new Set(Object.values(profiles).map((p) => p.department).filter(Boolean))
  ) as string[];

  // Profil listesi — atama için
  const profileList = Object.values(profiles);

  const filtered = filterStatus === "all" ? tasks : tasks.filter((t) => t.status === filterStatus);

  const counts = {
    open:        tasks.filter((t) => t.status === "open").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    done:        tasks.filter((t) => t.status === "done").length,
  };

  const handleAdd = async () => {
    if (!form.title.trim() || !form.assignedUnit || !user) return;
    setSaving(true);
    try {
      const task: ItsmTask = {
        id: crypto.randomUUID(),
        title: form.title.trim(),
        description: form.description.trim() || undefined,
        assignedUnit: form.assignedUnit,
        assignedUserId: form.assignedUserId || undefined,
        assignedUserName: form.assignedUserName || undefined,
        dueDate: form.dueDate || undefined,
        priority: form.priority,
        status: "open",
        createdAt: new Date().toISOString(),
        createdBy: user.id,
        createdByName: user.name,
      };
      await onAdd(task);
      setForm(EMPTY_FORM);
      setShowForm(false);
    } finally {
      setSaving(false);
    }
  };

  const handleDelete = async (taskId: string) => {
    setDeletingId(taskId);
    try { await onDelete(taskId); }
    finally { setDeletingId(null); }
  };

  const cycleStatus = async (task: ItsmTask) => {
    await onUpdate(task.id, { status: STATUS_CYCLE[task.status] });
  };

  return (
    <div className="space-y-4">
      {/* Üst bar: istatistikler + filtre */}
      <div className="flex items-center gap-3 flex-wrap">
        {(["all", "open", "in_progress", "done"] as const).map((s) => {
          const count = s === "all" ? tasks.length : counts[s];
          const active = filterStatus === s;
          const label  = s === "all" ? "Tümü" : STATUS_MAP[s].label;
          return (
            <button key={s} onClick={() => setFilterStatus(s)}
              className={cn(
                "px-3 py-1.5 rounded-full text-xs font-medium transition-colors border",
                active
                  ? "bg-indigo-600 text-white border-indigo-600"
                  : "bg-white text-gray-600 border-gray-200 hover:border-indigo-300 hover:text-indigo-600"
              )}>
              {label}
              <span className={cn("ml-1.5 font-bold", active ? "text-indigo-100" : "text-gray-400")}>{count}</span>
            </button>
          );
        })}
        {!readonly && (
          <button onClick={() => setShowForm((p) => !p)}
            className="ml-auto flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium bg-indigo-600 text-white hover:bg-indigo-700 transition-colors">
            <Plus className="w-4 h-4" />
            Görev Ekle
          </button>
        )}
      </div>

      {/* Yeni görev formu */}
      {showForm && (
        <div className="card border-indigo-200 bg-indigo-50/30 space-y-3">
          <h4 className="text-sm font-semibold text-gray-800">Yeni Görev</h4>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Başlık <span className="text-red-500">*</span></label>
            <input className="input w-full text-sm" placeholder="Görev başlığı..."
              value={form.title} onChange={(e) => setForm((p) => ({ ...p, title: e.target.value }))} />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1">Açıklama</label>
            <textarea className="input w-full text-sm min-h-[60px] resize-none" placeholder="İsteğe bağlı..."
              value={form.description} onChange={(e) => setForm((p) => ({ ...p, description: e.target.value }))} />
          </div>

          <div className="grid grid-cols-2 gap-3">
            {/* Birim */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Atanacak Birim <span className="text-red-500">*</span></label>
              <div className="relative">
                <select className="input w-full text-sm appearance-none pr-8"
                  value={form.assignedUnit}
                  onChange={(e) => setForm((p) => ({ ...p, assignedUnit: e.target.value, assignedUserId: "", assignedUserName: "" }))}>
                  <option value="">Birim seçin...</option>
                  {units.length > 0
                    ? units.map((u) => <option key={u} value={u}>{u}</option>)
                    : (
                      <>
                        <option value="IT">IT</option>
                        <option value="Yazılım">Yazılım</option>
                        <option value="Altyapı">Altyapı</option>
                        <option value="Güvenlik">Güvenlik</option>
                        <option value="Finans">Finans</option>
                        <option value="HR">HR</option>
                        <option value="Operasyon">Operasyon</option>
                        <option value="Satış">Satış</option>
                        <option value="Destek">Destek</option>
                      </>
                    )
                  }
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Kişi */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Atanacak Kişi</label>
              <div className="relative">
                <select className="input w-full text-sm appearance-none pr-8"
                  value={form.assignedUserId}
                  onChange={(e) => {
                    const p = profileList.find((x) => x.id === e.target.value);
                    setForm((prev) => ({ ...prev, assignedUserId: e.target.value, assignedUserName: p?.name ?? "" }));
                  }}>
                  <option value="">Kişi seçin...</option>
                  {profileList
                    .filter((p) => !form.assignedUnit || p.department === form.assignedUnit)
                    .map((p) => <option key={p.id} value={p.id}>{p.name}</option>)
                  }
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Öncelik */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Öncelik</label>
              <div className="relative">
                <select className="input w-full text-sm appearance-none pr-8"
                  value={form.priority}
                  onChange={(e) => setForm((p) => ({ ...p, priority: e.target.value as ItsmTaskPriority }))}>
                  <option value="high">Yüksek</option>
                  <option value="medium">Orta</option>
                  <option value="low">Düşük</option>
                </select>
                <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400 pointer-events-none" />
              </div>
            </div>

            {/* Termin */}
            <div>
              <label className="block text-xs font-medium text-gray-600 mb-1">Termin Tarihi</label>
              <input type="date" className="input w-full text-sm"
                value={form.dueDate} onChange={(e) => setForm((p) => ({ ...p, dueDate: e.target.value }))} />
            </div>
          </div>

          <div className="flex justify-end gap-2">
            <button onClick={() => { setShowForm(false); setForm(EMPTY_FORM); }}
              className="btn-secondary text-sm">İptal</button>
            <button onClick={handleAdd}
              disabled={saving || !form.title.trim() || !form.assignedUnit}
              className="btn-primary text-sm disabled:opacity-50">
              {saving ? "Kaydediliyor..." : "Görevi Ekle"}
            </button>
          </div>
        </div>
      )}

      {/* Görev listesi */}
      {filtered.length === 0 ? (
        <div className="py-10 text-center text-gray-400 text-sm border border-dashed border-gray-200 rounded-xl">
          {tasks.length === 0 ? "Henüz görev yok. Yeni bir görev ekleyin." : "Bu filtreye uygun görev bulunamadı."}
        </div>
      ) : (
        <div className="space-y-2">
          {filtered.map((task) => {
            const prio   = PRIORITY_MAP[task.priority];
            const status = STATUS_MAP[task.status];
            const overdue = task.dueDate && task.status !== "done" && new Date(task.dueDate) < new Date();
            return (
              <div key={task.id}
                className={cn(
                  "card group flex items-start gap-3 transition-all",
                  task.status === "done" && "opacity-60"
                )}>
                {/* Durum ikonu — tıklanabilir */}
                {!readonly && (
                  <button onClick={() => cycleStatus(task)} title="Durumu değiştir"
                    className="mt-0.5 flex-shrink-0 hover:scale-110 transition-transform">
                    {status.icon}
                  </button>
                )}
                {readonly && <div className="mt-0.5 flex-shrink-0">{status.icon}</div>}

                {/* İçerik */}
                <div className="flex-1 min-w-0">
                  <div className="flex items-start gap-2 flex-wrap">
                    <span className={cn("text-sm font-medium text-gray-900", task.status === "done" && "line-through text-gray-400")}>
                      {task.title}
                    </span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", prio.badge)}>{prio.label}</span>
                    <span className={cn("px-1.5 py-0.5 rounded text-xs font-medium", status.badge)}>{status.label}</span>
                  </div>

                  {task.description && (
                    <p className="text-xs text-gray-500 mt-0.5 leading-relaxed">{task.description}</p>
                  )}

                  <div className="flex items-center gap-3 mt-1.5 flex-wrap">
                    <span className="text-xs text-gray-500 font-medium">📌 {task.assignedUnit}</span>
                    {task.assignedUserName && (
                      <span className="text-xs text-gray-400">→ {task.assignedUserName}</span>
                    )}
                    {task.dueDate && (
                      <span className={cn("text-xs flex items-center gap-1", overdue ? "text-red-600 font-medium" : "text-gray-400")}>
                        <Clock className="w-3 h-3" />
                        {overdue ? "⚠ " : ""}
                        {format(new Date(task.dueDate), "dd MMM yyyy", { locale: tr })}
                      </span>
                    )}
                    <span className="text-xs text-gray-300">· {task.createdByName}</span>
                  </div>
                </div>

                {/* Sil butonu */}
                {!readonly && (
                  <button
                    onClick={() => handleDelete(task.id)}
                    disabled={deletingId === task.id}
                    title="Görevi sil"
                    className="flex-shrink-0 p-1 rounded text-gray-200 hover:text-red-500 hover:bg-red-50 opacity-0 group-hover:opacity-100 transition-all disabled:opacity-50">
                    <Trash2 className="w-3.5 h-3.5" />
                  </button>
                )}
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
