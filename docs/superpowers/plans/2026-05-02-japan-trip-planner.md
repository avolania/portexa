# Japan Trip Planner Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Build a standalone Next.js 16 app that generates personalized Japan travel plans (Tokyo, Kyoto, Osaka) using Claude API with streaming.

**Architecture:** Two-page app (wizard form → results). Form data passes via sessionStorage. Each city plan fetched in parallel via streaming Claude API calls with prompt caching. Static data layer (cities, transfers, resources) is separate from AI generation. API routes extract plain text from Claude SSE stream so client can accumulate and parse JSON at completion.

**Tech Stack:** Next.js 16, TypeScript 5, Tailwind CSS v4, @anthropic-ai/sdk ^0.80, zod ^4, date-fns ^4, @dnd-kit/core + @dnd-kit/sortable

---

## File Map

| File | Responsibility |
|------|---------------|
| `src/lib/types.ts` | All TypeScript interfaces (TripFormData, CityPlan, TransferPlan, etc.) |
| `src/lib/schemas.ts` | Zod schemas for validating Claude responses |
| `src/lib/claude.ts` | Anthropic client singleton + MODEL + MAX_TOKENS constants |
| `src/lib/prompts/city-plan.ts` | System prompt builder + getSeason helper |
| `src/lib/prompts/transfer-plan.ts` | Transfer system prompt builder |
| `src/data/cities.ts` | Static metadata for Tokyo, Kyoto, Osaka |
| `src/data/transfers.ts` | Static transfer options for 3 routes + getTransferOptions() |
| `src/data/resources/tokyo.json` | Resource links for Tokyo (empty template) |
| `src/data/resources/kyoto.json` | Resource links for Kyoto (empty template) |
| `src/data/resources/osaka.json` | Resource links for Osaka (empty template) |
| `src/data/resources/index.ts` | Barrel export for all resource files |
| `src/app/layout.tsx` | Root layout with DM Sans + JetBrains Mono fonts |
| `src/app/globals.css` | Tailwind v4 import + CSS variables |
| `src/app/page.tsx` | Home page — renders TripForm wizard |
| `src/app/plan/page.tsx` | Results page — reads sessionStorage, fetches plans |
| `src/app/api/generate-plan/route.ts` | POST — streams city plan from Claude |
| `src/app/api/generate-transfer/route.ts` | POST — streams transfer plan from Claude |
| `src/components/planner/TripForm.tsx` | Wizard state container (step 1→2→3 → submit) |
| `src/components/planner/DateStep.tsx` | Step 1: date range picker + season badge |
| `src/components/planner/CityStep.tsx` | Step 2: city cards + day sliders + DnD ordering |
| `src/components/planner/PreferencesStep.tsx` | Step 3: travel style + interests + JR Pass |
| `src/components/results/PlanLayout.tsx` | Results page skeleton + summary bar |
| `src/components/results/TransferTimeline.tsx` | Horizontal city→city transfer timeline |
| `src/components/results/CityPlanCard.tsx` | Per-city card with overview + category tabs |
| `src/components/results/CategoryTabs.tsx` | Tab bar for must_see / food / culture / etc. |
| `src/components/results/DailyItinerary.tsx` | Accordion for morning/afternoon/evening per day |
| `src/components/results/ResourceLinks.tsx` | Filtered resource link grid |
| `src/components/ui/LoadingSkeleton.tsx` | Pulse skeleton for loading city cards |
| `src/components/ui/ErrorBoundary.tsx` | React error boundary for plan page |

---

## Phase 1 — Foundation

### Task 1: Scaffold Project + Install Dependencies

**Files:**
- Create: `/Users/dincercinar/Desktop/Uygulama/japan-trip-planner/` (new project)

- [ ] **Step 1: Create Next.js project**

```bash
cd /Users/dincercinar/Desktop/Uygulama
npx create-next-app@latest japan-trip-planner \
  --typescript \
  --tailwind \
  --app \
  --src-dir \
  --import-alias "@/*" \
  --no-eslint \
  --no-turbopack
```

Expected: project scaffolded at `/Users/dincercinar/Desktop/Uygulama/japan-trip-planner/`

- [ ] **Step 2: Install additional dependencies**

```bash
cd /Users/dincercinar/Desktop/Uygulama/japan-trip-planner
npm install @anthropic-ai/sdk zod date-fns @dnd-kit/core @dnd-kit/sortable @dnd-kit/utilities
```

Expected: packages added to `node_modules/`, no peer dependency errors

- [ ] **Step 3: Read Next.js 16 docs for breaking changes**

```bash
ls node_modules/next/dist/docs/ 2>/dev/null || echo "no docs dir"
cat node_modules/next/package.json | grep '"version"'
```

Note the installed Next.js version. If docs exist, skim App Router and API Route sections.

- [ ] **Step 4: Remove boilerplate**

Delete `src/app/page.tsx` content (will replace in Task 17).
Delete `public/next.svg` and `public/vercel.svg`.
Clear `src/app/globals.css` content (will replace in Task 2).

- [ ] **Step 5: Create .env.local**

```bash
cat > .env.local << 'EOF'
ANTHROPIC_API_KEY=sk-ant-REPLACE_WITH_YOUR_KEY
NEXT_PUBLIC_APP_URL=http://localhost:3000
EOF
```

- [ ] **Step 6: Verify dev server starts**

```bash
npm run dev
```

Expected: `✓ Ready in Xms` on `http://localhost:3000`. Stop with Ctrl+C.

- [ ] **Step 7: Commit**

```bash
git init
git add .
git commit -m "feat: scaffold japan-trip-planner Next.js project"
```

---

### Task 2: Configure Fonts + Global Styles

**Files:**
- Modify: `src/app/layout.tsx`
- Modify: `src/app/globals.css`

- [ ] **Step 1: Update layout.tsx with DM Sans + JetBrains Mono**

```tsx
// src/app/layout.tsx
import type { Metadata } from 'next'
import { DM_Sans, JetBrains_Mono } from 'next/font/google'
import './globals.css'

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
})

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-mono',
})

export const metadata: Metadata = {
  title: 'Japan Trip Planner',
  description: 'Kişiselleştirilmiş Japonya gezi planı oluşturucu',
}

export default function RootLayout({
  children,
}: {
  children: React.ReactNode
}) {
  return (
    <html lang="tr">
      <body className={`${dmSans.variable} ${jetbrainsMono.variable} antialiased`}>
        {children}
      </body>
    </html>
  )
}
```

- [ ] **Step 2: Update globals.css**

```css
/* src/app/globals.css */
@import "tailwindcss";

:root {
  --font-dm-sans: 'DM Sans', sans-serif;
  --font-mono: 'JetBrains Mono', monospace;

  --color-bg: #fafafa;
  --color-surface: #ffffff;
  --color-border: #e5e7eb;
  --color-accent: #e8003d;
  --color-text-primary: #111827;
  --color-text-secondary: #6b7280;
  --color-text-muted: #9ca3af;
}

body {
  font-family: var(--font-dm-sans);
  background-color: var(--color-bg);
  color: var(--color-text-primary);
}

.font-mono {
  font-family: var(--font-mono);
}

@keyframes fadeIn {
  from { opacity: 0; }
  to { opacity: 1; }
}

@keyframes slideUp {
  from { opacity: 0; transform: translateY(8px); }
  to { opacity: 1; transform: translateY(0); }
}

@keyframes pulse-skeleton {
  0%, 100% { opacity: 1; }
  50% { opacity: 0.4; }
}

.animate-fade-in { animation: fadeIn 0.2s ease; }
.animate-slide-up { animation: slideUp 0.2s ease both; }
.animate-skeleton { animation: pulse-skeleton 1.5s ease infinite; }
```

- [ ] **Step 3: Verify fonts load**

```bash
npm run dev
```

Open `http://localhost:3000`. Check DevTools → Network → Fonts. Expect DM Sans font files to load. Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/app/layout.tsx src/app/globals.css
git commit -m "feat: configure DM Sans + JetBrains Mono fonts and CSS variables"
```

---

### Task 3: Type Definitions

**Files:**
- Create: `src/lib/types.ts`

- [ ] **Step 1: Write all types**

```typescript
// src/lib/types.ts
export type CityId = 'tokyo' | 'kyoto' | 'osaka'
export type TravelStyle = 'budget' | 'comfort' | 'luxury'
export type Interest = 'kultur' | 'yemek' | 'doga' | 'alisveris' | 'animepop'
export type Season = 'spring' | 'summer' | 'autumn' | 'winter'
export type TransferType = 'shinkansen' | 'local_train' | 'bus'
export type ResourceType = 'blog' | 'youtube' | 'official' | 'booking' | 'map'
export type ResourceLanguage = 'tr' | 'en' | 'ja'

export interface CityAllocation {
  cityId: CityId
  days: number
  order: number
}

export interface TripFormData {
  startDate: Date
  endDate: Date
  cities: CityAllocation[]
  travelStyle: TravelStyle
  interests: Interest[]
  hasJRPass: boolean
}

export interface Recommendation {
  name: string
  description: string
  duration: string
  cost: string
  category_tags: string[]
  booking_required: boolean
}

export interface DaySuggestion {
  day: number
  morning: string
  afternoon: string
  evening: string
  notes?: string
}

export interface AreaSuggestion {
  name: string
  description: string
  best_for: string[]
}

export interface CityPlanCategories {
  must_see: Recommendation[]
  food_drink: Recommendation[]
  culture_temples: Recommendation[]
  nature_day_trips: Recommendation[]
  shopping: Recommendation[]
  hidden_gems: Recommendation[]
}

export interface CityPlan {
  cityId: string
  cityName: string
  overview: string
  categories: CityPlanCategories
  daily_suggestions: DaySuggestion[]
  practical_tips: string[]
  best_areas_to_stay: AreaSuggestion[]
}

export interface TransferOption {
  id: string
  type: TransferType
  name: string
  duration: string
  cost_range: string
  passes_applicable: string[]
  booking_url: string
  notes: string
}

export interface TransferPlan {
  from: string
  to: string
  options: TransferOption[]
  recommended: string
}

export interface ResourceLink {
  title: string
  url: string
  type: ResourceType
  language: ResourceLanguage
  tags: string[]
  description: string
}

export interface CityResources {
  cityId: string
  links: ResourceLink[]
}

// State for results page
export type CityPlanStatus = 'idle' | 'loading' | 'done' | 'error'

