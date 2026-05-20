"use client";

import { useEffect, useState, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { ArrowLeft, Save, Loader2, MessageCircle } from "lucide-react";
import { supabase } from "@/lib/supabase";
import type {
  InnovationIdea, UpdateIdeaDto, IdeaType, EstimatedImpact,
  IdeaConfidentiality, InnovationRole, IdeaComment, IdeaEvaluation,
  StageHistoryEntry,
} from "@/lib/innovation/types";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";

type Tab = 'details' | 'comments' | 'evaluations' | 'history';
type OrgUser = { id: string; name: string };

const IDEA_TYPE_LABELS: Record<string, string> = {
  '': '—',
  quick_win: 'Quick Win',
  process: 'Süreç İyileştirme',
  digital: 'Dijital / BT Projesi',
  ai_data: 'Yapay Zeka / Veri',
  ot: 'BT-OT / Akıllı Fabrika',
  strategic: 'Stratejik İnovasyon',
};

const IMPACT_LABELS: Record<string, string> = {
  '': '—',
  low: 'Düşük',
  medium: 'Orta',
  high: 'Yüksek',
};

const CONFIDENTIALITY_LABELS: Record<string, string> = {
  open: 'Açık',
  team: 'Ekip',
  private: 'Gizli',
};

export default function IdeaDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [token, setToken] = useState('');
  const [userId, setUserId] = useState('');

  const [idea, setIdea] = useState<InnovationIdea | null>(null);
  const [loading, setLoading] = useState(true);
  const [notFound, setNotFound] = useState(false);
  const [tab, setTab] = useState<Tab>('details');

  const [innovationRole, setInnovationRole] = useState<InnovationRole>(null);
  const [orgUsers, setOrgUsers] = useState<OrgUser[]>([]);
  const [form, setForm] = useState<UpdateIdeaDto>({});
  const [saving, setSaving] = useState(false);
  const [saveError, setSaveError] = useState('');
  const [saveSuccess, setSaveSuccess] = useState(false);

  const [commentBody, setCommentBody] = useState('');
  const [postingComment, setPostingComment] = useState(false);

  // Resolve session once
  useEffect(() => {
    supabase.auth.getSession().then(({ data: { session } }) => {
      if (!session) return;
      setToken(session.access_token);
      setUserId(session.user.id);
    });
  }, []);

  const fetchIdea = useCallback(async () => {
    if (!token) return;
    const res = await fetch(`/api/innovation/ideas/${id}`, {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (res.status === 404) { setNotFound(true); setLoading(false); return; }
    if (!res.ok) { setLoading(false); return; }
    const data = await res.json() as InnovationIdea;
    setIdea(data);
    setForm({
      title: data.title,
      problem: data.problem,
      proposed_solution: data.proposed_solution,
      category: data.category,
      affected_area: data.affected_area,
      location_process: data.location_process,
      idea_type: data.idea_type,
      estimated_impact: data.estimated_impact,
      confidentiality: data.confidentiality,
      sponsor_id: data.sponsor_id,
      estimated_value: data.estimated_value,
      currency_code: data.currency_code,
    });
    setLoading(false);
  }, [id, token]);

  useEffect(() => { fetchIdea(); }, [fetchIdea]);

  useEffect(() => {
    if (!userId) return;
    supabase
      .from('auth_profiles')
      .select('innovation_role')
      .eq('id', userId)
      .single()
      .then(({ data }) => {
        setInnovationRole((data?.innovation_role ?? null) as InnovationRole);
      });
  }, [userId]);

  useEffect(() => {
    if (!token) return;
    fetch('/api/innovation/users', { headers: { Authorization: `Bearer ${token}` } })
      .then((r) => (r.ok ? r.json() : []))
      .then((data: OrgUser[]) => setOrgUsers(data))
      .catch(() => {});
  }, [token]);

  const canEdit = idea
    ? idea.submitter_id === userId || innovationRole === 'innovation_admin'
    : false;

  async function handleSave() {
    if (!idea) return;
    setSaving(true);
    setSaveError('');
    setSaveSuccess(false);
    try {
      const res = await fetch(`/api/innovation/ideas/${idea.id}`, {
        method: 'PATCH',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify(form),
      });
      if (res.ok) {
        setSaveSuccess(true);
        setTimeout(() => setSaveSuccess(false), 3000);
        fetchIdea();
      } else {
        const d = await res.json().catch(() => ({ error: 'Hata oluştu' }));
        setSaveError(d.error ?? 'Hata oluştu');
      }
    } finally {
      setSaving(false);
    }
  }

  async function handleAddComment() {
    if (!commentBody.trim() || !idea) return;
    setPostingComment(true);
    try {
      const res = await fetch(`/api/innovation/ideas/${idea.id}/comments`, {
        method: 'POST',
        headers: { Authorization: `Bearer ${token}`, 'Content-Type': 'application/json' },
        body: JSON.stringify({ body: commentBody }),
      });
      if (res.ok) {
        setCommentBody('');
        fetchIdea();
      }
    } finally {
      setPostingComment(false);
    }
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <Loader2 className="w-6 h-6 animate-spin text-gray-400" />
      </div>
    );
  }

  if (notFound || !idea) {
    return (
      <div className="flex flex-col items-center justify-center h-64 gap-3">
        <p className="text-gray-500">Fikir bulunamadı.</p>
        <button onClick={() => router.back()} className="text-sm text-blue-600 hover:underline">
          Geri dön
        </button>
      </div>
    );
  }

  const tabs: { key: Tab; label: string }[] = [
    { key: 'details', label: 'Detaylar' },
    { key: 'comments', label: `Yorumlar (${(idea.comments ?? []).length})` },
    { key: 'evaluations', label: `Değerlendirmeler (${(idea.evaluations ?? []).length})` },
    { key: 'history', label: 'Geçmiş' },
  ];

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="bg-white border-b border-gray-200 px-6 py-4">
        <div className="flex items-center gap-3 mb-3">
          <button
            onClick={() => router.back()}
            className="p-1.5 rounded-lg hover:bg-gray-100 transition-colors"
          >
            <ArrowLeft className="w-4 h-4 text-gray-500" />
          </button>
          <span className="font-mono text-xs font-bold text-gray-400">{idea.idea_number}</span>
          {idea.stage && (
            <span
              className="text-xs font-semibold px-2 py-0.5 rounded-full"
              style={{ background: idea.stage.color + '22', color: idea.stage.color }}
            >
              {idea.stage.name}
            </span>
          )}
          <span className="text-xs text-gray-400 capitalize">{idea.status}</span>
        </div>
        <h1 className="text-lg font-bold text-gray-900">{idea.title}</h1>
      </div>

      <div className="bg-white border-b border-gray-200 px-6">
        <div className="flex">
          {tabs.map((t) => (
            <button
              key={t.key}
              onClick={() => setTab(t.key)}
              className={`px-4 py-3 text-sm font-semibold border-b-2 transition-colors ${
                tab === t.key
                  ? 'border-blue-500 text-blue-600'
                  : 'border-transparent text-gray-500 hover:text-gray-700'
              }`}
            >
              {t.label}
            </button>
          ))}
        </div>
      </div>

      <div className="max-w-5xl mx-auto px-6 py-6">
        {tab === 'details' && (
          <DetailsTab
            idea={idea}
            form={form}
            setForm={setForm}
            canEdit={canEdit}
            orgUsers={orgUsers}
            saving={saving}
            saveError={saveError}
            saveSuccess={saveSuccess}
            onSave={handleSave}
          />
        )}
        {tab === 'comments' && (
          <CommentsTab
            comments={idea.comments ?? []}
            commentBody={commentBody}
            setCommentBody={setCommentBody}
            posting={postingComment}
            onSubmit={handleAddComment}
          />
        )}
        {tab === 'evaluations' && (
          <EvaluationsTab evaluations={idea.evaluations ?? []} />
        )}
        {tab === 'history' && (
          <HistoryTab history={idea.stage_history ?? []} />
        )}
      </div>
    </div>
  );
}

