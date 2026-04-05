"use client";

import { useState, useRef } from "react";
import { Plus, X, FileText, Users, AlertTriangle, GitBranch, Bug, CheckCircle2, Download, Upload, Check, LayoutTemplate, UserPlus } from "lucide-react";
import * as XLSX from "xlsx";
import { useGovernanceStore, GOVERNANCE_STATUS_META } from "@/store/useGovernanceStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useAuthStore } from "@/store/useAuthStore";
import { exportGovernance, getGovernanceTemplate } from "@/lib/exportExcel";
import type { GovernanceCategory, GovernanceItem, GovernanceStatus, Priority, Attachment } from "@/types";
import Button from "@/components/ui/Button";
import AttachmentSection from "@/components/ui/AttachmentSection";
import Avatar from "@/components/ui/Avatar";

const TABS: { id: GovernanceCategory; label: string; icon: React.ElementType }[] = [
  { id: "charter",  label: "Tüzük",        icon: FileText },
  { id: "meeting",  label: "Toplantılar",   icon: Users },
  { id: "risk",     label: "Riskler",       icon: AlertTriangle },
  { id: "change",   label: "Değişiklikler", icon: GitBranch },
  { id: "issue",    label: "Sorunlar",      icon: Bug },
  { id: "decision", label: "Kararlar",      icon: CheckCircle2 },
];

const PRIORITY_META: Record<Priority, { label: string; color: string }> = {
  low:      { label: "Düşük",    color: "text-gray-500" },
  medium:   { label: "Orta",     color: "text-amber-600" },
  high:     { label: "Yüksek",   color: "text-orange-600" },
  critical: { label: "Kritik",   color: "text-red-600" },
};

const IMPACT_LABELS: Record<string, string> = { low: "Düşük", medium: "Orta", high: "Yüksek" };

// ─── Toplantı şablonları ──────────────────────────────────────────────────────

interface MeetingTemplate {
  id: string;
  label: string;
  icon: string;
  description: string;
  title: string;
  defaultDescription: string;
  cadence: string; // gösterim için
}

const MEETING_TEMPLATES: MeetingTemplate[] = [
  {
    id: "steerco",
    label: "Aylık Steerco",
    icon: "🎯",
    description: "Üst yönetim ile aylık durum toplantısı",
    title: "Aylık Steerco Toplantısı",
    defaultDescription: "Proje durumu, bütçe kullanımı, risk ve sorunların üst yönetimle değerlendirilmesi.",
    cadence: "Aylık",
  },
  {
    id: "weekly_team",
    label: "Haftalık Ekip",
    icon: "👥",
    description: "Proje ekibinin haftalık durum güncellemesi",
    title: "Haftalık Ekip Toplantısı",
    defaultDescription: "Haftalık ilerleme güncellemesi, görev durumları ve engellerin konuşulması.",
    cadence: "Haftalık",
  },
  {
    id: "sprint_planning",
    label: "Sprint Planlama",
    icon: "🗓️",
    description: "Sprint başlangıcında backlog planlama",
    title: "Sprint Planlama Toplantısı",
    defaultDescription: "Bir sonraki sprint için görevlerin planlanması, efor tahminleri ve kabul kriterlerinin belirlenmesi.",
    cadence: "Sprint başı",
  },
  {
    id: "sprint_review",
    label: "Sprint Review",
    icon: "✅",
    description: "Sprint sonu demo ve retrospektif",
    title: "Sprint Review & Retrospektif",
    defaultDescription: "Tamamlanan işlerin demo edilmesi, takım geri bildirimleri ve iyileştirme aksiyonlarının belirlenmesi.",
    cadence: "Sprint sonu",
  },
  {
    id: "kickoff",
    label: "Proje Kickoff",
    icon: "🚀",
    description: "Proje başlangıç toplantısı",
    title: "Proje Kickoff Toplantısı",
    defaultDescription: "Proje kapsamı, paydaşlar, zaman çizelgesi ve sorumlulukların tanıtılması.",
    cadence: "Tek seferlik",
  },
  {
    id: "integration",
    label: "Entegrasyon",
    icon: "🔗",
    description: "Sistem entegrasyon değerlendirme toplantısı",
    title: "Entegrasyon Değerlendirme Toplantısı",
    defaultDescription: "Entegrasyon noktalarının incelenmesi, teknik sorunlar ve çözüm önerilerinin tartışılması.",
    cadence: "Gerektiğinde",
  },
  {
    id: "risk_review",
    label: "Risk Gözden Geçirme",
    icon: "⚠️",
    description: "Periyodik risk ve sorun değerlendirmesi",
    title: "Risk Gözden Geçirme Toplantısı",
    defaultDescription: "Açık risklerin durumu, yeni risklerin değerlendirilmesi ve azaltma planlarının güncellenmesi.",
    cadence: "İki haftada bir",
  },
  {
    id: "steering",
    label: "Proje Komitesi",
    icon: "🏛️",
    description: "Karar alma komitesi toplantısı",
    title: "Proje Komitesi Toplantısı",
    defaultDescription: "Kritik kararların alınması, kapsam değişikliklerinin onaylanması ve bütçe revizyonları.",
    cadence: "Aylık",
  },
];

interface Props {
  projectId: string;
}