export interface CityPlanState {
  status: CityPlanStatus
  data: CityPlan | null
  error?: string
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/types.ts
git commit -m "feat: add all TypeScript type definitions"
```

---

### Task 4: Zod Schemas

**Files:**
- Create: `src/lib/schemas.ts`

- [ ] **Step 1: Write Zod schemas for Claude response validation**

```typescript
// src/lib/schemas.ts
import { z } from 'zod'

const RecommendationSchema = z.object({
  name: z.string(),
  description: z.string(),
  duration: z.string(),
  cost: z.string(),
  category_tags: z.array(z.string()),
  booking_required: z.boolean(),
})

const DaySuggestionSchema = z.object({
  day: z.number(),
  morning: z.string(),
  afternoon: z.string(),
  evening: z.string(),
  notes: z.string().optional(),
})

const AreaSuggestionSchema = z.object({
  name: z.string(),
  description: z.string(),
  best_for: z.array(z.string()),
})

export const CityPlanSchema = z.object({
  cityId: z.string(),
  cityName: z.string(),
  overview: z.string(),
  categories: z.object({
    must_see: z.array(RecommendationSchema),
    food_drink: z.array(RecommendationSchema),
    culture_temples: z.array(RecommendationSchema),
    nature_day_trips: z.array(RecommendationSchema),
    shopping: z.array(RecommendationSchema),
    hidden_gems: z.array(RecommendationSchema),
  }),
  daily_suggestions: z.array(DaySuggestionSchema),
  practical_tips: z.array(z.string()),
  best_areas_to_stay: z.array(AreaSuggestionSchema),
})

export const TransferOptionSchema = z.object({
  id: z.string(),
  type: z.enum(['shinkansen', 'local_train', 'bus']),
  name: z.string(),
  duration: z.string(),
  cost_range: z.string(),
  passes_applicable: z.array(z.string()),
  booking_url: z.string(),
  notes: z.string(),
})

export const TransferPlanSchema = z.object({
  from: z.string(),
  to: z.string(),
  options: z.array(TransferOptionSchema),
  recommended: z.string(),
})
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/schemas.ts
git commit -m "feat: add Zod schemas for Claude response validation"
```

---

### Task 5: City Data

**Files:**
- Create: `src/data/cities.ts`
- Create: `public/cities/` (placeholder images)

- [ ] **Step 1: Write cities.ts**

```typescript
// src/data/cities.ts
import type { CityId } from '@/lib/types'

export interface CityMeta {
  id: CityId
  name: string
  nameJa: string
  region: string
  description: string
  recommendedDays: { min: number; max: number }
  bestSeasons: string[]
  image: string
  highlights: string[]
  coordinates: { lat: number; lng: number }
}

export const JAPAN_CITIES: CityMeta[] = [
  {
    id: 'tokyo',
    name: 'Tokyo',
    nameJa: '東京',
    region: 'Kanto',
    description: 'Modern Japonya\'nın kalbi — Shibuya\'dan Asakusa\'ya',
    recommendedDays: { min: 3, max: 7 },
    bestSeasons: ['spring', 'autumn'],
    image: '/cities/tokyo.jpg',
    highlights: ['Shibuya Crossing', 'Senso-ji', 'Shinjuku', 'Harajuku', 'Akihabara'],
    coordinates: { lat: 35.6762, lng: 139.6503 },
  },
  {
    id: 'kyoto',
    name: 'Kyoto',
    nameJa: '京都',
    region: 'Kansai',
    description: 'Geleneksel Japonya\'nın ruhu — tapınaklar ve çay seremonisi',
    recommendedDays: { min: 2, max: 5 },
    bestSeasons: ['spring', 'autumn'],
    image: '/cities/kyoto.jpg',
    highlights: ['Fushimi Inari', 'Arashiyama Bambu', 'Gion', 'Kinkaku-ji', 'Nishiki Market'],
    coordinates: { lat: 35.0116, lng: 135.7681 },
  },
  {
    id: 'osaka',
    name: 'Osaka',
    nameJa: '大阪',
    region: 'Kansai',
    description: 'Yemek cenneti ve eğlence şehri — Dotonbori\'nin ışıkları',
    recommendedDays: { min: 2, max: 3 },
    bestSeasons: ['spring', 'autumn'],
    image: '/cities/osaka.jpg',
    highlights: ['Dotonbori', 'Osaka Castle', 'Kuromon Market', 'Shinsekai', 'USJ'],
    coordinates: { lat: 34.6937, lng: 135.5023 },
  },
]

export function getCityById(id: CityId): CityMeta {
  const city = JAPAN_CITIES.find(c => c.id === id)
  if (!city) throw new Error(`City not found: ${id}`)
  return city
}
```

- [ ] **Step 2: Create public/cities directory with placeholder images**

```bash
mkdir -p public/cities
# Create 1×1 pixel placeholder JPGs (will be replaced with real images)
# For now, copy any image or create empty files
touch public/cities/tokyo.jpg
touch public/cities/kyoto.jpg
touch public/cities/osaka.jpg
```

Note: replace these with real city photos before deployment. Free options: Unsplash (tokyo, kyoto, osaka search).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/data/cities.ts public/cities/
git commit -m "feat: add static city data for Tokyo, Kyoto, Osaka"
```

---

### Task 6: Transfer Route Data

**Files:**
- Create: `src/data/transfers.ts`

- [ ] **Step 1: Write transfers.ts**

```typescript
// src/data/transfers.ts
import type { TransferOption } from '@/lib/types'

const TRANSFER_ROUTES: Record<string, TransferOption[]> = {
  'tokyo-kyoto': [
    {
      id: 'tokyo-kyoto-nozomi',
      type: 'shinkansen',
      name: 'Nozomi Shinkansen',
      duration: '2s 15dk',
      cost_range: '¥13,320 - ¥14,000',
      passes_applicable: [],
      booking_url: 'https://www.jrpass.com/bullet-train',
      notes: 'JR Pass ile KULLANILAMAZ. En hızlı seçenek.',
    },
    {
      id: 'tokyo-kyoto-hikari',
      type: 'shinkansen',
      name: 'Hikari Shinkansen',
      duration: '2s 40dk',
      cost_range: '¥13,320',
      passes_applicable: ['JR Pass'],
      booking_url: 'https://www.japan-guide.com/e/e2018.html',
      notes: 'JR Pass geçerli. Nozomi\'den biraz yavaş ama fark az.',
    },
    {
      id: 'tokyo-kyoto-bus',
      type: 'bus',
      name: 'Gece Otobüsü (Willer)',
      duration: '8s',
      cost_range: '¥3,500 - ¥6,000',
      passes_applicable: [],
      booking_url: 'https://willerexpress.com/en/',
      notes: 'Bütçe dostu. Bir gece konaklamadan tasarruf.',
    },
  ],
  'kyoto-osaka': [
    {
      id: 'kyoto-osaka-jr',
      type: 'local_train',
      name: 'JR Shinkaisoku',
      duration: '28dk',
      cost_range: '¥580',
      passes_applicable: ['JR Pass', 'Kansai Pass'],
      booking_url: 'https://www.hyperdia.com/',
      notes: 'En pratik seçenek. Sık sefer.',
    },
    {
      id: 'kyoto-osaka-hankyu',
      type: 'local_train',
      name: 'Hankyu Line',
      duration: '45dk',
      cost_range: '¥400',
      passes_applicable: ['Hankyu Tourist Pass'],
      booking_url: 'https://www.hankyu.co.jp/global/en/',
      notes: 'Ucuz alternatif. JR Pass geçmez.',
    },
  ],
  'tokyo-osaka': [
    {
      id: 'tokyo-osaka-nozomi',
      type: 'shinkansen',
      name: 'Nozomi Shinkansen',
      duration: '2s 30dk',
      cost_range: '¥14,720 - ¥15,500',
      passes_applicable: [],
      booking_url: 'https://www.jrpass.com/bullet-train',
      notes: 'JR Pass ile KULLANILAMAZ. En hızlı seçenek.',
    },
    {
      id: 'tokyo-osaka-hikari',
      type: 'shinkansen',
      name: 'Hikari Shinkansen',
      duration: '3s 10dk',
      cost_range: '¥14,720',
      passes_applicable: ['JR Pass'],
      booking_url: 'https://www.japan-guide.com/e/e2018.html',
      notes: 'JR Pass geçerli.',
    },
    {
      id: 'tokyo-osaka-bus',
      type: 'bus',
      name: 'Gece Otobüsü (Willer)',
      duration: '9s',
      cost_range: '¥4,000 - ¥7,000',
      passes_applicable: [],
      booking_url: 'https://willerexpress.com/en/',
      notes: 'Bütçe dostu. Gece seyahati.',
    },
  ],
}

export function getTransferOptions(from: string, to: string): TransferOption[] {
  return (
    TRANSFER_ROUTES[`${from}-${to}`] ??
    TRANSFER_ROUTES[`${to}-${from}`] ??
    []
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/data/transfers.ts
git commit -m "feat: add static transfer route data for 3 city pairs"
```

---

### Task 7: Resource JSON Templates + Barrel

**Files:**
- Create: `src/data/resources/tokyo.json`
- Create: `src/data/resources/kyoto.json`
- Create: `src/data/resources/osaka.json`
- Create: `src/data/resources/index.ts`

- [ ] **Step 1: Create resource JSON templates**

```json
// src/data/resources/tokyo.json
{
  "cityId": "tokyo",
  "links": [
    {
      "title": "Japan Guide — Tokyo",
      "url": "https://www.japan-guide.com/e/e2164.html",
      "type": "official",
      "language": "en",
      "tags": ["genel", "ulaşım", "gezilecek yerler"],
      "description": "Tokyo hakkında kapsamlı İngilizce rehber"
    }
  ]
}
```

```json
// src/data/resources/kyoto.json
{
  "cityId": "kyoto",
  "links": [
    {
      "title": "Japan Guide — Kyoto",
      "url": "https://www.japan-guide.com/e/e2158.html",
      "type": "official",
      "language": "en",
      "tags": ["genel", "tapınaklar", "gezilecek yerler"],
      "description": "Kyoto hakkında kapsamlı İngilizce rehber"
    }
  ]
}
```

```json
// src/data/resources/osaka.json
{
  "cityId": "osaka",
  "links": [
    {
      "title": "Japan Guide — Osaka",
      "url": "https://www.japan-guide.com/e/e2157.html",
      "type": "official",
      "language": "en",
      "tags": ["genel", "yemek", "gezilecek yerler"],
      "description": "Osaka hakkında kapsamlı İngilizce rehber"
    }
  ]
}
```

- [ ] **Step 2: Create resources barrel export**

```typescript
// src/data/resources/index.ts
import type { CityResources } from '@/lib/types'
import tokyoData from './tokyo.json'
import kyotoData from './kyoto.json'
import osakaData from './osaka.json'

export const CITY_RESOURCES: Record<string, CityResources> = {
  tokyo: tokyoData as CityResources,
  kyoto: kyotoData as CityResources,
  osaka: osakaData as CityResources,
}

export function getCityResources(cityId: string): CityResources {
  return CITY_RESOURCES[cityId] ?? { cityId, links: [] }
}
```

- [ ] **Step 3: Enable JSON imports in tsconfig.json**

Check `tsconfig.json` has `"resolveJsonModule": true`. If not, add it:

```json
// In compilerOptions:
"resolveJsonModule": true
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/data/resources/ tsconfig.json
git commit -m "feat: add resource JSON templates and barrel export"
```

---

### Task 8: Prompt Builders

**Files:**
- Create: `src/lib/prompts/city-plan.ts`
- Create: `src/lib/prompts/transfer-plan.ts`

- [ ] **Step 1: Write city-plan.ts**

```typescript
// src/lib/prompts/city-plan.ts
import type { CityAllocation, TravelStyle, Interest, Season } from '@/lib/types'

export function getSeason(date: Date): Season {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return 'spring'
  if (month >= 6 && month <= 8) return 'summer'
  if (month >= 9 && month <= 11) return 'autumn'
  return 'winter'
}

const SEASON_LABELS: Record<Season, string> = {
  spring: 'İlkbahar (Mart-Mayıs) — Sakura dönemi olabilir',
  summer: 'Yaz (Haziran-Ağustos) — Sıcak ve nemli, Matsuri festivalleri',
  autumn: 'Sonbahar (Eylül-Kasım) — Momiji yaprak rengi dönemi',
  winter: 'Kış (Aralık-Şubat) — Soğuk, sakin sezon',
}

const INTEREST_LABELS: Record<Interest, string> = {
  kultur: 'kültür ve tarih (tapınaklar, müzeler)',
  yemek: 'yemek ve içki (street food, restoranlar, izakaya)',
  doga: 'doğa ve parklar (günübirlik geziler dahil)',
  alisveris: 'alışveriş (mağazalar, çarşılar)',
  animepop: 'anime ve pop kültür (Akihabara, Harajuku)',
}

const TRAVEL_STYLE_LABELS: Record<TravelStyle, string> = {
  budget: 'ekonomik (bütçe odaklı, uygun fiyatlı seçenekler)',
  comfort: 'konforlu (orta segment)',
  luxury: 'lüks (premium, en iyileri)',
}

export function buildCityPlanSystemPrompt(
  cityAllocation: CityAllocation,
  cityName: string,
  travelStyle: TravelStyle,
  interests: Interest[],
  season: Season,
): string {
  const interestStr = interests.map(i => INTEREST_LABELS[i]).join(', ')
  return `Sen deneyimli bir Japonya seyahat uzmanısın. Türk gezginler için kişiselleştirilmiş Japonya gezi planları oluşturuyorsun.

Kullanıcı profili:
- Şehir: ${cityName}
- Kalış süresi: ${cityAllocation.days} gün
- Seyahat stili: ${TRAVEL_STYLE_LABELS[travelStyle]}
- İlgi alanları: ${interestStr}
- Mevsim: ${SEASON_LABELS[season]}

Önemli kurallar:
- Türk damak tadına uygun yemek alternatifleri sun (helal seçenekler dahil)
- Mevsime göre özel etkinlikleri ve dikkat edilmesi gerekenleri belirt
- Her öneri için tahmini maliyet (JPY) ver
- Yürüme mesafesi yakın yerleri gruplayarak öner
- Günlük planda sabah/öğle/akşam bloklarını dengeli dağıt
- ${cityAllocation.days} gün için tam olarak ${cityAllocation.days} adet daily_suggestion üret (day: 1'den başlar)

SADECE geçerli JSON döndür. Markdown fence (backtick bloğu) KULLANMA. Başka açıklama ekleme.

JSON schema (bu yapıya tam olarak uy):
{
  "cityId": "string",
  "cityName": "string",
  "overview": "string — 2-3 cümle şehir özeti",
  "categories": {
    "must_see": [{"name":"string","description":"string","duration":"string","cost":"string","category_tags":["string"],"booking_required":boolean}],
    "food_drink": [aynı yapı],
    "culture_temples": [aynı yapı],
    "nature_day_trips": [aynı yapı],
    "shopping": [aynı yapı],
    "hidden_gems": [aynı yapı]
  },
  "daily_suggestions": [{"day":1,"morning":"string","afternoon":"string","evening":"string","notes":"string veya undefined"}],
  "practical_tips": ["string"],
  "best_areas_to_stay": [{"name":"string","description":"string","best_for":["string"]}]
}`
}

export function buildCityPlanUserMessage(
  cityName: string,
  days: number,
  startDate: Date,
  endDate: Date,
): string {
  return `${cityName} için ${days} günlük gezi planı oluştur. Seyahat tarihleri: ${startDate.toLocaleDateString('tr-TR')} - ${endDate.toLocaleDateString('tr-TR')}.`
}
```

- [ ] **Step 2: Write transfer-plan.ts**

```typescript
// src/lib/prompts/transfer-plan.ts
import type { TravelStyle } from '@/lib/types'

export function buildTransferSystemPrompt(): string {
  return `Sen Japonya şehirlerarası ulaşım uzmanısın. Verilen rota için en iyi transfer seçeneklerini JSON olarak döndür.

SADECE geçerli JSON döndür. Markdown fence KULLANMA. Başka açıklama ekleme.

JSON schema:
{
  "from": "string",
  "to": "string",
  "options": [
    {
      "id": "string",
      "type": "shinkansen|local_train|bus",
      "name": "string",
      "duration": "string",
      "cost_range": "string (JPY cinsinden)",
      "passes_applicable": ["string"],
      "booking_url": "string",
      "notes": "string"
    }
  ],
  "recommended": "string — önerilen option id"
}`
}

export function buildTransferUserMessage(
  fromCity: string,
  toCity: string,
  travelStyle: TravelStyle,
  hasJRPass: boolean,
): string {
  return `Rota: ${fromCity} → ${toCity}. Seyahat stili: ${travelStyle}. JR Pass: ${hasJRPass ? 'Var' : 'Yok'}. En iyi 2-3 seçenek öner ve birini recommended olarak işaretle.`
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/prompts/
git commit -m "feat: add Claude prompt builder functions with caching-friendly system prompts"
```

---

### Task 9: Anthropic Client

**Files:**
- Create: `src/lib/claude.ts`

- [ ] **Step 1: Write claude.ts**

```typescript
// src/lib/claude.ts
import Anthropic from '@anthropic-ai/sdk'

export const anthropic = new Anthropic({
  apiKey: process.env.ANTHROPIC_API_KEY,
})

export const MODEL = 'claude-sonnet-4-6'
export const MAX_TOKENS = 4000

/**
 * Wraps a system prompt string for use with prompt caching.
 * The cache_control marks this content block as cacheable (5-min TTL).
 * Uses `as const` to satisfy the SDK's TextBlockParam type without a named import.
 */
export function cachedSystemPrompt(text: string) {
  return {
    type: 'text' as const,
    text,
    cache_control: { type: 'ephemeral' as const },
  }
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/claude.ts
git commit -m "feat: add Anthropic client with prompt caching helper"
```

---

## Phase 2 — API Routes

### Task 10: Generate Plan API Route

**Files:**
- Create: `src/app/api/generate-plan/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/generate-plan/route.ts
import { anthropic, MODEL, MAX_TOKENS, cachedSystemPrompt } from '@/lib/claude'
import { buildCityPlanSystemPrompt, buildCityPlanUserMessage, getSeason } from '@/lib/prompts/city-plan'
import type { CityAllocation, TravelStyle, Interest } from '@/lib/types'

interface RequestBody {
  cityAllocation: CityAllocation
  cityName: string
  travelStyle: TravelStyle
  interests: Interest[]
  startDate: string
  endDate: string
}

export async function POST(req: Request) {
  const body: RequestBody = await req.json()
  const { cityAllocation, cityName, travelStyle, interests, startDate, endDate } = body

  const start = new Date(startDate)
  const end = new Date(endDate)
  const season = getSeason(start)

  const systemPrompt = buildCityPlanSystemPrompt(
    cityAllocation,
    cityName,
    travelStyle,
    interests,
    season,
  )
  const userMessage = buildCityPlanUserMessage(cityName, cityAllocation.days, start, end)

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: MAX_TOKENS,
    system: [cachedSystemPrompt(systemPrompt)],
    messages: [{ role: 'user', content: userMessage }],
  })

  // Forward only the text deltas as a plain text stream.
  // Client accumulates and parses JSON when stream ends.
  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 2: Test the route with curl (requires ANTHROPIC_API_KEY in .env.local)**

```bash
npm run dev &
sleep 3
curl -s -X POST http://localhost:3000/api/generate-plan \
  -H "Content-Type: application/json" \
  -d '{
    "cityAllocation": {"cityId":"tokyo","days":3,"order":1},
    "cityName": "Tokyo",
    "travelStyle": "comfort",
    "interests": ["yemek","kultur"],
    "startDate": "2026-09-01",
    "endDate": "2026-09-10"
  }' | head -c 500
```

Expected: first 500 chars of streaming JSON text (starts with `{`).

Kill the dev server: `pkill -f "next dev"` or stop with Ctrl+C.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate-plan/
git commit -m "feat: add generate-plan API route with Claude streaming and prompt caching"
```

---

### Task 11: Generate Transfer API Route

**Files:**
- Create: `src/app/api/generate-transfer/route.ts`

- [ ] **Step 1: Write the route**

```typescript
// src/app/api/generate-transfer/route.ts
import { anthropic, MODEL, MAX_TOKENS, cachedSystemPrompt } from '@/lib/claude'
import { buildTransferSystemPrompt, buildTransferUserMessage } from '@/lib/prompts/transfer-plan'
import type { TravelStyle } from '@/lib/types'

interface RequestBody {
  fromCity: string
  toCity: string
  travelStyle: TravelStyle
  hasJRPass: boolean
}

export async function POST(req: Request) {
  const body: RequestBody = await req.json()
  const { fromCity, toCity, travelStyle, hasJRPass } = body

  const systemPrompt = buildTransferSystemPrompt()
  const userMessage = buildTransferUserMessage(fromCity, toCity, travelStyle, hasJRPass)

  const stream = anthropic.messages.stream({
    model: MODEL,
    max_tokens: 1000,
    system: [cachedSystemPrompt(systemPrompt)],
    messages: [{ role: 'user', content: userMessage }],
  })

  const encoder = new TextEncoder()
  const readable = new ReadableStream({
    async start(controller) {
      for await (const chunk of stream) {
        if (
          chunk.type === 'content_block_delta' &&
          chunk.delta.type === 'text_delta'
        ) {
          controller.enqueue(encoder.encode(chunk.delta.text))
        }
      }
      controller.close()
    },
    cancel() {
      stream.abort()
    },
  })

  return new Response(readable, {
    headers: { 'Content-Type': 'text/plain; charset=utf-8' },
  })
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/app/api/generate-transfer/
git commit -m "feat: add generate-transfer API route with Claude streaming"
```

---

## Phase 3 — Form Components

### Task 12: DateStep Component

**Files:**
- Create: `src/components/planner/DateStep.tsx`

- [ ] **Step 1: Write DateStep.tsx**

```tsx
// src/components/planner/DateStep.tsx
'use client'

import { differenceInDays, format } from 'date-fns'
import { tr } from 'date-fns/locale'

interface Props {
  startDate: Date | null
  endDate: Date | null
  onChange: (start: Date | null, end: Date | null) => void
}

function getSeasonLabel(date: Date): string {
  const month = date.getMonth() + 1
  if (month >= 3 && month <= 5) return '🌸 Sakura dönemi (İlkbahar)'
  if (month >= 6 && month <= 8) return '☀️ Yaz — Sıcak ve nemli'
  if (month >= 9 && month <= 11) return '🍂 Momiji dönemi (Sonbahar)'
  return '❄️ Kış sezonu'
}

export default function DateStep({ startDate, endDate, onChange }: Props) {
  const totalDays =
    startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Seyahat tarihleriniz
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Japonya'ya ne zaman gideceksiniz?
        </p>
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Gidiş Tarihi
          </label>
          <input
            type="date"
            value={startDate ? format(startDate, 'yyyy-MM-dd') : ''}
            min={format(new Date(), 'yyyy-MM-dd')}
            onChange={e => {
              const d = e.target.value ? new Date(e.target.value) : null
              onChange(d, endDate)
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1.5px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'var(--font-dm-sans)',
              outline: 'none',
              cursor: 'pointer',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#e8003d'
              e.target.style.boxShadow = '0 0 0 3px rgba(232,0,61,0.1)'
            }}
            onBlur={e => {
              e.target.style.borderColor = '#e5e7eb'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>

        <div>
          <label style={{ display: 'block', fontSize: 12, fontWeight: 600, color: '#374151', marginBottom: 6 }}>
            Dönüş Tarihi
          </label>
          <input
            type="date"
            value={endDate ? format(endDate, 'yyyy-MM-dd') : ''}
            min={startDate ? format(startDate, 'yyyy-MM-dd') : format(new Date(), 'yyyy-MM-dd')}
            onChange={e => {
              const d = e.target.value ? new Date(e.target.value) : null
              onChange(startDate, d)
            }}
            style={{
              width: '100%',
              padding: '10px 14px',
              border: '1.5px solid #e5e7eb',
              borderRadius: 8,
              fontSize: 14,
              fontFamily: 'var(--font-dm-sans)',
              outline: 'none',
              cursor: 'pointer',
            }}
            onFocus={e => {
              e.target.style.borderColor = '#e8003d'
              e.target.style.boxShadow = '0 0 0 3px rgba(232,0,61,0.1)'
            }}
            onBlur={e => {
              e.target.style.borderColor = '#e5e7eb'
              e.target.style.boxShadow = 'none'
            }}
          />
        </div>
      </div>

      {startDate && endDate && totalDays > 0 && (
        <div style={{ animation: 'fadeIn 0.2s ease' }}>
          <div style={{
            background: '#fff7f8',
            border: '1px solid #fecdd3',
            borderRadius: 10,
            padding: '14px 18px',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'space-between',
          }}>
            <div>
              <span style={{ fontSize: 13, color: '#6b7280' }}>Toplam seyahat: </span>
              <span style={{ fontSize: 15, fontWeight: 700, color: '#111827' }}>{totalDays} gün</span>
            </div>
            <div style={{
              fontSize: 12,
              fontWeight: 600,
              color: '#e8003d',
              background: '#fff',
              border: '1px solid #fecdd3',
              borderRadius: 20,
              padding: '4px 12px',
            }}>
              {getSeasonLabel(startDate)}
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/DateStep.tsx
git commit -m "feat: add DateStep component with season badge"
```

---

### Task 13: CityStep Component

**Files:**
- Create: `src/components/planner/CityStep.tsx`

- [ ] **Step 1: Install DnD Kit (already installed in Task 1, verify)**

```bash
ls node_modules/@dnd-kit/core/dist/index.mjs 2>/dev/null && echo "installed" || echo "not found"
```

- [ ] **Step 2: Write CityStep.tsx**

```tsx
// src/components/planner/CityStep.tsx
'use client'

import { DndContext, closestCenter, DragEndEvent } from '@dnd-kit/core'
import { SortableContext, useSortable, verticalListSortingStrategy, arrayMove } from '@dnd-kit/sortable'
import { CSS } from '@dnd-kit/utilities'
import { JAPAN_CITIES } from '@/data/cities'
import type { CityAllocation, CityId } from '@/lib/types'

interface Props {
  cities: CityAllocation[]
  totalDays: number
  onChange: (cities: CityAllocation[]) => void
}

interface SortableRowProps {
  allocation: CityAllocation
  cityName: string
  totalDays: number
  onDaysChange: (days: number) => void
  onRemove: () => void
}

function SortableRow({ allocation, cityName, totalDays, onDaysChange, onRemove }: SortableRowProps) {
  const { attributes, listeners, setNodeRef, transform, transition } = useSortable({ id: allocation.cityId })

  return (
    <div
      ref={setNodeRef}
      style={{
        transform: CSS.Transform.toString(transform),
        transition,
        background: '#fff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 10,
        padding: '12px 16px',
        display: 'flex',
        alignItems: 'center',
        gap: 12,
        marginBottom: 8,
      }}
    >
      <button
        {...attributes}
        {...listeners}
        style={{ cursor: 'grab', color: '#9ca3af', fontSize: 18, border: 'none', background: 'none', padding: 0 }}
      >
        ⠿
      </button>
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{cityName}</div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginTop: 6 }}>
          <input
            type="range"
            min={1}
            max={Math.max(1, totalDays - 1)}
            value={allocation.days}
            onChange={e => onDaysChange(Number(e.target.value))}
            style={{ flex: 1, accentColor: '#e8003d' }}
          />
          <span style={{
            fontFamily: 'var(--font-mono)',
            fontSize: 13,
            fontWeight: 600,
            color: '#e8003d',
            minWidth: 50,
            textAlign: 'right',
          }}>
            {allocation.days} gün
          </span>
        </div>
      </div>
      <button
        onClick={onRemove}
        style={{
          width: 28,
          height: 28,
          borderRadius: '50%',
          border: '1px solid #e5e7eb',
          background: '#fff',
          color: '#6b7280',
          cursor: 'pointer',
          fontSize: 14,
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        ✕
      </button>
    </div>
  )
}

export default function CityStep({ cities, totalDays, onChange }: Props) {
  const selectedIds = cities.map(c => c.cityId)

  function toggleCity(cityId: CityId) {
    if (selectedIds.includes(cityId)) {
      const updated = cities
        .filter(c => c.cityId !== cityId)
        .map((c, i) => ({ ...c, order: i + 1 }))
      onChange(updated)
    } else {
      const newCity: CityAllocation = { cityId, days: 2, order: cities.length + 1 }
      onChange([...cities, newCity])
    }
  }

  function updateDays(cityId: CityId, days: number) {
    onChange(cities.map(c => c.cityId === cityId ? { ...c, days } : c))
  }

  function handleDragEnd(event: DragEndEvent) {
    const { active, over } = event
    if (!over || active.id === over.id) return
    const oldIdx = cities.findIndex(c => c.cityId === active.id)
    const newIdx = cities.findIndex(c => c.cityId === over.id)
    const reordered = arrayMove(cities, oldIdx, newIdx).map((c, i) => ({ ...c, order: i + 1 }))
    onChange(reordered)
  }

  const allocatedDays = cities.reduce((sum, c) => sum + c.days, 0)
  const remaining = totalDays - allocatedDays

  return (
    <div className="space-y-6">
      <div>
        <h2 style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Hangi şehirlere gidiyorsunuz?
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Şehirleri seçin ve her biri için kaç gün ayırdığınızı belirleyin.
        </p>
      </div>

      {/* City selector cards */}
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 12 }}>
        {JAPAN_CITIES.map(city => {
          const isSelected = selectedIds.includes(city.id)
          return (
            <button
              key={city.id}
              onClick={() => toggleCity(city.id)}
              style={{
                background: isSelected ? '#fff7f8' : '#fff',
                border: `2px solid ${isSelected ? '#e8003d' : '#e5e7eb'}`,
                borderRadius: 12,
                padding: '16px 12px',
                cursor: 'pointer',
                textAlign: 'left',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: 20, marginBottom: 4 }}>
                {city.id === 'tokyo' ? '🗼' : city.id === 'kyoto' ? '⛩️' : '🏯'}
              </div>
              <div style={{ fontSize: 14, fontWeight: 700, color: '#111827' }}>{city.name}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', fontFamily: 'var(--font-mono)' }}>{city.nameJa}</div>
              <div style={{ fontSize: 11, color: '#6b7280', marginTop: 4 }}>
                Önerilen: {city.recommendedDays.min}-{city.recommendedDays.max} gün
              </div>
            </button>
          )
        })}
      </div>

      {/* Day allocation with drag-and-drop */}
      {cities.length > 0 && (
        <div>
          <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 8 }}>
            <span style={{ fontSize: 13, fontWeight: 600, color: '#374151' }}>Gün dağılımı ve ziyaret sırası</span>
            <span style={{
              fontSize: 12,
              fontFamily: 'var(--font-mono)',
              fontWeight: 600,
              color: remaining === 0 ? '#059669' : remaining < 0 ? '#dc2626' : '#6b7280',
            }}>
              {allocatedDays}/{totalDays} gün
            </span>
          </div>

          <DndContext collisionDetection={closestCenter} onDragEnd={handleDragEnd}>
            <SortableContext items={cities.map(c => c.cityId)} strategy={verticalListSortingStrategy}>
              {cities.map(allocation => {
                const meta = JAPAN_CITIES.find(c => c.id === allocation.cityId)!
                return (
                  <SortableRow
                    key={allocation.cityId}
                    allocation={allocation}
                    cityName={meta.name}
                    totalDays={totalDays}
                    onDaysChange={days => updateDays(allocation.cityId, days)}
                    onRemove={() => toggleCity(allocation.cityId)}
                  />
                )
              })}
            </SortableContext>
          </DndContext>

          {remaining < 0 && (
            <p style={{ fontSize: 12, color: '#dc2626', marginTop: 4 }}>
              ⚠️ Toplam günler seyahat süresini aşıyor ({Math.abs(remaining)} gün fazla)
            </p>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/CityStep.tsx
git commit -m "feat: add CityStep with city cards, day sliders, and drag-and-drop ordering"
```

---

### Task 14: PreferencesStep Component

**Files:**
- Create: `src/components/planner/PreferencesStep.tsx`

- [ ] **Step 1: Write PreferencesStep.tsx**

```tsx
// src/components/planner/PreferencesStep.tsx
'use client'

import type { TravelStyle, Interest } from '@/lib/types'

interface Props {
  travelStyle: TravelStyle
  interests: Interest[]
  hasJRPass: boolean
  onChange: (updates: { travelStyle?: TravelStyle; interests?: Interest[]; hasJRPass?: boolean }) => void
}

const TRAVEL_STYLES: { id: TravelStyle; label: string; desc: string; emoji: string }[] = [
  { id: 'budget', label: 'Ekonomik', desc: 'Uygun fiyatlı, pratik seçenekler', emoji: '🎒' },
  { id: 'comfort', label: 'Konforlu', desc: 'Orta segment, kaliteli deneyim', emoji: '🏨' },
  { id: 'luxury', label: 'Lüks', desc: 'Premium, en iyisi', emoji: '✨' },
]

const INTERESTS: { id: Interest; label: string; emoji: string }[] = [
  { id: 'kultur', label: 'Kültür & Tarih', emoji: '⛩️' },
  { id: 'yemek', label: 'Yemek & İçki', emoji: '🍜' },
  { id: 'doga', label: 'Doğa & Parklar', emoji: '🌿' },
  { id: 'alisveris', label: 'Alışveriş', emoji: '🛍️' },
  { id: 'animepop', label: 'Anime & Pop', emoji: '🎌' },
]

export default function PreferencesStep({ travelStyle, interests, hasJRPass, onChange }: Props) {
  function toggleInterest(id: Interest) {
    const updated = interests.includes(id)
      ? interests.filter(i => i !== id)
      : [...interests, id]
    onChange({ interests: updated })
  }

  return (
    <div className="space-y-8">
      <div>
        <h2 style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 22, fontWeight: 700, color: '#111827', marginBottom: 8 }}>
          Seyahat tercihleriniz
        </h2>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Size özel bir plan oluşturmamıza yardımcı olur.
        </p>
      </div>

      {/* Travel style */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          Seyahat stili
        </label>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3, 1fr)', gap: 10 }}>
          {TRAVEL_STYLES.map(style => (
            <button
              key={style.id}
              onClick={() => onChange({ travelStyle: style.id })}
              style={{
                background: travelStyle === style.id ? '#fff7f8' : '#fff',
                border: `2px solid ${travelStyle === style.id ? '#e8003d' : '#e5e7eb'}`,
                borderRadius: 10,
                padding: '14px 10px',
                cursor: 'pointer',
                textAlign: 'center',
                transition: 'all 0.15s ease',
              }}
            >
              <div style={{ fontSize: 22, marginBottom: 4 }}>{style.emoji}</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{style.label}</div>
              <div style={{ fontSize: 11, color: '#9ca3af', marginTop: 2 }}>{style.desc}</div>
            </button>
          ))}
        </div>
      </div>

      {/* Interests */}
      <div>
        <label style={{ display: 'block', fontSize: 13, fontWeight: 600, color: '#374151', marginBottom: 12 }}>
          İlgi alanlarınız
        </label>
        <div style={{ display: 'flex', flexWrap: 'wrap', gap: 8 }}>
          {INTERESTS.map(interest => {
            const isSelected = interests.includes(interest.id)
            return (
              <button
                key={interest.id}
                onClick={() => toggleInterest(interest.id)}
                style={{
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                  padding: '8px 16px',
                  borderRadius: 20,
                  border: `1.5px solid ${isSelected ? '#e8003d' : '#e5e7eb'}`,
                  background: isSelected ? '#fff7f8' : '#fff',
                  color: isSelected ? '#e8003d' : '#374151',
                  fontSize: 13,
                  fontWeight: isSelected ? 600 : 400,
                  cursor: 'pointer',
                  transition: 'all 0.15s ease',
                }}
              >
                <span>{interest.emoji}</span>
                <span>{interest.label}</span>
              </button>
            )
          })}
        </div>
      </div>

      {/* JR Pass */}
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'space-between',
        background: '#fff',
        border: '1.5px solid #e5e7eb',
        borderRadius: 10,
        padding: '16px 18px',
      }}>
        <div>
          <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>JR Pass</div>
          <div style={{ fontSize: 12, color: '#6b7280', marginTop: 2 }}>
            Sınırsız Shinkansen (Hikari/Sakura) ve JR hatları
          </div>
        </div>
        <button
          onClick={() => onChange({ hasJRPass: !hasJRPass })}
          style={{
            width: 48,
            height: 26,
            borderRadius: 13,
            border: 'none',
            background: hasJRPass ? '#e8003d' : '#e5e7eb',
            cursor: 'pointer',
            position: 'relative',
            transition: 'background 0.2s ease',
          }}
        >
          <span style={{
            position: 'absolute',
            top: 3,
            left: hasJRPass ? 25 : 3,
            width: 20,
            height: 20,
            borderRadius: '50%',
            background: '#fff',
            transition: 'left 0.2s ease',
            boxShadow: '0 1px 3px rgba(0,0,0,0.2)',
          }} />
        </button>
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/components/planner/PreferencesStep.tsx
git commit -m "feat: add PreferencesStep with travel style, interests, and JR Pass toggle"
```

---

### Task 15: TripForm Wizard + Home Page

**Files:**
- Create: `src/components/planner/TripForm.tsx`
- Modify: `src/app/page.tsx`

- [ ] **Step 1: Write TripForm.tsx**

```tsx
// src/components/planner/TripForm.tsx
'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { differenceInDays } from 'date-fns'
import DateStep from './DateStep'
import CityStep from './CityStep'
import PreferencesStep from './PreferencesStep'
import type { TripFormData, CityAllocation, TravelStyle, Interest } from '@/lib/types'

const STEPS = ['Tarihler', 'Şehirler', 'Tercihler']

export default function TripForm() {
  const router = useRouter()
  const [step, setStep] = useState(0)

  const [startDate, setStartDate] = useState<Date | null>(null)
  const [endDate, setEndDate] = useState<Date | null>(null)
  const [cities, setCities] = useState<CityAllocation[]>([])
  const [travelStyle, setTravelStyle] = useState<TravelStyle>('comfort')
  const [interests, setInterests] = useState<Interest[]>(['kultur', 'yemek'])
  const [hasJRPass, setHasJRPass] = useState(false)

  const totalDays = startDate && endDate ? differenceInDays(endDate, startDate) + 1 : 0
  const allocatedDays = cities.reduce((sum, c) => sum + c.days, 0)

  function canProceed(): boolean {
    if (step === 0) return !!(startDate && endDate && totalDays > 0)
    if (step === 1) return cities.length > 0 && allocatedDays <= totalDays
    if (step === 2) return interests.length > 0
    return false
  }

  function handleSubmit() {
    if (!startDate || !endDate) return
    const formData: TripFormData = { startDate, endDate, cities, travelStyle, interests, hasJRPass }
    sessionStorage.setItem('tripFormData', JSON.stringify({
      ...formData,
      startDate: startDate.toISOString(),
      endDate: endDate.toISOString(),
    }))
    router.push('/plan')
  }

  return (
    <div style={{ maxWidth: 600, margin: '0 auto', padding: '40px 24px' }}>
      {/* Header */}
      <div style={{ textAlign: 'center', marginBottom: 40 }}>
        <div style={{ fontSize: 32, marginBottom: 12 }}>🗾</div>
        <h1 style={{ fontFamily: 'var(--font-dm-sans)', fontSize: 28, fontWeight: 800, color: '#111827', marginBottom: 8 }}>
          Japan Trip Planner
        </h1>
        <p style={{ fontSize: 14, color: '#6b7280' }}>
          Claude AI ile kişiselleştirilmiş Japonya gezi planınız
        </p>
      </div>

      {/* Step indicator */}
      <div style={{ display: 'flex', alignItems: 'center', marginBottom: 32 }}>
        {STEPS.map((label, idx) => (
          <div key={idx} style={{ display: 'flex', alignItems: 'center', flex: idx < STEPS.length - 1 ? 1 : undefined }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
              <div style={{
                width: 28,
                height: 28,
                borderRadius: '50%',
                background: idx < step ? '#059669' : idx === step ? '#e8003d' : '#e5e7eb',
                color: idx <= step ? '#fff' : '#9ca3af',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: 12,
                fontWeight: 700,
                flexShrink: 0,
              }}>
                {idx < step ? '✓' : idx + 1}
              </div>
              <span style={{
                fontSize: 12,
                fontWeight: idx === step ? 600 : 400,
                color: idx === step ? '#111827' : '#9ca3af',
              }}>
                {label}
              </span>
            </div>
            {idx < STEPS.length - 1 && (
              <div style={{
                flex: 1,
                height: 1,
                background: idx < step ? '#059669' : '#e5e7eb',
                margin: '0 8px',
              }} />
            )}
          </div>
        ))}
      </div>

      {/* Step content */}
      <div style={{
        background: '#fff',
        border: '1px solid #e5e7eb',
        borderRadius: 16,
        padding: 28,
        marginBottom: 20,
        boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
      }}>
        {step === 0 && (
          <DateStep
            startDate={startDate}
            endDate={endDate}
            onChange={(s, e) => { setStartDate(s); setEndDate(e) }}
          />
        )}
        {step === 1 && (
          <CityStep
            cities={cities}
            totalDays={totalDays}
            onChange={setCities}
          />
        )}
        {step === 2 && (
          <PreferencesStep
            travelStyle={travelStyle}
            interests={interests}
            hasJRPass={hasJRPass}
            onChange={updates => {
              if (updates.travelStyle) setTravelStyle(updates.travelStyle)
              if (updates.interests) setInterests(updates.interests)
              if (updates.hasJRPass !== undefined) setHasJRPass(updates.hasJRPass)
            }}
          />
        )}
      </div>

      {/* Navigation */}
      <div style={{ display: 'flex', justifyContent: 'space-between' }}>
        <button
          onClick={() => setStep(s => s - 1)}
          disabled={step === 0}
          style={{
            padding: '10px 20px',
            borderRadius: 8,
            border: '1px solid #e5e7eb',
            background: '#fff',
            color: '#6b7280',
            fontSize: 14,
            fontWeight: 600,
            cursor: step === 0 ? 'not-allowed' : 'pointer',
            opacity: step === 0 ? 0.5 : 1,
          }}
        >
          ← Geri
        </button>

        {step < STEPS.length - 1 ? (
          <button
            onClick={() => setStep(s => s + 1)}
            disabled={!canProceed()}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: canProceed() ? '#e8003d' : '#e5e7eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: canProceed() ? 'pointer' : 'not-allowed',
              transition: 'background 0.15s ease',
            }}
          >
            İleri →
          </button>
        ) : (
          <button
            onClick={handleSubmit}
            disabled={!canProceed()}
            style={{
              padding: '10px 24px',
              borderRadius: 8,
              border: 'none',
              background: canProceed() ? '#e8003d' : '#e5e7eb',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: canProceed() ? 'pointer' : 'not-allowed',
            }}
          >
            🗾 Plan Oluştur
          </button>
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write app/page.tsx**

```tsx
// src/app/page.tsx
import TripForm from '@/components/planner/TripForm'

export default function Home() {
  return (
    <main style={{ minHeight: '100vh', background: '#fafafa', paddingBottom: 60 }}>
      <TripForm />
    </main>
  )
}
```

- [ ] **Step 3: Start dev server and verify wizard works**

```bash
npm run dev
```

Open `http://localhost:3000`. Test:
- Step 1: Select dates → season badge appears → İleri button enables
- Step 2: Select a city → day slider appears → İleri enables
- Step 3: Preferences render → Plan Oluştur button enables
- Submit → redirects to `/plan` (404 page is fine for now)

Stop server.

- [ ] **Step 4: Commit**

```bash
git add src/components/planner/TripForm.tsx src/app/page.tsx
git commit -m "feat: add TripForm wizard with 3-step flow and sessionStorage handoff"
```

---

## Phase 4 — Results Page

### Task 16: UI Utilities (Skeleton + ErrorBoundary)

**Files:**
- Create: `src/components/ui/LoadingSkeleton.tsx`
- Create: `src/components/ui/ErrorBoundary.tsx`

- [ ] **Step 1: Write LoadingSkeleton.tsx**

```tsx
// src/components/ui/LoadingSkeleton.tsx
export default function LoadingSkeleton() {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 24,
      overflow: 'hidden',
    }}>
      {[80, 60, 90, 50, 70].map((width, i) => (
        <div
          key={i}
          className="animate-skeleton"
          style={{
            height: i === 0 ? 22 : 14,
            width: `${width}%`,
            background: '#f3f4f6',
            borderRadius: 6,
            marginBottom: i === 0 ? 16 : 10,
            animationDelay: `${i * 0.1}s`,
          }}
        />
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Write ErrorBoundary.tsx**

```tsx
// src/components/ui/ErrorBoundary.tsx
'use client'

import { Component, ReactNode } from 'react'

interface Props { children: ReactNode }
interface State { hasError: boolean; message: string }

export default class ErrorBoundary extends Component<Props, State> {
  state: State = { hasError: false, message: '' }

  static getDerivedStateFromError(error: Error): State {
    return { hasError: true, message: error.message }
  }

  render() {
    if (this.state.hasError) {
      return (
        <div style={{
          padding: 40,
          textAlign: 'center',
          background: '#fff7f8',
          border: '1px solid #fecdd3',
          borderRadius: 16,
        }}>
          <div style={{ fontSize: 32, marginBottom: 12 }}>⚠️</div>
          <div style={{ fontSize: 16, fontWeight: 600, color: '#111827', marginBottom: 8 }}>
            Plan yüklenirken hata oluştu
          </div>
          <div style={{ fontSize: 13, color: '#6b7280', marginBottom: 20 }}>
            {this.state.message}
          </div>
          <button
            onClick={() => window.location.href = '/'}
            style={{
              padding: '10px 20px',
              borderRadius: 8,
              border: 'none',
              background: '#e8003d',
              color: '#fff',
              fontSize: 14,
              fontWeight: 600,
              cursor: 'pointer',
            }}
          >
            ← Forma Dön
          </button>
        </div>
      )
    }
    return this.props.children
  }
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/ui/
git commit -m "feat: add LoadingSkeleton and ErrorBoundary UI components"
```

---

### Task 17: TransferTimeline Component

**Files:**
- Create: `src/components/results/TransferTimeline.tsx`

- [ ] **Step 1: Write TransferTimeline.tsx**

```tsx
// src/components/results/TransferTimeline.tsx
import { getTransferOptions } from '@/data/transfers'
import type { CityAllocation, TransferOption } from '@/lib/types'
import { getCityById } from '@/data/cities'

interface Props {
  cities: CityAllocation[]
}

const TYPE_ICONS: Record<string, string> = {
  shinkansen: '🚅',
  local_train: '🚃',
  bus: '🚌',
}

export default function TransferTimeline({ cities }: Props) {
  const sorted = [...cities].sort((a, b) => a.order - b.order)

  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: '20px 24px',
      marginBottom: 24,
    }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 16 }}>
        Seyahat Güzergahı
      </h3>
      <div style={{ display: 'flex', alignItems: 'center', overflowX: 'auto', gap: 0 }}>
        {sorted.map((allocation, idx) => {
          const city = getCityById(allocation.cityId)
          const nextCity = sorted[idx + 1]
          const transferOptions = nextCity
            ? getTransferOptions(allocation.cityId, nextCity.cityId)
            : []
          const recommended = transferOptions[0] as TransferOption | undefined

          return (
            <div key={allocation.cityId} style={{ display: 'flex', alignItems: 'center', flexShrink: 0 }}>
              {/* City node */}
              <div style={{ textAlign: 'center' }}>
                <div style={{
                  width: 52,
                  height: 52,
                  borderRadius: '50%',
                  background: '#fff7f8',
                  border: '2px solid #e8003d',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: 22,
                  margin: '0 auto 6px',
                }}>
                  {allocation.cityId === 'tokyo' ? '🗼' : allocation.cityId === 'kyoto' ? '⛩️' : '🏯'}
                </div>
                <div style={{ fontSize: 13, fontWeight: 700, color: '#111827' }}>{city.name}</div>
                <div style={{
                  fontSize: 11,
                  fontFamily: 'var(--font-mono)',
                  color: '#e8003d',
                  fontWeight: 600,
                }}>
                  {allocation.days}g
                </div>
              </div>

              {/* Transfer connector */}
              {nextCity && (
                <div style={{ display: 'flex', flexDirection: 'column', alignItems: 'center', margin: '0 8px', minWidth: 120 }}>
                  <div style={{ fontSize: 11, color: '#6b7280', marginBottom: 3 }}>
                    {recommended ? `${TYPE_ICONS[recommended.type]} ${recommended.name}` : '→'}
                  </div>
                  <div style={{ width: '100%', height: 2, background: '#e8003d', borderRadius: 1 }} />
                  <div style={{
                    fontSize: 10,
                    fontFamily: 'var(--font-mono)',
                    color: '#9ca3af',
                    marginTop: 3,
                  }}>
                    {recommended?.duration ?? ''}
                  </div>
                </div>
              )}
            </div>
          )
        })}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/results/TransferTimeline.tsx
git commit -m "feat: add TransferTimeline component with city nodes and transfer connectors"
```

---

### Task 18: CategoryTabs + CityPlanCard

**Files:**
- Create: `src/components/results/CategoryTabs.tsx`
- Create: `src/components/results/CityPlanCard.tsx`

- [ ] **Step 1: Write CategoryTabs.tsx**

```tsx
// src/components/results/CategoryTabs.tsx
'use client'

import { useState } from 'react'
import type { CityPlanCategories, Recommendation } from '@/lib/types'

interface Props {
  categories: CityPlanCategories
}

const TAB_CONFIG = [
  { key: 'must_see' as const, label: 'Must See', emoji: '⭐' },
  { key: 'food_drink' as const, label: 'Yemek & İçki', emoji: '🍜' },
  { key: 'culture_temples' as const, label: 'Kültür', emoji: '⛩️' },
  { key: 'nature_day_trips' as const, label: 'Doğa', emoji: '🌿' },
  { key: 'shopping' as const, label: 'Alışveriş', emoji: '🛍️' },
  { key: 'hidden_gems' as const, label: 'Gizli Gems', emoji: '💎' },
]

function RecommendationCard({ rec }: { rec: Recommendation }) {
  return (
    <div style={{
      background: '#fafafa',
      border: '1px solid #f3f4f6',
      borderRadius: 10,
      padding: '12px 14px',
      marginBottom: 8,
    }}>
      <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'flex-start', marginBottom: 4 }}>
        <div style={{ fontSize: 14, fontWeight: 600, color: '#111827' }}>{rec.name}</div>
        {rec.booking_required && (
          <span style={{
            fontSize: 10,
            fontWeight: 600,
            color: '#d97706',
            background: '#fef3c7',
            borderRadius: 4,
            padding: '2px 6px',
            flexShrink: 0,
            marginLeft: 8,
          }}>
            Rezervasyon
          </span>
        )}
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', marginBottom: 6, lineHeight: 1.5 }}>
        {rec.description}
      </p>
      <div style={{ display: 'flex', gap: 12 }}>
        <span style={{ fontSize: 11, color: '#6b7280' }}>⏱ {rec.duration}</span>
        <span style={{
          fontSize: 11,
          fontFamily: 'var(--font-mono)',
          fontWeight: 600,
          color: '#059669',
        }}>
          {rec.cost}
        </span>
      </div>
    </div>
  )
}

