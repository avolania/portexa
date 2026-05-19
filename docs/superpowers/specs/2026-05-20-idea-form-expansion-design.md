# Fikir Formu Genişletmesi Tasarımı

## Hedef

Mevcut 3 alanlı fikir formunu (`title`, `description`, `category`) tasarım dokümanındaki tam alan setine yükselt. Modal minimal (4 alan) kalırken tüm detaylar yeni bir fikir detay sayfasında düzenlenir.

---

## Kapsam

**Dahil:**
- `description` → `problem` yeniden adlandırma (veri korunur)
- 7 yeni DB kolonu: `proposed_solution`, `affected_area`, `location_process`, `idea_type`, `estimated_impact`, `confidentiality`, `sponsor_id`
- `NewIdeaModal` güncelleme (2 instance: pipeline + kampanya)
- Yeni fikir detay sayfası: `/innovation/ideas/[id]`
- Modal submit sonrası detay sayfasına yönlendirme
- `CreateIdeaDto`, `UpdateIdeaDto`, `InnovationIdea` tip güncellemeleri
- `POST`, `GET /[id]`, `PATCH /[id]` API route güncellemeleri

**Dışarıda:**
- Dosya ekleme (fotoğraf, video, doküman)
- Benzer fikir aramasının `problem` kolonunu da kapsaması
- Mevcut slide-over panelinin kaldırılması (korunur, detay sayfasına ek olarak çalışır)

---

## Veritabanı Şema Değişiklikleri

### Kolon yeniden adlandırma

```sql
ALTER TABLE innovation_ideas RENAME COLUMN description TO problem;
```

### Yeni kolonlar

```sql
ALTER TABLE innovation_ideas
  ADD COLUMN proposed_solution TEXT NOT NULL DEFAULT '',
  ADD COLUMN affected_area     TEXT NOT NULL DEFAULT '',
  ADD COLUMN location_process  TEXT NOT NULL DEFAULT '',
  ADD COLUMN idea_type         TEXT NOT NULL DEFAULT '',
  ADD COLUMN estimated_impact  TEXT NOT NULL DEFAULT '',
  ADD COLUMN confidentiality   TEXT NOT NULL DEFAULT 'open',
  ADD COLUMN sponsor_id        TEXT REFERENCES auth_profiles(id) ON DELETE SET NULL;
```

### Alan açıklamaları

| Kolon | Tip | Değerler | Açıklama |
|-------|-----|----------|----------|
| `problem` | TEXT | serbest | Eski `description` — çözülmek istenen problem veya fırsat |
| `proposed_solution` | TEXT | serbest | Önerilen çözüm yaklaşımı |
| `affected_area` | TEXT | serbest | Etkilenen alan (Üretim, Kalite, R&D, Supply Chain, IT/OT, Sustainability vb.) |
| `location_process` | TEXT | serbest | Fabrika, hat, departman, ülke veya süreç bilgisi |
| `idea_type` | TEXT | `quick_win`, `process`, `digital`, `ai_data`, `ot`, `strategic`, `''` | Fikir tipi |
| `estimated_impact` | TEXT | `low`, `medium`, `high`, `''` | Tahmini etki seviyesi |
| `confidentiality` | TEXT | `open`, `team`, `private` | Gizlilik seviyesi |
| `sponsor_id` | TEXT / NULL | auth_profiles.id | İş birimi sponsoru |

---

## Tip Değişiklikleri

### `InnovationIdea` (genişler)

```ts
export interface InnovationIdea {
  // ... mevcut alanlar ...
  problem: string;           // eski 'description'
  proposed_solution: string;
  affected_area: string;
  location_process: string;
  idea_type: IdeaType;
  estimated_impact: EstimatedImpact;
  confidentiality: IdeaConfidentiality;
  sponsor_id: string | null;
  sponsor?: { name: string } | null;
  // ... geri kalanlar aynı ...
}

export type IdeaType =
  | 'quick_win' | 'process' | 'digital' | 'ai_data' | 'ot' | 'strategic' | '';

export type EstimatedImpact = 'low' | 'medium' | 'high' | '';

export type IdeaConfidentiality = 'open' | 'team' | 'private';
```

