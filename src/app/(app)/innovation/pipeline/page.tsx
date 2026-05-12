"use client";

import { useEffect, useState, useCallback } from "react";
import { useSearchParams } from "next/navigation";
import {
  Plus, Search, X, ChevronUp, ChevronDown,
  Loader2, MessageCircle, Star, ArrowRight, LayoutList, LayoutGrid,
} from "lucide-react";
import { DragDropContext, Droppable, Draggable, type DropResult } from '@hello-pangea/dnd';
import { supabase } from "@/lib/supabase";
import { useAuthStore } from "@/store/useAuthStore";
import type { InnovationIdea, InnovationStage, InnovationRole } from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

// ── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea, onOpen }: { idea: InnovationIdea; onOpen: (idea: InnovationIdea) => void }) {
  return (
    <button
      onClick={() => onOpen(idea)}
      className="w-full text-left bg-white border border-gray-200 rounded-lg p-4 hover:border-blue-300 hover:shadow-sm transition-all"
    >
      <div className="flex items-start gap-3">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="font-mono text-xs font-bold text-gray-400">{idea.idea_number}</span>
            {idea.stage && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: idea.stage.color + "22", color: idea.stage.color }}
              >
                {idea.stage.name}
              </span>
            )}
          </div>
          <p className="font-semibold text-gray-900 mt-1 text-sm">{idea.title}</p>
          {idea.description && (
            <p className="text-xs text-gray-500 mt-1 line-clamp-2">{idea.description}</p>
          )}
          <div className="flex items-center gap-3 mt-2 flex-wrap">
            {idea.submitter && (
              <span className="text-xs text-gray-400">{idea.submitter.name}</span>
            )}
            {idea.category && (
              <span className="text-xs bg-gray-100 text-gray-600 px-2 py-0.5 rounded-full">
                {idea.category}
              </span>
            )}
            <span className="text-xs text-gray-400">
              {formatDistanceToNow(new Date(idea.created_at), { addSuffix: true, locale: tr })}
            </span>
          </div>
        </div>
        <div className="flex flex-col items-end gap-2 flex-shrink-0">
          <div
            className="flex items-center gap-0.5 text-sm font-bold"
            style={{ color: idea.vote_count >= 0 ? "#059669" : "#DC2626" }}
          >
            {idea.vote_count >= 0 ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            {Math.abs(idea.vote_count)}
          </div>
          <div className="flex items-center gap-1 text-xs text-gray-400">
            <MessageCircle className="w-3.5 h-3.5" />
            {idea.comment_count}
          </div>
          {idea.composite_score > 0 && (
            <div className="flex items-center gap-1 text-xs text-amber-600 font-semibold">
              <Star className="w-3.5 h-3.5" />
              {idea.composite_score}
            </div>
          )}
        </div>
      </div>
    </button>
  );
}

// ── Detail Slide-Over ─────────────────────────────────────────────────────────

