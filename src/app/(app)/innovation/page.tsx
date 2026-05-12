"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import {
  Lightbulb, TrendingUp, Clock, CheckCircle2,
  ArrowRight, Loader2, ChevronRight,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { InnovationStats } from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const ACTIVITY_LABEL: Record<string, string> = {
  new_idea: "yeni fikir gönderdi",
  stage_change: "fikri aşama ilerletti →",
  evaluation: "fikri değerlendirdi",
};

export default function InnovationDashboard() {
  const [stats, setStats] = useState<InnovationStats | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const res = await fetch("/api/innovation/stats", {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setStats(await res.json());
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

  const totalStageCount = (stats?.by_stage ?? []).reduce((s, b) => s + b.count, 0) || 1;

  const statCards = [
    { label: "Toplam Fikir",    value: stats?.total_ideas ?? 0,  icon: Lightbulb,    color: "#3B82F6" },
    { label: "Bu Ay Gelen",     value: stats?.this_month ?? 0,   icon: TrendingUp,   color: "#8B5CF6" },
    { label: "Değerlendirmede", value: stats?.under_review ?? 0, icon: Clock,        color: "#D97706" },
    { label: "Uygulanan",       value: stats?.implemented ?? 0,  icon: CheckCircle2, color: "#059669" },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Fikir Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-0.5">Organizasyonunuzun inovasyon pipeline&apos;ı</p>
        </div>
        <Link
          href="/innovation/pipeline"
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <span>Pipeline</span>
          <ArrowRight className="w-4 h-4" />
        </Link>
      </div>

      {/* Stat Cards */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
        {statCards.map((card) => {
          const Icon = card.icon;
          return (
            <div
              key={card.label}
              className="bg-white rounded-lg border border-gray-200 p-5 relative overflow-hidden"
            >
              <div className="absolute top-0 left-0 w-1 h-full" style={{ background: card.color }} />
              <div className="flex items-start justify-between">
                <div>
                  <p className="text-xs font-semibold uppercase tracking-wide text-gray-400">{card.label}</p>
                  <p className="text-3xl font-bold text-gray-900 mt-1">{card.value}</p>
                </div>
                <div
                  className="w-9 h-9 rounded-lg flex items-center justify-center"
                  style={{ background: card.color + "1a" }}
                >
                  <Icon className="w-5 h-5" style={{ color: card.color }} />
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Stage Distribution */}
      <div className="bg-white rounded-lg border border-gray-200 p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-4">Stage Dağılımı</h2>
        <div className="space-y-3">
          {(stats?.by_stage ?? []).map((s) => (
            <div key={s.stage_id} className="flex items-center gap-3">
              <div className="w-32 text-sm text-gray-600 truncate">{s.stage_name}</div>
              <div className="flex-1 h-5 bg-gray-100 rounded-full overflow-hidden">
                <div
                  className="h-full rounded-full transition-all duration-500"
                  style={{
                    width: `${Math.round((s.count / totalStageCount) * 100)}%`,
                    background: s.stage_color,
                  }}
                />
              </div>
              <div
                className="w-7 h-7 rounded-full flex items-center justify-center text-xs font-bold text-white flex-shrink-0"
                style={{ background: s.stage_color }}
              >
                {s.count}
              </div>
            </div>
          ))}
          {!(stats?.by_stage?.length) && (
            <p className="text-sm text-gray-400 italic">Henüz fikir bulunmuyor.</p>
          )}
        </div>
      </div>

      {/* Bottom 2-col */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        {/* Top Ideas */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <div className="flex items-center justify-between mb-4">
            <h2 className="text-sm font-semibold text-gray-700">En Çok Oy Alan Fikirler</h2>
            <Link
              href="/innovation/pipeline?sort=votes"
              className="text-xs text-blue-600 hover:underline flex items-center gap-1"
            >
              Tümü <ChevronRight className="w-3 h-3" />
            </Link>
          </div>
          <div className="space-y-2">
            {(stats?.top_ideas ?? []).map((idea, i) => (
              <Link
                key={idea.id}
                href={`/innovation/pipeline?open=${idea.id}`}
                className="flex items-center gap-3 p-2.5 rounded-lg hover:bg-gray-50 transition-colors group"
              >
                <span className="text-xs font-bold text-gray-400 w-4">{i + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-gray-800 truncate group-hover:text-blue-600 transition-colors">
                    {idea.title}
                  </p>
                  <div className="flex items-center gap-2 mt-0.5">
                    <span className="font-mono text-xs text-gray-400">{idea.idea_number}</span>
                    <span
                      className="text-xs font-semibold px-1.5 py-0.5 rounded"
                      style={{ background: idea.stage_color + "22", color: idea.stage_color }}
                    >
                      {idea.stage_name}
                    </span>
                  </div>
                </div>
                <div className="text-right flex-shrink-0">
                  <p
                    className="text-sm font-bold"
                    style={{ color: idea.vote_count >= 0 ? "#059669" : "#DC2626" }}
                  >
                    {idea.vote_count >= 0 ? "↑" : "↓"}{Math.abs(idea.vote_count)}
                  </p>
                  {idea.composite_score > 0 && (
                    <p className="text-xs text-gray-400">⭐ {idea.composite_score}</p>
                  )}
                </div>
              </Link>
            ))}
            {!(stats?.top_ideas?.length) && (
              <p className="text-sm text-gray-400 italic">Henüz oy kullanılmamış.</p>
            )}
          </div>
        </div>

        {/* Recent Activity */}
        <div className="bg-white rounded-lg border border-gray-200 p-5">
          <h2 className="text-sm font-semibold text-gray-700 mb-4">Son Aktivite</h2>
          <div className="space-y-3">
            {(stats?.recent_activity ?? []).map((act, i) => (
              <div key={i} className="flex gap-3">
                <div
                  className="w-7 h-7 rounded-full flex items-center justify-center flex-shrink-0 mt-0.5 text-xs"
                  style={{
                    background:
                      act.type === "new_idea" ? "#DBEAFE" :
                      act.type === "stage_change" ? "#F3E8FF" : "#D1FAE5",
                  }}
                >
                  {act.type === "new_idea" ? "💡" : act.type === "stage_change" ? "→" : "⭐"}
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-gray-700">
                    <span className="font-semibold">{act.actor_name}</span>
                    {" "}{ACTIVITY_LABEL[act.type]}
                    {act.detail && <span className="font-semibold"> {act.detail}</span>}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5 font-mono">
                    {act.idea_number} — {act.idea_title}
                  </p>
                  <p className="text-xs text-gray-400 mt-0.5">
                    {formatDistanceToNow(new Date(act.created_at), { addSuffix: true, locale: tr })}
                  </p>
                </div>
              </div>
            ))}
            {!(stats?.recent_activity?.length) && (
              <p className="text-sm text-gray-400 italic">Henüz aktivite yok.</p>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
