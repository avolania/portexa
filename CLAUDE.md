@AGENTS.md

# CLAUDE.md — Pixanto ITSM Design System

> Bu dosya Claude Code'un Pixanto ITSM modülünü geliştirirken tutarlı UI üretmesi için referans belgesidir.
> Tüm yeni sayfa, component ve düzenleme bu kurallara uygun olmalıdır.

---

## Tech Stack

- **Framework**: Next.js 16 App Router
- **Language**: TypeScript
- **Styling**: Tailwind CSS v4 (inline style prototype'larda CSS-in-JS kullanıldı)
- **Database**: Supabase (PostgreSQL + JSONB)
- **Architecture**: 3-layer (Route Handler → Service → Repository)
- **State**: React hooks (useState, useEffect, useRef)

---

## Typography

### Font Ailesi

| Kullanım | Font | Fallback |
|----------|------|----------|
| Heading & Body (Enterprise ekranlar) | `IBM Plex Sans` | `sans-serif` |
| Heading & Body (Portal ekranlar) | `DM Sans` | `sans-serif` |
| Monospace (ID, SLA, badge, tablo) | `IBM Plex Mono` veya `JetBrains Mono` | `monospace` |

Google Fonts import:
```
IBM Plex Sans: wght@300;400;500;600;700
IBM Plex Mono: wght@400;500;600
DM Sans: wght@400;500;600;700
JetBrains Mono: wght@400;500;600;700;800
```

### Font Size Skalası

| Token | Size | Kullanım |
|-------|------|----------|
| `text-xxs` | 8-9px | Micro badge, matrix hücre, icon label |
| `text-xs` | 10-11px | Tablo header, field label, meta bilgi, SLA countdown |
| `text-sm` | 12-13px | Tablo body, form input, sidebar content, card body |
| `text-base` | 14-15px | Sayfa alt başlık, form açıklama |
| `text-lg` | 16-18px | Sayfa başlık, detail panel başlık |
| `text-xl` | 20-22px | Portal hero başlık, section başlık |
| `text-2xl` | 28px | Portal ana başlık |
| `text-stat` | 32px | Dashboard stat card büyük rakam |

### Font Weight Kuralları

- `300` — Sadece büyük hero text
- `400` — Normal body, meta text
- `500` — Tablo body, input text, card body
- `600` — Label, badge, sidebar item, button
- `700` — Heading, stat value, ticket ID, section title
- `800` — Stat card büyük rakam, Workbench counter, logo

---

## Color System

### Ticket Tip Renkleri

| Tip | Primary | Light BG | Dark BG | Kullanım |
|-----|---------|----------|---------|----------|
| INC (Incident) | `#DC2626` | `#FEE2E2` | `#7F1D1D` | Badge, sol border, icon |
| SR (Service Request) | `#2563EB` | `#DBEAFE` | `#1E3A5F` | Badge, sol border, icon |
| CR (Change Request) | `#7C3AED` | `#F3E8FF` | `#4C1D95` | Badge, sol border, icon |

### Priority Renkleri

| Priority | BG Color | Text Color | Kullanım |
|----------|----------|------------|----------|
| P1 / Critical | `#DC2626` | `#fff` | Badge bg, SLA bar |
| P2 / High | `#D97706` | `#fff` | Badge bg |
| P3 / Medium / Normal | `#2563EB` | `#fff` | Badge bg |
| P4 / Low | `#6B7280` | `#fff` | Badge bg |

### State (Durum) Renkleri

| State | Color | Light BG | Icon | Kullanım |
|-------|-------|----------|------|----------|
| New | `#3B82F6` | `#DBEAFE` | `○` | Badge, state bar, filter |
| Open | `#2563EB` | `#DBEAFE` | `○` | Badge, state bar |
| In Progress | `#D97706` | `#FEF3C7` | `◎` | Badge, state bar |
| Pending | `#7C3AED` | `#F3E8FF` | `⏷` | Badge, state bar |
| Awaiting Approval | `#D97706` | `#FEF3C7` | `⏳` | SR approval durumu |
| Resolved | `#059669` | `#D1FAE5` | `✓` | Badge, state bar |
| Closed | `#374151` | `#E5E7EB` | `✕` | Badge |
| CAB Review | `#7C3AED` | `#F3E8FF` | `👥` | CR CAB durumu |
| Scheduled | `#0891B2` | `#CFFAFE` | `📅` | CR zamanlanmış |
| Implemented | `#059669` | `#D1FAE5` | `✓` | CR tamamlanmış |

### SLA Countdown Renkleri

| Durum | Color | Davranış |
|-------|-------|----------|
| İhlal edilmiş (≤0) | `#EF4444` | `animation: pulse 1.2s ease infinite` |
| Kritik (<30dk veya <2s) | `#F59E0B` | Normal |
| Normal (>2s) | `#10B981` / `#22C55E` | Normal |
| Tamamlandı | `#10B981` | Static "✓ Süresi içinde" |

### Risk Renkleri (CR)

| Risk | Color | BG |
|------|-------|----|
| Low | `#059669` | `#D1FAE5` |
| Medium | `#D97706` | `#FEF3C7` |
| High | `#DC2626` | `#FEE2E2` |

### UI Yüzey Renkleri

**Light Theme (Dashboard, Incident Create, Portal):**

| Token | Color | Kullanım |
|-------|-------|----------|
| `bg-page` | `#F3F4F6` / `#F7F8FA` | Sayfa arka plan |
| `bg-surface` | `#FFFFFF` | Kart, panel, tablo |
| `bg-surface-secondary` | `#F9FAFB` / `#FAFBFC` | Tablo header, hover |
| `border-default` | `#E5E7EB` / `#E2E5EA` | Kart border, tablo çizgi |
| `border-subtle` | `#F3F4F6` / `#F1F5F9` | İç bölüm çizgisi |
| `text-primary` | `#111827` / `#1E293B` | Ana metin |
| `text-secondary` | `#6B7280` / `#64748B` | İkincil metin |
| `text-muted` | `#9CA3AF` / `#94A3B8` | Meta, placeholder |

**Dark Theme (Agent Workbench):**

| Token | Color | Kullanım |
|-------|-------|----------|
| `bg-page` | `#0F172A` | Sayfa arka plan |
| `bg-surface` | `#1E293B` | Header, panel, kart |
| `bg-surface-secondary` | `#334155` | Input bg, hover |
| `border-default` | `#334155` | Kart border |
| `border-subtle` | `#1E293B` | İç bölüm çizgisi |
| `text-primary` | `#F8FAFC` / `#E2E8F0` | Ana metin |
| `text-secondary` | `#94A3B8` | İkincil metin |
| `text-muted` | `#64748B` / `#475569` | Meta, placeholder |

### Accent (Pixanto Brand)

| Token | Color | Kullanım |
|-------|-------|----------|
| `accent-primary` | `#3B82F6` | CTA buton, link, selected state |
| `accent-primary-hover` | `#2563EB` | Buton hover |
| `accent-gradient` | `linear-gradient(135deg, #3B82F6, #8B5CF6)` | Logo, avatar, brand element |

---

## Component Patterns

### Badge

```jsx
// Küçük (tablo içi)
<span style={{
  fontSize: 10, fontWeight: 600, fontFamily: "monospace",
  padding: "2px 8px", borderRadius: 4,
  background: bg, color: text,
}}>P1</span>

// Micro (Workbench)
<span style={{
  fontSize: 8-9, fontWeight: 800, fontFamily: "monospace",
  padding: "1px 5px", borderRadius: 3,
  background: bg, color: text,
}}>INC</span>
```

Kurallar:
- Ticket tip ve priority badge'leri DAIMA monospace font
- border-radius: 3-4px
- Padding: micro (1px 5px), small (2px 8px), normal (2px 10px)
- Renk sistemi tablolara göre

### SLA Bar

```jsx
<div style={{ height: 3-6, background: "#E5E7EB", borderRadius: 2, overflow: "hidden" }}>
  <div style={{
    width: `${percent}%`, height: "100%",
    background: color, // SLA countdown rengine göre
    borderRadius: 2, transition: "width 0.5s ease",
  }} />
</div>
```

- Dashboard/detail: height 4-6px
- Tablo inline: height 2-3px
- Workbench card: height 2px

### State Machine Bar

ITIL state flow'u görsel olarak gösteren progress bar:

```
○ New → ○ Open → ◎ In Progress → ⏷ Pending → ✓ Resolved → ✕ Closed
```

Her adım:
- Geçmiş: yeşil circle + check icon + yeşil çizgi
- Aktif: state color + highlighted bg
- Gelecek: gri circle + gri çizgi

### Ticket Card (Liste satır formatı)

Satır içeriği soldan sağa:
1. Checkbox (bulk seçim)
2. Tip badge (INC/SR/CR)
3. Priority badge (P1/P2/P3)
4. Ticket bilgi bloğu: ID (monospace) + başlık + caller/dept
5. State badge
6. SLA countdown + mini bar
7. Assigned to (avatar + isim)
8. Kategori
9. Quick action butonları

### Stat Card (Dashboard)

```jsx
<div style={{
  background: "#fff", borderRadius: 8, padding: "20px 24px",
  border: "1px solid #E5E7EB", position: "relative", overflow: "hidden",
}}>
  <div style={{ position: "absolute", top: 0, left: 0, width: 3, height: "100%", background: accentColor }} />
  // Label (xs, uppercase, muted) → Value (32px, bold) → Change indicator
</div>
```

### Form Input

```jsx
// Text input
<input style={{
  width: "100%", padding: "9px 14px",
  border: "1.5px solid #E2E8F0", borderRadius: 8-10,
  fontSize: 13, fontFamily: "body font",
  outline: "none", transition: "border-color 0.2s, box-shadow 0.2s",
}} />

// Focus state:
// borderColor: "#3B82F6"
// boxShadow: "0 0 0 3px rgba(59,130,246,0.1)"
```

### Button Styles

| Tip | Background | Color | Border |
|-----|------------|-------|--------|
| Primary | `#3B82F6` | `#fff` | none |
| Primary hover | `#2563EB` | `#fff` | none |
| Danger | `#DC2626` / `#E53E3E` | `#fff` | none |
| Secondary | `#fff` | `#6B7280` | `1px solid #E5E7EB` |
| Ghost | transparent | `#6B7280` | `1px solid #E5E7EB` |
| Dark Primary | `#3B82F6` | `#fff` | none |
| Dark Secondary | transparent | `#94A3B8` | `1px solid #334155` |

Tüm butonlar: `borderRadius: 6-8px`, `padding: 8px 16-22px`, `fontSize: 12-13`, `fontWeight: 600`, `cursor: pointer`

### Avatar

```jsx
<div style={{
  width: 20-32, height: 20-32, borderRadius: "50%",
  background: color, // priority ring veya gradient
  display: "flex", alignItems: "center", justifyContent: "center",
  fontSize: 7-10, fontWeight: 700, color: textColor,
}}>
  {initials} // "AY", "EK" gibi 2 harf
</div>
```

- "Ben" (current user): background `#3B82F6`, border `2px solid #93C5FD`
- Diğer agent: background `#E2E8F0` veya `#334155`, color `#475569`

---

## Layout Patterns

### Split Pane (Incident/SR/CR Management)

```
┌─────────────────────────────────────────────────────┐
│ Top Bar (48px, dark bg, breadcrumb + search + user) │
├─────────────────────────────────────────────────────┤
│ Filter Bar (44px, white bg, state tabs + priority)  │
├──────────────────┬──────────────────────────────────┤
│ Left Queue       │ Right Detail Panel               │
│ (380-400px)      │ (flex: 1)                        │
│ ticket list      │ ┌──────────────────────────────┐ │
│ scrollable       │ │ Header (ticket info + state) │ │
│                  │ ├──────────────────────────────┤ │
│                  │ │ Tabs (Details|Notes|Timeline)│ │
│                  │ ├──────────────────────────────┤ │
│                  │ │ Tab Content (scrollable)     │ │
│                  │ └──────────────────────────────┘ │
└──────────────────┴──────────────────────────────────┘
```

### Unified Queue (Agent Workbench)

```
┌─────────────────────────────────────────────────────┐
│ Top Bar (48px, dark)                                │
├─────────────────────────────────────────────────────┤
│ Stats + Filter Bar (flex, stats left, filters right)│
├─────────────────────────────────────────────────────┤
│ Table (sticky header, full width, scrollable body)  │
└─────────────────────────────────────────────────────┘
                                    + Detail slide-over →
```

### Form Wizard (Incident Create, Portal Forms)

```
┌─────────────────────────────────────────────────────┐
│ Header (sticky, back + title + actions)             │
├───────────────────────────────────┬─────────────────┤
│ Main Form Area                    │ Right Sidebar   │
│ ┌─────────────────────────────┐   │ (280-340px)     │
│ │ Step Indicator (1-2-3-4)   │   │                 │
│ ├─────────────────────────────┤   │ Priority        │
│ │ Form Card (white, rounded)  │   │ Calculator      │
│ │ - Fields, selectors, upload │   │                 │
│ │ - Back/Next buttons         │   │ Live Summary    │
│ └─────────────────────────────┘   │                 │
│                                   │ Tips            │
└───────────────────────────────────┴─────────────────┘
```

### Portal Home

```
┌─────────────────────────────────────────────────────┐
│ Portal Header (dark, logo + user)                   │
├─────────────────────────────────────────────────────┤
│                                                     │
│           Hero ("Nasıl yardımcı olabiliriz?")       │
│                                                     │
│     ┌─────────────────┐  ┌─────────────────┐       │
│     │  Olay Bildir    │  │  Hizmet Talep   │       │
│     │  (kırmızı)      │  │  (mavi)         │       │
│     └─────────────────┘  └─────────────────┘       │
│                                                     │
│     Popüler Hizmetler (3-col grid)                  │
│     Açık Taleplerim (summary bar)                   │
└─────────────────────────────────────────────────────┘
```

---

## Sidebar Pattern (Management Screens)

Sol sidebar (260px, `#111827` dark bg):

```
Logo Area (Px gradient + "Pixanto" + "ITSM Service Desk")
─────────
Ana Menü (section label)
  Dashboard      [count badge]
  Incidents      [5]
  Service Req    [3]
  Change Req     [3]
  Knowledge Base
  Reports
─────────
Yönetim (section label)
  Ayarlar
─────────
User Area (avatar + name + role)
```

Nav item style:
- Active: `background: rgba(59,130,246,0.15)`, `color: #60A5FA`
- Inactive: `color: #9CA3AF`, hover: `background: rgba(255,255,255,0.05)`
- Count badge: `minWidth: 20`, `borderRadius: 10`, `fontSize: 10`, `fontWeight: 700`

---

## Top Bar Pattern (Management Screens)

Height: 48px, background: `#1E293B`

```
[Logo Px] Pixanto › ITSM › [Page Name]  ...  [Search ⌘K]  [+Yeni RFC]  [Avatar]
```

- Logo: 26-28px, gradient `#3B82F6 → #8B5CF6`, border-radius 6
- Breadcrumb: `›` separator, muted colors, active page bold
- Search: bg `#334155`, border-radius 6, kbd badge for shortcut

---

## Animation Patterns

```css
@keyframes fadeIn { from { opacity: 0 } to { opacity: 1 } }
@keyframes slideUp { from { opacity: 0; transform: translateY(8px) } to { opacity: 1; transform: translateY(0) } }
@keyframes slideRight { from { opacity: 0; transform: translateX(12px) } to { opacity: 1; transform: translateX(0) } }
@keyframes scaleIn { from { opacity: 0; transform: scale(0.95) } to { opacity: 1; transform: scale(1) } }
@keyframes pulse { 0%,100% { opacity: 1 } 50% { opacity: 0.4 } }
@keyframes rowIn { from { opacity: 0; transform: translateY(4px) } to { opacity: 1; transform: translateY(0) } }
```

Kullanım kuralları:
- Liste item staggered: `animation: slideUp 0.2s ease ${index * 0.03}s both`
- Panel/card entrance: `animation: fadeIn 0.2s ease`
- Slide-over: `animation: slideRight 0.2s ease`
- Success screen: `animation: scaleIn 0.4s ease`
- SLA breach: `animation: pulse 1.2s ease infinite`
- Tablo satır: `animation: rowIn 0.2s ease ${index * 0.02}s both`

---

## ITIL State Machines

### Incident States

```
New → Open → In Progress → Pending → Resolved → Closed
                  ↑            ↓
                  └────────────┘  (Pending'den geri dönüş)
```

### Service Request States

```
Draft → Submitted → Pending Approval → Approved → In Progress → Fulfilled → Closed
                                                        ↑
                                                     Pending
```

States: Draft, Submitted, Pending Approval, Approved, In Progress, Pending, Fulfilled, Closed, Rejected, Cancelled

### Change Request States

```
Draft → New → Assess → CAB Review → Scheduled → Implementing → Implemented → Closed
```

Change Types: Standard (pre-approved), Normal (CAB gerekli), Emergency (ECAB)

---

## Approval Workflow Pattern (SR & CR)

Visual olarak sıralı node'lar:

```
[Onaylı ✓] ─── [Bekliyor ⏳] ─── [Henüz başlamadı]
```

Her node içeriği:
- Role (label, muted)
- Name (bold)
- State badge (Approved/Pending/Rejected)
- Date (monospace, muted)
- Comment (italic)

---

## Data Display Patterns

### Detail Panel Field Grid

2 sütunlu grid, her hücre:
```
┌───────────────────┐
│ LABEL (9-10px,    │
│ uppercase, muted) │
│ Value (12-13px)   │
└───────────────────┘
```

Alternatif satır border: `borderBottom: 1px solid #F1F5F9`

### Work Notes / Activity Feed

Timeline tarzı dikey liste:
```
[Avatar] ── [Note card]
  │
[Avatar] ── [Note card]
  │
[Avatar] ── [Note card]
```

- Dikey çizgi: `width: 1px, background: #E2E5EA`
- System note: kırmızı border
- Work note: normal border, "🔒 Internal Work Note" label
- Customer comment: mavi border, "💬 Customer Visible" label
- Approval note: yeşil border, "✅ Onay Notu" label

---

## Responsive Considerations

- Minimum desteklenen genişlik: 1000px (desktop-first, enterprise tool)
- Sidebar collapsible (260px → 52px)
- Detail slide-over: 420-440px fixed width
- Tablo: min-width 1000px, horizontal scroll küçük ekranlarda
- Portal (Self-Service): max-width 680-1000px, centered

---

## Notification Pattern

Dropdown (320px, top-right):
```
Bildirimler                      [Tümünü oku]
────────────────────────────────────────────
● (kırmızı) INC-1042 SLA ihlali    5dk
● (sarı)    CR-0312 CAB bekleniyor  15dk
● (mavi)    SR-2087 size atandı     1s
```

Dot renkleri: critical `#EF4444`, warning `#F59E0B`, info `#3B82F6`

---

## File Listing: Mevcut Ekranlar

| Dosya | Ekran | Tema | Açıklama |
|-------|-------|------|----------|
| `itsm-portal-dashboard.jsx` | ITSM Dashboard | Light | Ana dashboard, stat cards, ticket tabloları, trend chart, SLA performans |
| `itsm-incident-create.jsx` | Incident Oluştur | Light | 4 adımlı wizard, Impact×Urgency matrisi, CI search, priority calculator |
| `itsm-incident-management.jsx` | Incident Yönetim | Light | Split-pane, ServiceNow tarzı, ITIL state bar, 4 tab (Details/Notes/Timeline/Related) |
| `itsm-service-request.jsx` | Service Request | Light | Dual view (Queue + Catalog), approval workflow, fulfillment progress |
| `itsm-change-request.jsx` | Change Request | Light | CAB review, risk assessment, impl/rollback plans, change calendar |
| `itsm-self-service-portal.jsx` | Self-Service Portal | Light | Son kullanıcı portalı, olay bildirimi + hizmet talebi formları |
| `itsm-agent-workbench-v2.jsx` | Agent Workbench | Dark | L1 agent unified queue, bulk actions, SLA countdown, quick assign |

---

## Yeni Ekran Oluştururken Checklist

1. ✅ Doğru font ailesini import et (IBM Plex veya DM Sans + monospace)
2. ✅ Color token'ları bu dokümana göre kullan (ticket tipi, priority, state)
3. ✅ Ticket ID'leri DAIMA monospace font ile göster
4. ✅ SLA countdown varsa renk + animation kurallarına uy
5. ✅ Badge'ler micro/small/normal boyut kuralına uysun
6. ✅ State badge'lerde icon karakterini (✓, ○, ⏷, ✕, ✕) dahil et
7. ✅ Form focus state: mavi border + subtle box-shadow
8. ✅ Hover state: tüm tıklanabilir öğelerde transition var mı?
9. ✅ Staggered animation: liste item'larında index-based delay
10. ✅ Slide-over panel: sağdan açılma + backdrop overlay
11. ✅ Quick actions: inline butonlar, icon + tooltip
12. ✅ Breadcrumb: Top bar'da `›` separator ile sayfa konumu
13. ✅ Error state: `#EF4444` renk, icon + mesaj
14. ✅ Empty state: dashed border, italic muted text
15. ✅ Pixanto logo: gradient `#3B82F6 → #8B5CF6`, "Px" text, border-radius 6-8
