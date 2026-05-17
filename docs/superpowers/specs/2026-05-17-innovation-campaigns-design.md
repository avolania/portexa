# Innovation Campaigns Design — Stage-Gate Kampanya Yönetimi

## Goal

Innovation modülüne kampanya kavramı ekle: `innovation_admin` belirli tarih aralıklarında tematik fikir toplama kampanyaları açabilsin. Kampanya fikirleri mevcut global stage-gate pipeline'ını kullanır ama genel pipeline'dan ayrı görünür.

---

## Scope

**In scope:**
- `innovation_campaigns` ve `innovation_campaign_invites` DB tabloları
- `GET/POST /api/innovation/campaigns` — liste ve oluşturma
- `GET/PATCH/DELETE /api/innovation/campaigns/[id]` — tekil kampanya yönetimi
- `GET/POST/DELETE /api/innovation/campaigns/[id]/invites` — davet yönetimi
- `/innovation/kampanyalar` — kampanya listesi sayfası
- `/innovation/kampanyalar/[id]` — kampanya detay sayfası (pipeline + davetler tab)
- Mevcut fikir oluşturma modalına `campaign_id` desteği
- Genel pipeline'da `campaign_id IS NULL` filtresi

**Out of scope:**
- Kampanyaya özel stage konfigürasyonu (global stage-gate kullanılır)
- Kampanya bazlı raporlama/analitik
- Kampanya şablonları
- E-posta/bildirim ile davet gönderimi

---

## Data Model

### Yeni tablolar

```sql
CREATE TABLE innovation_campaigns (
  id           uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id       uuid NOT NULL,
  created_by   uuid NOT NULL,
  title        text NOT NULL,
  description  text,
  goal         text,
  start_date   date NOT NULL,
  end_date     date NOT NULL,
  is_invite_only boolean NOT NULL DEFAULT false,
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

ALTER TABLE innovation_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON innovation_campaigns
  USING (auth.role() = 'service_role');

CREATE TABLE innovation_campaign_invites (
  campaign_id  uuid NOT NULL REFERENCES innovation_campaigns(id) ON DELETE CASCADE,
  user_id      uuid NOT NULL,
  created_at   timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

ALTER TABLE innovation_campaign_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON innovation_campaign_invites
  USING (auth.role() = 'service_role');
```

### Mevcut tablo değişikliği

```sql
ALTER TABLE innovation_ideas
  ADD COLUMN campaign_id uuid REFERENCES innovation_campaigns(id) ON DELETE SET NULL;
```

`campaign_id IS NULL` → genel havuz fikri. `campaign_id IS NOT NULL` → kampanya fikri.

### Status derivasyonu

DB'de `status` kolonu yoktur. Her sorguda sunucu tarafında hesaplanır:

```ts
function deriveCampaignStatus(startDate: string, endDate: string): 'draft' | 'active' | 'ended' {
  const today = new Date().toISOString().slice(0, 10);
  if (today < startDate) return 'draft';
  if (today > endDate) return 'ended';
  return 'active';
}
```

---

## API Routes

### `GET /api/innovation/campaigns`

**Auth:** Oturum açmış herhangi bir kullanıcı.

**Query params:** `status` (draft | active | ended, opsiyonel)

**Logic:**
1. Caller'ın `org_id`'sini `auth_profiles`'dan al.
2. `innovation_campaigns` tablosundan org'a ait tüm kampanyaları çek.
3. Her kampanya için `deriveCampaignStatus()` ile status hesapla.
4. Admin olmayan kullanıcılara sadece `active` kampanyaları döndür.
5. Her kampanyaya `idea_count` (ilgili ideas sayısı) ekle.

**Response:**
```json
[{
  "id": "...",
  "title": "Q2 Verimlilik Fikirleri",
  "description": "...",
  "goal": "...",
  "start_date": "2026-06-01",
  "end_date": "2026-06-30",
  "is_invite_only": false,
  "status": "active",
  "idea_count": 12,
  "created_at": "..."
}]
```

---

### `POST /api/innovation/campaigns`

**Auth:** `innovation_admin` rolü gerekli.