function DetailSlideOver({
  idea, onClose, token, userRole, userId, onVote,
}: {
  idea: InnovationIdea;
  onClose: () => void;
  token: string;
  userRole: InnovationRole;
  userId: string;
  onVote: (ideaId: string, newCount: number, userVote: number | null) => void;
}) {
  const [detail, setDetail] = useState<InnovationIdea | null>(null);
  const [comment, setComment] = useState("");
  const [submitting, setSubmitting] = useState(false);
  const [advancing, setAdvancing] = useState(false);
  const [advanceReason, setAdvanceReason] = useState("");

  useEffect(() => {
    fetch(`/api/innovation/ideas/${idea.id}`, {
      headers: { Authorization: `Bearer ${token}` },
    }).then((r) => r.ok && r.json()).then((d) => d && setDetail(d));
  }, [idea.id, token]);

  async function handleVote(value: 1 | -1) {
    const res = await fetch(`/api/innovation/ideas/${idea.id}/vote`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ value }),
    });
    if (res.ok) {
      const { newCount, action } = await res.json();
      const userVote = action === "removed" ? null : value;
      onVote(idea.id, newCount, userVote);
      setDetail((d) => d ? { ...d, vote_count: newCount, user_vote: userVote } : d);
    }
  }

  async function handleComment() {
    if (!comment.trim()) return;
    setSubmitting(true);
    const res = await fetch(`/api/innovation/ideas/${idea.id}/comments`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ body: comment }),
    });
    if (res.ok) {
      const newComment = await res.json();
      setDetail((d) => d ? {
        ...d,
        comments: [...(d.comments ?? []), newComment],
        comment_count: (d.comment_count ?? 0) + 1,
      } : d);
      setComment("");
    }
    setSubmitting(false);
  }

  async function handleAdvance() {
    if (!advanceReason.trim()) return;
    setAdvancing(true);
    const res = await fetch(`/api/innovation/ideas/${idea.id}/advance`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ reason: advanceReason }),
    });
    if (res.ok) {
      const refreshed = await fetch(`/api/innovation/ideas/${idea.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshed.ok) setDetail(await refreshed.json());
      setAdvanceReason("");
    }
    setAdvancing(false);
  }

  const d = detail ?? idea;

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed right-0 top-0 h-full w-full max-w-[480px] bg-white z-50 shadow-2xl flex flex-col overflow-hidden">
        {/* Header */}
        <div className="flex items-start justify-between p-5 border-b border-gray-200">
          <div className="flex-1 min-w-0 pr-3">
            <span className="font-mono text-xs text-gray-400">{d.idea_number}</span>
            <h2 className="text-base font-bold text-gray-900 mt-1">{d.title}</h2>
          </div>
          <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors flex-shrink-0">
            <X className="w-5 h-5 text-gray-500" />
          </button>
        </div>

        <div className="flex-1 overflow-y-auto p-5 space-y-5">
          {/* Stage */}
          {d.stage && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">Aşama</p>
              <div className="flex items-center gap-2">
                <div
                  className="px-3 py-1.5 rounded-full text-sm font-semibold"
                  style={{ background: d.stage.color + "22", color: d.stage.color }}
                >
                  {d.stage.name}
                </div>
                {d.stage.order_index < 5 && (
                  <span className="text-xs text-gray-400">→ aşama {d.stage.order_index + 1}</span>
                )}
              </div>
            </div>
          )}

          {/* Description */}
          {d.description && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-1">Açıklama</p>
              <p className="text-sm text-gray-700 whitespace-pre-wrap">{d.description}</p>
            </div>
          )}

          {/* Score + Vote */}
          <div className="grid grid-cols-2 gap-3">
            <div className="bg-gray-50 rounded-lg p-3 text-center">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide">Kompozit Puan</p>
              <p className="text-2xl font-bold text-gray-900 mt-1">{d.composite_score || "—"}</p>
            </div>
            <div className="bg-gray-50 rounded-lg p-3">
              <p className="text-xs text-gray-400 font-semibold uppercase tracking-wide mb-2">Oyunuz</p>
              <div className="flex gap-2">
                <button
                  onClick={() => handleVote(1)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors"
                  style={d.user_vote === 1
                    ? { background: "#059669", color: "#fff", borderColor: "#059669" }
                    : { borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  <ChevronUp className="w-4 h-4" />
                  {d.vote_count}
                </button>
                <button
                  onClick={() => handleVote(-1)}
                  className="flex-1 flex items-center justify-center gap-1 py-1.5 rounded-lg border text-sm font-semibold transition-colors"
                  style={d.user_vote === -1
                    ? { background: "#DC2626", color: "#fff", borderColor: "#DC2626" }
                    : { borderColor: "#E5E7EB", color: "#6B7280" }}
                >
                  <ChevronDown className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>

          {/* Evaluations */}
          {(d.evaluations?.length ?? 0) > 0 && (
            <div>
              <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
                Değerlendirmeler ({d.evaluations!.length})
              </p>
              <div className="space-y-2">
                {d.evaluations!.map((ev) => (
                  <div key={ev.id} className="bg-gray-50 rounded-lg p-3">
                    <div className="flex items-center justify-between">
                      <span className="text-xs font-semibold text-gray-700">
                        {ev.evaluator?.name ?? "Bilinmiyor"}
                      </span>
                      <span className="text-sm font-bold text-blue-600">{ev.total_score} puan</span>
                    </div>
                    {ev.notes && <p className="text-xs text-gray-500 mt-1">{ev.notes}</p>}
                  </div>
                ))}
              </div>
            </div>
          )}

          {/* Admin: advance stage */}
          {userRole === "innovation_admin" && (
            <div className="border border-purple-200 rounded-lg p-4 bg-purple-50">
              <p className="text-xs font-semibold text-purple-700 uppercase tracking-wide mb-2">Stage İlerlet</p>
              <input
                value={advanceReason}
                onChange={(e) => setAdvanceReason(e.target.value)}
                placeholder="İlerleme nedeni..."
                className="w-full text-sm border border-purple-200 rounded-lg px-3 py-2 bg-white focus:outline-none focus:border-purple-400 mb-2"
              />
              <button
                onClick={handleAdvance}
                disabled={advancing || !advanceReason.trim()}
                className="w-full flex items-center justify-center gap-2 py-2 bg-purple-600 text-white rounded-lg text-sm font-semibold hover:bg-purple-700 disabled:opacity-50 transition-colors"
              >
                {advancing ? <Loader2 className="w-4 h-4 animate-spin" /> : <ArrowRight className="w-4 h-4" />}
                Sonraki Aşamaya İlerlet
              </button>
            </div>
          )}

          {/* Comments */}
          <div>
            <p className="text-xs font-semibold uppercase tracking-wide text-gray-400 mb-2">
              Yorumlar ({d.comment_count ?? 0})
            </p>
            <div className="space-y-3">
              {(d.comments ?? []).filter((c) => !c.parent_id).map((c) => (
                <div key={c.id} className="flex gap-2">
                  <div className="w-7 h-7 rounded-full bg-gray-200 flex items-center justify-center text-xs font-bold text-gray-600 flex-shrink-0">
                    {c.author?.name?.[0]?.toUpperCase() ?? "?"}
                  </div>
                  <div className="flex-1 bg-gray-50 rounded-lg p-2.5">
                    <p className="text-xs font-semibold text-gray-700">{c.author?.name ?? "Bilinmiyor"}</p>
                    <p className="text-xs text-gray-600 mt-0.5">{c.body}</p>
                    <p className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
                    </p>
                  </div>
                </div>
              ))}
            </div>
            <div className="mt-3 flex gap-2">
              <input
                value={comment}
                onChange={(e) => setComment(e.target.value)}
                onKeyDown={(e) => { if (e.key === "Enter" && !e.shiftKey) { e.preventDefault(); handleComment(); } }}
                placeholder="Yorum ekle..."
                className="flex-1 text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
              <button
                onClick={handleComment}
                disabled={submitting || !comment.trim()}
                className="px-3 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
              >
                {submitting ? <Loader2 className="w-4 h-4 animate-spin" /> : "Gönder"}
              </button>
            </div>
          </div>
        </div>
      </div>
    </>
  );
}

// ── New Idea Modal ─────────────────────────────────────────────────────────────

function NewIdeaModal({ onClose, onCreated, token }: {
  onClose: () => void;
  onCreated: () => void;
  token: string;
}) {
  const [form, setForm] = useState({ title: "", description: "", category: "" });
  const [submitting, setSubmitting] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title.trim()) { setError("Başlık zorunludur"); return; }
    setSubmitting(true);
    const res = await fetch("/api/innovation/ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    if (res.ok) {
      onCreated();
    } else {
      const d = await res.json();
      setError(d.error ?? "Hata oluştu");
    }
    setSubmitting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="flex items-center justify-between p-5 border-b">
            <h2 className="text-base font-bold text-gray-900">Yeni Fikir Gönder</h2>
            <button onClick={onClose} className="p-1.5 rounded-lg hover:bg-gray-100">
              <X className="w-5 h-5 text-gray-500" />
            </button>
          </div>
          <div className="p-5 space-y-4">
            {error && <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{error}</p>}
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Başlık *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                placeholder="Fikrinizi kısaca özetleyin"
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                placeholder="Fikrinizi detaylandırın..."
                rows={4}
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
              />
            </div>
            <div>
              <label className="text-xs font-semibold text-gray-500 uppercase tracking-wide">Kategori</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                placeholder="Süreç İyileştirme, Müşteri Deneyimi..."
                className="mt-1 w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </div>
          </div>
          <div className="flex gap-3 p-5 border-t">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={submitting}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              Gönder
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Advance Reason Modal ──────────────────────────────────────────────────────

function AdvanceReasonModal({
  onConfirm,
  onCancel,
  error,
}: {
  onConfirm: (reason: string) => Promise<void>;
  onCancel: () => void;
  error: string;
}) {
  const [reason, setReason] = useState("");
  const [submitting, setSubmitting] = useState(false);

  async function handleSubmit() {
    if (!reason.trim()) return;
    setSubmitting(true);
    await onConfirm(reason);
    setSubmitting(false);
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/40 z-40" onClick={onCancel} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-xl w-full max-w-md p-6">
          <h3 className="text-base font-bold text-gray-900 mb-1">Aşama İlerlet</h3>
          <p className="text-sm text-gray-500 mb-4">Bu fikri bir sonraki aşamaya taşımak için gerekçe girin.</p>
          {error && (
            <div className="mb-3 flex items-center gap-2 text-sm text-red-600 bg-red-50 border border-red-200 rounded-lg px-3 py-2">
              <span className="flex-shrink-0">⚠</span>
              {error}
            </div>
          )}
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            placeholder="Gerekçe girin..."
            rows={3}
            className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
          />
          <div className="flex gap-3 mt-4">
            <button
              onClick={onCancel}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={!reason.trim() || submitting}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {submitting && <Loader2 className="w-4 h-4 animate-spin" />}
              İlerlet
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ──────────────────────────────────────────────────────────────────────

export default function InnovationPipeline() {
  const { user } = useAuthStore();
  const searchParams = useSearchParams();

  const [token, setToken] = useState("");
  const [ideas, setIdeas] = useState<InnovationIdea[]>([]);
  const [stages, setStages] = useState<InnovationStage[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);
  const [selectedIdea, setSelectedIdea] = useState<InnovationIdea | null>(null);
  const [showNewModal, setShowNewModal] = useState(false);
  const [userRole, setUserRole] = useState<InnovationRole>(null);
  const [viewMode, setViewMode] = useState<'list' | 'kanban'>('list');
  const [pendingAdvance, setPendingAdvance] = useState<{
    ideaId: string;
    originalStage: InnovationStage;
  } | null>(null);
  const [advanceError, setAdvanceError] = useState("");

  const [filters, setFilters] = useState({
    stage: searchParams.get("stage") ?? "",
    search: "",
    sort: (searchParams.get("sort") ?? "date") as "date" | "score" | "votes",
  });

  const loadIdeas = useCallback(async (tok: string, f: typeof filters) => {
    const params = new URLSearchParams();
    if (f.stage) params.set("stage", f.stage);
    if (f.search) params.set("search", f.search);
    params.set("sort", f.sort);

    const res = await fetch(`/api/innovation/ideas?${params}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (res.ok) {
      const data = await res.json();
      setIdeas(data.ideas);
      setTotal(data.total);
    }
    setLoading(false);
  }, []);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);

      const [stagesRes, statsRes] = await Promise.all([
        fetch("/api/innovation/stages", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/innovation/stats", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      if (stagesRes.ok) setStages(await stagesRes.json());
      if (statsRes.ok) {
        const statsData = await statsRes.json();
        setUserRole(statsData.user_role ?? null);
      }

      await loadIdeas(session.access_token, filters);

      const openId = searchParams.get("open");
      if (openId) {
        const res = await fetch(`/api/innovation/ideas/${openId}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        });
        if (res.ok) setSelectedIdea(await res.json());
      }
    }
    init();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  useEffect(() => {
    if (token) loadIdeas(token, filters);
  }, [filters, token, loadIdeas]);

  useEffect(() => {
    const saved = localStorage.getItem('innovation_view_mode');
    if (saved === 'kanban') setViewMode('kanban');
  }, []);

  function handleVote(ideaId: string, newCount: number, userVote: number | null) {
    setIdeas((prev) =>
      prev.map((i) => (i.id === ideaId ? { ...i, vote_count: newCount, user_vote: userVote } : i))
    );
  }

  function handleDragEnd(result: DropResult) {
    const { destination, source, draggableId } = result;
    if (!destination) return;
    if (source.droppableId === destination.droppableId) return;

    const fromStage = stages.find((s) => s.id === source.droppableId);
    const toStage = stages.find((s) => s.id === destination.droppableId);
    if (!fromStage || !toStage) return;
    if (toStage.order_index !== fromStage.order_index + 1) return;

    const idea = ideas.find((i) => i.id === draggableId);
    if (!idea) return;

    setIdeas((prev) =>
      prev.map((i) => i.id === idea.id ? { ...i, stage_id: toStage.id, stage: toStage } : i)
    );
    setAdvanceError("");
    setPendingAdvance({ ideaId: idea.id, originalStage: fromStage });
  }

  async function handleConfirmAdvance(reason: string) {
    if (!pendingAdvance) return;
    const res = await fetch(`/api/innovation/ideas/${pendingAdvance.ideaId}/advance`, {
      method: 'POST',
      headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
      body: JSON.stringify({ reason }),
    });
    if (!res.ok) {
      const err = await res.json();
      setAdvanceError(err.error ?? 'Stage ilerletme başarısız');
      const orig = pendingAdvance.originalStage;
      setIdeas((prev) =>
        prev.map((i) => i.id === pendingAdvance.ideaId ? { ...i, stage_id: orig.id, stage: orig } : i)
      );
      return;
    }
    setPendingAdvance(null);
  }

  return (
    <div className="max-w-4xl mx-auto space-y-4">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">İnovasyon Pipeline</h1>
          <p className="text-sm text-gray-500 mt-0.5">{total} fikir</p>
        </div>
        <button
          onClick={() => setShowNewModal(true)}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
        >
          <Plus className="w-4 h-4" />
          Fikir Ekle
        </button>
      </div>

      {/* Filter Bar */}
      <div className="bg-white rounded-lg border border-gray-200 p-3 flex items-center gap-3 flex-wrap">
        <div className="flex gap-1 flex-wrap">
          <button
            onClick={() => setFilters((f) => ({ ...f, stage: "" }))}
            className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
              !filters.stage ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
            }`}
          >
            Tümü
          </button>
          {stages.map((s) => (
            <button
              key={s.id}
              onClick={() => setFilters((f) => ({ ...f, stage: f.stage === s.id ? "" : s.id }))}
              className="px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors"
              style={
                filters.stage === s.id
                  ? { background: s.color, color: "#fff" }
                  : { color: "#6B7280" }
              }
            >
              {s.name}
            </button>
          ))}
        </div>
        <div className="flex-1" />
        <div className="relative">
          <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
          <input
            value={filters.search}
            onChange={(e) => setFilters((f) => ({ ...f, search: e.target.value }))}
            placeholder="Ara..."
            className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
          />
        </div>
        <select
          value={filters.sort}
          onChange={(e) => setFilters((f) => ({ ...f, sort: e.target.value as "date" | "score" | "votes" }))}
          className="text-sm border border-gray-200 rounded-lg px-2 py-1.5 focus:outline-none focus:border-blue-400"
        >
          <option value="date">Tarih</option>
          <option value="votes">Oy</option>
          <option value="score">Puan</option>
        </select>
        <div className="flex border border-gray-200 rounded-lg overflow-hidden">
          <button
            onClick={() => { setViewMode('list'); localStorage.setItem('innovation_view_mode', 'list'); }}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'list' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Liste görünümü"
          >
            <LayoutList className="w-3.5 h-3.5" />
          </button>
          <button
            onClick={() => { setViewMode('kanban'); localStorage.setItem('innovation_view_mode', 'kanban'); }}
            className={`px-2.5 py-1.5 text-xs font-semibold transition-colors flex items-center gap-1 ${
              viewMode === 'kanban' ? 'bg-gray-900 text-white' : 'text-gray-500 hover:bg-gray-100'
            }`}
            title="Kanban görünümü"
          >
            <LayoutGrid className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>

      {/* Ideas List / Kanban */}
      {loading ? (
        <div className="flex items-center justify-center h-40">
          <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
        </div>
      ) : viewMode === 'list' ? (
        ideas.length === 0 ? (
          <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-lg">
            <p className="text-gray-400 text-sm italic">Henüz fikir bulunmuyor.</p>
            <button
              onClick={() => setShowNewModal(true)}
              className="mt-3 text-sm text-blue-600 hover:underline"
            >
              İlk fikri siz gönderin
            </button>
          </div>
        ) : (
          <div className="space-y-3">
            {ideas.map((idea) => (
              <IdeaCard key={idea.id} idea={idea} onOpen={setSelectedIdea} />
            ))}
          </div>
        )
      ) : (
        <DragDropContext onDragEnd={handleDragEnd}>
          <div className="flex gap-4 overflow-x-auto pb-4">
            {stages.map((stage) => {
              const colIdeas = ideas.filter((i) => i.stage_id === stage.id);
              return (
                <div
                  key={stage.id}
                  className="flex-shrink-0 w-[280px] bg-gray-50 rounded-lg border border-gray-200"
                >
                  <div
                    className="p-3 border-b border-gray-200 flex items-center gap-2"
                    style={{ borderLeftWidth: 3, borderLeftColor: stage.color }}
                  >
                    <span className="text-sm font-semibold text-gray-700 flex-1 truncate">{stage.name}</span>
                    <span
                      className="text-xs font-bold px-2 py-0.5 rounded-full text-white flex-shrink-0"
                      style={{ background: stage.color }}
                    >
                      {colIdeas.length}
                    </span>
                  </div>
                  <Droppable droppableId={stage.id}>
                    {(provided, snapshot) => (
                      <div
                        ref={provided.innerRef}
                        {...provided.droppableProps}
                        className={`p-2 min-h-[96px] max-h-[calc(100vh-240px)] overflow-y-auto space-y-2 transition-colors ${
                          snapshot.isDraggingOver ? 'bg-blue-50' : ''
                        }`}
                      >
                        {colIdeas.map((idea, index) => (
                          <Draggable
                            key={idea.id}
                            draggableId={idea.id}
                            index={index}
                            isDragDisabled={userRole !== 'innovation_admin'}
                          >
                            {(dragProvided, dragSnapshot) => (
                              <div
                                ref={dragProvided.innerRef}
                                {...dragProvided.draggableProps}
                                {...dragProvided.dragHandleProps}
                                onClick={() => setSelectedIdea(idea)}
                                className={`bg-white border border-gray-200 rounded-lg p-3 transition-all ${
                                  dragSnapshot.isDragging ? 'shadow-lg rotate-1 border-blue-300' : 'hover:border-blue-200'
                                } ${userRole === 'innovation_admin' ? 'cursor-grab active:cursor-grabbing' : 'cursor-pointer'}`}
                              >
                                <p className="font-mono text-xs text-gray-400 mb-1">{idea.idea_number}</p>
                                <p className="text-sm font-semibold text-gray-800 line-clamp-2 leading-snug">{idea.title}</p>
                                <div className="flex items-center gap-2 mt-2 flex-wrap">
                                  <span
                                    className="text-xs font-bold"
                                    style={{ color: idea.vote_count >= 0 ? '#059669' : '#DC2626' }}
                                  >
                                    {idea.vote_count >= 0 ? '↑' : '↓'}{Math.abs(idea.vote_count)}
                                  </span>
                                  {idea.composite_score > 0 && (
                                    <span className="text-xs text-amber-600">⭐ {idea.composite_score}</span>
                                  )}
                                  {idea.submitter && (
                                    <span className="text-xs text-gray-400 ml-auto truncate max-w-[80px]">
                                      {idea.submitter.name}
                                    </span>
                                  )}
                                </div>
                              </div>
                            )}
                          </Draggable>
                        ))}
                        {provided.placeholder}
                        {colIdeas.length === 0 && (
                          <p className="text-xs text-gray-400 italic text-center py-4">Boş</p>
                        )}
                      </div>
                    )}
                  </Droppable>
                </div>
              );
            })}
          </div>
        </DragDropContext>
      )}

      {/* Detail Slide-Over */}
      {selectedIdea && (
        <DetailSlideOver
          idea={selectedIdea}
          onClose={() => setSelectedIdea(null)}
          token={token}
          userRole={userRole}
          userId={user?.id ?? ""}
          onVote={handleVote}
        />
      )}

      {/* New Idea Modal */}
      {showNewModal && (
        <NewIdeaModal
          onClose={() => setShowNewModal(false)}
          token={token}
          onCreated={() => {
            setShowNewModal(false);
            loadIdeas(token, filters);
          }}
        />
      )}

      {/* Advance Reason Modal */}
      {pendingAdvance && (
        <AdvanceReasonModal
          onConfirm={handleConfirmAdvance}
          onCancel={() => {
            const orig = pendingAdvance.originalStage;
            setIdeas((prev) =>
              prev.map((i) => i.id === pendingAdvance.ideaId ? { ...i, stage_id: orig.id, stage: orig } : i)
            );
            setPendingAdvance(null);
            setAdvanceError("");
          }}
          error={advanceError}
        />
      )}
    </div>
  );
}
