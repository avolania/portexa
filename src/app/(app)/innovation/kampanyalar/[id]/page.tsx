"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import {
  ArrowLeft, Loader2, Lock, Calendar, Target,
  Plus, Search, ChevronUp, ChevronDown, MessageCircle, Star,
  UserPlus, Trash2,
} from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  InnovationCampaign, InnovationIdea, InnovationStage,
  CampaignInvite, CreateIdeaDto, UpdateCampaignDto,
} from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

const STATUS_LABEL: Record<string, string> = {
  draft:  "Taslak",
  active: "Aktif",
  ended:  "Sona Erdi",
};

const STATUS_STYLE: Record<string, { bg: string; text: string }> = {
  draft:  { bg: "#F3F4F6", text: "#6B7280" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  ended:  { bg: "#F3E8FF", text: "#6D28D9" },
};

// ── Idea Card ─────────────────────────────────────────────────────────────────

function IdeaCard({ idea }: { idea: InnovationIdea }) {
  return (
    <div className="w-full text-left bg-white border border-gray-200 rounded-lg p-4">
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
    </div>
  );
}

// ── New Idea Modal ────────────────────────────────────────────────────────────

function NewIdeaModal({
  campaignId,
  token,
  onCreated,
  onClose,
}: {
  campaignId: string;
  token: string;
  onCreated: (idea: InnovationIdea) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<Omit<CreateIdeaDto, 'campaign_id'>>({
    title: "",
    description: "",
    category: "",
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title.trim()) { setError("Başlık zorunludur"); return; }
    setSaving(true);
    setError("");
    const res = await fetch("/api/innovation/ideas", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ ...form, campaign_id: campaignId }),
    });
    setSaving(false);
    if (res.ok) {
      onCreated(await res.json() as InnovationIdea);
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Fikir Gönder</h2>
          {error && <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>}
          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Başlık *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Fikrin başlığı"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={3}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Fikrin detayları"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Kategori</label>
              <input
                value={form.category}
                onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Örn: Verimlilik, Müşteri Deneyimi"
              />
            </div>
          </div>
          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Gönder
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Edit Campaign Modal ───────────────────────────────────────────────────────

function EditCampaignModal({
  campaign,
  token,
  onUpdated,
  onClose,
}: {
  campaign: InnovationCampaign;
  token: string;
  onUpdated: (c: InnovationCampaign) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<UpdateCampaignDto>({
    title: campaign.title,
    description: campaign.description ?? "",
    goal: campaign.goal ?? "",
    start_date: campaign.start_date,
    end_date: campaign.end_date,
    is_invite_only: campaign.is_invite_only,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title?.trim() || !form.start_date || !form.end_date) {
      setError("Başlık, başlangıç ve bitiş tarihleri zorunludur");
      return;
    }
    if (form.end_date < form.start_date!) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch(`/api/innovation/campaigns/${campaign.id}`, {
      method: "PATCH",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      // Reload the campaign to get updated data with derived status
      const refreshRes = await fetch(`/api/innovation/campaigns/${campaign.id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (refreshRes.ok) {
        onUpdated(await refreshRes.json() as InnovationCampaign);
      } else {
        onClose();
      }
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  return (
    <>
      <div className="fixed inset-0 bg-black/30 z-40" onClick={onClose} />
      <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg p-6 space-y-4">
          <h2 className="text-lg font-bold text-gray-900">Kampanyayı Düzenle</h2>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Başlık *</label>
              <input
                value={form.title ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Kampanya başlığı"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Açıklama</label>
              <textarea
                value={form.description ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Kampanya açıklaması"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Hedef</label>
              <input
                value={form.goal ?? ""}
                onChange={(e) => setForm((f) => ({ ...f, goal: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Bu kampanyanın hedefi nedir?"
              />
            </div>
            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Başlangıç *</label>
                <input
                  type="date"
                  value={form.start_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bitiş *</label>
                <input
                  type="date"
                  value={form.end_date ?? ""}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_invite_only ?? false}
                onChange={(e) => setForm((f) => ({ ...f, is_invite_only: e.target.checked }))}
                className="w-4 h-4 rounded"
              />
              <span className="text-sm text-gray-700">Sadece davetlilere açık</span>
            </label>
          </div>

          <div className="flex gap-3 pt-2">
            <button
              onClick={onClose}
              className="flex-1 px-4 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={handleSubmit}
              disabled={saving}
              className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center justify-center gap-2"
            >
              {saving && <Loader2 className="w-4 h-4 animate-spin" />}
              Kaydet
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Invites Tab ───────────────────────────────────────────────────────────────

function InvitesTab({ campaignId, token }: { campaignId: string; token: string }) {
  const [invites, setInvites] = useState<CampaignInvite[]>([]);
  const [loading, setLoading] = useState(true);
  const [userIdInput, setUserIdInput] = useState("");
  const [adding, setAdding] = useState(false);
  const [error, setError] = useState("");

  useEffect(() => {
    fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
      headers: { Authorization: `Bearer ${token}` },
    })
      .then((r) => r.ok && r.json())
      .then((d) => d && setInvites(d))
      .finally(() => setLoading(false));
  }, [campaignId, token]);

  async function handleAdd() {
    const ids = userIdInput.split(",").map((s) => s.trim()).filter(Boolean);
    if (!ids.length) return;
    setAdding(true);
    setError("");
    const res = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_ids: ids }),
    });
    setAdding(false);
    if (res.ok) {
      const fresh = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (fresh.ok) setInvites(await fresh.json());
      setUserIdInput("");
    } else {
      const err = await res.json().catch(() => ({ error: "Bir hata oluştu" }));
      setError((err as { error: string }).error);
    }
  }

  async function handleRemove(userId: string) {
    const res = await fetch(`/api/innovation/campaigns/${campaignId}/invites`, {
      method: "DELETE",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify({ user_id: userId }),
    });
    if (res.ok) setInvites((prev) => prev.filter((i) => i.user_id !== userId));
  }

  if (loading) return <div className="flex items-center justify-center h-24"><Loader2 className="w-5 h-5 animate-spin text-gray-400" /></div>;

  return (
    <div className="space-y-4">
      <div className="flex gap-2">
        <input
          value={userIdInput}
          onChange={(e) => setUserIdInput(e.target.value)}
          placeholder="Kullanıcı ID (virgülle ayırın)"
          className="flex-1 border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
        />
        <button
          onClick={handleAdd}
          disabled={adding || !userIdInput.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {adding ? <Loader2 className="w-4 h-4 animate-spin" /> : <UserPlus className="w-4 h-4" />}
          Ekle
        </button>
      </div>
      {error && <p className="text-sm text-red-600">{error}</p>}
      {invites.length === 0 ? (
        <p className="text-sm text-gray-400 italic text-center py-8">Henüz davetli yok.</p>
      ) : (
        <div className="space-y-2">
          {invites.map((invite) => (
            <div key={invite.user_id} className="flex items-center justify-between bg-white border border-gray-200 rounded-lg px-4 py-3">
              <span className="text-sm font-medium text-gray-800">{invite.name}</span>
              <button
                onClick={() => handleRemove(invite.user_id)}
                className="p-1.5 rounded-lg hover:bg-red-50 text-gray-400 hover:text-red-500 transition-colors"
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          ))}
        </div>
      )}
    </div>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type ActiveTab = "pipeline" | "invites";

export default function CampaignDetailPage() {
  const params = useParams();
  const router = useRouter();
  const campaignId = params.id as string;

  const [campaign, setCampaign] = useState<InnovationCampaign | null>(null);
  const [ideas, setIdeas] = useState<InnovationIdea[]>([]);
  const [stages, setStages] = useState<InnovationStage[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [isInvited, setIsInvited] = useState(false);
  const [activeTab, setActiveTab] = useState<ActiveTab>("pipeline");
  const [showNewModal, setShowNewModal] = useState(false);
  const [showEditModal, setShowEditModal] = useState(false);
  const [search, setSearch] = useState("");

  // Suppress unused variable warning for stages (fetched but not yet rendered)
  void stages;

  const loadIdeas = useCallback(async (tok: string, q: string) => {
    const p = new URLSearchParams({ campaign_id: campaignId });
    if (q) p.set("search", q);
    const res = await fetch(`/api/innovation/ideas?${p}`, {
      headers: { Authorization: `Bearer ${tok}` },
    });
    if (res.ok) {
      const data = await res.json();
      setIdeas(data.ideas ?? []);
    }
  }, [campaignId]);

  useEffect(() => {
    async function init() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      const tok = session.access_token;
      setToken(tok);

      const [campaignRes, stagesRes, statsRes] = await Promise.all([
        fetch(`/api/innovation/campaigns/${campaignId}`, { headers: { Authorization: `Bearer ${tok}` } }),
        fetch("/api/innovation/stages", { headers: { Authorization: `Bearer ${tok}` } }),
        fetch("/api/innovation/stats", { headers: { Authorization: `Bearer ${tok}` } }),
      ]);

      if (!campaignRes.ok) { router.replace("/innovation/kampanyalar"); return; }
      const c = await campaignRes.json() as InnovationCampaign;
      setCampaign(c);

      if (stagesRes.ok) setStages(await stagesRes.json());
      if (statsRes.ok) {
        const stats = await statsRes.json();
        const role = stats.user_role;
        setIsAdmin(role === "innovation_admin");
        if (role === "innovation_admin") {
          setIsInvited(true);
        } else {
          // is_invited is embedded in the campaign response — no extra fetch needed
          setIsInvited(c.is_invited ?? !c.is_invite_only);
        }
      }

      await loadIdeas(tok, "");
      setLoading(false);
    }
    init();
  }, [campaignId, router, loadIdeas]);

  useEffect(() => {
    if (token) loadIdeas(token, search);
  }, [search, token, loadIdeas]);

  const canSubmit = campaign?.status === "active" && (isAdmin || isInvited);

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (!campaign) return null;

  const style = STATUS_STYLE[campaign.status];

  return (
    <div className="max-w-4xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <button
          onClick={() => router.push("/innovation/kampanyalar")}
          className="flex items-center gap-1.5 text-sm text-gray-500 hover:text-gray-700 mb-3 transition-colors"
        >
          <ArrowLeft className="w-4 h-4" />
          Kampanyalar
        </button>
        <div className="flex items-start justify-between gap-4">
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2 flex-wrap">
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: style.bg, color: style.text }}
              >
                {STATUS_LABEL[campaign.status]}
              </span>
              {campaign.is_invite_only && (
                <span className="flex items-center gap-1 text-xs text-gray-500">
                  <Lock className="w-3 h-3" /> Davetli
                </span>
              )}
            </div>
            <h1 className="text-xl font-bold text-gray-900 mt-1">{campaign.title}</h1>
            {campaign.description && (
              <p className="text-sm text-gray-500 mt-1">{campaign.description}</p>
            )}
            <div className="flex items-center gap-4 mt-2 text-xs text-gray-400 flex-wrap">
              <span className="flex items-center gap-1">
                <Calendar className="w-3.5 h-3.5" />
                {campaign.start_date} → {campaign.end_date}
              </span>
              {campaign.goal && (
                <span className="flex items-center gap-1">
                  <Target className="w-3.5 h-3.5" />
                  {campaign.goal}
                </span>
              )}
              <span>{campaign.idea_count} fikir</span>
            </div>
          </div>
          {isAdmin && (
            <button
              onClick={() => setShowEditModal(true)}
              className="flex items-center gap-2 px-3 py-1.5 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors flex-shrink-0"
            >
              Düzenle
            </button>
          )}
        </div>
      </div>

      {/* Invite-only banner for non-invited */}
      {campaign.is_invite_only && !isAdmin && !isInvited && (
        <div className="bg-amber-50 border border-amber-200 rounded-lg px-4 py-3 text-sm text-amber-800">
          Bu kampanya yalnızca davetli katılımcılara açıktır.
        </div>
      )}

      {/* Tabs */}
      <div className="flex gap-1 border-b border-gray-200">
        <button
          onClick={() => setActiveTab("pipeline")}
          className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
            activeTab === "pipeline"
              ? "border-blue-600 text-blue-600"
              : "border-transparent text-gray-500 hover:text-gray-700"
          }`}
        >
          Pipeline
        </button>
        {isAdmin && (
          <button
            onClick={() => setActiveTab("invites")}
            className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
              activeTab === "invites"
                ? "border-blue-600 text-blue-600"
                : "border-transparent text-gray-500 hover:text-gray-700"
            }`}
          >
            Davetler
          </button>
        )}
      </div>

      {/* Tab Content */}
      {activeTab === "pipeline" && (
        <div className="space-y-4">
          <div className="flex items-center gap-3">
            {/* "Fikir Gönder" button logic */}
            {campaign.status === "active" ? (
              (isAdmin || isInvited) ? (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
                >
                  <Plus className="w-4 h-4" />
                  Fikir Gönder
                </button>
              ) : null  // invite-only and not invited → hide completely (banner shown above)
            ) : (
              <button
                disabled
                title="Kampanya aktif değil"
                className="flex items-center gap-2 px-4 py-2 bg-gray-200 text-gray-400 rounded-lg text-sm font-semibold cursor-not-allowed"
              >
                <Plus className="w-4 h-4" />
                Fikir Gönder
              </button>
            )}
            {campaign.status === "ended" && (
              <span className="text-sm text-gray-400 italic">Kampanya sona erdi — yeni fikir gönderilemez.</span>
            )}
            {campaign.status === "draft" && (
              <span className="text-sm text-gray-400 italic">Kampanya henüz başlamadı.</span>
            )}
            <div className="flex-1" />
            <div className="relative">
              <Search className="absolute left-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-gray-400" />
              <input
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                placeholder="Ara..."
                className="pl-8 pr-3 py-1.5 text-sm border border-gray-200 rounded-lg focus:outline-none focus:border-blue-400 w-44"
              />
            </div>
          </div>

          {ideas.length === 0 ? (
            <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
              <p className="text-gray-400 text-sm italic">
                {canSubmit ? "İlk fikri siz gönderin." : "Henüz fikir bulunmuyor."}
              </p>
              {canSubmit && (
                <button
                  onClick={() => setShowNewModal(true)}
                  className="mt-2 text-sm text-blue-600 hover:underline"
                >
                  Fikir Gönder
                </button>
              )}
            </div>
          ) : (
            <div className="space-y-3">
              {ideas.map((idea) => (
                <IdeaCard key={idea.id} idea={idea} />
              ))}
            </div>
          )}
        </div>
      )}

      {activeTab === "invites" && isAdmin && (
        <InvitesTab campaignId={campaignId} token={token} />
      )}

      {showNewModal && (
        <NewIdeaModal
          campaignId={campaignId}
          token={token}
          onCreated={(idea) => {
            setIdeas((prev) => [idea, ...prev]);
            setShowNewModal(false);
          }}
          onClose={() => setShowNewModal(false)}
        />
      )}

      {showEditModal && (
        <EditCampaignModal
          campaign={campaign}
          token={token}
          onUpdated={(updated) => {
            setCampaign(updated);
            setShowEditModal(false);
          }}
          onClose={() => setShowEditModal(false)}
        />
      )}
    </div>
  );
}