**Request body:**
```json
{
  "title": "Q2 Verimlilik Fikirleri",
  "description": "...",
  "goal": "...",
  "start_date": "2026-06-01",
  "end_date": "2026-06-30",
  "is_invite_only": false
}
```

**Validation:**
- `title` zorunlu, boş olamaz.
- `start_date` ve `end_date` zorunlu, `YYYY-MM-DD` formatı.
- `end_date >= start_date`.

**Response:** Oluşturulan kampanya objesi.

---

### `GET /api/innovation/campaigns/[id]`

**Auth:** Oturum açmış herhangi bir kullanıcı. `draft` kampanyayı sadece admin görebilir.

**Response:** Kampanya objesi + `status` + `idea_count` + `invite_count`.

---

### `PATCH /api/innovation/campaigns/[id]`

**Auth:** `innovation_admin`.

**Request body:** `title`, `description`, `goal`, `start_date`, `end_date`, `is_invite_only` — hepsi opsiyonel.

**Validation:** Güncellenen tarihler mevcutlarla birlikte `end_date >= start_date` koşulunu sağlamalı.

**Response:** Güncellenmiş kampanya objesi.

---

### `DELETE /api/innovation/campaigns/[id]`

**Auth:** `innovation_admin`.

**Logic:**
- Kampanyada fikir varsa `400` döndür: `"Bu kampanyada fikir bulunuyor. Önce fikirleri taşıyın veya kampanyayı kapatın."`.
- Fikir yoksa kampanyayı ve cascade ile davetleri sil.

---

### `GET /api/innovation/campaigns/[id]/invites`

**Auth:** `innovation_admin`.

**Response:** Davetli kullanıcı listesi (id, name, avatar).

---

### `POST /api/innovation/campaigns/[id]/invites`

**Auth:** `innovation_admin`.

**Request body:** `{ "user_ids": ["uuid1", "uuid2"] }`

**Logic:** Toplu upsert — zaten davetli olanlar tekrar eklenmez.

**Response:** `{ "added": 3, "already_invited": 1 }`

---

### `DELETE /api/innovation/campaigns/[id]/invites`

**Auth:** `innovation_admin`.

**Request body:** `{ "user_id": "uuid" }`

**Response:** `{ "ok": true }`

---

### Mevcut `/api/innovation/ideas` değişiklikleri

**POST (oluşturma):**
- Body'de opsiyonel `campaign_id` kabul eder.
- `campaign_id` verilmişse:
  1. Kampanyanın var olduğunu ve `active` olduğunu doğrula (`status = 'active'`). Değilse `400`.
  2. `is_invite_only = true` ise, gönderenin davetli olduğunu kontrol et. Davetli değilse `403`.
- Idea `campaign_id` ile oluşturulur.

**GET (listeleme):**
- `campaign_id` query param desteği:
  - `campaign_id=none` → `campaign_id IS NULL` (genel pipeline).
  - `campaign_id=<uuid>` → belirli kampanya fikirleri.
  - Parametre yoksa → önceki davranış (tüm fikirler, geriye dönük uyumluluk).
- `/innovation/pipeline` sayfası artık `campaign_id=none` ile çağırır.

---

## Pages

### `/innovation/kampanyalar`

**Erişim:** Tüm kullanıcılar (admin: draft dahil tümünü görür; diğerleri: sadece active).

**Layout:**
```
┌─────────────────────────────────────────────────────┐
│ Başlık: "Kampanyalar"    [+ Yeni Kampanya] (admin)  │
├─────────────────────────────────────────────────────┤
│ Filtre tabs: Tümü | Aktif | Draft | Sona Ermiş      │
├─────────────────────────────────────────────────────┤
│ Kampanya kartları (grid):                           │
│  ┌─────────────────────────┐                        │
│  │ [Status badge] [invite] │                        │
│  │ Başlık                  │                        │
│  │ Açıklama (2 satır)      │                        │
│  │ Tarih aralığı           │                        │
│  │ N fikir                 │                        │
│  └─────────────────────────┘                        │
└─────────────────────────────────────────────────────┘
```

Status badge renkleri:
- `draft` → gri
- `active` → yeşil
- `ended` → mor

Invite-only kampanyalar küçük kilit ikonu taşır.

