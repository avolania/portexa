"use client";

import { useState, useEffect, useCallback } from "react";
import { RefreshCw } from "lucide-react";
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { useActivityStore } from "@/store/useActivityStore";

function renderMarkdown(text: string): string {
  return text
    .replace(/\*\*(.+?)\*\*/g, "<strong>$1</strong>")
    .replace(/\*(.+?)\*/g, "<em>$1</em>")
    .replace(/^- (.+)$/gm, "<div class='flex gap-1.5'><span class='shrink-0'>•</span><span>$1</span></div>")
    .replace(/\n/g, "<br/>");
}

export default function AISuggestions() {
  const [suggestions, setSuggestions] = useState<string[]>([]);
  const [loading, setLoading] = useState(false);
  const [initialized, setInitialized] = useState(false);

  const { user } = useAuthStore();
  const { projects, tasks } = useProjectStore();
  const { members } = useTeamStore();
  const { items: governanceItems } = useGovernanceStore();
  const { entries: activities } = useActivityStore();

  const buildContext = useCallback(() => {
    const now = new Date();

    const overdueTasks = tasks.filter(
      (t) => t.dueDate && new Date(t.dueDate) < now && t.status !== "done"
    );
    const upcomingDeadlines = tasks.filter((t) => {
      if (!t.dueDate || t.status === "done") return false;
      const diff = (new Date(t.dueDate).getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
      return diff <= 7 && diff >= 0;
    });

    const projectLines = projects.map((p) => {
      const budgetPct = p.budget && p.budgetUsed
        ? Math.round((p.budgetUsed / p.budget) * 100)
        : 0;
      return `  • ${p.name} | durum:${p.status} | ilerleme:%${p.progress} | bütçe kullanım:%${budgetPct}`;
    }).join("\n");

    const openRisks = governanceItems.filter((g) => g.category === "risk" && g.status !== "mitigated");
    const pendingChanges = governanceItems.filter((g) => g.category === "change" && g.status === "pending");

    const myActivities = activities.filter((a) => a.userId === user?.id);
    const draftActivities = myActivities.filter((a) => a.status === "draft");

    return `
Kullanıcı: ${user?.name} | Rol: ${user?.role}
Projeler: ${projects.length} (aktif:${projects.filter((p) => p.status === "active").length}, riskli:${projects.filter((p) => p.status === "at_risk").length})
${projectLines}
Görevler: toplam:${tasks.length}, tamamlanmamış:${tasks.filter((t) => t.status !== "done").length}, gecikmiş:${overdueTasks.length}, bu hafta bitiş:${upcomingDeadlines.length}
Açık riskler: ${openRisks.length}
Bekleyen değişiklikler: ${pendingChanges.length}
Taslak aktiviteler (kaydedilmemiş): ${draftActivities.length}
Ekip: ${members.length} üye
`.trim();
  }, [projects, tasks, members, governanceItems, activities, user]);

  const fetchSuggestions = useCallback(async () => {
    setLoading(true);
    setSuggestions([]);

    try {
      const context = buildContext();
      const { data: { session } } = await supabase.auth.getSession();
      const res = await fetch("/api/chat", {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          ...(session?.access_token ? { Authorization: `Bearer ${session.access_token}` } : {}),
        },
        body: JSON.stringify({
          messages: [
            {
              role: "user",
              content:
                "Yukarıdaki verilere göre benim için bugün dikkate almam gereken 3 kısa ve eyleme dönüştürülebilir öneri sun. Her öneri ayrı satırda, uygun bir emoji ile başlasın. Sadece maddeler — başlık, açıklama veya selamlama ekleme.",
            },
          ],
          context,
        }),
      });

      if (!res.ok || !res.body) throw new Error("API hatası");

      const reader = res.body.getReader();
      const decoder = new TextDecoder();
      let fullText = "";

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        fullText += decoder.decode(value, { stream: true });
      }

      // Split into individual suggestion lines (non-empty)
      const lines = fullText
        .split("\n")
        .map((l) => l.trim())
        .filter((l) => l.length > 0);

      setSuggestions(lines);
    } catch {
      setSuggestions(["Öneriler yüklenemedi. Tekrar denemek için yenile düğmesine tıklayın."]);
    } finally {
      setLoading(false);
    }
  }, [buildContext]);

  useEffect(() => {
    if (!initialized && projects.length > 0) {
      setInitialized(true);
      fetchSuggestions();
    }
  }, [initialized, projects.length, fetchSuggestions]);

  return (
    <div className="card border-indigo-200 bg-indigo-50">
      <div className="flex items-center gap-2 mb-3">
        <div className="w-7 h-7 rounded-full overflow-hidden flex-shrink-0">
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src="/pixa.png" alt="Pixa" className="w-full h-full object-cover" />
        </div>
        <h3 className="text-sm font-semibold text-indigo-900 flex-1">AI Önerileri</h3>
        <button
          onClick={fetchSuggestions}
          disabled={loading}
          className="p-1 hover:bg-indigo-100 rounded-lg transition-colors disabled:opacity-40"
          title="Yenile"
        >
          <RefreshCw className={`w-3.5 h-3.5 text-indigo-500 ${loading ? "animate-spin" : ""}`} />
        </button>
      </div>

      <div className="space-y-2.5">
        {loading && suggestions.length === 0 ? (
          <div className="space-y-2">
            {[1, 2, 3].map((i) => (
              <div
                key={i}
                className="h-10 bg-white/70 rounded-lg animate-pulse border border-indigo-100"
              />
            ))}
          </div>
        ) : suggestions.length > 0 ? (
          suggestions.map((s, i) => (
            <div
              key={i}
              className="text-xs text-indigo-800 bg-white rounded-lg p-2.5 border border-indigo-100"
              dangerouslySetInnerHTML={{ __html: renderMarkdown(s) }}
            />
          ))
        ) : null}
      </div>
    </div>
  );
}