export default function CategoryTabs({ categories }: Props) {
  const [activeTab, setActiveTab] = useState<keyof CityPlanCategories>('must_see')
  const items = categories[activeTab] ?? []

  return (
    <div>
      {/* Tab bar - horizontal scroll */}
      <div style={{ display: 'flex', gap: 4, overflowX: 'auto', paddingBottom: 12, marginBottom: 12 }}>
        {TAB_CONFIG.map(tab => (
          <button
            key={tab.key}
            onClick={() => setActiveTab(tab.key)}
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: 4,
              padding: '6px 14px',
              borderRadius: 20,
              border: `1.5px solid ${activeTab === tab.key ? '#e8003d' : '#e5e7eb'}`,
              background: activeTab === tab.key ? '#fff7f8' : '#fff',
              color: activeTab === tab.key ? '#e8003d' : '#6b7280',
              fontSize: 12,
              fontWeight: activeTab === tab.key ? 600 : 400,
              cursor: 'pointer',
              flexShrink: 0,
              transition: 'all 0.15s ease',
            }}
          >
            <span>{tab.emoji}</span>
            <span>{tab.label}</span>
            <span style={{
              background: activeTab === tab.key ? '#e8003d' : '#f3f4f6',
              color: activeTab === tab.key ? '#fff' : '#9ca3af',
              borderRadius: 10,
              fontSize: 10,
              fontWeight: 700,
              padding: '1px 6px',
              fontFamily: 'var(--font-mono)',
            }}>
              {categories[tab.key].length}
            </span>
          </button>
        ))}
      </div>

      {/* Recommendations */}
      <div style={{ animation: 'fadeIn 0.2s ease' }}>
        {items.length === 0 ? (
          <div style={{ textAlign: 'center', padding: 24, color: '#9ca3af', fontSize: 13 }}>
            Bu kategoride öneri yok
          </div>
        ) : (
          items.map((rec, i) => (
            <div key={i} style={{ animation: `slideUp 0.2s ease ${i * 0.03}s both` }}>
              <RecommendationCard rec={rec} />
            </div>
          ))
        )}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Write CityPlanCard.tsx**

