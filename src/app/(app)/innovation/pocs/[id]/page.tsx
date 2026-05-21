'use client';

import { useEffect, useState, useCallback } from 'react';
import { useRouter, useParams } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { InnovationPoc, PocUpdate, PocTransitionAction, InnovationRole } from '@/lib/innovation/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  pending_sponsor_approval: 'Sponsor Onayı Bekliyor',
  active: 'Aktif',
  on_hold: 'Beklemede',
  pending_completion_approval: 'Tamamlama Onayı Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const STATUS_COLORS: Record<string, string> = {
  draft: '#6B7280', pending_sponsor_approval: '#7C3AED', active: '#059669',
  on_hold: '#D97706', pending_completion_approval: '#7C3AED',
  completed: '#374151', cancelled: '#9CA3AF',
};

function getActions(status: string, roles: InnovationRole[], ownerId: string, userId: string): { action: PocTransitionAction; label: string; danger?: boolean }[] {
  const isAdmin = roles.includes('innovation_admin');
  const isSponsor = roles.includes('business_sponsor');
  const isOwner = ownerId === userId;
  const actions: { action: PocTransitionAction; label: string; danger?: boolean }[] = [];

  if (status === 'draft' && (isAdmin || isOwner))
    actions.push({ action: 'submit_for_approval', label: 'Onaya Gönder' });
  if (status === 'pending_sponsor_approval' && (isAdmin || isSponsor)) {
    actions.push({ action: 'approve_start', label: 'Onayla & Başlat' });
    actions.push({ action: 'reject_start', label: 'Reddet', danger: true });
  }
  if (status === 'active' && (isAdmin || isOwner)) {
    actions.push({ action: 'hold', label: 'Askıya Al' });
    actions.push({ action: 'submit_completion', label: 'Tamamlamaya Gönder' });
  }
  if (status === 'on_hold' && (isAdmin || isOwner))
    actions.push({ action: 'resume', label: 'Devam Ettir' });
  if (status === 'pending_completion_approval' && (isAdmin || isSponsor)) {
    actions.push({ action: 'approve_completion', label: 'Tamamlandı Onayla' });
    actions.push({ action: 'reject_completion', label: 'Geri Al', danger: true });
  }
  if (!['completed', 'cancelled'].includes(status) && isAdmin)
    actions.push({ action: 'cancel', label: 'İptal Et', danger: true });

  return actions;
}

