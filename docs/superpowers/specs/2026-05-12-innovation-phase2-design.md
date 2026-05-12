# Innovation Modülü Phase 2 — Design Spec

**Kapsam:** Settings ekranı (stage + değerlendirme kriteri yönetimi) + Kanban görünümü (Pipeline toggle)
**Durum:** Onaylandı
**Bağımlı:** Phase 1 tamamlanmış olmalı (Dashboard + Pipeline + tüm backend)

---

## Özet

Phase 1'de tamamlanan relational backend ve liste-bazlı Pipeline üzerine iki ek özellik eklenir:

1. **Settings sayfası** — `innovation_admin` rolündeki kullanıcılar stage'leri ve değerlendirme kriterlerini doğrudan UI'dan yönetebilir (Phase 1'de yalnızca DB'den değiştirilebiliyordu).
2. **Kanban görünümü** — Pipeline sayfasına liste/kanban toggle eklenir. Kanban'da kartlar sütunlar arasında sürüklenir; adminler drag ile stage advance yapabilir.

---

## Mimari

**Yaklaşım:** Phase 1 ile aynı — Service-Only, Zustand yok, `useState/useEffect + fetch` pattern.  
**Sürükle-bırak:** `@hello-pangea/dnd` (react-beautiful-dnd fork, aktif bakım).  
**Auth:** Her mutasyon route handler'ında `supabaseAdmin.auth.getUser(token)` + `innovation_role` kontrolü.

---

## Dosya Yapısı

### Yeni dosyalar

```
src/app/(app)/innovation/settings/page.tsx
src/app/api/innovation/stages/[id]/route.ts
src/app/api/innovation/criteria/route.ts
src/app/api/innovation/criteria/[id]/route.ts
```

### Değişen dosyalar

```
src/app/(app)/innovation/pipeline/page.tsx       — Kanban toggle + board view
src/components/layout/Sidebar.tsx                — Settings linki (adminOnly)
src/lib/innovation/types/index.ts                — Stage/kriter CRUD DTO'ları
src/lib/innovation/repositories/stagesRepo.ts    — createStage, updateStage, deleteStage
src/lib/innovation/repositories/evaluationsRepo.ts — createCriterion, updateCriterion, deleteCriterion
src/app/api/innovation/stages/route.ts           — POST handler eklenir
```

---

## Settings Sayfası (`/innovation/settings`)

### Erişim kontrolü

- Yalnızca `innovation_admin` rolündeki kullanıcılar erişebilir.
- Sayfa mount'ta stats API'dan gelen `user_role` kontrol edilir; `innovation_admin` değilse `/innovation`'a redirect yapılır.
- Sidebar'daki `adminOnly` mekanizması genel `role === 'admin'` kontrolü yapar, `innovation_role`'u bilmez. Bu nedenle Settings linki sidebar'da tüm kullanıcılara görünür; koruma yalnızca sayfa seviyesinde sağlanır. `User` tipine `innovation_role` eklenmesi ve auth store'un güncellenmesi Phase 3'e bırakılmıştır.

### Yükleme

Sayfa mount'ta iki paralel fetch yapar:
- `GET /api/innovation/stages` — mevcut route
- `GET /api/innovation/criteria` — yeni route

### Tab 1 — Aşamalar

Her stage satırında:
- Renk noktası (stage.color)
- Sıra numarası (order_index)
- İsim (name)
- Min geçiş skoru (min_score_to_advance)
- Zorunlu değerlendirme sayısı (required_evaluations)
- Aktif toggle (is_active)
- Yukarı / Aşağı ok (order_index swap → PATCH her iki stage)
- Düzenle butonu → satır inline form'a dönüşür
- Sil butonu → onay dialog'u → DELETE; stage'e bağlı fikir varsa API 400 döner, hata mesajı gösterilir

Sayfa altında "Yeni Aşama Ekle" butonu → inline form:
- İsim (text, zorunlu)
- Renk (color input, default `#6B7280`)
- Min geçiş skoru (number, 0–100, default 0)
- Zorunlu değerlendirme sayısı (number, 0–10, default 0)

Her aksiyon (create/update/delete) anında ilgili API'yi çağırır. Ayrı "Kaydet" butonu yok.

### Tab 2 — Değerlendirme Kriterleri

Her kriter satırında:
- İsim (name)
- Açıklama (description, truncated)
- Ağırlık (weight × 100, %)
- Max skor (max_score)
- Aktif toggle (is_active)
- Yukarı / Aşağı ok (order_index swap)
- Düzenle / Sil butonları

Tüm aktif kriterlerin ağırlık toplamı %100'ü aşarsa liste üstünde uyarı gösterilir (`Σ ağırlık = %X — toplamın %100 olması önerilir`). Bu bir engel değil, sadece uyarı.

"Yeni Kriter Ekle" inline form:
- İsim (text, zorunlu)
- Açıklama (text)
- Ağırlık (0.01–1.00 arası, % olarak girilir)
- Max skor (1–100, default 10)

---

## Kanban Görünümü (Pipeline Toggle)

### Toggle