"+ Yeni Kampanya" → modal (title, description, goal, start_date, end_date, is_invite_only checkbox).

---

### `/innovation/kampanyalar/[id]`

**Layout:**

```
┌─────────────────────────────────────────────────────┐
│ ← Kampanyalar   Başlık   [Status badge]  [Düzenle]  │
│ Tarih aralığı · Hedef kısa özeti · N fikir          │
├─────────────────────────────────────────────────────┤
│ Tab: [Pipeline]  [Davetler] (admin only)            │
├─────────────────────────────────────────────────────┤
│ Pipeline tab:                                       │
│   [+ Fikir Gönder] butonu (active ise, izin varsa)  │
│   Mevcut pipeline kanban/liste bileşeni             │
│   (campaign_id filtreli)                            │
│                                                     │
│ Davetler tab (admin):                               │
│   [+ Kullanıcı Ekle]  arama                         │
│   Davetli kullanıcı listesi (avatar, isim, sil)     │
└─────────────────────────────────────────────────────┘
```

**"Fikir Gönder" butonu kuralları:**
- Kampanya `active` değilse → disabled, tooltip: "Kampanya aktif değil".
- `is_invite_only = true` ve kullanıcı davetli değilse → buton gizlenir, banner: "Bu kampanya yalnızca davetli katılımcılara açıktır."
- `innovation_admin` her zaman fikir gönderebilir (davetli kontrolü geçer).

**Fikir gönderme modalı:** Mevcut idea create modalı. `campaign_id` prop olarak geçilir; modal bu değeri gizli olarak tutar (kullanıcı değiştiremez).

---

## Sidebar / Navigation

Mevcut innovation sidebar'ına "Kampanyalar" nav item eklenir:

```
İnovasyon
  Dashboard
  Pipeline
  Kampanyalar   ← yeni
  Ayarlar
```

---

## Error Handling

| Senaryo | Davranış |
|---------|---------|
| Kampanya `ended` | Pipeline tab görünür (read-only); "Fikir Gönder" disabled |
| Kampanya `draft` | Admin görebilir; diğerleri liste sayfasında göremez; direkt URL → `404` |
| Invite-only, davetli değil | Pipeline görünür (fikirleri okuyabilir); "Fikir Gönder" yok; banner gösterilir |
| Kampanya silinmek isteniyor, fikir var | `400` — UI "Bu kampanyada N fikir var, silinemez" mesajı gösterir |
| `end_date < start_date` | Form validasyonu + API `400` |
| Olmayan `campaign_id` ile fikir gönderme | API `404` |

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `supabase-innovation-campaigns.sql` | DB migration |
| Create | `src/app/api/innovation/campaigns/route.ts` | GET list + POST create |
| Create | `src/app/api/innovation/campaigns/[id]/route.ts` | GET + PATCH + DELETE |
| Create | `src/app/api/innovation/campaigns/[id]/invites/route.ts` | GET + POST invites |
| Modify | `src/app/api/innovation/campaigns/[id]/invites/route.ts` | GET + POST + DELETE invites |
| Create | `src/lib/innovation/repositories/campaignsRepo.ts` | DB queries |
| Create | `src/lib/innovation/services/campaignService.ts` | Business logic |
| Create | `src/lib/innovation/types/campaign.ts` | Campaign types + DTOs |
| Modify | `src/lib/innovation/types/index.ts` | Re-export campaign types |
| Modify | `src/app/api/innovation/ideas/route.ts` | `campaign_id` support in GET + POST |
| Modify | `src/lib/innovation/repositories/ideasRepo.ts` | `campaign_id` filter |
| Create | `src/app/(app)/innovation/kampanyalar/page.tsx` | Campaign list page |
| Create | `src/app/(app)/innovation/kampanyalar/[id]/page.tsx` | Campaign detail page |
| Modify | `src/app/(app)/innovation/pipeline/page.tsx` | Add `campaign_id=none` filter |

---

## Out of Scope (Sonraki Fazlar)

- Kampanyaya özel stage konfigürasyonu
- Kampanya bazlı raporlama ve analitik dashboard
- E-posta / push bildirim ile davet
- Kampanya şablonları
- Genel havuzdan mevcut bir fikri kampanyaya taşıma
