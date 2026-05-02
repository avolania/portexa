# Japan Trip Planner — Design Spec

**Tarih:** 2026-05-02  
**Yazar:** Dincer  
**Durum:** Onaylı

---

## Özet

Kullanıcıdan tarih aralığı, şehir seçimi ve tercihler alarak Claude API aracılığıyla kişiselleştirilmiş Japonya gezi planı üreten standalone web uygulaması.

---

## Proje Konumu

```
/Users/dincercinar/Desktop/Uygulama/japan-trip-planner/
```

Bağımsız Next.js 16 projesi — `projeyonet` ile kod paylaşmaz.

---

## Kapsam (MVP)

**Şehirler:** Tokyo, Kyoto, Osaka (3 şehir)  
**Transfer rotaları:** Tokyo↔Kyoto, Kyoto↔Osaka, Tokyo↔Osaka

Diğer şehirler (Hiroshima, Nara, Hakone, vb.) ilerleyen fazlarda eklenebilir.

---

## Mimari

```
src/
├── app/
│   ├── page.tsx                       # Form wizard (3 adım)
│   ├── plan/page.tsx                  # Sonuç sayfası
│   ├── api/
│   │   ├── generate-plan/route.ts     # Claude → şehir önerileri (streaming)
│   │   └── generate-transfer/route.ts # Claude → transfer planı (streaming)
│   ├── layout.tsx
│   └── globals.css
├── components/
│   ├── planner/
│   │   ├── TripForm.tsx               # Wizard container
│   │   ├── DateStep.tsx               # Adım 1: Tarih seçimi
│   │   ├── CityStep.tsx               # Adım 2: Şehir + gün dağıtımı
│   │   └── PreferencesStep.tsx        # Adım 3: Stil + ilgi alanları
│   ├── results/
│   │   ├── PlanLayout.tsx             # Sonuç sayfası iskelet
│   │   ├── TransferTimeline.tsx       # Şehirler arası yatay timeline
│   │   ├── CityPlanCard.tsx           # Şehir önerileri kartı
│   │   ├── CategoryTabs.tsx           # must_see / food / culture vb.
│   │   ├── DailyItinerary.tsx         # Günlük plan accordion
│   │   └── ResourceLinks.tsx          # Harici link kartları
│   └── ui/
│       ├── LoadingSkeleton.tsx        # Streaming yükleme göstergesi
│       └── ErrorBoundary.tsx
├── data/
│   ├── cities.ts                      # 3 şehir tanımı
│   ├── transfers.ts                   # 3 rota, her biri 2-3 seçenek
│   └── resources/
│       ├── tokyo.json
│       ├── kyoto.json
│       └── osaka.json
└── lib/
    ├── claude.ts                      # Anthropic client + prompt caching
    ├── types.ts                       # Tüm tip tanımları
    └── prompts/
        ├── city-plan.ts               # Şehir planı sistem promptu
        └── transfer-plan.ts           # Transfer planı sistem promptu
```

---

## Tech Stack

| Paket | Versiyon | Amaç |
|-------|----------|-------|
| next | 16 | Framework |
| typescript | 5 | Dil |
| tailwindcss | 4 | Stil |
| @anthropic-ai/sdk | latest | Claude API |
| zod | 4 | JSON doğrulama |
| date-fns | 4 | Tarih işlemleri |
| @dnd-kit/core + sortable | latest | Şehir sıralama (sürükle-bırak) |

---

## Veri Modelleri

```typescript
// Form girişi
interface TripFormData {
  startDate: Date
  endDate: Date
  cities: CityAllocation[]
  travelStyle: 'budget' | 'comfort' | 'luxury'
  interests: ('kultur' | 'yemek' | 'doga' | 'alisveris' | 'animepop')[]
  hasJRPass: boolean
}

interface CityAllocation {
  cityId: 'tokyo' | 'kyoto' | 'osaka'
  days: number
  order: number
}

// Claude API çıktısı
interface CityPlan {
  cityId: string
  cityName: string
  overview: string
  categories: {
    must_see: Recommendation[]
    food_drink: Recommendation[]
    culture_temples: Recommendation[]
    nature_day_trips: Recommendation[]
    shopping: Recommendation[]
    hidden_gems: Recommendation[]
  }
  daily_suggestions: DaySuggestion[]
  practical_tips: string[]
  best_areas_to_stay: AreaSuggestion[]
}

interface Recommendation {
  name: string
  description: string
  duration: string
  cost: string
  category_tags: string[]
  booking_required: boolean
}

interface DaySuggestion {
  day: number
  morning: string
  afternoon: string
  evening: string
  notes?: string
}

interface AreaSuggestion {
  name: string
  description: string
  best_for: string[]
}

interface TransferPlan {
  from: string
  to: string
  options: TransferOption[]
  recommended: string
}

interface TransferOption {
  id: string
  type: 'shinkansen' | 'local_train' | 'bus'
  name: string
  duration: string
  cost_range: string
  passes_applicable: string[]
  booking_url: string
  notes: string
}
```

---

## Claude API Entegrasyonu

### Model
`claude-sonnet-4-6` (claude-sonnet-4-20250514 yerine güncel model)

