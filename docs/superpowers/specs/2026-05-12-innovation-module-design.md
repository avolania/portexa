# Innovation (Fikir Yönetimi) Modülü — Tasarım Spec

**Tarih:** 2026-05-12  
**Kapsam:** Phase 1 — Dashboard + Pipeline (Settings Phase 2'de)  
**Durum:** Onaylandı

---

## Özet

Pixanto PPM'e bir Stage-Gate fikir yönetimi modülü eklenir. Kullanıcılar fikir gönderir, uzmanlar değerlendirir, adminler fikirleri aşamalar arasında ilerletir. Phase 1; Dashboard ve Pipeline ekranlarını, tam relational backend'i ve sidebar entegrasyonunu kapsar.

---

## Mimari

**Yaklaşım:** Service-Only (Zustand store yok, Phase 1 için)  
**Desen:** Mevcut ITSM 3-katman mimarisini izler — Repository → Service → Route Handler → Page Component

```
src/
├── lib/innovation/
│   ├── types/index.ts
│   ├── repositories/
│   │   ├── ideasRepo.ts
│   │   ├── votesRepo.ts
│   │   ├── commentsRepo.ts
│   │   ├── evaluationsRepo.ts
│   │   └── stagesRepo.ts
│   └── services/
│       ├── ideasService.ts
│       ├── votingService.ts
│       └── evaluationService.ts
│
├── app/api/innovation/
│   ├── stats/route.ts
│   ├── stages/route.ts
│   ├── ideas/route.ts
│   └── ideas/[id]/
│       ├── route.ts
│       ├── vote/route.ts
│       ├── comments/route.ts
│       ├── evaluate/route.ts
│       └── advance/route.ts
│
└── app/(app)/innovation/
    ├── page.tsx              ← Dashboard
    └── pipeline/page.tsx     ← Pipeline
```

Veri akışı: `Page (useState/useEffect)` → `fetch /api/innovation/...` → `Route Handler` → `Service` → `Repository` → `Supabase`

---

## Veritabanı Şeması (10 Tablo)

### `innovation_stages`
Stage-gate tanımları. Seed data ile gelir, Phase 1'de UI yok.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | uuid PK | |
| order_index | int | Sıralama |
| name | text | "Fikir", "Ön Değerlendirme", vb. |
| description | text | |
| color | text | Hex renk kodu |
| min_score_to_advance | numeric | Geçiş için minimum composite skor |
| required_evaluations | int | Geçiş için gereken minimum değerlendirme sayısı |
| is_active | boolean | default true |

**Seed Data:** Fikir → Ön Değerlendirme → Detaylı Analiz → Pilot → Uygulama

### `innovation_ideas`
Ana fikir kaydı.

| Kolon | Tip | Açıklama |
|-------|-----|----------|
| id | uuid PK | |
| idea_number | text UNIQUE | "INN-001" formatı, sequences tablosundan |
| title | text NOT NULL | |
| description | text | |
| category | text | |
| submitter_id | uuid → auth_profiles | |
| stage_id | uuid → innovation_stages | |
| status | enum | draft, submitted, under_review, approved, rejected, implemented, archived |
| impact_score | numeric(5,2) | 0–100 |
| feasibility_score | numeric(5,2) | 0–100 |
| composite_score | numeric(5,2) | Ağırlıklı ortalama, service tarafından hesaplanır |
| vote_count | int default 0 | Cache, votingService günceller |
| comment_count | int default 0 | Cache |
| estimated_value | numeric | Tahmini iş değeri |
| currency_code | text default 'TRY' | |
| created_at | timestamptz | |
| updated_at | timestamptz | |

### `innovation_votes`

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| idea_id | uuid → innovation_ideas |
| user_id | uuid → auth_profiles |
| value | smallint | +1 veya -1 |
| created_at | timestamptz |

UNIQUE(idea_id, user_id)

### `innovation_comments`

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| idea_id | uuid → innovation_ideas |
| author_id | uuid → auth_profiles |
| parent_id | uuid → innovation_comments | null = root yorum |
| body | text NOT NULL |
| created_at | timestamptz |

### `innovation_evaluation_criteria`
Değerlendirme kriterleri. Seed data ile gelir.

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| name | text | "Etki", "Fizibilite", vb. |
| description | text | |
| weight | numeric(4,2) | 0.0–1.0, tüm kriterler toplamı = 1.0 |
| max_score | int default 10 | |
| order_index | int | |
| is_active | boolean default true | |

**Seed Data:** Etki (0.40), Fizibilite (0.30), Özgünlük (0.20), Uygulama Hızı (0.10)

### `innovation_evaluations`
Uzman değerlendirme başlığı.

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| idea_id | uuid → innovation_ideas |
| evaluator_id | uuid → auth_profiles |
| stage_id | uuid → innovation_stages |
| notes | text |
| total_score | numeric(5,2) | Hesaplanmış ağırlıklı toplam |
| created_at | timestamptz |

### `innovation_evaluation_scores`
Kriter bazlı puanlar.

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| evaluation_id | uuid → innovation_evaluations |
| criterion_id | uuid → innovation_evaluation_criteria |
| score | int | 0–max_score |
| comment | text | |

### `innovation_tags`

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| name | text |
| color | text |
| org_id | uuid |
| created_by | uuid → auth_profiles |
| created_at | timestamptz |

### `innovation_idea_tags`

| Kolon | Tip |
|-------|-----|
| idea_id | uuid → innovation_ideas |
| tag_id | uuid → innovation_tags |

PRIMARY KEY (idea_id, tag_id)

### `innovation_stage_history`
Audit trail — bir fikrin hangi stage'den hangisine ne zaman geçtiği.

| Kolon | Tip |
|-------|-----|
| id | uuid PK |
| idea_id | uuid → innovation_ideas |
| from_stage_id | uuid → innovation_stages | null = ilk stage |
| to_stage_id | uuid → innovation_stages |
| changed_by | uuid → auth_profiles |
| reason | text |
| created_at | timestamptz |

---

## API Routes

| Method | Path | Yetki | İşlev |
|--------|------|-------|-------|
| GET | `/api/innovation/stats` | Giriş yapmış herkes | Dashboard aggregate'leri |
| GET | `/api/innovation/stages` | Giriş yapmış herkes | Stage tanımları |
| GET | `/api/innovation/ideas` | Giriş yapmış herkes | Liste; `?stage=`, `?status=`, `?search=`, `?sort=`, `?page=` |
| POST | `/api/innovation/ideas` | Giriş yapmış herkes | Fikir oluştur (status: submitted) |
| GET | `/api/innovation/ideas/[id]` | Giriş yapmış herkes | Tek fikir (comments, evaluations dahil) |
| PATCH | `/api/innovation/ideas/[id]` | Submitter veya innovation_admin | Güncelle |
| DELETE | `/api/innovation/ideas/[id]` | Submitter (draft) veya innovation_admin | Sil |
| POST | `/api/innovation/ideas/[id]/vote` | Giriş yapmış herkes | Oy ver / geri al |
| GET | `/api/innovation/ideas/[id]/comments` | Giriş yapmış herkes | Yorum listesi |
| POST | `/api/innovation/ideas/[id]/comments` | Giriş yapmış herkes | Yorum ekle |
| POST | `/api/innovation/ideas/[id]/evaluate` | innovation_evaluator | Değerlendirme kaydet |
| POST | `/api/innovation/ideas/[id]/advance` | innovation_admin | Stage ilerlet |

---

## Service Katmanı

### `ideasService.ts`
- `createIdea()`: idea_number üretimi (itsm_sequences tablosundan `INNOVATION` tipi), status=submitted set edilir
- `advanceStage()`: `min_score_to_advance` ve `required_evaluations` kontrolü → `innovation_stage_history` kaydı → `ideas.stage_id` güncelle
- `updateCompositeScore()`: Tüm aktif değerlendirmelerin ağırlıklı ortalaması alınarak `ideas.composite_score` güncellenir
- Yetki kontrolü: submitter_id === current user VEYA innovation_role === 'innovation_admin'

### `votingService.ts`
- UPSERT mantığı: aynı kullanıcı aynı değerde tekrar oylarsa oy geri alınır (toggle), farklı değerde güncellenir
- `ideas.vote_count` cache güncelleme: net oy toplamı (+1 sayısı - (-1) sayısı)

### `evaluationService.ts`
- `saveEvaluation()`: Her kriter için score kaydeder, `Σ(score/max_score × weight) × 100` formülüyle total_score hesaplar
- Kayıt sonrası `ideasService.updateCompositeScore()` çağırır

---

## UI Tasarımı

### Dashboard (`/innovation`)

CLAUDE.md light theme + stat card pattern.

**Stat Cards (4 adet):**
- Toplam Fikir (tüm zamanlar)
- Bu Ay Gelen (cari ay)
- Değerlendirmede (under_review)
- Uygulanan (implemented)

**Stage Dağılımı:** Her stage için idea sayısını gösteren horizontal progress bar (her stage kendi rengiyle)

**Alt bölüm (2 kolon):**
- Sol: En çok oy alan 5 fikir (idea_number, başlık, oy sayısı, stage badge)
- Sağ: Son aktivite timeline (yeni fikirler, stage geçişleri, değerlendirmeler)

### Pipeline (`/innovation/pipeline`)

Liste view (Kanban değil — daha fazla bilgi yoğunluğu).

**Filter Bar:** Stage tabs + Kategori dropdown + Sıralama (Tarih / Puan / Oy) + `+ Fikir Ekle` butonu

**Idea Card (satır formatı):**
```
[INN-001] [Stage Badge] Başlık + açıklama özeti (2 satır)
Submitter avatar + isim · ↑42 oy · 💬 7 yorum · ⭐ 78 puan · Kategori tag · Tarih
[Değerlendir] (sadece innovation_evaluator rolü için görünür)
```

**Detail Slide-Over (sağdan, 480px):**
- Fikir başlığı, tam açıklama
- Stage progress bar (5 adım, CLAUDE.md state machine bar pattern)
- Composite score gauge (0–100)
- Kriter bazlı değerlendirme skorları
- Yorumlar (threaded)
- Stage ilerlet butonu (sadece innovation_admin)
- Yorum ekle formu

### Sidebar Entegrasyonu

`src/app/(app)/layout.tsx` veya sidebar component'ına eklenir:

```
💡 Innovation    [badge: submitted + under_review sayısı]
   Pipeline
```

Active state, inactive, hover → CLAUDE.md sidebar kurallarına uygun.

---

## Roller & Yetki

`auth_profiles.innovation_role` alanı (Phase 1'de DB seviyesinde, UI yok):

| Rol | Yapabilecekleri |
|-----|----------------|
| `null` / normal kullanıcı | Fikir gönder, oy ver, yorum yap, tümünü görüntüle |
| `innovation_evaluator` | + Değerlendirme kaydet |
| `innovation_admin` | + Stage ilerlet, herhangi fikri düzenle/sil |

Yetki kontrolleri service katmanında yapılır (route handler session'dan user alır, service'e geçirir).

---

## RLS Politikaları

- `innovation_ideas`: SELECT herkese (submitted ve üstü); kendi draft'ını yalnızca submitter görür. INSERT/UPDATE/DELETE service katmanında kontrol edilir, RLS'de de kısıtlanır.
- `innovation_votes`, `innovation_comments`: SELECT herkese; INSERT giriş yapmış kullanıcılara
- `innovation_evaluations`: INSERT yalnızca `innovation_evaluator` veya `innovation_admin`
- `innovation_stages`, `innovation_evaluation_criteria`: SELECT herkese; değişiklik yalnızca `innovation_admin` (Phase 2 Settings UI'ına kadar doğrudan DB'den)
- `innovation_stage_history`: SELECT herkese; INSERT yalnızca service (SECURITY DEFINER fonksiyon)

---

## Kapsam Dışı (Phase 2)

- Settings ekranı (stage ve kriter yönetimi UI'ı)
- E-posta / in-app bildirimler
- Toplu değerlendirme akışı (batch evaluation)
- Fikir merge / duplicate detection
- Export (PDF/Excel)
- Kanban görünümü

---

## Bağımlılıklar

- `itsm_sequences` tablosu: `INNOVATION` tipi için `next_ticket_number()` fonksiyonu zaten kullanılabilir
- `auth_profiles`: `innovation_role text` kolonu eklenmesi gerekiyor
- `supabaseAdmin`: Mevcut, SECURITY DEFINER operasyonlar için kullanılacak
