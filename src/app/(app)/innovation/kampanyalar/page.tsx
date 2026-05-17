"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { Plus, Loader2, Megaphone, Lock, Calendar } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type { InnovationCampaign, CreateCampaignDto, CampaignStatus } from "@/lib/innovation/types";

const STATUS_LABEL: Record<CampaignStatus, string> = {
  draft: "Taslak",
  active: "Aktif",
  ended: "Sona Erdi",
};

const STATUS_STYLE: Record<CampaignStatus, { bg: string; text: string }> = {
  draft:  { bg: "#F3F4F6", text: "#6B7280" },
  active: { bg: "#D1FAE5", text: "#065F46" },
  ended:  { bg: "#F3E8FF", text: "#6D28D9" },
};

// ── New Campaign Modal ────────────────────────────────────────────────────────

function NewCampaignModal({
  token,
  onCreated,
  onClose,
}: {
  token: string;
  onCreated: (c: InnovationCampaign) => void;
  onClose: () => void;
}) {
  const [form, setForm] = useState<CreateCampaignDto>({
    title: "",
    description: "",
    goal: "",
    start_date: "",
    end_date: "",
    is_invite_only: false,
  });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState("");

  async function handleSubmit() {
    if (!form.title.trim() || !form.start_date || !form.end_date) {
      setError("Başlık, başlangıç ve bitiş tarihleri zorunludur");
      return;
    }
    if (form.end_date < form.start_date) {
      setError("Bitiş tarihi başlangıç tarihinden önce olamaz");
      return;
    }
    setSaving(true);
    setError("");
    const res = await fetch("/api/innovation/campaigns", {
      method: "POST",
      headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
      body: JSON.stringify(form),
    });
    setSaving(false);
    if (res.ok) {
      const campaign = await res.json() as InnovationCampaign;
      onCreated(campaign);
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
          <h2 className="text-lg font-bold text-gray-900">Yeni Kampanya</h2>

          {error && (
            <p className="text-sm text-red-600 bg-red-50 px-3 py-2 rounded-lg">{error}</p>
          )}

          <div className="space-y-3">
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Başlık *</label>
              <input
                value={form.title}
                onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                placeholder="Kampanya başlığı"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Açıklama</label>
              <textarea
                value={form.description}
                onChange={(e) => setForm((f) => ({ ...f, description: e.target.value }))}
                rows={2}
                className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400 resize-none"
                placeholder="Kampanya açıklaması"
              />
            </div>
            <div>
              <label className="block text-xs font-semibold text-gray-500 mb-1">Hedef</label>
              <input
                value={form.goal}
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
                  value={form.start_date}
                  onChange={(e) => setForm((f) => ({ ...f, start_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
              <div>
                <label className="block text-xs font-semibold text-gray-500 mb-1">Bitiş *</label>
                <input
                  type="date"
                  value={form.end_date}
                  onChange={(e) => setForm((f) => ({ ...f, end_date: e.target.value }))}
                  className="w-full border border-gray-200 rounded-lg px-3 py-2 text-sm focus:outline-none focus:border-blue-400"
                />
              </div>
            </div>
            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={form.is_invite_only}
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
              Oluştur
            </button>
          </div>
        </div>
      </div>
    </>
  );
}

// ── Page ─────────────────────────────────────────────────────────────────────

type FilterTab = 'all' | CampaignStatus;

export default function KampanyalarPage() {
  const router = useRouter();
  const [campaigns, setCampaigns] = useState<InnovationCampaign[]>([]);
  const [loading, setLoading] = useState(true);
  const [token, setToken] = useState("");
  const [isAdmin, setIsAdmin] = useState(false);
  const [showModal, setShowModal] = useState(false);
  const [tab, setTab] = useState<FilterTab>("all");

  useEffect(() => {
    async function load() {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) return;
      setToken(session.access_token);

      const [campaignsRes, statsRes] = await Promise.all([
        fetch("/api/innovation/campaigns", { headers: { Authorization: `Bearer ${session.access_token}` } }),
        fetch("/api/innovation/stats", { headers: { Authorization: `Bearer ${session.access_token}` } }),
      ]);

      if (campaignsRes.ok) setCampaigns(await campaignsRes.json());
      if (statsRes.ok) {
        const stats = await statsRes.json();
        setIsAdmin(stats.user_role === "innovation_admin");
      }
      setLoading(false);
    }
    load();
  }, []);

  const filtered = tab === "all" ? campaigns : campaigns.filter((c) => c.status === tab);

  const TABS: { key: FilterTab; label: string }[] = [
    { key: "all", label: "Tümü" },
    { key: "active", label: "Aktif" },
    { key: "draft", label: "Taslak" },
    { key: "ended", label: "Sona Erdi" },
  ];

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  return (
    <div className="max-w-5xl mx-auto space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Kampanyalar</h1>
          <p className="text-sm text-gray-500 mt-0.5">Tematik fikir toplama kampanyaları</p>
        </div>
        {isAdmin && (
          <button
            onClick={() => setShowModal(true)}
            className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
          >
            <Plus className="w-4 h-4" />
            Yeni Kampanya
          </button>
        )}
      </div>

      {/* Tabs — only shown to admin (who can see draft/ended) */}
      {isAdmin && (
        <div className="flex gap-1">
          {TABS.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                tab === t.key ? "bg-gray-900 text-white" : "text-gray-600 hover:bg-gray-100"
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      )}

      {/* Campaign Cards */}
      {filtered.length === 0 ? (
        <div className="text-center py-16 border-2 border-dashed border-gray-200 rounded-xl">
          <Megaphone className="w-10 h-10 text-gray-300 mx-auto mb-3" />
          <p className="text-gray-400 text-sm italic">Henüz kampanya bulunmuyor.</p>
        </div>
      ) : (
        <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-4">
          {filtered.map((campaign) => {
            const style = STATUS_STYLE[campaign.status];
            return (
              <button
                key={campaign.id}
                onClick={() => router.push(`/innovation/kampanyalar/${campaign.id}`)}
                className="text-left bg-white border border-gray-200 rounded-xl p-5 hover:border-blue-300 hover:shadow-sm transition-all space-y-3"
              >
                <div className="flex items-start justify-between gap-2">
                  <span
                    className="text-xs font-semibold px-2 py-0.5 rounded-full flex-shrink-0"
                    style={{ background: style.bg, color: style.text }}
                  >
                    {STATUS_LABEL[campaign.status]}
                  </span>
                  {campaign.is_invite_only && (
                    <Lock className="w-3.5 h-3.5 text-gray-400 flex-shrink-0 mt-0.5" />
                  )}
                </div>
                <div>
                  <p className="font-bold text-gray-900 text-sm leading-snug">{campaign.title}</p>
                  {campaign.description && (
                    <p className="text-xs text-gray-500 mt-1 line-clamp-2">{campaign.description}</p>
                  )}
                </div>
                <div className="flex items-center gap-3 text-xs text-gray-400">
                  <span className="flex items-center gap-1">
                    <Calendar className="w-3 h-3" />
                    {campaign.start_date} → {campaign.end_date}
                  </span>
                </div>
                <div className="text-xs text-gray-500 font-semibold">
                  {campaign.idea_count} fikir
                </div>
              </button>
            );
          })}
        </div>
      )}

      {showModal && (
        <NewCampaignModal
          token={token}
          onCreated={(c) => {
            setCampaigns((prev) => [c, ...prev]);
            setShowModal(false);
          }}
          onClose={() => setShowModal(false)}
        />
      )}
    </div>
  );
}