### `CreateIdeaDto` (güncellenir)

```ts
export interface CreateIdeaDto {
  title: string;
  problem: string;           // eski 'description' yerine
  category: string;
  idea_type?: IdeaType;
  estimated_value?: number;
  currency_code?: string;
  tag_ids?: string[];
  campaign_id?: string;
}
```

### `UpdateIdeaDto` (genişler)

```ts
export interface UpdateIdeaDto {
  title?: string;
  problem?: string;
  proposed_solution?: string;
  category?: string;
  affected_area?: string;
  location_process?: string;
  idea_type?: IdeaType;
  estimated_impact?: EstimatedImpact;
  confidentiality?: IdeaConfidentiality;
  sponsor_id?: string | null;
  estimated_value?: number;
  currency_code?: string;
  status?: IdeaStatus;
}
```

---

## Modal Değişiklikleri

`NewIdeaModal` hem pipeline (`src/app/(app)/innovation/pipeline/page.tsx`) hem kampanya (`src/app/(app)/innovation/kampanyalar/[id]/page.tsx`) sayfasında güncellenir.

### Yeni form state

```ts
const [form, setForm] = useState({
  title: "",
  problem: "",
  category: "",
  idea_type: "" as IdeaType,
});
```

### 4 alan

| Alan | Tip | Zorunlu | Açıklama |
|------|-----|---------|----------|
| Başlık | text input | ✓ | Değişmez |
| Problem / Fırsat | textarea (4 satır) | — | Eski "Açıklama" |
| Kategori | text input | — | Değişmez |
| Fikir Tipi | `<select>` | — | Dropdown (aşağıda) |

### Fikir Tipi dropdown seçenekleri

```
""            → "Seçiniz..." (placeholder)
"quick_win"   → "Quick Win"
"process"     → "Süreç İyileştirme"
"digital"     → "Dijital / BT Projesi"
"ai_data"     → "Yapay Zeka / Veri"
"ot"          → "BT-OT / Akıllı Fabrika"
"strategic"   → "Stratejik İnovasyon"
```

### Submit sonrası yönlendirme

```ts
const idea = await res.json();
router.push(`/innovation/ideas/${idea.id}`);
```

Benzer fikir kontrolü (`onBlur` + `SimilarIdeasModal`) korunur, değişmez.

---

## Yeni Fikir Detay Sayfası

**Route:** `src/app/(app)/innovation/ideas/[id]/page.tsx`

### Sayfa yapısı

```
┌─────────────────────────────────────────────────────┐
│ ← Pipeline   INN-0042  [Feasibility]  [submitted]  │
│ Paketleme hattı enerji izleme                       │
├─────────────────────────────────────────────────────┤
│  Detaylar  │  Yorumlar  │  Değerlendirmeler  │  Geçmiş │
├─────────────────────────────────────────────────────┤
│  [Sekme içeriği]                                    │
└─────────────────────────────────────────────────────┘
```

### Detaylar sekmesi

İki sütunlu grid, tüm alanlar düzenlenebilir. Sadece `submitter_id === user.id` veya `innovation_admin` rolü düzenleyebilir; diğerleri read-only görür.

| Sol sütun | Sağ sütun |
|-----------|-----------|
| Problem / Fırsat (textarea) | Önerilen Çözüm (textarea) |
| Kategori (text) | Fikir Tipi (select) |
| Etkilenen Alan (text) | Lokasyon / Süreç (text) |
| Tahmini Etki (select) | Gizlilik (select) |
| Tahmini Değer + Para Birimi | Sponsor (select) |

"Kaydet" butonu `PATCH /api/innovation/ideas/[id]` çağırır. Başarılı save sonrası inline feedback (yeşil toast veya buton state değişimi).

### Yorumlar sekmesi