Pipeline filter bar'ında sağ köşeye iki buton eklenir:
- `☰ Liste` — mevcut görünüm
- `⊞ Kanban`

Seçim `localStorage` key `innovation_view_mode` ile saklanır; sayfa yenilenince hatırlanır.

### Layout

Yatay scroll kapsayıcı içinde her stage için bir sütun:
- Sütun genişliği: `280px` sabit
- Sütun başlığı: stage rengi sol border + stage ismi + kart sayısı badge'i
- Sütun gövdesi: dikey kart listesi (scroll)

### Kart içeriği (Kanban)

- INN numarası (monospace, muted)
- Başlık (truncate, 2 satır)
- Stage badge (stage rengiyle)
- Oy sayısı `↑N`
- Composite score (varsa `⭐ X`)
- Submitter adı (muted)

Karta tıklanınca mevcut `DetailSlideOver` açılır (Phase 1 ile aynı).

### Sürükle-bırak

**Kütüphane:** `@hello-pangea/dnd` — `DragDropContext`, `Droppable` (her sütun), `Draggable` (her kart).

**Yetki:** Yalnızca `innovation_admin` rolündeki kullanıcılar sürükleyebilir. Diğer roller için `isDragDisabled: true`.

**Stage geçiş kuralı:** Yalnızca bir sonraki stage'e (order_index + 1) sürükleme geçerlidir. Başka sütuna bırakıldığında `onDragEnd` içinde `result.destination` kontrol edilir; geçersizse `return` yapılır (kart yerine döner).

**Akış:**
1. Admin kartı bir sonraki sütuna bırakır.
2. UI optimistik güncelleme yapar (kart yeni sütunda görünür).
3. "Neden?" modal'ı açılır (reason text alanı, zorunlu).
4. Kullanıcı reason girer → `POST /api/innovation/ideas/[id]/advance` çağrılır.
5. Başarıda kart yeni sütunda kalır, modal kapanır.
6. Hata durumunda optimistik güncelleme geri alınır, toast hata mesajı gösterilir.

**Filtreler:** Mevcut Pipeline filter bar'ındaki arama ve sort seçimleri kanban görünümünde de aktif kalır. Her sütun filtreden geçmiş fikirleri gösterir.

---

## API Eklemeleri

### `POST /api/innovation/stages`

Mevcut `GET /api/innovation/stages` route'una POST handler eklenir.

- Auth: `innovation_admin` zorunlu, değilse 403
- Body: `CreateStageDto { name, color, min_score_to_advance, required_evaluations }`
- `order_index` otomatik: mevcut max order_index + 1
- Başarıda: 201 + oluşturulan stage

### `PATCH /api/innovation/stages/[id]`

- Auth: `innovation_admin` zorunlu
- Body: `UpdateStageDto` (tüm alanlar opsiyonel: name, color, min_score_to_advance, required_evaluations, is_active, order_index)
- Başarıda: 200 + güncel stage

### `DELETE /api/innovation/stages/[id]`

- Auth: `innovation_admin` zorunlu
- Stage'e bağlı en az bir fikir varsa 400: `"Bu aşamada fikir var, silinemez"`
- Başarıda: 200 `{ ok: true }`

### `GET /api/innovation/criteria`

- Auth: authenticated (tüm roller)
- `order_index` sırasıyla tüm aktif + pasif kriterler döner

### `POST /api/innovation/criteria`

- Auth: `innovation_admin` zorunlu
- Body: `CreateCriterionDto { name, description?, weight, max_score }`
- `order_index` otomatik: max + 1
- Başarıda: 201 + oluşturulan kriter

### `PATCH /api/innovation/criteria/[id]`

- Auth: `innovation_admin` zorunlu
- Body: `UpdateCriterionDto` (tüm alanlar opsiyonel)
- Başarıda: 200 + güncel kriter

### `DELETE /api/innovation/criteria/[id]`

- Auth: `innovation_admin` zorunlu
- Kritere bağlı değerlendirme skoru varsa 400: `"Bu kritere ait değerlendirme var, silinemez"`
- Başarıda: 200 `{ ok: true }`

---

## Yeni TypeScript DTO'ları

```typescript
// types/index.ts'e eklenir

export interface CreateStageDto {
  name: string;
  color: string;
  min_score_to_advance: number;
  required_evaluations: number;
}

export interface UpdateStageDto {
  name?: string;
  color?: string;
  min_score_to_advance?: number;
  required_evaluations?: number;
  is_active?: boolean;
  order_index?: number;
}

export interface CreateCriterionDto {
  name: string;
  description?: string;
  weight: number;
  max_score: number;
}

export interface UpdateCriterionDto {
  name?: string;
  description?: string;
  weight?: number;
  max_score?: number;
  is_active?: boolean;
  order_index?: number;
}
```

---

## Kapsam Dışı (Phase 3)

- E-posta / in-app bildirimler
- Toplu değerlendirme akışı (batch evaluation)
- Fikir merge / duplicate detection
- Export (PDF/Excel)
- Stage'ler arası geri hareket (Kanban'da yalnızca ileri)