```tsx
// src/components/results/CityPlanCard.tsx
import CategoryTabs from './CategoryTabs'
import LoadingSkeleton from '@/components/ui/LoadingSkeleton'
import type { CityPlan, CityPlanStatus } from '@/lib/types'

interface Props {
  cityName: string
  status: CityPlanStatus
  data: CityPlan | null
  error?: string
}

export default function CityPlanCard({ cityName, status, data, error }: Props) {
  return (
    <div style={{
      background: '#fff',
      border: '1px solid #e5e7eb',
      borderRadius: 16,
      padding: 24,
      animation: 'fadeIn 0.3s ease',
    }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 16 }}>
        <div style={{ fontSize: 22 }}>
          {cityName === 'Tokyo' ? '🗼' : cityName === 'Kyoto' ? '⛩️' : '🏯'}
        </div>
        <div>
          <h2 style={{ fontSize: 18, fontWeight: 700, color: '#111827', margin: 0 }}>{cityName}</h2>
          {status === 'loading' && (
            <span style={{ fontSize: 12, color: '#6b7280' }}>Plan oluşturuluyor...</span>
          )}
          {status === 'done' && data && (
            <span style={{ fontSize: 12, color: '#059669' }}>✓ Hazır</span>
          )}
          {status === 'error' && (
            <span style={{ fontSize: 12, color: '#dc2626' }}>⚠️ Hata</span>
          )}
        </div>
      </div>

      {status === 'idle' && (
        <div style={{ padding: '20px 0', textAlign: 'center', color: '#9ca3af', fontSize: 13 }}>
          Bekleniyor...
        </div>
      )}

      {status === 'loading' && <LoadingSkeleton />}

      {status === 'error' && (
        <div style={{
          background: '#fff7f8',
          border: '1px solid #fecdd3',
          borderRadius: 10,
          padding: '14px 16px',
          fontSize: 13,
          color: '#dc2626',
        }}>
          {error ?? 'Plan yüklenemedi'}
        </div>
      )}

      {status === 'done' && data && (
        <div>
          <p style={{ fontSize: 14, color: '#374151', lineHeight: 1.6, marginBottom: 20 }}>
            {data.overview}
          </p>
          <CategoryTabs categories={data.categories} />
          {data.practical_tips.length > 0 && (
            <div style={{ marginTop: 16, padding: '12px 16px', background: '#f0fdf4', border: '1px solid #bbf7d0', borderRadius: 10 }}>
              <div style={{ fontSize: 12, fontWeight: 600, color: '#059669', marginBottom: 6 }}>💡 Pratik İpuçları</div>
              {data.practical_tips.map((tip, i) => (
                <div key={i} style={{ fontSize: 12, color: '#374151', marginBottom: 3 }}>• {tip}</div>
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  )
}
```