function ReadField({ label, value, multiline }: { label: string; value: string; multiline?: boolean }) {
  return (
    <div>
      <p className="text-xs font-semibold text-gray-400 uppercase tracking-wide mb-1">{label}</p>
      {multiline
        ? <p className="text-sm text-gray-800 whitespace-pre-wrap">{value || '—'}</p>
        : <p className="text-sm text-gray-800">{value || '—'}</p>
      }
    </div>
  );
}

function EditField({ label, children, className }: { label: string; children: React.ReactNode; className?: string }) {
  return (
    <div className={className}>
      <label className="block text-xs font-semibold text-gray-500 uppercase tracking-wide mb-1">{label}</label>
      {children}
    </div>
  );
}

function DetailsTab({
  idea, form, setForm, canEdit, orgUsers, saving, saveError, saveSuccess, onSave,
}: {
  idea: InnovationIdea;
  form: UpdateIdeaDto;
  setForm: React.Dispatch<React.SetStateAction<UpdateIdeaDto>>;
  canEdit: boolean;
  orgUsers: OrgUser[];
  saving: boolean;
  saveError: string;
  saveSuccess: boolean;
  onSave: () => void;
}) {
  if (!canEdit) {
    return (
      <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
        <ReadField label="Problem / Fırsat" value={idea.problem} multiline />
        <ReadField label="Önerilen Çözüm" value={idea.proposed_solution} multiline />
        <ReadField label="Kategori" value={idea.category} />
        <ReadField label="Fikir Tipi" value={IDEA_TYPE_LABELS[idea.idea_type] ?? idea.idea_type} />
        <ReadField label="Etkilenen Alan" value={idea.affected_area} />
        <ReadField label="Lokasyon / Süreç" value={idea.location_process} />
        <ReadField label="Tahmini Etki" value={IMPACT_LABELS[idea.estimated_impact] ?? idea.estimated_impact} />
        <ReadField label="Gizlilik" value={CONFIDENTIALITY_LABELS[idea.confidentiality] ?? idea.confidentiality} />
        <ReadField label="Tahmini Değer" value={idea.estimated_value ? `${idea.estimated_value} ${idea.currency_code}` : '—'} />
        <ReadField label="Sponsor" value={idea.sponsor?.name ?? '—'} />
      </div>
    );
  }

  return (
    <div className="space-y-6">
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="space-y-4">
          <EditField label="Problem / Fırsat">
            <textarea
              value={form.problem ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, problem: e.target.value }))}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            />
          </EditField>
          <EditField label="Kategori">
            <input
              value={form.category ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, category: e.target.value }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </EditField>
          <EditField label="Etkilenen Alan">
            <input
              value={form.affected_area ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, affected_area: e.target.value }))}
              placeholder="Üretim, Kalite, R&D, Supply Chain..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </EditField>
          <EditField label="Tahmini Etki">
            <select
              value={form.estimated_impact ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, estimated_impact: e.target.value as EstimatedImpact }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">Seçiniz...</option>
              <option value="low">Düşük</option>
              <option value="medium">Orta</option>
              <option value="high">Yüksek</option>
            </select>
          </EditField>
          <div className="flex gap-2">
            <EditField label="Tahmini Değer" className="flex-1">
              <input
                type="number"
                value={form.estimated_value ?? ''}
                onChange={(e) => setForm((f) => ({ ...f, estimated_value: e.target.value ? Number(e.target.value) : undefined }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </EditField>
            <EditField label="Para Birimi" className="w-24">
              <input
                value={form.currency_code ?? 'TRY'}
                onChange={(e) => setForm((f) => ({ ...f, currency_code: e.target.value }))}
                className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
              />
            </EditField>
          </div>
        </div>

        <div className="space-y-4">
          <EditField label="Önerilen Çözüm">
            <textarea
              value={form.proposed_solution ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, proposed_solution: e.target.value }))}
              rows={4}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
            />
          </EditField>
          <EditField label="Fikir Tipi">
            <select
              value={form.idea_type ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, idea_type: e.target.value as IdeaType }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">Seçiniz...</option>
              <option value="quick_win">Quick Win</option>
              <option value="process">Süreç İyileştirme</option>
              <option value="digital">Dijital / BT Projesi</option>
              <option value="ai_data">Yapay Zeka / Veri</option>
              <option value="ot">BT-OT / Akıllı Fabrika</option>
              <option value="strategic">Stratejik İnovasyon</option>
            </select>
          </EditField>
          <EditField label="Lokasyon / Süreç">
            <input
              value={form.location_process ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, location_process: e.target.value }))}
              placeholder="Fabrika, hat, departman, ülke..."
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400"
            />
          </EditField>
          <EditField label="Gizlilik">
            <select
              value={form.confidentiality ?? 'open'}
              onChange={(e) => setForm((f) => ({ ...f, confidentiality: e.target.value as IdeaConfidentiality }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="open">Açık</option>
              <option value="team">Ekip</option>
              <option value="private">Gizli</option>
            </select>
          </EditField>
          <EditField label="Sponsor">
            <select
              value={form.sponsor_id ?? ''}
              onChange={(e) => setForm((f) => ({ ...f, sponsor_id: e.target.value || null }))}
              className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 bg-white"
            >
              <option value="">Sponsor Yok</option>
              {orgUsers.map((u) => (
                <option key={u.id} value={u.id}>{u.name}</option>
              ))}
            </select>
          </EditField>
        </div>
      </div>

      {saveError && (
        <p className="text-sm text-red-600 bg-red-50 rounded-lg px-3 py-2">{saveError}</p>
      )}

      <div className="flex items-center gap-3">
        <button
          onClick={onSave}
          disabled={saving}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {saving ? <Loader2 className="w-4 h-4 animate-spin" /> : <Save className="w-4 h-4" />}
          Kaydet
        </button>
        {saveSuccess && (
          <span className="text-sm text-green-600 font-medium">✓ Kaydedildi</span>
        )}
      </div>
    </div>
  );
}

function CommentsTab({
  comments, commentBody, setCommentBody, posting, onSubmit,
}: {
  comments: IdeaComment[];
  commentBody: string;
  setCommentBody: (v: string) => void;
  posting: boolean;
  onSubmit: () => void;
}) {
  return (
    <div className="space-y-4">
      <div className="space-y-3">
        {comments.length === 0 && (
          <p className="text-sm text-gray-400 italic">Henüz yorum yok.</p>
        )}
        {comments.map((c) => (
          <div key={c.id} className="bg-white rounded-lg border border-gray-200 p-4">
            <div className="flex items-center gap-2 mb-2">
              <span className="text-sm font-semibold text-gray-800">{c.author?.name ?? 'Kullanıcı'}</span>
              <span className="text-xs text-gray-400">
                {formatDistanceToNow(new Date(c.created_at), { addSuffix: true, locale: tr })}
              </span>
            </div>
            <p className="text-sm text-gray-700 whitespace-pre-wrap">{c.body}</p>
          </div>
        ))}
      </div>
      <div className="bg-white rounded-lg border border-gray-200 p-4 space-y-3">
        <label className="flex items-center gap-1.5 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <MessageCircle className="w-3.5 h-3.5" />
          Yorum Ekle
        </label>
        <textarea
          value={commentBody}
          onChange={(e) => setCommentBody(e.target.value)}
          rows={3}
          placeholder="Yorumunuzu yazın..."
          className="w-full text-sm border border-gray-200 rounded-lg px-3 py-2 focus:outline-none focus:border-blue-400 resize-none"
        />
        <button
          onClick={onSubmit}
          disabled={posting || !commentBody.trim()}
          className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 disabled:opacity-50 transition-colors"
        >
          {posting && <Loader2 className="w-4 h-4 animate-spin" />}
          Gönder
        </button>
      </div>
    </div>
  );
}

function EvaluationsTab({ evaluations }: { evaluations: IdeaEvaluation[] }) {
  if (!evaluations.length) {
    return <p className="text-sm text-gray-400 italic">Henüz değerlendirme yok.</p>;
  }
  return (
    <div className="space-y-4">
      {evaluations.map((ev) => (
        <div key={ev.id} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center justify-between mb-2">
            <span className="text-sm font-semibold text-gray-800">{ev.evaluator?.name ?? 'Değerlendirici'}</span>
            <span className="text-sm font-bold text-blue-600">{ev.total_score} puan</span>
          </div>
          {ev.notes && <p className="text-sm text-gray-600">{ev.notes}</p>}
          <p className="text-xs text-gray-400 mt-2">
            {formatDistanceToNow(new Date(ev.created_at), { addSuffix: true, locale: tr })}
          </p>
        </div>
      ))}
    </div>
  );
}

function HistoryTab({ history }: { history: StageHistoryEntry[] }) {
  if (!history.length) {
    return <p className="text-sm text-gray-400 italic">Geçmiş kaydı yok.</p>;
  }
  return (
    <div className="space-y-3">
      {history.map((entry) => (
        <div key={entry.id} className="bg-white rounded-lg border border-gray-200 p-4">
          <div className="flex items-center gap-2 text-sm flex-wrap mb-1">
            {entry.from_stage && (
              <>
                <span
                  className="text-xs font-semibold px-2 py-0.5 rounded-full"
                  style={{ background: entry.from_stage.color + '22', color: entry.from_stage.color }}
                >
                  {entry.from_stage.name}
                </span>
                <span className="text-gray-400">→</span>
              </>
            )}
            {entry.to_stage && (
              <span
                className="text-xs font-semibold px-2 py-0.5 rounded-full"
                style={{ background: entry.to_stage.color + '22', color: entry.to_stage.color }}
              >
                {entry.to_stage.name}
              </span>
            )}
          </div>
          {entry.reason && <p className="text-sm text-gray-600">{entry.reason}</p>}
          <p className="text-xs text-gray-400 mt-1">
            {entry.changer?.name ?? 'Sistem'} ·{' '}
            {formatDistanceToNow(new Date(entry.created_at), { addSuffix: true, locale: tr })}
          </p>
        </div>
      ))}
    </div>
  );
}
