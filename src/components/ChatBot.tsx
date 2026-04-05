"use client";

import { useState, useRef, useEffect, useCallback } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { useReportStore } from "@/store/useReportStore";
import { useActivityStore } from "@/store/useActivityStore";
import { useRequestStore } from "@/store/useRequestStore";
import { ROLE_PERMISSIONS, ROLE_META } from "@/lib/permissions";

interface Message {
  role: "user" | "assistant";
  content: string;
}

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")   // **bold**
    .replace(/\*(.+?)\*/g, "<em>$1</em>")                // *italic*
    .replace(/^### (.+)$/gm, "<div class='font-semibold text-gray-800 mt-2'>$1</div>")
    .replace(/^## (.+)$/gm, "<div class='font-bold text-gray-900 mt-2'>$1</div>")
    .replace(/^- (.+)$/gm, "<div class='flex gap-1.5'><span class='mt-0.5 shrink-0'>•</span><span>$1</span></div>")
    .replace(/\n/g, "<br/>");
}

export default function ChatBot() {
  const [open, setOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([]);
  const [input, setInput] = useState("");
  const [loading, setLoading] = useState(false);
  const bottomRef = useRef<HTMLDivElement>(null);
  const inputRef = useRef<HTMLTextAreaElement>(null);

  const { user } = useAuthStore();
  const { projects, tasks } = useProjectStore();
  const { members } = useTeamStore();
  const { items: governanceItems } = useGovernanceStore();
  const { reports } = useReportStore();
  const { entries: activities } = useActivityStore();
  const { requests } = useRequestStore();

  const buildContext = useCallback(() => {
    const role = user?.role ?? "member";
    const permissions = ROLE_PERMISSIONS[role as keyof typeof ROLE_PERMISSIONS] ?? [];
    const roleMeta = ROLE_META[role as keyof typeof ROLE_META];
    const now = new Date();

    // ── Projeler ──────────────────────────────────────────────────────────────
    const byStatus = (s: string) => projects.filter((p) => p.status === s).length;
    const projectLines = projects.map((p) => {
      const mgr = members.find((m) => m.id === p.managerId)?.name ?? p.managerId;
      const budgetStr = p.budget
        ? `bütçe:${p.budget.toLocaleString("tr-TR")}₺ (%${p.budgetUsed && p.budget ? Math.round((p.budgetUsed / p.budget) * 100) : 0} kullanıldı)`
        : "bütçe:tanımsız";
      return `  • [${p.id}] ${p.name} | durum:${p.status} | ilerleme:%${p.progress} | tür:${p.projectType} | PM:${mgr} | ${budgetStr} | üye:${p.members.length}`;
    }).join("\n");

    // ── Görevler ──────────────────────────────────────────────────────────────
    const myTasks = tasks.filter((t) => t.assigneeId === user?.id);
    const overdueTasks = tasks.filter((t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done");
    const tasksByStatus = ["todo","in_progress","review","done"].map((s) =>
      `${s}:${tasks.filter((t) => t.status === s).length}`
    ).join(", ");
    const upcomingTasks = tasks
      .filter((t) => t.dueDate && new Date(t.dueDate) >= now && t.status !== "done")
      .sort((a, b) => new Date(a.dueDate!).getTime() - new Date(b.dueDate!).getTime())
      .slice(0, 5)
      .map((t) => {
        const proj = projects.find((p) => p.id === t.projectId)?.name ?? t.projectId;
        return `  • ${t.title} [${t.status}] — proje:${proj}, bitiş:${t.dueDate}`;
      }).join("\n");

    // ── Yönetişim ─────────────────────────────────────────────────────────────
    // Toplantılar: yaklaşan ve geçmiş
    const meetings = governanceItems.filter((g) => g.category === "meeting");
    const upcomingMeetings = meetings
      .filter((g) => g.meetingDate && new Date(g.meetingDate) >= now)
      .sort((a, b) => new Date(a.meetingDate!).getTime() - new Date(b.meetingDate!).getTime())
      .slice(0, 5)
      .map((g) => {
        const proj = projects.find((p) => p.id === g.projectId)?.name ?? g.projectId;
        const attendees = g.attendees?.length ? `katılımcı:${g.attendees.join(", ")}` : "";
        return `  • ${g.title} | proje:${proj} | tarih:${g.meetingDate} | ${attendees}`;
      }).join("\n");

    const recentMeetings = meetings
      .filter((g) => g.meetingDate && new Date(g.meetingDate) < now)
      .sort((a, b) => new Date(b.meetingDate!).getTime() - new Date(a.meetingDate!).getTime())
      .slice(0, 3)
      .map((g) => {
        const proj = projects.find((p) => p.id === g.projectId)?.name ?? g.projectId;
        const minuteSnippet = g.minutes ? `\n    Toplantı notu: ${g.minutes.slice(0, 300)}${g.minutes.length > 300 ? "..." : ""}` : "";
        return `  • ${g.title} | proje:${proj} | tarih:${g.meetingDate}${minuteSnippet}`;
      }).join("\n");

    // Riskler, değişiklikler, sorunlar, kararlar
    const risks = governanceItems.filter((g) => g.category === "risk" && g.status !== "mitigated");
    const riskLines = risks.slice(0, 5).map((g) => {
      const proj = projects.find((p) => p.id === g.projectId)?.name ?? g.projectId;
      return `  • ${g.title} | proje:${proj} | etki:${g.impact ?? "?"} | olasılık:${g.probability ?? "?"} | plan:${g.mitigationPlan ?? "yok"}`;
    }).join("\n");

    const pendingChanges = governanceItems.filter((g) => g.category === "change" && g.status === "pending");
    const changeLines = pendingChanges.slice(0, 5).map((g) => {
      const proj = projects.find((p) => p.id === g.projectId)?.name ?? g.projectId;
      return `  • ${g.title} | proje:${proj} | talep eden:${g.requestedBy ?? "?"} | etki:${g.impactAssessment ?? "yok"}`;
    }).join("\n");

    const openIssues = governanceItems.filter((g) => g.category === "issue" && g.status === "open");
    const issueLines = openIssues.slice(0, 5).map((g) => {
      const proj = projects.find((p) => p.id === g.projectId)?.name ?? g.projectId;
      return `  • ${g.title} | proje:${proj} | öncelik:${g.priority ?? "?"} | sorumlu:${g.owner ?? "?"}`;
    }).join("\n");

    const decisions = governanceItems.filter((g) => g.category === "decision").slice(0, 5);
    const decisionLines = decisions.map((g) => {
      const proj = projects.find((p) => p.id === g.projectId)?.name ?? g.projectId;
      return `  • ${g.title} | proje:${proj} | karar veren:${g.decidedBy ?? "?"} | gerekçe:${g.rationale ?? "yok"}`;
    }).join("\n");

    // ── Raporlar ──────────────────────────────────────────────────────────────
    const sortedReports = [...reports].sort((a, b) =>
      new Date(b.updatedAt).getTime() - new Date(a.updatedAt).getTime()
    );
    const recentReports = sortedReports.slice(0, 5).map((r) => {
      const proj = r.projectId ? (projects.find((p) => p.id === r.projectId)?.name ?? r.projectId) : "Platform";
      const sections = r.sections?.map((s) => `${s.label}: ${s.content.slice(0, 100)}`).join(" | ") ?? "";
      return `  • [${r.type}] ${r.title} | proje:${proj} | dönem:${r.period} | durum:${r.status} | güncelleme:${r.updatedAt.slice(0,10)}\n    İçerik özeti: ${sections.slice(0, 200)}`;
    }).join("\n");

    // ── Aktiviteler ───────────────────────────────────────────────────────────
    const myActivities = activities.filter((a) => a.userId === user?.id);
    const pendingActivities = myActivities.filter((a) => a.status === "draft");
    const recentActivityLines = myActivities
      .sort((a, b) => new Date(b.date).getTime() - new Date(a.date).getTime())
      .slice(0, 5)
      .map((a) => {
        const proj = projects.find((p) => p.id === a.projectId)?.name ?? a.projectId;
        return `  • ${a.title} [${a.type}] | proje:${proj} | tarih:${a.date} | süre:${a.hours}s | durum:${a.status}`;
      }).join("\n");

    // ── Talepler ──────────────────────────────────────────────────────────────
    const pendingRequests = requests.filter((r) => r.status === "pending" || r.status === "in_review");
    const requestLines = pendingRequests.slice(0, 5).map((r) => {
      const proj = r.projectId ? (projects.find((p) => p.id === r.projectId)?.name ?? r.projectId) : "—";
      return `  • [${r.type}] ${r.title} | proje:${proj} | durum:${r.status} | öncelik:${r.priority}`;
    }).join("\n");

    // ── Ekip ──────────────────────────────────────────────────────────────────
    const teamLines = members.map((m) => `  • ${m.name} | rol:${m.role} | durum:${m.status}`).join("\n");

    return `
## Kullanıcı
Ad:${user?.name ?? "?"} | E-posta:${user?.email ?? "?"} | Rol:${roleMeta?.label ?? role} (${roleMeta?.description ?? ""})
Yetkiler: ${permissions.join(", ")}

## Projeler (${projects.length} — aktif:${byStatus("active")}, riskli:${byStatus("at_risk")}, beklemede:${byStatus("on_hold")}, tamamlandı:${byStatus("completed")})
${projectLines || "  Proje yok."}

## Görevler — toplam:${tasks.length} (${tasksByStatus})
Bana atanan:${myTasks.length} | Gecikmiş (tüm projeler):${overdueTasks.length}
Yaklaşan görevler:
${upcomingTasks || "  Yok."}

## Yaklaşan Toplantılar
${upcomingMeetings || "  Planlanmış toplantı yok."}

## Son Geçmiş Toplantılar (toplantı notlarıyla)
${recentMeetings || "  Kayıt yok."}

## Açık Riskler (${risks.length})
${riskLines || "  Yok."}

## Bekleyen Değişiklik Talepleri (${pendingChanges.length})
${changeLines || "  Yok."}

## Açık Sorunlar (${openIssues.length})
${issueLines || "  Yok."}

## Kararlar
${decisionLines || "  Kayıt yok."}

## Son Raporlar
${recentReports || "  Rapor yok."}

## Aktivitelerim
Taslak:${pendingActivities.length} | Son aktiviteler:
${recentActivityLines || "  Kayıt yok."}

## Bekleyen Talepler (${pendingRequests.length})
${requestLines || "  Yok."}

## Ekip (${members.length} üye)
${teamLines || "  Üye yok."}
`.trim();
  }, [projects, tasks, members, governanceItems, reports, activities, requests, user]);

  useEffect(() => {
    if (open) {
      setTimeout(() => inputRef.current?.focus(), 100);
    }
  }, [open]);

  useEffect(() => {
    bottomRef.current?.scrollIntoView({ behavior: "smooth" });
  }, [messages, loading]);

  async function sendMessage() {
    const text = input.trim();
    if (!text || loading) return;

    const newMessages: Message[] = [
      ...messages,
      { role: "user", content: text },
    ];
    setMessages(newMessages);
    setInput("");
    setLoading(true);

    // Placeholder for streaming response
    setMessages((prev) => [...prev, { role: "assistant", content: "" }]);

    try {
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          messages: newMessages.map((m) => ({
            role: m.role,
            content: m.content,
          })),
          context: buildContext(),
        }),
      });

      if (!res.ok || !res.body) throw new Error("API hatası");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let assistantText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        assistantText += decoder.decode(value, { stream: true });
        setMessages((prev) => {
          const updated = [...prev];
          updated[updated.length - 1] = {
            role: "assistant",
            content: assistantText,
          };
          return updated;
        });
      }
    } catch {
      setMessages((prev) => {
        const updated = [...prev];
        updated[updated.length - 1] = {
          role: "assistant",
          content: "Bir hata oluştu. Lütfen tekrar deneyin.",
        };
        return updated;
      });
    } finally {
      setLoading(false);
    }
  }

  function handleKeyDown(e: React.KeyboardEvent<HTMLTextAreaElement>) {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      sendMessage();
    }
  }

  return (
    <>
      {/* Floating button */}
      <button
        onClick={() => setOpen((v) => !v)}
        className="fixed bottom-20 right-4 md:bottom-6 md:right-6 z-50 w-14 h-14 rounded-full shadow-lg overflow-hidden hover:scale-105 transition-transform"
        aria-label="Pixa Asistanı"
      >
        {/* eslint-disable-next-line @next/next/no-img-element */}
        <img src="/pixa.png" alt="Pixa" className="w-full h-full object-cover" />
      </button>

      {/* Chat panel */}
      {open && (
        <div className="fixed bottom-36 right-4 md:bottom-20 md:right-6 z-50 w-80 md:w-96 h-[480px] bg-white rounded-2xl shadow-2xl border border-gray-200 flex flex-col overflow-hidden">
          {/* Header */}
          <div className="flex items-center gap-2 px-4 py-3 bg-indigo-600 text-white">
            <div className="w-9 h-9 rounded-full overflow-hidden flex-shrink-0 bg-white">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img src="/pixa.png" alt="Pixa" className="w-full h-full object-cover" />
            </div>
            <div>
              <p className="text-sm font-semibold">Pixa</p>
              <p className="text-xs text-indigo-200">Pixanto Asistanı</p>
            </div>
            <button
              onClick={() => setOpen(false)}
              className="ml-auto p-1 hover:bg-indigo-500 rounded"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M6 18L18 6M6 6l12 12"
                />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto px-4 py-3 space-y-3">
            {messages.length === 0 && (
              <div className="text-center text-gray-400 text-sm mt-6">
                <div className="w-16 h-16 rounded-full overflow-hidden mx-auto mb-3">
                  {/* eslint-disable-next-line @next/next/no-img-element */}
                  <img src="/pixa.png" alt="Pixa" className="w-full h-full object-cover" />
                </div>
                <p className="font-medium text-gray-600">Merhaba! Ben Pixa 👋</p>
                <p className="mt-1">Projeler, görevler ve ekibiniz</p>
                <p>hakkında sorabilirsiniz.</p>
              </div>
            )}
            {messages.map((msg, i) => (
              <div
                key={i}
                className={`flex ${msg.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] px-3 py-2 rounded-2xl text-sm ${
                    msg.role === "user"
                      ? "bg-indigo-600 text-white rounded-tr-sm"
                      : "bg-gray-100 text-gray-800 rounded-tl-sm"
                  }`}
                >
                  {msg.content ? (
                    msg.role === "assistant" ? (
                      <span dangerouslySetInnerHTML={{ __html: renderMarkdown(msg.content) }} />
                    ) : (
                      <span>{msg.content}</span>
                    )
                  ) : (
                    <span className="flex gap-1">
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:0ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:150ms]" />
                      <span className="w-1.5 h-1.5 bg-gray-400 rounded-full animate-bounce [animation-delay:300ms]" />
                    </span>
                  )}
                </div>
              </div>
            ))}
            <div ref={bottomRef} />
          </div>

          {/* Input */}
          <div className="px-3 py-2 border-t border-gray-200 flex gap-2 items-end">
            <textarea
              ref={inputRef}
              value={input}
              onChange={(e) => setInput(e.target.value)}
              onKeyDown={handleKeyDown}
              placeholder="Mesajınızı yazın..."
              rows={1}
              className="flex-1 resize-none rounded-xl border border-gray-300 px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-indigo-500 max-h-24 overflow-y-auto"
              style={{ lineHeight: "1.4" }}
            />
            <button
              onClick={sendMessage}
              disabled={!input.trim() || loading}
              className="w-9 h-9 rounded-xl bg-indigo-600 text-white flex items-center justify-center hover:bg-indigo-700 disabled:opacity-40 transition-colors flex-shrink-0"
            >
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="w-4 h-4"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
                strokeWidth={2}
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8"
                />
              </svg>
            </button>
          </div>
        </div>
      )}
    </>
  );
}
