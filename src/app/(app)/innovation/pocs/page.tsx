'use client';

import { useEffect, useState } from 'react';
import { useRouter } from 'next/navigation';
import { supabase } from '@/lib/supabase';
import type { InnovationPoc } from '@/lib/innovation/types';

const STATUS_LABELS: Record<string, string> = {
  draft: 'Taslak',
  pending_sponsor_approval: 'Sponsor Onayı Bekliyor',
  active: 'Aktif',
  on_hold: 'Beklemede',
  pending_completion_approval: 'Tamamlama Onayı Bekliyor',
  completed: 'Tamamlandı',
  cancelled: 'İptal Edildi',
};

const STATUS_COLORS: Record<string, { bg: string; text: string }> = {
  draft:                       { bg: '#F3F4F6', text: '#6B7280' },
  pending_sponsor_approval:    { bg: '#F3E8FF', text: '#7C3AED' },
  active:                      { bg: '#D1FAE5', text: '#059669' },
  on_hold:                     { bg: '#FEF3C7', text: '#D97706' },
  pending_completion_approval: { bg: '#F3E8FF', text: '#7C3AED' },
  completed:                   { bg: '#E5E7EB', text: '#374151' },
  cancelled:                   { bg: '#F9FAFB', text: '#9CA3AF' },
};

export default function PocsPage() {
  const router = useRouter();
  const [pocs, setPocs] = useState<InnovationPoc[]>([]);
  const [loading, setLoading] = useState(true);
  const [statusFilter, setStatusFilter] = useState('');

  useEffect(() => {
    const load = async () => {
      const { data: { session } } = await supabase.auth.getSession();
      if (!session) { router.push('/login'); return; }
      const url = `/api/innovation/pocs${statusFilter ? `?status=${statusFilter}` : ''}`;
      const res = await fetch(url, {
        headers: { Authorization: `Bearer ${session.access_token}` },
      });
      if (res.ok) setPocs(await res.json());
      setLoading(false);
    };
    load();
  }, [statusFilter, router]);

  return (
    <div style={{ padding: 24, fontFamily: 'IBM Plex Sans, sans-serif' }}>
      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'space-between', marginBottom: 20 }}>
        <div>
          <h1 style={{ fontSize: 20, fontWeight: 700, color: '#111827', margin: 0 }}>POC'lar</h1>
          <p style={{ fontSize: 13, color: '#6B7280', margin: '4px 0 0' }}>
            Proof of Concept takibi
          </p>
        </div>
      </div>

      {/* Status filter */}
      <div style={{ display: 'flex', gap: 8, marginBottom: 16, flexWrap: 'wrap' }}>
        {['', 'active', 'pending_sponsor_approval', 'on_hold', 'completed', 'cancelled'].map((s) => (
          <button
            key={s}
            onClick={() => setStatusFilter(s)}
            style={{
              fontSize: 12, fontWeight: 600, borderRadius: 6,
              padding: '5px 12px', cursor: 'pointer', border: 'none',
              background: statusFilter === s ? '#3B82F6' : '#F3F4F6',
              color: statusFilter === s ? '#fff' : '#6B7280',
            }}
          >
            {s === '' ? 'Tümü' : (STATUS_LABELS[s] ?? s)}
          </button>
        ))}
      </div>

      {/* Table */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: 40, color: '#9CA3AF', fontSize: 13 }}>Yükleniyor…</div>
      ) : (
        <div style={{ background: '#fff', borderRadius: 10, border: '1px solid #E5E7EB', overflow: 'hidden' }}>
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: 13 }}>
            <thead>
              <tr style={{ borderBottom: '1px solid #F3F4F6', background: '#F9FAFB' }}>
                {['Fikir', 'POC Başlığı', 'Sorumlu', 'Sponsor', 'Durum', 'Bütçe', 'Bitiş', ''].map((h) => (
                  <th key={h} style={{
                    textAlign: 'left', padding: '10px 14px',
                    fontSize: 10, fontWeight: 700, color: '#9CA3AF',
                    textTransform: 'uppercase', letterSpacing: '0.05em',
                  }}>{h}</th>
                ))}
              </tr>
            </thead>
            <tbody>
              {pocs.length === 0 && (
                <tr>
                  <td colSpan={8} style={{ textAlign: 'center', padding: 32, color: '#9CA3AF', fontSize: 13, fontStyle: 'italic' }}>
                    POC bulunamadı.
                  </td>
                </tr>
              )}
              {pocs.map((poc) => {
                const sc = STATUS_COLORS[poc.status] ?? { bg: '#F3F4F6', text: '#6B7280' };
                return (
                  <tr
                    key={poc.id}
                    style={{ borderBottom: '1px solid #F9FAFB', cursor: 'pointer' }}
                    onClick={() => router.push(`/innovation/pocs/${poc.id}`)}
                    onMouseEnter={(e) => (e.currentTarget.style.background = '#F9FAFB')}
                    onMouseLeave={(e) => (e.currentTarget.style.background = '')}
                  >
                    <td style={{ padding: '12px 14px', color: '#6B7280', fontSize: 12 }}>
                      {poc.idea_title ?? '—'}
                    </td>
                    <td style={{ padding: '12px 14px', fontWeight: 600, color: '#111827' }}>
                      {poc.title}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{poc.owner_name ?? '—'}</td>
                    <td style={{ padding: '12px 14px', color: '#374151' }}>{poc.sponsor_name ?? '—'}</td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{
                        fontSize: 11, fontWeight: 600, borderRadius: 4,
                        padding: '2px 8px', background: sc.bg, color: sc.text,
                      }}>
                        {STATUS_LABELS[poc.status] ?? poc.status}
                      </span>
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151', fontFamily: 'monospace', fontSize: 12 }}>
                      {poc.budget !== null ? poc.budget.toLocaleString('tr-TR') + ' ₺' : '—'}
                    </td>
                    <td style={{ padding: '12px 14px', color: '#374151', fontSize: 12 }}>
                      {poc.end_date ? new Date(poc.end_date).toLocaleDateString('tr-TR') : '—'}
                    </td>
                    <td style={{ padding: '12px 14px' }}>
                      <span style={{ color: '#3B82F6', fontSize: 12, fontWeight: 600 }}>Detay →</span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