### Prompt Caching
- **Cache bloğu:** Sistem promptu + JSON schema (şehre özel sabit kısım)
- **Dinamik kısım:** Kullanıcı parametreleri (gün sayısı, tarih, tercihler)
- Sonuç: Aynı şehir için tekrar istekte ~%80 token tasarrufu

### Streaming Akışı
```
/plan sayfası yüklenince:
  1. Form verisi sessionStorage'dan okunur
  2. Her şehir için paralel fetch('/api/generate-plan') başlar
  3. Transfer rotaları için fetch('/api/generate-transfer') çağrılır
  4. Response ReadableStream → JSON parse → Zod doğrulama → state güncelleme
  5. Şehir kartları sırayla fadeIn ile belirir
```

### Hata Yönetimi
- JSON parse hatası: max 2 retry
- Retry başarısızsa: partial data ile devam, kart "bilgi yüklenemedi" mesajı gösterir
- Network hatası: ErrorBoundary yakalar, form sayfasına dönüş butonu

---

## UI/UX

### Tasarım Dili (Minimal/Modern)

| Token | Değer |
|-------|-------|
| Font başlık/gövde | `DM Sans` |
| Font monospace | `JetBrains Mono` (fiyat, tarih) |
| Sayfa arka plan | `#FAFAFA` |
| Yüzey | `#FFFFFF`, `border: 1px solid #E5E7EB` |
| Accent | `#E8003D` (Japonya kırmızısı) |
| Metin birincil | `#111827` |
| Metin ikincil | `#6B7280` |
| Kart radius | `12px` |
| Buton/input radius | `8px` |
| Gölge | `shadow-sm` → hover `shadow-md` |

### Form Wizard (Sayfa 1)

```
Adım göstergesi: ① Tarihler → ② Şehirler → ③ Tercihler

Adım 1 (Tarihler):
  - Başlangıç / bitiş tarih seçici
  - Toplam gün otomatik hesap
  - Mevsim badge (🌸 Mart-Nisan / ☀️ Yaz / 🍂 Kasım / ❄️ Kış)

Adım 2 (Şehirler):
  - 3 şehir kartı grid (fotoğraf + isim + önerilen gün)
  - Tıklayarak seç/çıkar
  - Seçili şehirlerde gün kaydırıcısı inline açılır
  - Sürükle-bırak ile ziyaret sırası belirleme

Adım 3 (Tercihler):
  - Seyahat stili: Budget / Comfort / Luxury (card select)
  - İlgi alanı chip'leri: Kültür / Yemek / Doğa / Alışveriş / Anime & Pop
  - JR Pass toggle
```

### Sonuç Sayfası (Sayfa 2)

```
Üst bar: "Tokyo (4g) → Kyoto (3g) → Osaka (2g)  |  15 Nisan - 24 Nisan"

Transfer Timeline (yatay):
  [Tokyo 4g] ──shinkansen 2s 40dk──> [Kyoto 3g] ──JR 28dk──> [Osaka 2g]

Şehir Tab'ları: [Tokyo] [Kyoto] [Osaka]
  Her tab içinde:
  - Kategori chip'leri: Must See / Yemek & İçki / Kültür / Alışveriş / Gizli Gems
  - Öneri kartları (isim, süre, maliyet, rezervasyon linki)
  - Günlük plan accordion (Sabah / Öğle / Akşam)

Kaynaklar bölümü:
  - Şehre göre filtreli linkler (blog / YouTube / resmi site)
  - Dil badge'i (TR / EN)
```

### Animasyonlar
- Liste item: `animation: slideUp 0.2s ease ${index * 0.03}s both`
- Panel girişi: `animation: fadeIn 0.2s ease`
- Streaming skeleton: `animation: pulse 1.5s ease infinite`

---

## Ortam Değişkenleri

```bash
# .env.local
ANTHROPIC_API_KEY=sk-ant-...
NEXT_PUBLIC_APP_URL=http://localhost:3000
```

---

## Geliştirme Fazları

### Phase 1 — Temel Yapı
- Next.js 16 projesi kurulumu
- `lib/types.ts` — tüm tip tanımları
- `lib/claude.ts` — Anthropic client + prompt caching kurulumu
- `data/cities.ts` — 3 şehir (Tokyo, Kyoto, Osaka)
- `data/transfers.ts` — 3 rota
- `data/resources/*.json` — boş şablon dosyaları

### Phase 2 — Form Bileşenleri
- `DateStep.tsx`, `CityStep.tsx`, `PreferencesStep.tsx`
- `TripForm.tsx` wizard container
- Form validasyonu (toplam gün kontrolü)

### Phase 3 — API Routes
- `/api/generate-plan` — streaming Claude çağrısı
- `/api/generate-transfer` — transfer planı
- Prompt mühendisliği + Zod doğrulama

### Phase 4 — Sonuç Sayfası
- `TransferTimeline.tsx`, `CityPlanCard.tsx`, `CategoryTabs.tsx`
- `DailyItinerary.tsx`, `ResourceLinks.tsx`
- Streaming UI, skeleton loader

### Phase 5 — Cilalama
- Responsive tasarım
- Hata sayfaları ve fallback
- Performans optimizasyonu

---

## Sonraki Adımlar

Bu spec onaylandıktan sonra `writing-plans` skill ile ayrıntılı implementation plan oluşturulacak, Phase 1'den başlanacak.