- [ ] **Step 3: Commit**

```bash
git add src/components/results/CategoryTabs.tsx src/components/results/CityPlanCard.tsx
git commit -m "feat: add CategoryTabs and CityPlanCard result components"
```

---

### Task 19: DailyItinerary Component

**Files:**
- Create: `src/components/results/DailyItinerary.tsx`

- [ ] **Step 1: Write DailyItinerary.tsx**

```tsx
// src/components/results/DailyItinerary.tsx
'use client'

import { useState } from 'react'
import type { DaySuggestion } from '@/lib/types'

interface Props {
  suggestions: DaySuggestion[]
  cityName: string
}

export default function DailyItinerary({ suggestions, cityName }: Props) {
  const [openDays, setOpenDays] = useState<Set<number>>(new Set([1]))

  function toggle(day: number) {
    setOpenDays(prev => {
      const next = new Set(prev)
      next.has(day) ? next.delete(day) : next.add(day)
      return next
    })
  }

  if (suggestions.length === 0) return null

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
        📅 {cityName} Günlük Plan
      </h3>
      {suggestions.map(s => (
        <div key={s.day} style={{ marginBottom: 6 }}>
          <button
            onClick={() => toggle(s.day)}
            style={{
              width: '100%',
              display: 'flex',
              justifyContent: 'space-between',
              alignItems: 'center',
              padding: '10px 14px',
              background: openDays.has(s.day) ? '#fff7f8' : '#fafafa',
              border: `1px solid ${openDays.has(s.day) ? '#fecdd3' : '#e5e7eb'}`,
              borderRadius: openDays.has(s.day) ? '10px 10px 0 0' : 10,
              cursor: 'pointer',
              textAlign: 'left',
            }}
          >
            <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>
              {s.day}. Gün
            </span>
            <span style={{ fontSize: 12, color: '#9ca3af' }}>
              {openDays.has(s.day) ? '▲' : '▼'}
            </span>
          </button>

          {openDays.has(s.day) && (
            <div style={{
              padding: '12px 14px',
              background: '#fff',
              border: '1px solid #fecdd3',
              borderTop: 'none',
              borderRadius: '0 0 10px 10px',
              animation: 'fadeIn 0.15s ease',
            }}>
              {[
                { label: '☀️ Sabah', value: s.morning },
                { label: '🌤️ Öğle', value: s.afternoon },
                { label: '🌙 Akşam', value: s.evening },
              ].map(block => (
                <div key={block.label} style={{ marginBottom: 10 }}>
                  <div style={{ fontSize: 11, fontWeight: 700, color: '#9ca3af', marginBottom: 2 }}>
                    {block.label}
                  </div>
                  <div style={{ fontSize: 13, color: '#374151', lineHeight: 1.5 }}>
                    {block.value}
                  </div>
                </div>
              ))}
              {s.notes && (
                <div style={{ fontSize: 11, color: '#6b7280', fontStyle: 'italic', marginTop: 4 }}>
                  💡 {s.notes}
                </div>
              )}
            </div>
          )}
        </div>
      ))}
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/results/DailyItinerary.tsx
git commit -m "feat: add DailyItinerary accordion component"
```

