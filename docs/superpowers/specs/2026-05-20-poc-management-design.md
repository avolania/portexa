# Innovation Modülü V2 — POC Yönetimi Tasarımı

**Tarih:** 2026-05-20
**Kapsam:** V2 Adım 2 — POC (Proof of Concept) Yönetimi
**Durum:** Onaylandı

---

## Hedef

Onaylanan fikirlerden manuel olarak POC başlatmayı, POC sürecini (bütçe, hedefler, başarı kriterleri, haftalık güncelleme) takip etmeyi ve `business_sponsor` onay akışını (başlatma + tamamlama) yönetmeyi sağla.

---

## Mimari

Ayrı `innovation_pocs` tablosu + `innovation_poc_updates` log tablosu. Her fikrin en fazla bir aktif POC'u olabilir (önceki cancelled/completed POC'lar geçmişte kalır). Mevcut 3-katmanlı mimariyle (Route Handler → Service → Repository) tam uyumlu.

---

## Veritabanı Şeması

### `innovation_pocs`

```sql
CREATE TABLE innovation_pocs (
  id           TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  org_id       TEXT NOT NULL,
  idea_id      TEXT NOT NULL REFERENCES innovation_ideas(id) ON DELETE CASCADE,
  title        TEXT NOT NULL,
  owner_id     TEXT NOT NULL REFERENCES auth_profiles(id),
  sponsor_id   TEXT REFERENCES auth_profiles(id),
  status       TEXT NOT NULL DEFAULT 'draft'
               CHECK (status IN (
                 'draft', 'pending_sponsor_approval', 'active',
                 'on_hold', 'pending_completion_approval', 'completed', 'cancelled'
               )),
  budget       NUMERIC(12,2),
  goals        TEXT,
  success_criteria TEXT,
  notes        TEXT,
  start_date   DATE,
  end_date     DATE,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_innovation_pocs_org_id ON innovation_pocs(org_id);
CREATE INDEX idx_innovation_pocs_idea_id ON innovation_pocs(idea_id);
CREATE INDEX idx_innovation_pocs_status ON innovation_pocs(status);
```

### `innovation_poc_updates`

```sql
CREATE TABLE innovation_poc_updates (
  id         TEXT PRIMARY KEY DEFAULT gen_random_uuid()::text,
  poc_id     TEXT NOT NULL REFERENCES innovation_pocs(id) ON DELETE CASCADE,
  author_id  TEXT NOT NULL REFERENCES auth_profiles(id),
  content    TEXT NOT NULL,
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX idx_innovation_poc_updates_poc_id ON innovation_poc_updates(poc_id);
```

---

## TypeScript Tipleri

`src/lib/innovation/types/index.ts` dosyasına eklenir:

```ts
export type PocStatus =
  | 'draft'
  | 'pending_sponsor_approval'
  | 'active'
  | 'on_hold'
  | 'pending_completion_approval'
  | 'completed'
  | 'cancelled';

export interface InnovationPoc {
  id: string;
  org_id: string;
  idea_id: string;
  title: string;
  owner_id: string;
  owner_name?: string;
  sponsor_id: string | null;
  sponsor_name?: string;
  status: PocStatus;
  budget: number | null;
  goals: string | null;
  success_criteria: string | null;
  notes: string | null;
  start_date: string | null;
  end_date: string | null;
  created_at: string;
  updated_at: string;
  idea_title?: string;
}

export interface PocUpdate {
  id: string;
  poc_id: string;
  author_id: string;
  author_name?: string;
  content: string;
  created_at: string;
}

export interface CreatePocDto {
  idea_id: string;
  title: string;
  owner_id: string;
  sponsor_id?: string;
  budget?: number;
  goals?: string;
  success_criteria?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
}

export interface UpdatePocDto {
  title?: string;
  owner_id?: string;
  sponsor_id?: string;
  budget?: number;
  goals?: string;
  success_criteria?: string;
  notes?: string;
  start_date?: string;
  end_date?: string;
}

export interface TransitionPocDto {
  action: PocTransitionAction;
  note?: string;
}

export type PocTransitionAction =
  | 'submit_for_approval'   // draft → pending_sponsor_approval
  | 'approve_start'         // pending_sponsor_approval → active
  | 'reject_start'          // pending_sponsor_approval → draft
  | 'hold'                  // active → on_hold
  | 'resume'                // on_hold → active
  | 'submit_completion'     // active → pending_completion_approval
  | 'approve_completion'    // pending_completion_approval → completed
  | 'reject_completion'     // pending_completion_approval → active
  | 'cancel';               // herhangi → cancelled
```

---

## Durum Geçiş Kuralları

| Action | Mevcut Durum | Yeni Durum | Yetkili Roller |
|--------|-------------|------------|----------------|
| `submit_for_approval` | `draft` | `pending_sponsor_approval` | `innovation_admin`, owner |
| `approve_start` | `pending_sponsor_approval` | `active` | `business_sponsor`, `innovation_admin` |
| `reject_start` | `pending_sponsor_approval` | `draft` | `business_sponsor`, `innovation_admin` |
| `hold` | `active` | `on_hold` | `innovation_admin`, owner |
| `resume` | `on_hold` | `active` | `innovation_admin`, owner |
| `submit_completion` | `active` | `pending_completion_approval` | `innovation_admin`, owner |
| `approve_completion` | `pending_completion_approval` | `completed` | `business_sponsor`, `innovation_admin` |
| `reject_completion` | `pending_completion_approval` | `active` | `business_sponsor`, `innovation_admin` |
| `cancel` | herhangi (completed hariç) | `cancelled` | `innovation_admin` |