Mevcut slide-over'daki yorum bileşeniyle aynı API'lar kullanılır (`GET/POST /api/innovation/ideas/[id]/comments`). Slide-over korunur — yeni sayfa paralel bir tam-sayfa alternatifdir.

### Değerlendirmeler sekmesi

Mevcut slide-over'daki değerlendirme içeriği aynı endpoint'ler ile gösterilir. Slide-over dokunulmaz.

### Geçmiş sekmesi

Stage history — mevcut `StageHistoryEntry` verileri aynı `stage_history` join'i ile gösterilir.

### Sponsor alanı

`GET /api/innovation/users` endpoint'inden org üyeleri çekilir (Phase 3'te implement edildi). `<select>` dropdown ile seçilir; `name` gösterilir, `id` gönderilir.

---

## API Değişiklikleri

### `POST /api/innovation/ideas`

`dto.description` → `dto.problem`. Validation:
```ts
if (!dto.title?.trim()) return 400;
// problem boş olabilir
```

DB insert'e `problem`, `idea_type` eklenir.

### `GET /api/innovation/ideas/[id]`

Select genişler — yeni 7 kolon + sponsor join:

```ts
.select(`
  *,
  stage:innovation_stages(*),
  submitter:auth_profiles!innovation_ideas_submitter_id_fkey(data),
  sponsor:auth_profiles!innovation_ideas_sponsor_id_fkey(data),
  tags:innovation_idea_tags(tag:innovation_tags(*)),
  comments:innovation_comments(...),
  evaluations:innovation_evaluations(...),
  stage_history:innovation_stage_history(...)
`)
```

Response'da `sponsor: { name: string } | null` olarak çıkar.

### `PATCH /api/innovation/ideas/[id]`

**Yetki:** `submitter_id === user.id` veya `innovation_admin`.

Kabul edilen alanlar: `UpdateIdeaDto`'daki tüm alanlar. Bilinmeyen alanlar yoksayılır. DB update:

```ts
const allowed = [
  'title', 'problem', 'proposed_solution', 'category',
  'affected_area', 'location_process', 'idea_type',
  'estimated_impact', 'confidentiality', 'sponsor_id',
  'estimated_value', 'currency_code', 'status'
];
```

---

## Dosya Haritası

| İşlem | Dosya | Amaç |
|-------|-------|-------|
| Create | `supabase-idea-form-expansion.sql` | DB migration |
| Modify | `src/lib/innovation/types/index.ts` | Yeni tipler + interface güncellemeleri |
| Modify | `src/lib/innovation/repositories/ideasRepo.ts` | `description` → `problem`, yeni kolonlar |
| Modify | `src/lib/innovation/services/ideasService.ts` | `CreateIdeaDto` / `UpdateIdeaDto` değişiklikleri |
| Modify | `src/app/api/innovation/ideas/route.ts` | POST handler: `problem` alanı |
| Modify | `src/app/api/innovation/ideas/[id]/route.ts` | GET genişleme + PATCH endpoint |
| Modify | `src/app/(app)/innovation/pipeline/page.tsx` | `NewIdeaModal` güncelleme + yönlendirme |
| Modify | `src/app/(app)/innovation/kampanyalar/[id]/page.tsx` | `NewIdeaModal` güncelleme + yönlendirme |
| Create | `src/app/(app)/innovation/ideas/[id]/page.tsx` | Yeni fikir detay sayfası |

---

## Hata Yönetimi

| Senaryo | Davranış |
|---------|----------|
| PATCH yetkisiz kullanıcı | 403 döner, UI hata gösterir |
| `GET /[id]` bulunamadı | 404 döner, sayfa "Fikir bulunamadı" mesajı gösterir |
| Sponsor seçici yüklenemedi | Dropdown boş kalır, hata sessizce yutulur |
| Save başarısız | Buton disabled'dan çıkar, inline hata mesajı gösterilir |
| Modal submit sonrası yönlendirme başarısız | Kullanıcı pipeline'da kalır |