export default function PocDetailPage() {
  const { id } = useParams<{ id: string }>();
  const router = useRouter();

  const [poc, setPoc] = useState<InnovationPoc | null>(null);
  const [loading, setLoading] = useState(true);
  const [userId, setUserId] = useState('');
  const [innovationRoles, setInnovationRoles] = useState<InnovationRole[]>([]);
  const [token, setToken] = useState('');
  const [transitioning, setTransitioning] = useState(false);
  const [updateContent, setUpdateContent] = useState('');
  const [addingUpdate, setAddingUpdate] = useState(false);
  const [error, setError] = useState('');
  const [editField, setEditField] = useState<string | null>(null);
  const [editValue, setEditValue] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      setToken(session.access_token);
      setUserId(session.user.id);

      const [pocRes, rolesRes] = await Promise.all([
        fetch(`/api/innovation/pocs/${id}`, {
          headers: { Authorization: `Bearer ${session.access_token}` },
        }),
        supabase
          .from('innovation_user_roles')
          .select('role')
          .eq('user_id', session.user.id),
      ]);

      if (pocRes.ok) setPoc(await pocRes.json());
      else router.push('/innovation/pocs');

      setInnovationRoles((rolesRes.data ?? []).map((r: { role: string }) => r.role as InnovationRole));
      setLoading(false);
    };
    load();
  }, [id]);

  const handleTransition = useCallback(async (action: PocTransitionAction) => {
    if (!token) return;
    setTransitioning(true);
    setError('');
    const res = await fetch(`/api/innovation/pocs/${id}/transition`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ action }),
    });
    if (res.ok) {
      const updated = await fetch(`/api/innovation/pocs/${id}`, {
        headers: { Authorization: `Bearer ${token}` },
      });
      if (updated.ok) setPoc(await updated.json());
    } else {
      const d = await res.json();
      setError(d.error ?? 'Hata');
    }
    setTransitioning(false);
  }, [id, token]);

  const handleAddUpdate = async () => {
    if (!updateContent.trim() || !token) return;
    setAddingUpdate(true);
    setError('');
    const res = await fetch(`/api/innovation/pocs/${id}/updates`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ content: updateContent }),
    });
    if (res.ok) {
      const newUpdate = await res.json();
      setPoc((prev) => prev ? {
        ...prev,
        updates: [newUpdate, ...(prev.updates ?? [])],
      } : prev);
      setUpdateContent('');
    } else {
      const d = await res.json();
      setError(d.error ?? 'Hata');
    }
    setAddingUpdate(false);
  };

  const handleSaveField = async (field: string, value: string) => {
    if (!token) return;
    const res = await fetch(`/api/innovation/pocs/${id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
      body: JSON.stringify({ [field]: value }),
    });
    if (res.ok) {
      setPoc((prev) => prev ? { ...prev, [field]: value } : prev);
      setEditField(null);
    }
  };

  if (loading) return (
    <div style={{ padding: 40, textAlign: 'center', color: '#9CA3AF', fontFamily: 'IBM Plex Sans, sans-serif' }}>
      Yükleniyor…
    </div>
  );

  if (!poc) return null;

  const statusColor = STATUS_COLORS[poc.status] ?? '#6B7280';
  const actions = getActions(poc.status, innovationRoles, poc.owner_id, userId);

  return (
    <div style={{ padding: 24, fontFamily: 'IBM Plex Sans, sans-serif', maxWidth: 1100 }}>
      {/* Back link */}
      <button
        onClick={() => router.push('/innovation/pocs')}
        style={{ background: 'none', border: 'none', cursor: 'pointer', color: '#6B7280', fontSize: 13, marginBottom: 16, padding: 0 }}
      >
        ← POC Listesi
      </button>

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'flex-start', justifyContent: 'space-between', marginBottom: 24 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: '0 0 6px' }}>{poc.title}</h1>
          {poc.idea_title && (
            <p style={{ fontSize: 12, color: '#6B7280', margin: 0 }}>
              Fikir: <span style={{ color: '#3B82F6' }}>{poc.idea_title}</span>
            </p>
          )}
          <span style={{
            display: 'inline-block', marginTop: 8,
            fontSize: 11, fontWeight: 600, borderRadius: 4, padding: '3px 10px',
            background: statusColor + '20', color: statusColor,
          }}>
            {STATUS_LABELS[poc.status] ?? poc.status}
          </span>
        </div>

        {/* Action buttons */}
        <div style={{ display: 'flex', gap: 8, flexWrap: 'wrap', justifyContent: 'flex-end' }}>
          {actions.map((a) => (
            <button
              key={a.action}
              onClick={() => handleTransition(a.action)}
              disabled={transitioning}
              style={{
                fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '7px 14px',
                cursor: transitioning ? 'not-allowed' : 'pointer', border: 'none',
                background: a.danger ? '#FEE2E2' : '#DBEAFE',
                color: a.danger ? '#DC2626' : '#1D4ED8',
                opacity: transitioning ? 0.6 : 1,
              }}
            >
              {a.label}
            </button>
          ))}
        </div>
      </div>

      {error && (
        <div style={{ background: '#FEE2E2', color: '#DC2626', borderRadius: 6, padding: '8px 14px', fontSize: 13, marginBottom: 16 }}>
          {error}
        </div>
      )}

      {/* Main content: 2 columns */}
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 360px', gap: 20 }}>
        {/* Left column: details */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          {/* Info grid */}
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 20 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 14px' }}>Genel Bilgiler</h2>
            <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 14 }}>
              {[
                { label: 'Sorumlu', value: poc.owner_name ?? '—' },
                { label: 'Sponsor', value: poc.sponsor_name ?? '—' },
                { label: 'Başlangıç', value: poc.start_date ? new Date(poc.start_date).toLocaleDateString('tr-TR') : '—' },
                { label: 'Bitiş', value: poc.end_date ? new Date(poc.end_date).toLocaleDateString('tr-TR') : '—' },
                {
                  label: 'Bütçe',
                  value: poc.budget !== null ? poc.budget.toLocaleString('tr-TR') + ' ₺' : '—',
                },
              ].map((field) => (
                <div key={field.label}>
                  <p style={{ fontSize: 10, fontWeight: 700, color: '#9CA3AF', textTransform: 'uppercase', margin: '0 0 3px' }}>
                    {field.label}
                  </p>
                  <p style={{ fontSize: 13, color: '#111827', margin: 0, fontFamily: field.label === 'Bütçe' ? 'monospace' : undefined }}>
                    {field.value}
                  </p>
                </div>
              ))}
            </div>
          </div>

          {/* Goals, success_criteria, notes — inline editable */}
          {(['goals', 'success_criteria', 'notes'] as const).map((field) => {
            const labels: Record<string, string> = {
              goals: 'Hedefler',
              success_criteria: 'Başarı Kriterleri',
              notes: 'Notlar',
            };
            const value = poc[field] ?? '';
            const isEditing = editField === field;
            return (
              <div key={field} style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 20 }}>
                <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 10 }}>
                  <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: 0 }}>{labels[field]}</h2>
                  {!isEditing && (
                    <button
                      onClick={() => { setEditField(field); setEditValue(value); }}
                      style={{ fontSize: 11, color: '#6B7280', background: 'none', border: 'none', cursor: 'pointer' }}
                    >
                      Düzenle
                    </button>
                  )}
                </div>
                {isEditing ? (
                  <div>
                    <textarea
                      value={editValue}
                      onChange={(e) => setEditValue(e.target.value)}
                      rows={4}
                      style={{
                        width: '100%', padding: '8px 12px', borderRadius: 6,
                        border: '1.5px solid #3B82F6', fontSize: 13, resize: 'vertical',
                        fontFamily: 'inherit', boxSizing: 'border-box' as const,
                      }}
                    />
                    <div style={{ display: 'flex', gap: 8, marginTop: 8 }}>
                      <button
                        onClick={() => handleSaveField(field, editValue)}
                        style={{ fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '6px 14px', background: '#3B82F6', color: '#fff', border: 'none', cursor: 'pointer' }}
                      >
                        Kaydet
                      </button>
                      <button
                        onClick={() => setEditField(null)}
                        style={{ fontSize: 12, fontWeight: 600, borderRadius: 6, padding: '6px 14px', background: '#F3F4F6', color: '#6B7280', border: 'none', cursor: 'pointer' }}
                      >
                        İptal
                      </button>
                    </div>
                  </div>
                ) : (
                  <p style={{ fontSize: 13, color: value ? '#111827' : '#D1D5DB', margin: 0, whiteSpace: 'pre-wrap' }}>
                    {value || 'Henüz girilmedi.'}
                  </p>
                )}
              </div>
            );
          })}
        </div>

        {/* Right column: updates */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', padding: 16 }}>
            <h2 style={{ fontSize: 13, fontWeight: 700, color: '#374151', margin: '0 0 14px' }}>Güncellemeler</h2>

            {/* Add update */}
            {poc.status !== 'cancelled' && (
              <div style={{ marginBottom: 16 }}>
                <textarea
                  value={updateContent}
                  onChange={(e) => setUpdateContent(e.target.value)}
                  placeholder="Haftalık güncelleme ekle…"
                  rows={3}
                  style={{
                    width: '100%', padding: '8px 12px', borderRadius: 6, resize: 'vertical',
                    border: '1.5px solid #E5E7EB', fontSize: 12, fontFamily: 'inherit',
                    boxSizing: 'border-box' as const,
                  }}
                  onFocus={(e) => (e.target.style.borderColor = '#3B82F6')}
                  onBlur={(e) => (e.target.style.borderColor = '#E5E7EB')}
                />
                <button
                  onClick={handleAddUpdate}
                  disabled={addingUpdate || !updateContent.trim()}
                  style={{
                    marginTop: 6, fontSize: 12, fontWeight: 600, borderRadius: 6,
                    padding: '6px 14px', background: '#3B82F6', color: '#fff', border: 'none',
                    cursor: (addingUpdate || !updateContent.trim()) ? 'not-allowed' : 'pointer',
                    opacity: (addingUpdate || !updateContent.trim()) ? 0.6 : 1,
                  }}
                >
                  {addingUpdate ? 'Ekleniyor…' : '+ Ekle'}
                </button>
              </div>
            )}

            {/* Update list */}
            <div style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
              {(poc.updates ?? []).length === 0 && (
                <p style={{ fontSize: 12, color: '#9CA3AF', fontStyle: 'italic', margin: 0 }}>
                  Henüz güncelleme yok.
                </p>
              )}
              {(poc.updates ?? []).map((u: PocUpdate) => (
                <div key={u.id} style={{ borderLeft: '3px solid #DBEAFE', paddingLeft: 12 }}>
                  <p style={{ fontSize: 12, fontWeight: 600, color: '#374151', margin: '0 0 3px' }}>
                    {u.author_name ?? 'Kullanıcı'}
                    <span style={{ fontWeight: 400, color: '#9CA3AF', marginLeft: 8 }}>
                      {new Date(u.created_at).toLocaleDateString('tr-TR')}
                    </span>
                  </p>
                  <p style={{ fontSize: 12, color: '#374151', margin: 0, whiteSpace: 'pre-wrap' }}>{u.content}</p>
                </div>
              ))}
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