const EMPTY_FORM = {
  title: "",
  description: "",
  owner: "",
  dueDate: "",
  meetingDateOnly: "",         // yyyy-MM-dd
  meetingHour: "09",
  meetingMinute: "00",
  attendees: [] as string[],
  externalAttendee: "",
  recurrence: "none" as "none" | "daily" | "weekly" | "monthly",
  recurrenceInterval: "1",
  recurrenceWeekdays: [] as number[],  // 1=Pzt 2=Sal 3=Çar 4=Per 5=Cum 6=Cmt 0=Paz
  recurrenceMonthDay: "",              // boşsa başlangıç gününü kullan
  recurrenceEndType: "count" as "count" | "date" | "noend",
  recurrenceCount: "10",
  recurrenceEndDate: "",
  priority: "" as Priority | "",
  impact: "" as "low" | "medium" | "high" | "",
  probability: "" as "low" | "medium" | "high" | "",
  mitigationPlan: "",
  requestedBy: "",
  impactAssessment: "",
  decidedBy: "",
  rationale: "",
};

const HOUR_OPTIONS = Array.from({ length: 24 }, (_, i) => String(i).padStart(2, "0"));
const MINUTE_OPTIONS = ["00", "15", "30", "45"];

export default function GovernancePanel({ projectId }: Props) {
  const [activeTab, setActiveTab] = useState<GovernanceCategory>("charter");
  const [showTemplates, setShowTemplates] = useState(false);
  const [showAdd, setShowAdd] = useState(false);
  const [form, setForm] = useState(EMPTY_FORM);
  const [selectedItem, setSelectedItem] = useState<GovernanceItem | null>(null);
  const [importResult, setImportResult] = useState<{ success: number; errors: string[] } | null>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { getProjectItems, addItem, updateItem } = useGovernanceStore();
  const { projects } = useProjectStore();
  const { members: teamMembers } = useTeamStore();
  const profiles = useAuthStore((s) => s.profiles);
  const project = projects.find((p) => p.id === projectId);
  const projectName = project?.name ?? "Proje";

  // Projedeki ekip üyeleri — teamStore + profiles birleştir
  const projectMemberIds = project?.members ?? [];
  const projectTeam = projectMemberIds.map((id) => {
    const tm = teamMembers.find((m) => m.id === id);
    if (tm) return { id: tm.id, name: tm.name };
    const prof = Object.values(profiles).find((p) => p.id === id);
    if (prof) return { id: prof.id, name: prof.name };
    return null;
  }).filter(Boolean) as { id: string; name: string }[];

  function handleExport() {
    const allItems = getProjectItems(projectId);
    exportGovernance(projectName, allItems);
  }

  function handleTemplate() {
    getGovernanceTemplate(projectName);
  }

  function handleFileUpload(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setImportResult(null);

    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const wb = XLSX.read(ev.target?.result, { type: "array" });
        const ws = wb.Sheets[wb.SheetNames[0]];
        const rows = XLSX.utils.sheet_to_json<Record<string, string>>(ws, { defval: "" });

        let success = 0;
        const errors: string[] = [];

        rows.forEach((row, i) => {
          const title = String(row.title ?? "").trim();
          if (!title) { errors.push(`Satır ${i + 2}: "title" boş`); return; }
          const category = (row.category as GovernanceCategory) || "issue";
          const validCategories: GovernanceCategory[] = ["charter", "meeting", "risk", "change", "issue", "decision"];
          if (!validCategories.includes(category)) { errors.push(`Satır ${i + 2}: geçersiz kategori "${row.category}"`); return; }

          addItem({
            id: crypto.randomUUID(),
            projectId,
            category,
            title,
            description: row.description || undefined,
            status: (row.status as GovernanceStatus) || (category === "risk" ? "open" : category === "meeting" ? "scheduled" : "draft"),
            priority: (row.priority as GovernanceItem["priority"]) || undefined,
            owner: row.owner || undefined,
            dueDate: row.dueDate || undefined,
            impact: (row.impact as GovernanceItem["impact"]) || undefined,
            probability: (row.probability as GovernanceItem["probability"]) || undefined,
            mitigationPlan: row.mitigationPlan || undefined,
            requestedBy: row.requestedBy || undefined,
            impactAssessment: row.impactAssessment || undefined,
            meetingDate: row.meetingDate || undefined,
            attendees: row.attendees ? String(row.attendees).split(",").map((s) => s.trim()).filter(Boolean) : undefined,
            minutes: row.minutes || undefined,
            decidedBy: row.decidedBy || undefined,
            rationale: row.rationale || undefined,
            createdAt: new Date().toISOString(),
          });
          success++;
        });

        setImportResult({ success, errors });
      } catch {
        setImportResult({ success: 0, errors: ["Dosya okunamadı. Geçerli bir Excel dosyası yükleyin."] });
      } finally {
        e.target.value = "";
      }
    };
    reader.readAsArrayBuffer(file);
  }

  const items = getProjectItems(projectId, activeTab);

  const setField = (key: keyof typeof EMPTY_FORM, value: string) =>
    setForm((f) => ({ ...f, [key]: value }));

  const toggleAttendee = (name: string) =>
    setForm((f) => ({
      ...f,
      attendees: f.attendees.includes(name)
        ? f.attendees.filter((a) => a !== name)
        : [...f.attendees, name],
    }));

  const applyTemplate = (tpl: MeetingTemplate) => {
    setForm((f) => ({
      ...f,
      title: tpl.title,
      description: tpl.defaultDescription,
    }));
    setShowTemplates(false);
    setShowAdd(true);
  };

  const addExternalAttendee = () => {
    const name = form.externalAttendee.trim();
    if (!name || form.attendees.includes(name)) return;
    setForm((f) => ({ ...f, attendees: [...f.attendees, name], externalAttendee: "" }));
  };

  const toggleWeekday = (day: number) =>
    setForm((f) => ({
      ...f,
      recurrenceWeekdays: f.recurrenceWeekdays.includes(day)
        ? f.recurrenceWeekdays.filter((d) => d !== day)
        : [...f.recurrenceWeekdays, day],
    }));

  function buildMeetingDate(dateOnly: string, hour: string, minute: string): string | undefined {
    if (!dateOnly) return undefined;
    return `${dateOnly}T${hour}:${minute}`;
  }

  function generateRecurringDates(
    startDateOnly: string,
    recurrence: string,
    interval: number,
    weekdays: number[],
    monthDay: string,
    endType: string,
    count: string,
    endDate: string,
  ): string[] {
    if (recurrence === "none") return [startDateOnly];

    const results: string[] = [];
    const start = new Date(startDateOnly + "T00:00:00");
    const maxCount = endType === "count" ? Math.min(parseInt(count) || 10, 104) : 104;
    const maxEnd = endType === "date" && endDate ? new Date(endDate + "T23:59:59") : null;

    const push = (d: Date): boolean => {
      if (maxEnd && d > maxEnd) return false;
      if (results.length >= maxCount) return false;
      results.push(d.toISOString().slice(0, 10));
      return true;
    };

    if (recurrence === "daily") {
      const cur = new Date(start);
      while (push(new Date(cur))) {
        cur.setDate(cur.getDate() + interval);
      }
    } else if (recurrence === "weekly") {
      // Seçili günler yoksa başlangıç gününü kullan
      const days = weekdays.length > 0 ? [...weekdays].sort((a, b) => a - b) : [start.getDay()];
      // Haftanın Pazartesi'ne git
      const weekCursor = new Date(start);
      const startDow = weekCursor.getDay(); // 0=Sun
      const monday = startDow === 0 ? -6 : 1 - startDow;
      weekCursor.setDate(weekCursor.getDate() + monday);

      outer: for (let w = 0; ; w += interval) {
        for (const dow of days) {
          const d = new Date(weekCursor);
          // dow: 1=Mon...6=Sat, 0=Sun
          const offset = dow === 0 ? 6 : dow - 1; // offset from Monday
          d.setDate(d.getDate() + offset + w * 7);
          if (d < start) continue;
          if (!push(d)) break outer;
        }
      }
    } else if (recurrence === "monthly") {
      const targetDay = monthDay ? parseInt(monthDay) : start.getDate();
      const cur = new Date(start);
      for (let m = 0; results.length < maxCount; m += interval) {
        const d = new Date(start.getFullYear(), start.getMonth() + m, 1);
        const lastDay = new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
        d.setDate(Math.min(targetDay, lastDay));
        if (d < start) { continue; }
        if (!push(d)) break;
      }
    }

    return results;
  }

  function handleAdd() {
    if (!form.title.trim()) return;

    const baseItem = {
      projectId,
      category: activeTab,
      title: form.title.trim(),
      description: form.description || undefined,
      status: (activeTab === "risk" ? "open" : activeTab === "meeting" ? "scheduled" : "draft") as GovernanceStatus,
      owner: form.owner || undefined,
      dueDate: form.dueDate || undefined,
      priority: (form.priority as Priority) || undefined,
      impact: (form.impact as "low" | "medium" | "high") || undefined,
      probability: (form.probability as "low" | "medium" | "high") || undefined,
      mitigationPlan: form.mitigationPlan || undefined,
      requestedBy: form.requestedBy || undefined,
      impactAssessment: form.impactAssessment || undefined,
      attendees: form.attendees.length > 0 ? form.attendees : undefined,
      decidedBy: form.decidedBy || undefined,
      rationale: form.rationale || undefined,
    };

    if (activeTab === "meeting" && form.recurrence !== "none" && form.meetingDateOnly) {
      const dates = generateRecurringDates(
        form.meetingDateOnly,
        form.recurrence,
        Math.max(1, parseInt(form.recurrenceInterval) || 1),
        form.recurrenceWeekdays,
        form.recurrenceMonthDay,
        form.recurrenceEndType,
        form.recurrenceCount,
        form.recurrenceEndDate,
      );
      dates.forEach((d, idx) => {
        addItem({
          ...baseItem,
          id: `g${Date.now()}_${idx}`,
          title: dates.length > 1 ? `${baseItem.title} #${idx + 1}` : baseItem.title,
          meetingDate: buildMeetingDate(d, form.meetingHour, form.meetingMinute),
          createdAt: new Date().toISOString(),
        });
      });
    } else {
      addItem({
        ...baseItem,
        id: `g${Date.now()}`,
        meetingDate: buildMeetingDate(form.meetingDateOnly, form.meetingHour, form.meetingMinute),
        createdAt: new Date().toISOString(),
      });
    }

    setForm(EMPTY_FORM);
    setShowAdd(false);
  }

  return (
    <div className="space-y-4">
      {/* Toolbar */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex gap-1 overflow-x-auto pb-1 flex-1">
        {/* Tab bar rendered below */}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <button
            onClick={handleTemplate}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium border border-gray-300 rounded-lg text-gray-600 hover:bg-gray-50 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            Şablon
          </button>
          <label className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-indigo-50 text-indigo-700 border border-indigo-200 rounded-lg hover:bg-indigo-100 transition-colors cursor-pointer">
            <Upload className="w-3.5 h-3.5" />
            Excel Yükle
            <input
              ref={fileInputRef}
              type="file"
              accept=".xlsx,.xls"
              className="hidden"
              onChange={handleFileUpload}
            />
          </label>
          <button
            onClick={handleExport}
            className="flex items-center gap-1.5 px-3 py-1.5 text-xs font-medium bg-emerald-50 text-emerald-700 border border-emerald-200 rounded-lg hover:bg-emerald-100 transition-colors"
          >
            <Download className="w-3.5 h-3.5" />
            İndir
          </button>
        </div>
      </div>

      {/* Import result */}
      {importResult && (
        <div className="space-y-1.5">
          {importResult.success > 0 && (
            <div className="text-xs text-emerald-700 bg-emerald-50 rounded-lg px-3 py-2">
              ✓ {importResult.success} kayıt başarıyla eklendi.
            </div>
          )}
          {importResult.errors.map((err, i) => (
            <div key={i} className="text-xs text-red-700 bg-red-50 rounded-lg px-3 py-2">⚠ {err}</div>
          ))}
        </div>
      )}

      {/* Tab bar */}
      <div className="flex gap-1 overflow-x-auto pb-1">
        {TABS.map((tab) => {
          const Icon = tab.icon;
          const count = getProjectItems(projectId, tab.id).length;
          return (
            <button
              key={tab.id}
              onClick={() => setActiveTab(tab.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${
                activeTab === tab.id
                  ? "bg-indigo-600 text-white"
                  : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              <Icon className="w-3.5 h-3.5" />
              {tab.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${activeTab === tab.id ? "bg-white/20 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Items list */}
      <div className="space-y-2">
        {items.length === 0 ? (
          <div className="text-center py-10 text-gray-400 text-sm">
            Bu kategoride kayıt bulunmuyor.
          </div>
        ) : (
          items.map((item) => {
            const statusMeta = GOVERNANCE_STATUS_META[item.status];
            return (
              <button
                key={item.id}
                onClick={() => setSelectedItem(item)}
                className="w-full text-left card hover:shadow-md transition-shadow p-4"
              >
                <div className="flex items-start justify-between gap-3">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${statusMeta.bg} ${statusMeta.color}`}>
                        {statusMeta.label}
                      </span>
                      {item.priority && (
                        <span className={`text-xs font-medium ${PRIORITY_META[item.priority].color}`}>
                          {PRIORITY_META[item.priority].label}
                        </span>
                      )}
                      {item.impact && (
                        <span className="text-xs text-gray-500">
                          Etki: <strong>{IMPACT_LABELS[item.impact]}</strong>
                        </span>
                      )}
                    </div>
                    <div className="text-sm font-semibold text-gray-900 truncate">{item.title}</div>
                    {item.description && (
                      <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{item.description}</p>
                    )}
                  </div>
                  <div className="text-right shrink-0">
                    {item.owner && <div className="text-xs text-gray-500">{item.owner}</div>}
                    <div className="text-xs text-gray-400 mt-0.5">
                      {new Date(item.createdAt).toLocaleDateString("tr-TR")}
                    </div>
                    {item.dueDate && (
                      <div className="text-xs text-amber-600 mt-0.5">
                        Son: {new Date(item.dueDate).toLocaleDateString("tr-TR")}
                      </div>
                    )}
                  </div>
                </div>

                {/* Risk specific */}
                {item.category === "risk" && item.mitigationPlan && (
                  <div className="mt-2 text-xs text-gray-500 bg-amber-50 rounded-lg p-2">
                    <strong className="text-amber-700">Azaltma Planı:</strong> {item.mitigationPlan}
                  </div>
                )}

                {/* Meeting specific */}
                {item.category === "meeting" && item.meetingDate && (
                  <div className="mt-2 flex items-center gap-4 text-xs text-gray-500">
                    <span>📅 {new Date(item.meetingDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", hour: "2-digit", minute: "2-digit" })}</span>
                    {item.attendees && <span>👥 {item.attendees.length} katılımcı</span>}
                  </div>
                )}

                {/* Decision specific */}
                {item.category === "decision" && item.decidedBy && (
                  <div className="mt-1 text-xs text-gray-500">Karar veren: <strong>{item.decidedBy}</strong></div>
                )}
              </button>
            );
          })
        )}
      </div>

      {/* Add button */}
      {activeTab === "meeting" ? (
        <div className="flex gap-2">
          <Button variant="outline" className="flex-1" onClick={() => { setForm(EMPTY_FORM); setShowAdd(true); }}>
            <Plus className="w-4 h-4" />
            Boş Toplantı
          </Button>
          <Button className="flex-1" onClick={() => setShowTemplates(true)}>
            <LayoutTemplate className="w-4 h-4" />
            Şablondan Ekle
          </Button>
        </div>
      ) : (
        <Button variant="outline" onClick={() => setShowAdd(true)} className="w-full">
          <Plus className="w-4 h-4" />
          {TABS.find((t) => t.id === activeTab)?.label} Ekle
        </Button>
      )}

      {/* Template picker modal */}
      {showTemplates && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setShowTemplates(false)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-2xl p-6 max-h-[85vh] flex flex-col">
            <div className="flex items-center justify-between mb-5 flex-shrink-0">
              <div>
                <h2 className="text-lg font-bold text-gray-900">Toplantı Şablonu Seç</h2>
                <p className="text-sm text-gray-500 mt-0.5">Bir şablon seçin, ardından detayları düzenleyin</p>
              </div>
              <button onClick={() => setShowTemplates(false)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 overflow-y-auto">
              {MEETING_TEMPLATES.map((tpl) => (
                <button
                  key={tpl.id}
                  onClick={() => applyTemplate(tpl)}
                  className="text-left p-4 border border-gray-200 rounded-xl hover:border-indigo-400 hover:bg-indigo-50 transition-all group"
                >
                  <div className="flex items-start gap-3">
                    <span className="text-2xl flex-shrink-0 mt-0.5">{tpl.icon}</span>
                    <div className="min-w-0">
                      <div className="flex items-center gap-2 mb-1">
                        <span className="text-sm font-semibold text-gray-900 group-hover:text-indigo-700">{tpl.label}</span>
                        <span className="text-[10px] bg-gray-100 group-hover:bg-indigo-100 text-gray-500 group-hover:text-indigo-600 px-1.5 py-0.5 rounded-full font-medium">{tpl.cadence}</span>
                      </div>
                      <p className="text-xs text-gray-500 line-clamp-2">{tpl.description}</p>
                    </div>
                  </div>
                </button>
              ))}
            </div>
            <div className="pt-4 flex-shrink-0 border-t border-gray-100 mt-4">
              <button
                onClick={() => { setForm(EMPTY_FORM); setShowTemplates(false); setShowAdd(true); }}
                className="text-sm text-indigo-600 hover:underline"
              >
                Şablon kullanmadan boş ekle →
              </button>
            </div>
          </div>
        </div>
      )}

      {/* Add modal */}
      {showAdd && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[90vh] overflow-y-auto">
            <div className="flex items-center justify-between mb-5">
              <h2 className="text-lg font-bold text-gray-900">
                Yeni {TABS.find((t) => t.id === activeTab)?.label}
              </h2>
              <button onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>
            <div className="space-y-4">
              {/* Başlık */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Başlık *</label>
                <input
                  value={form.title}
                  onChange={(e) => setField("title", e.target.value)}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  placeholder="Başlık..."
                  autoFocus
                />
              </div>

              {/* Açıklama */}
              <div className="flex flex-col gap-1.5">
                <label className="text-sm font-medium text-gray-700">Açıklama</label>
                <textarea
                  value={form.description}
                  onChange={(e) => setField("description", e.target.value)}
                  rows={3}
                  className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none"
                  placeholder="Açıklama..."
                />
              </div>

              {/* Sorumlu + Son Tarih */}
              <div className="grid grid-cols-2 gap-3">
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Sorumlu</label>
                  {projectTeam.length > 0 ? (
                    <select
                      value={form.owner}
                      onChange={(e) => setField("owner", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                    >
                      <option value="">— Seçin —</option>
                      {projectTeam.map((m) => (
                        <option key={m.id} value={m.name}>{m.name}</option>
                      ))}
                    </select>
                  ) : (
                    <input
                      value={form.owner}
                      onChange={(e) => setField("owner", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                      placeholder="Ad Soyad"
                    />
                  )}
                </div>
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Son Tarih</label>
                  <input
                    type="date"
                    value={form.dueDate}
                    onChange={(e) => setField("dueDate", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                  />
                </div>
              </div>

              {/* Öncelik */}
              {(activeTab === "risk" || activeTab === "issue" || activeTab === "change") && (
                <div className="flex flex-col gap-1.5">
                  <label className="text-sm font-medium text-gray-700">Öncelik</label>
                  <select
                    value={form.priority}
                    onChange={(e) => setField("priority", e.target.value)}
                    className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                  >
                    <option value="">— Seçin —</option>
                    <option value="low">Düşük</option>
                    <option value="medium">Orta</option>
                    <option value="high">Yüksek</option>
                    <option value="critical">Kritik</option>
                  </select>
                </div>
              )}

              {/* Risk'e özgü alanlar */}
              {activeTab === "risk" && (
                <>
                  <div className="grid grid-cols-2 gap-3">
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">Etki</label>
                      <select value={form.impact} onChange={(e) => setField("impact", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">— Seçin —</option>
                        <option value="low">Düşük</option>
                        <option value="medium">Orta</option>
                        <option value="high">Yüksek</option>
                      </select>
                    </div>
                    <div className="flex flex-col gap-1.5">
                      <label className="text-sm font-medium text-gray-700">Olasılık</label>
                      <select value={form.probability} onChange={(e) => setField("probability", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">— Seçin —</option>
                        <option value="low">Düşük</option>
                        <option value="medium">Orta</option>
                        <option value="high">Yüksek</option>
                      </select>
                    </div>
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Azaltma Planı</label>
                    <textarea value={form.mitigationPlan} onChange={(e) => setField("mitigationPlan", e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Risk azaltma adımları..." />
                  </div>
                </>
              )}

              {/* Toplantı'ya özgü alanlar */}
              {activeTab === "meeting" && (
                <>
                  {/* Tarih */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Toplantı Tarihi</label>
                    <input
                      type="date"
                      value={form.meetingDateOnly}
                      onChange={(e) => setField("meetingDateOnly", e.target.value)}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                    />
                  </div>

                  {/* Saat & Dakika */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Toplantı Saati</label>
                    <div className="flex items-center gap-2">
                      <select
                        value={form.meetingHour}
                        onChange={(e) => setField("meetingHour", e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {HOUR_OPTIONS.map((h) => (
                          <option key={h} value={h}>{h}:00</option>
                        ))}
                      </select>
                      <span className="text-gray-400 font-medium">:</span>
                      <select
                        value={form.meetingMinute}
                        onChange={(e) => setField("meetingMinute", e.target.value)}
                        className="flex-1 border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white"
                      >
                        {MINUTE_OPTIONS.map((m) => (
                          <option key={m} value={m}>{m}</option>
                        ))}
                      </select>
                    </div>
                  </div>

                  {/* Katılımcılar */}
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Katılımcılar</label>
                    {projectTeam.length > 0 && (
                      <div className="border border-gray-200 rounded-xl overflow-hidden divide-y divide-gray-100">
                        {projectTeam.map((m) => {
                          const checked = form.attendees.includes(m.name);
                          return (
                            <button
                              key={m.id}
                              type="button"
                              onClick={() => toggleAttendee(m.name)}
                              className={`w-full flex items-center gap-3 px-3 py-2.5 text-left transition-colors ${checked ? "bg-indigo-50" : "hover:bg-gray-50"}`}
                            >
                              <Avatar name={m.name} size="sm" />
                              <span className="flex-1 text-sm text-gray-800">{m.name}</span>
                              {checked && <Check className="w-4 h-4 text-indigo-600 flex-shrink-0" />}
                            </button>
                          );
                        })}
                      </div>
                    )}
                    {/* Harici katılımcı ekleme */}
                    <div className="flex gap-2 mt-1">
                      <div className="relative flex-1">
                        <UserPlus className="absolute left-3 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
                        <input
                          value={form.externalAttendee}
                          onChange={(e) => setField("externalAttendee", e.target.value)}
                          onKeyDown={(e) => e.key === "Enter" && (e.preventDefault(), addExternalAttendee())}
                          placeholder="Harici katılımcı ekle..."
                          className="w-full pl-8 pr-3 py-2 text-sm border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-indigo-500"
                        />
                      </div>
                      <button
                        type="button"
                        onClick={addExternalAttendee}
                        disabled={!form.externalAttendee.trim()}
                        className="px-3 py-2 text-sm bg-gray-100 hover:bg-gray-200 text-gray-700 rounded-lg disabled:opacity-40 transition-colors font-medium"
                      >
                        Ekle
                      </button>
                    </div>
                    {/* Seçilen katılımcılar */}
                    {form.attendees.length > 0 && (
                      <div className="flex flex-wrap gap-1.5 mt-1">
                        {form.attendees.map((a) => {
                          const isTeam = projectTeam.some((m) => m.name === a);
                          return (
                            <span
                              key={a}
                              className={`inline-flex items-center gap-1 text-xs px-2 py-0.5 rounded-full font-medium ${
                                isTeam ? "bg-indigo-100 text-indigo-700" : "bg-gray-100 text-gray-600"
                              }`}
                            >
                              {a}
                              <button type="button" onClick={() => toggleAttendee(a)} className="hover:text-red-500 ml-0.5">
                                <X className="w-3 h-3" />
                              </button>
                            </span>
                          );
                        })}
                      </div>
                    )}
                  </div>

                  {/* ── Tekrarlama (Outlook stili) ─────────────────────── */}
                  <div className="border border-gray-200 rounded-xl overflow-hidden">
                    {/* Başlık + pattern seçimi */}
                    <div className="bg-gray-50 px-4 py-2.5 border-b border-gray-200">
                      <span className="text-xs font-semibold text-gray-600 uppercase tracking-wide">Tekrarlama Düzeni</span>
                    </div>
                    <div className="p-4 space-y-4">
                      {/* Pattern butonları */}
                      <div className="grid grid-cols-4 gap-1.5">
                        {(["none", "daily", "weekly", "monthly"] as const).map((opt) => {
                          const labels = { none: "Yok", daily: "Günlük", weekly: "Haftalık", monthly: "Aylık" };
                          return (
                            <button
                              key={opt}
                              type="button"
                              onClick={() => setField("recurrence", opt)}
                              className={`py-1.5 text-xs font-medium rounded-lg border transition-colors ${
                                form.recurrence === opt
                                  ? "bg-indigo-600 text-white border-indigo-600"
                                  : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                              }`}
                            >
                              {labels[opt]}
                            </button>
                          );
                        })}
                      </div>

                      {/* Günlük: her N günde bir */}
                      {form.recurrence === "daily" && (
                        <div className="flex items-center gap-2 text-sm text-gray-700">
                          <span>Her</span>
                          <input
                            type="number" min="1" max="30"
                            value={form.recurrenceInterval}
                            onChange={(e) => setField("recurrenceInterval", e.target.value)}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span>günde bir</span>
                        </div>
                      )}

                      {/* Haftalık: her N haftada, hangi günlerde */}
                      {form.recurrence === "weekly" && (
                        <div className="space-y-3">
                          <div className="flex items-center gap-2 text-sm text-gray-700">
                            <span>Her</span>
                            <input
                              type="number" min="1" max="12"
                              value={form.recurrenceInterval}
                              onChange={(e) => setField("recurrenceInterval", e.target.value)}
                              className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                            />
                            <span>haftada bir, şu günlerde:</span>
                          </div>
                          <div className="flex gap-1.5 flex-wrap">
                            {[
                              { day: 1, label: "Pzt" },
                              { day: 2, label: "Sal" },
                              { day: 3, label: "Çar" },
                              { day: 4, label: "Per" },
                              { day: 5, label: "Cum" },
                              { day: 6, label: "Cmt" },
                              { day: 0, label: "Paz" },
                            ].map(({ day, label }) => {
                              const active = form.recurrenceWeekdays.includes(day);
                              return (
                                <button
                                  key={day}
                                  type="button"
                                  onClick={() => toggleWeekday(day)}
                                  className={`w-10 h-9 text-xs font-medium rounded-lg border transition-colors ${
                                    active
                                      ? "bg-indigo-600 text-white border-indigo-600"
                                      : "bg-white text-gray-600 border-gray-300 hover:border-indigo-400"
                                  }`}
                                >
                                  {label}
                                </button>
                              );
                            })}
                          </div>
                        </div>
                      )}

                      {/* Aylık: her N ayda bir, ayın X. günü */}
                      {form.recurrence === "monthly" && (
                        <div className="flex items-center gap-2 text-sm text-gray-700 flex-wrap">
                          <span>Her</span>
                          <input
                            type="number" min="1" max="12"
                            value={form.recurrenceInterval}
                            onChange={(e) => setField("recurrenceInterval", e.target.value)}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span>ayda bir, ayın</span>
                          <input
                            type="number" min="1" max="31"
                            value={form.recurrenceMonthDay || (form.meetingDateOnly ? new Date(form.meetingDateOnly + "T00:00:00").getDate().toString() : "1")}
                            onChange={(e) => setField("recurrenceMonthDay", e.target.value)}
                            className="w-16 border border-gray-300 rounded-lg px-2 py-1.5 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                          />
                          <span>. günü</span>
                        </div>
                      )}

                      {/* Tekrarlama sonu — sadece none olmadığında */}
                      {form.recurrence !== "none" && (
                        <div className="border-t border-gray-100 pt-3 space-y-2.5">
                          <span className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Bitiş Koşulu</span>
                          <div className="space-y-2">
                            {/* Bitiş yok */}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input type="radio" name="recEndType" value="noend"
                                checked={form.recurrenceEndType === "noend"}
                                onChange={() => setField("recurrenceEndType", "noend")}
                                className="accent-indigo-600"
                              />
                              <span className="text-sm text-gray-700">Bitiş tarihi yok</span>
                              {form.recurrenceEndType === "noend" && (
                                <span className="text-xs text-gray-400">(maks. 104 oluşum)</span>
                              )}
                            </label>

                            {/* Sayıyla bitir */}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input type="radio" name="recEndType" value="count"
                                checked={form.recurrenceEndType === "count"}
                                onChange={() => setField("recurrenceEndType", "count")}
                                className="accent-indigo-600"
                              />
                              <span className="text-sm text-gray-700">Şu kadar sonra:</span>
                              {form.recurrenceEndType === "count" && (
                                <div className="flex items-center gap-1.5">
                                  <input
                                    type="number" min="2" max="104"
                                    value={form.recurrenceCount}
                                    onChange={(e) => setField("recurrenceCount", e.target.value)}
                                    className="w-16 border border-gray-300 rounded-lg px-2 py-1 text-sm text-center focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                  />
                                  <span className="text-sm text-gray-600">oluşum</span>
                                </div>
                              )}
                            </label>

                            {/* Tarihle bitir */}
                            <label className="flex items-center gap-2.5 cursor-pointer">
                              <input type="radio" name="recEndType" value="date"
                                checked={form.recurrenceEndType === "date"}
                                onChange={() => setField("recurrenceEndType", "date")}
                                className="accent-indigo-600"
                              />
                              <span className="text-sm text-gray-700">Tarihte bit:</span>
                              {form.recurrenceEndType === "date" && (
                                <input
                                  type="date"
                                  value={form.recurrenceEndDate}
                                  onChange={(e) => setField("recurrenceEndDate", e.target.value)}
                                  className="border border-gray-300 rounded-lg px-2 py-1 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500"
                                />
                              )}
                            </label>
                          </div>
                        </div>
                      )}
                    </div>
                  </div>
                </>
              )}

              {/* Değişiklik isteği alanları */}
              {activeTab === "change" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Talep Eden</label>
                    {projectTeam.length > 0 ? (
                      <select value={form.requestedBy} onChange={(e) => setField("requestedBy", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">— Seçin —</option>
                        {projectTeam.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    ) : (
                      <input value={form.requestedBy} onChange={(e) => setField("requestedBy", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ad Soyad" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Etki Değerlendirmesi</label>
                    <textarea value={form.impactAssessment} onChange={(e) => setField("impactAssessment", e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Değişikliğin etkileri..." />
                  </div>
                </>
              )}

              {/* Karar alanları */}
              {activeTab === "decision" && (
                <>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Karar Veren</label>
                    {projectTeam.length > 0 ? (
                      <select value={form.decidedBy} onChange={(e) => setField("decidedBy", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 bg-white">
                        <option value="">— Seçin —</option>
                        {projectTeam.map((m) => <option key={m.id} value={m.name}>{m.name}</option>)}
                      </select>
                    ) : (
                      <input value={form.decidedBy} onChange={(e) => setField("decidedBy", e.target.value)} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500" placeholder="Ad Soyad" />
                    )}
                  </div>
                  <div className="flex flex-col gap-1.5">
                    <label className="text-sm font-medium text-gray-700">Gerekçe</label>
                    <textarea value={form.rationale} onChange={(e) => setField("rationale", e.target.value)} rows={2} className="w-full border border-gray-300 rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 resize-none" placeholder="Kararın gerekçesi..." />
                  </div>
                </>
              )}

              <div className="flex gap-3 pt-1">
                <Button variant="outline" className="flex-1" onClick={() => { setShowAdd(false); setForm(EMPTY_FORM); }}>İptal</Button>
                <Button className="flex-1" onClick={handleAdd} disabled={!form.title.trim()}>Kaydet</Button>
              </div>
            </div>
          </div>
        </div>
      )}

      {/* Detail modal */}
      {selectedItem && (
        <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center sm:p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setSelectedItem(null)} />
          <div className="relative bg-white rounded-t-2xl sm:rounded-2xl shadow-xl w-full max-w-lg p-6 max-h-[80vh] overflow-y-auto">
            <div className="flex items-start justify-between mb-4">
              <div>
                <div className="flex items-center gap-2 mb-1">
                  <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${GOVERNANCE_STATUS_META[selectedItem.status].bg} ${GOVERNANCE_STATUS_META[selectedItem.status].color}`}>
                    {GOVERNANCE_STATUS_META[selectedItem.status].label}
                  </span>
                  {selectedItem.priority && (
                    <span className={`text-xs font-semibold ${PRIORITY_META[selectedItem.priority].color}`}>
                      {PRIORITY_META[selectedItem.priority].label} Öncelik
                    </span>
                  )}
                </div>
                <h2 className="text-lg font-bold text-gray-900">{selectedItem.title}</h2>
              </div>
              <button onClick={() => setSelectedItem(null)} className="p-2 hover:bg-gray-100 rounded-lg">
                <X className="w-4 h-4 text-gray-500" />
              </button>
            </div>

            <div className="space-y-3 text-sm">
              {selectedItem.description && (
                <p className="text-gray-600">{selectedItem.description}</p>
              )}

              <div className="grid grid-cols-2 gap-3 pt-2">
                {selectedItem.owner && (
                  <div><span className="text-xs text-gray-400">Sorumlu</span><div className="font-medium text-gray-800">{selectedItem.owner}</div></div>
                )}
                {selectedItem.dueDate && (
                  <div><span className="text-xs text-gray-400">Son Tarih</span><div className="font-medium text-gray-800">{new Date(selectedItem.dueDate).toLocaleDateString("tr-TR")}</div></div>
                )}
                <div><span className="text-xs text-gray-400">Oluşturulma</span><div className="font-medium text-gray-800">{new Date(selectedItem.createdAt).toLocaleDateString("tr-TR")}</div></div>
              </div>

              {/* Risk fields */}
              {selectedItem.category === "risk" && (
                <div className="bg-amber-50 rounded-xl p-3 space-y-2">
                  <div className="grid grid-cols-2 gap-3">
                    <div><span className="text-xs text-gray-400">Etki</span><div className="font-medium">{IMPACT_LABELS[selectedItem.impact ?? ""]}</div></div>
                    <div><span className="text-xs text-gray-400">Olasılık</span><div className="font-medium">{IMPACT_LABELS[selectedItem.probability ?? ""]}</div></div>
                  </div>
                  {selectedItem.mitigationPlan && (
                    <div><span className="text-xs text-gray-400">Azaltma Planı</span><p className="text-gray-700 mt-0.5">{selectedItem.mitigationPlan}</p></div>
                  )}
                </div>
              )}

              {/* Change request fields */}
              {selectedItem.category === "change" && (
                <div className="bg-blue-50 rounded-xl p-3 space-y-2">
                  {selectedItem.requestedBy && (
                    <div><span className="text-xs text-gray-400">Talep Eden</span><div className="font-medium">{selectedItem.requestedBy}</div></div>
                  )}
                  {selectedItem.impactAssessment && (
                    <div><span className="text-xs text-gray-400">Etki Değerlendirmesi</span><p className="text-gray-700 mt-0.5">{selectedItem.impactAssessment}</p></div>
                  )}
                </div>
              )}

              {/* Meeting fields */}
              {selectedItem.category === "meeting" && (
                <div className="bg-violet-50 rounded-xl p-3 space-y-2">
                  {selectedItem.meetingDate && (
                    <div><span className="text-xs text-gray-400">Toplantı Tarihi</span><div className="font-medium">{new Date(selectedItem.meetingDate).toLocaleDateString("tr-TR", { day: "numeric", month: "long", year: "numeric", hour: "2-digit", minute: "2-digit" })}</div></div>
                  )}
                  {selectedItem.attendees && selectedItem.attendees.length > 0 && (
                    <div><span className="text-xs text-gray-400">Katılımcılar</span><div className="flex flex-wrap gap-1 mt-1">{selectedItem.attendees.map((a) => (<span key={a} className="text-xs bg-white border border-violet-200 text-violet-700 px-2 py-0.5 rounded-full">{a}</span>))}</div></div>
                  )}
                  {selectedItem.minutes && (
                    <div><span className="text-xs text-gray-400">Toplantı Notları</span><p className="text-gray-700 mt-0.5">{selectedItem.minutes}</p></div>
                  )}
                </div>
              )}

              {/* Decision fields */}
              {selectedItem.category === "decision" && (
                <div className="bg-emerald-50 rounded-xl p-3 space-y-2">
                  {selectedItem.decidedBy && (
                    <div><span className="text-xs text-gray-400">Karar Veren</span><div className="font-medium">{selectedItem.decidedBy}</div></div>
                  )}
                  {selectedItem.rationale && (
                    <div><span className="text-xs text-gray-400">Gerekçe</span><p className="text-gray-700 mt-0.5">{selectedItem.rationale}</p></div>
                  )}
                </div>
              )}

              {/* Attachments */}
              <div className="pt-2 border-t border-gray-100">
                <AttachmentSection
                  attachments={selectedItem.attachments ?? []}
                  onAdd={(att: Attachment) => {
                    const updated = [...(selectedItem.attachments ?? []), att];
                    updateItem(selectedItem.id, { attachments: updated });
                    setSelectedItem({ ...selectedItem, attachments: updated });
                  }}
                  onRemove={(id) => {
                    const updated = (selectedItem.attachments ?? []).filter((a) => a.id !== id);
                    updateItem(selectedItem.id, { attachments: updated });
                    setSelectedItem({ ...selectedItem, attachments: updated });
                  }}
                />
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
}