---

### Task 20: ResourceLinks Component

**Files:**
- Create: `src/components/results/ResourceLinks.tsx`

- [ ] **Step 1: Write ResourceLinks.tsx**

```tsx
// src/components/results/ResourceLinks.tsx
'use client'

import { getCityResources } from '@/data/resources'
import type { ResourceLink } from '@/lib/types'

interface Props {
  cityId: string
}

const TYPE_ICONS: Record<string, string> = {
  blog: '📝',
  youtube: '▶️',
  official: '🏛️',
  booking: '🎫',
  map: '🗺️',
}

const LANG_LABELS: Record<string, string> = {
  tr: 'TR',
  en: 'EN',
  ja: 'JA',
}

function LinkCard({ link }: { link: ResourceLink }) {
  return (
    <a
      href={link.url}
      target="_blank"
      rel="noopener noreferrer"
      style={{
        display: 'block',
        background: '#fafafa',
        border: '1px solid #e5e7eb',
        borderRadius: 10,
        padding: '10px 14px',
        textDecoration: 'none',
        transition: 'all 0.15s ease',
      }}
      onMouseEnter={e => {
        (e.currentTarget as HTMLElement).style.background = '#fff'
        ;(e.currentTarget as HTMLElement).style.boxShadow = '0 2px 8px rgba(0,0,0,0.06)'
      }}
      onMouseLeave={e => {
        (e.currentTarget as HTMLElement).style.background = '#fafafa'
        ;(e.currentTarget as HTMLElement).style.boxShadow = 'none'
      }}
    >
      <div style={{ display: 'flex', alignItems: 'center', gap: 8, marginBottom: 4 }}>
        <span style={{ fontSize: 14 }}>{TYPE_ICONS[link.type] ?? '🔗'}</span>
        <span style={{ fontSize: 13, fontWeight: 600, color: '#111827' }}>{link.title}</span>
        <span style={{
          fontSize: 10,
          fontWeight: 600,
          fontFamily: 'var(--font-mono)',
          color: '#6b7280',
          background: '#f3f4f6',
          borderRadius: 4,
          padding: '1px 5px',
          marginLeft: 'auto',
        }}>
          {LANG_LABELS[link.language] ?? link.language}
        </span>
      </div>
      <p style={{ fontSize: 12, color: '#6b7280', margin: 0, lineHeight: 1.4 }}>
        {link.description}
      </p>
    </a>
  )
}

export default function ResourceLinks({ cityId }: Props) {
  const resources = getCityResources(cityId)

  if (resources.links.length === 0) return null

  return (
    <div style={{ marginTop: 16 }}>
      <h3 style={{ fontSize: 14, fontWeight: 600, color: '#374151', marginBottom: 10 }}>
        🔗 Kaynaklar & Linkler
      </h3>
      <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
        {resources.links.map((link, i) => (
          <LinkCard key={i} link={link} />
        ))}
      </div>
    </div>
  )
}
```