---

## Dosya Haritası

| İşlem | Dosya | Amaç |
|-------|-------|------|
| Create | `supabase-innovation-pocs.sql` | DB migration |
| Modify | `src/lib/innovation/types/index.ts` | `PocStatus`, `InnovationPoc`, DTO'lar |
| Create | `src/lib/innovation/repositories/pocsRepo.ts` | CRUD + update log |
| Create | `src/lib/innovation/services/pocService.ts` | Geçiş kuralları, iş mantığı |
| Create | `src/app/api/innovation/pocs/route.ts` | GET (liste) + POST (oluştur) |
| Create | `src/app/api/innovation/pocs/[id]/route.ts` | GET (detay) + PATCH (güncelle) |
| Create | `src/app/api/innovation/pocs/[id]/transition/route.ts` | POST (durum geçişi) |
| Create | `src/app/api/innovation/pocs/[id]/updates/route.ts` | POST (güncelleme ekle) |
| Create | `src/app/(app)/innovation/pocs/page.tsx` | POC listesi sayfası |
| Create | `src/app/(app)/innovation/pocs/[id]/page.tsx` | POC detay sayfası |
| Modify | `src/app/(app)/innovation/ideas/[id]/page.tsx` | POC bölümü eklenir |
| Modify | `src/components/layout/Sidebar.tsx` | "POC'lar" menü öğesi |

---

## API Tasarımı

### `POST /api/innovation/pocs`

**Body:** `CreatePocDto`
**Yetki:** `innovation_admin` veya `business_sponsor`
**Validasyon:**
- `idea_id` var mı, aynı org'a ait mi?
- Fikir `approved` statüsünde mi?
- Fikrin zaten aktif/pending bir POC'u var mı? (varsa 409)
**Response:** `InnovationPoc`

### `GET /api/innovation/pocs`

**Query params:** `status` (opsiyonel filtre), `idea_id` (opsiyonel)
**Yetki:** Tüm innovation rolleri
**Response:** `InnovationPoc[]` (owner/sponsor isimleri join ile)

### `GET /api/innovation/pocs/[id]`

**Yetki:** Tüm innovation rolleri
**Response:** `InnovationPoc & { updates: PocUpdate[] }`

### `PATCH /api/innovation/pocs/[id]`

**Body:** `UpdatePocDto`
**Yetki:** `innovation_admin` veya POC owner'ı
**Kural:** `completed` veya `cancelled` POC güncellenemez

### `POST /api/innovation/pocs/[id]/transition`

**Body:** `TransitionPocDto`
**Yetki:** Durum geçiş tablosuna göre
**Hata:** Geçersiz action → 400, yetki yok → 403

### `POST /api/innovation/pocs/[id]/updates`

**Body:** `{ content: string }`
**Yetki:** `innovation_admin`, `innovation_evaluator`, POC owner'ı
**Kural:** `cancelled` POC'a güncelleme eklenemez

---

## UI Tasarımı

### Sidebar

`src/components/layout/Sidebar.tsx` — Innovation bölümüne "POC'lar" menü öğesi eklenir. Görünürlük: `innovation_admin`, `business_sponsor`, `innovation_evaluator` rollerinden en az birine sahip kullanıcılar.

### POC Listesi — `/innovation/pocs`

Tablo: Fikir adı, POC başlığı, Owner, Sponsor, Durum badge, Bütçe, Bitiş tarihi, Detay linki.

Durum badge renkleri:
| Durum | Renk |
|-------|------|
| `draft` | `#6B7280` (gri) |
| `pending_sponsor_approval` | `#7C3AED` (mor) |
| `active` | `#059669` (yeşil) |
| `on_hold` | `#D97706` (amber) |
| `pending_completion_approval` | `#7C3AED` (mor) |
| `completed` | `#374151` (koyu gri) |
| `cancelled` | `#9CA3AF` (açık gri) |

### Fikir Detail Sayfası — POC Bölümü

Mevcut `ideas/[id]/page.tsx` sayfasına "POC" sekmesi veya alt bölüm eklenir:
- POC yoksa: "POC Başlat" butonu (sadece `innovation_admin`/`business_sponsor`, fikir `approved` ise aktif)
- POC varsa: durum badge, owner, sponsor, bütçe, tarihler + "Detayı Gör" linki

### POC Detay Sayfası — `/innovation/pocs/[id]`

**Üst bar:** POC başlığı, durum badge, aksiyon butonları (duruma göre: "Onaya Gönder", "Aktifleştir", "Askıya Al", "Tamamlamaya Gönder" vb.)

**Ana içerik (2 kolon):**
- Sol: Temel bilgiler (idea linki, owner, sponsor, tarihler, bütçe), Hedefler, Başarı Kriterleri, Notlar
- Sağ: Güncelleme timeline'ı + güncelleme ekleme textarea'sı

---

## Hata Yönetimi

| Senaryo | Davranış |
|---------|----------|
| Fikir `approved` değilken POC oluşturma | 400: "POC yalnızca onaylı fikirler için başlatılabilir" |
| Aktif POC varken yeni POC oluşturma | 409: "Bu fikrin zaten aktif bir POC'u var" |
| Geçersiz durum geçişi | 400: "Bu geçiş mevcut durumdan yapılamaz" |
| Yetkisiz durum geçişi | 403 |
| Tamamlanan POC güncelleme denemesi | 400: "Tamamlanan POC güncellenemez" |