- [ ] **Step 2: Commit**

```bash
git add src/components/results/ResourceLinks.tsx
git commit -m "feat: add ResourceLinks component for city resource cards"
```

---

### Task 21: Plan Page (Results)

**Files:**
- Create: `src/components/results/PlanLayout.tsx`
- Create: `src/app/plan/page.tsx`

- [ ] **Step 1: Write PlanLayout.tsx**

```tsx
// src/components/results/PlanLayout.tsx
'use client'

import { useEffect, useState } from 'react'
import { format } from 'date-fns'
import { tr } from 'date-fns/locale'
import TransferTimeline from './TransferTimeline'
import CityPlanCard from './CityPlanCard'
import DailyItinerary from './DailyItinerary'
import ResourceLinks from './ResourceLinks'
import ErrorBoundary from '@/components/ui/ErrorBoundary'
import { CityPlanSchema } from '@/lib/schemas'
import { getCityById } from '@/data/cities'
import type { TripFormData, CityPlanState } from '@/lib/types'

async function streamJSON<T>(url: string, body: unknown): Promise<T> {
  const response = await fetch(url, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  })
  if (!response.ok) throw new Error(`HTTP ${response.status}`)
  if (!response.body) throw new Error('No response body')

  const reader = response.body.getReader()
  const decoder = new TextDecoder()
  let accumulated = ''

  while (true) {
    const { done, value } = await reader.read()
    if (done) break
    accumulated += decoder.decode(value, { stream: true })
  }

  // Strip markdown fences if Claude included them despite instructions
  const cleaned = accumulated.trim().replace(/^```json\s*/i, '').replace(/\s*```$/i, '')
  return JSON.parse(cleaned) as T
}

export default function PlanLayout() {
  const [formData, setFormData] = useState<TripFormData | null>(null)
  const [cityPlans, setCityPlans] = useState<Record<string, CityPlanState>>({})
  const [activeCity, setActiveCity] = useState<string>('')

  useEffect(() => {
    const raw = sessionStorage.getItem('tripFormData')
    if (!raw) {
      window.location.href = '/'
      return
    }

    const parsed = JSON.parse(raw)
    const data: TripFormData = {
      ...parsed,
      startDate: new Date(parsed.startDate),
      endDate: new Date(parsed.endDate),
    }

    setFormData(data)
    setActiveCity(data.cities.sort((a, b) => a.order - b.order)[0]?.cityId ?? '')

    // Initialize loading states
    const initial: Record<string, CityPlanState> = {}
    data.cities.forEach(c => { initial[c.cityId] = { status: 'loading', data: null } })
    setCityPlans(initial)

    // Fetch all city plans in parallel
    data.cities.forEach(async allocation => {
      const cityMeta = getCityById(allocation.cityId)
      try {
        const raw = await streamJSON('/api/generate-plan', {
          cityAllocation: allocation,
          cityName: cityMeta.name,
          travelStyle: data.travelStyle,
          interests: data.interests,
          startDate: data.startDate.toISOString(),
          endDate: data.endDate.toISOString(),
        })

        const result = CityPlanSchema.safeParse(raw)
        if (result.success) {
          setCityPlans(prev => ({
            ...prev,
            [allocation.cityId]: { status: 'done', data: result.data },
          }))
        } else {
          // Retry once with a fresh request
          const raw2 = await streamJSON('/api/generate-plan', {
            cityAllocation: allocation,
            cityName: cityMeta.name,
            travelStyle: data.travelStyle,
            interests: data.interests,
            startDate: data.startDate.toISOString(),
            endDate: data.endDate.toISOString(),
          })
          const result2 = CityPlanSchema.safeParse(raw2)
          setCityPlans(prev => ({
            ...prev,
            [allocation.cityId]: result2.success
              ? { status: 'done', data: result2.data }
              : { status: 'error', data: null, error: 'JSON doğrulama hatası' },
          }))
        }
      } catch (e) {
        setCityPlans(prev => ({
          ...prev,
          [allocation.cityId]: {
            status: 'error',
            data: null,
            error: e instanceof Error ? e.message : 'Bilinmeyen hata',
          },
        }))
      }
    })
  }, [])

  if (!formData) return null

  const sortedCities = [...formData.cities].sort((a, b) => a.order - b.order)
  const activePlan = cityPlans[activeCity]

  return (
    <ErrorBoundary>
      <div style={{ maxWidth: 800, margin: '0 auto', padding: '32px 24px' }}>
        {/* Header */}
        <div style={{ display: 'flex', justifyContent: 'space-between', alignItems: 'center', marginBottom: 24 }}>
          <div>
            <a href="/" style={{ fontSize: 13, color: '#6b7280', textDecoration: 'none' }}>← Forma Dön</a>
            <h1 style={{ fontSize: 22, fontWeight: 800, color: '#111827', margin: '4px 0 0' }}>
              Japonya Gezi Planınız
            </h1>
          </div>
          <div style={{ textAlign: 'right', fontSize: 12, color: '#6b7280', fontFamily: 'var(--font-mono)' }}>
            <div>
              {format(formData.startDate, 'd MMM', { locale: tr })} —{' '}
              {format(formData.endDate, 'd MMM yyyy', { locale: tr })}
            </div>
            <div style={{ fontWeight: 600, color: '#e8003d' }}>
              {sortedCities.map(c => getCityById(c.cityId).name).join(' → ')}
            </div>
          </div>
        </div>

        {/* Transfer timeline */}
        <TransferTimeline cities={sortedCities} />

        {/* City tabs */}
        <div style={{ display: 'flex', gap: 8, marginBottom: 16 }}>
          {sortedCities.map(allocation => {
            const city = getCityById(allocation.cityId)
            const plan = cityPlans[allocation.cityId]
            return (
              <button
                key={allocation.cityId}
                onClick={() => setActiveCity(allocation.cityId)}
                style={{
                  padding: '8px 16px',
                  borderRadius: 8,
                  border: `1.5px solid ${activeCity === allocation.cityId ? '#e8003d' : '#e5e7eb'}`,
                  background: activeCity === allocation.cityId ? '#fff7f8' : '#fff',
                  color: activeCity === allocation.cityId ? '#e8003d' : '#374151',
                  fontSize: 13,
                  fontWeight: activeCity === allocation.cityId ? 600 : 400,
                  cursor: 'pointer',
                  display: 'flex',
                  alignItems: 'center',
                  gap: 6,
                }}
              >
                {city.name}
                {plan?.status === 'loading' && <span style={{ fontSize: 10 }}>⟳</span>}
                {plan?.status === 'done' && <span style={{ fontSize: 10, color: '#059669' }}>✓</span>}
                {plan?.status === 'error' && <span style={{ fontSize: 10, color: '#dc2626' }}>!</span>}
              </button>
            )
          })}
        </div>

        {/* Active city plan */}
        {activeCity && activePlan && (
          <div key={activeCity} style={{ animation: 'fadeIn 0.2s ease' }}>
            <CityPlanCard
              cityName={getCityById(activeCity as 'tokyo' | 'kyoto' | 'osaka').name}
              status={activePlan.status}
              data={activePlan.data}
              error={activePlan.error}
            />
            {activePlan.status === 'done' && activePlan.data && (
              <>
                <div style={{ marginTop: 16 }}>
                  <DailyItinerary
                    suggestions={activePlan.data.daily_suggestions}
                    cityName={getCityById(activeCity as 'tokyo' | 'kyoto' | 'osaka').name}
                  />
                </div>
                <ResourceLinks cityId={activeCity} />
              </>
            )}
          </div>
        )}
      </div>
    </ErrorBoundary>
  )
}
```

- [ ] **Step 2: Write app/plan/page.tsx**

```tsx
// src/app/plan/page.tsx
import PlanLayout from '@/components/results/PlanLayout'

export default function PlanPage() {
  return (
    <main style={{ minHeight: '100vh', background: '#fafafa', paddingBottom: 60 }}>
      <PlanLayout />
    </main>
  )
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Start dev server and do end-to-end test**

```bash
npm run dev
```

Test flow:
1. Open `http://localhost:3000`
2. Select dates (e.g. 15 April — 24 April 2027)
3. Select Tokyo (3g), Kyoto (3g), Osaka (3g)
4. Select preferences → click "Plan Oluştur"
5. `/plan` page loads → TransferTimeline shows → city cards show loading skeletons
6. After 10-30s, city plans populate with Claude-generated content
7. Switch city tabs → each city plan shown
8. Expand daily itinerary accordion

Expected: full plan visible for all 3 cities. Stop server.

- [ ] **Step 5: Commit**

```bash
git add src/components/results/PlanLayout.tsx src/app/plan/
git commit -m "feat: add PlanLayout and plan page with parallel streaming and city tab navigation"
```

---

## Phase 5 — Polish

### Task 22: Responsive Design + Final Checks

**Files:**
- Modify: `src/app/globals.css`
- Modify: `src/components/planner/TripForm.tsx` (mobile padding)

- [ ] **Step 1: Add responsive breakpoints to globals.css**

Append to `src/app/globals.css`:

```css
/* Mobile adjustments (max-width: 640px) */
@media (max-width: 640px) {
  .grid-cols-3-mobile {
    grid-template-columns: 1fr !important;
  }
  .hide-mobile {
    display: none !important;
  }
}
```

- [ ] **Step 2: Run TypeScript check and build**

```bash
npx tsc --noEmit
npm run build
```

Expected: build succeeds with no type errors. Note any warnings.

- [ ] **Step 3: Final smoke test**

```bash
npm run dev
```

Verify:
- Form wizard completes end-to-end
- All 3 cities generate plans
- Category tabs switch correctly
- Daily accordion opens/closes
- Back link returns to form

- [ ] **Step 4: Final commit**

```bash
git add -A
git commit -m "feat: japan-trip-planner MVP complete — 3-city wizard with Claude streaming"
```

---

## Environment Setup Reminder

Before running any API calls, ensure `.env.local` has your real key:

```bash
# /Users/dincercinar/Desktop/Uygulama/japan-trip-planner/.env.local
ANTHROPIC_API_KEY=sk-ant-YOUR_REAL_KEY_HERE
NEXT_PUBLIC_APP_URL=http://localhost:3000
```
