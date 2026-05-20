# Innovation Modülü V2 — Rol Sistemi Genişletmesi Tasarımı

**Tarih:** 2026-05-20
**Kapsam:** V2 Adım 1 — Çoklu rol desteği (junction table) + 4 yeni rol
**Durum:** Onaylandı

---

## Hedef

Mevcut tek kolonlu `auth_profiles.innovation_role` yapısını junction tabloya taşıyarak her kullanıcının birden fazla innovation rolü taşımasına izin ver. V2 modülleri (POC, business case, portfolio, value realization) için gereken 4 yeni rolü ekle.

---

## Mimari

### Yaklaşım

`innovation_user_roles` junction tablosu oluşturulur. Mevcut `innovation_role` verisi migration ile taşınır. Auth store `string[]` yükler. Tüm yetki kontrolleri `hasRole()` helper'ına dönüştürülür. Settings UI dropdown → checkbox.

### Yeni Roller

| Rol | Açıklama | V2'de Kullanıldığı Yer |
|-----|----------|----------------------|
| `business_sponsor` | POC onayı, fikir sahipliği, kaynak desteği | POC yönetimi |
| `finance` | Business case ve fayda doğrulaması | Value realization |
| `pmo_manager` | Portfolio cockpit yönetimi, roadmap | Portfolio cockpit |
| `executive` | Portfolio cockpit read-only erişimi | Portfolio cockpit |

Mevcut roller değişmez: `innovation_evaluator`, `innovation_admin`.

---

## Veritabanı Şema Değişiklikleri

### Yeni tablo

```sql
CREATE TABLE innovation_user_roles (
  user_id    TEXT NOT NULL REFERENCES auth_profiles(id) ON DELETE CASCADE,
  org_id     TEXT NOT NULL,
  role       TEXT NOT NULL CHECK (role IN (
               'innovation_evaluator', 'innovation_admin',
               'business_sponsor', 'finance', 'pmo_manager', 'executive'
             )),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  PRIMARY KEY (user_id, role)
);
```

### Veri migrasyonu

```sql
INSERT INTO innovation_user_roles (user_id, org_id, role)
SELECT id, org_id, innovation_role
FROM auth_profiles
WHERE innovation_role IS NOT NULL;
```

### Eski kolon

`auth_profiles.innovation_role` kolonu migration sonrası kod değişiklikleri tamamlanana kadar olduğu gibi kalır — kod artık yazmaz/okumaz. Kod geçişi tamamlandıktan sonra ayrı bir migration ile drop edilebilir:

```sql
-- Gelecekte (isteğe bağlı):
ALTER TABLE auth_profiles DROP COLUMN innovation_role;
```

---

## Tip Değişiklikleri

### `InnovationRole` (`src/lib/innovation/types/index.ts`)

```ts
// Eskisi
export type InnovationRole = 'innovation_evaluator' | 'innovation_admin' | null;

// Yenisi
export type InnovationRole =
  | 'innovation_evaluator'
  | 'innovation_admin'
  | 'business_sponsor'
  | 'finance'
  | 'pmo_manager'
  | 'executive';
```

### `User` interface (`src/types/index.ts`)

```ts
// Eskisi
innovation_role?: InnovationRole | null;

// Yenisi
innovation_roles?: InnovationRole[];
```

### Yeni helper (`src/lib/innovation/utils.ts`)

```ts
import type { InnovationRole } from './types';

export function hasRole(
  roles: InnovationRole[] | undefined,
  role: InnovationRole
): boolean {
  return roles?.includes(role) ?? false;
}
```

---

## Auth Store Değişiklikleri

### `src/lib/db.ts` — `dbLoadProfile`

Mevcut `innovation_role` kolonu okuma kaldırılır. Yerine junction tablosu sorgulanır:

```ts
const { data: roleRows } = await supabaseAdmin
  .from('innovation_user_roles')
  .select('role')
  .eq('user_id', userId);

profile.innovation_roles = roleRows?.map(r => r.role as InnovationRole) ?? [];
```

---

## API Değişiklikleri

### `GET /api/innovation/users`

Response'daki her kullanıcı nesnesinde `innovation_role` → `innovation_roles`:

```ts
// Yeni response shape
{
  id: string;
  name: string;
  email: string;
  department: string;
  innovation_roles: InnovationRole[];
}
```

Implementasyon: her kullanıcı için `innovation_user_roles` tablosundan rolleri çek (batch query veya join).

### `PATCH /api/innovation/users/[id]`

Body değişir — tek rol set etmek yerine rol ekle/çıkar:

```ts
// Yeni body
{ role: InnovationRole; action: 'add' | 'remove' }
```

Handler mantığı:
- `action === 'add'` → `INSERT INTO innovation_user_roles ... ON CONFLICT DO NOTHING`
- `action === 'remove'` → `DELETE FROM innovation_user_roles WHERE user_id = $1 AND role = $2`
- Duplicate add ve var olmayan remove sessizce yutulur (idempotent)
- Yetki: sadece `innovation_admin` çağırabilir

### Diğer API route'ları — yetki kontrol güncellemesi

`ctx.innovationRole === 'innovation_admin'` → `hasRole(ctx.innovationRoles, 'innovation_admin')`

Etkilenen dosyalar (mekanik güncelleme):
- `src/app/api/innovation/ideas/route.ts`
- `src/app/api/innovation/ideas/[id]/route.ts`
- `src/app/api/innovation/campaigns/route.ts`
- `src/app/api/innovation/campaigns/[id]/route.ts`
- `src/app/api/innovation/stages/route.ts`
- `src/app/api/innovation/stages/[id]/route.ts`
- `src/app/api/innovation/criteria/route.ts`
- `src/app/api/innovation/criteria/[id]/route.ts`
- `src/app/api/innovation/users/route.ts`
- `src/app/api/innovation/users/[id]/route.ts`

Her route handler'daki `getCtx` fonksiyonu `innovationRole: InnovationRole` yerine `innovationRoles: InnovationRole[]` döndürecek şekilde güncellenir.

---

## Settings UI Değişiklikleri

### `src/app/(app)/innovation/settings/page.tsx` — "Kullanıcılar" sekmesi

Mevcut tek dropdown → her kullanıcı için inline checkbox grubu.

**Tablo yapısı:**

```
Ad / E-posta  | Admin | Evaluator | Sponsor | Finance | PMO | Executive
──────────────────────────────────────────────────────────────────────
Ahmet Yılmaz  |  ☑   |    ☐     |   ☑    |   ☐    |  ☐  |    ☐
Fatma Kaya    |  ☐   |    ☑     |   ☐    |   ☑    |  ☐  |    ☐
```

**Davranış kuralları:**
- Her checkbox toggle anında `PATCH /api/innovation/users/[id]` tetikler (`add` veya `remove`)
- Toggle sırasında o checkbox `disabled` + loading spinner gösterilir
- Hata durumunda checkbox eski değerine döner, satır altında inline kırmızı hata mesajı gösterilir
- Kendi satırındaki tüm checkboxlar `disabled` (kendinize rol atayamazsınız), tooltip: "Kendi rolünüzü değiştiremezsiniz"

**Rol badge renkleri (pipeline ve detail page'de kullanım için):**

| Rol | Renk |
|-----|------|
| `innovation_admin` | `#7C3AED` (mor) |
| `innovation_evaluator` | `#2563EB` (mavi) |
| `business_sponsor` | `#0891B2` (cyan) |
| `finance` | `#059669` (yeşil) |
| `pmo_manager` | `#D97706` (amber) |
| `executive` | `#374151` (gri) |

---

## Dosya Haritası

| İşlem | Dosya | Amaç |
|-------|-------|------|
| Create | `supabase-innovation-roles-v2.sql` | DB migration |
| Create | `src/lib/innovation/utils.ts` | `hasRole` helper |
| Modify | `src/lib/innovation/types/index.ts` | `InnovationRole` genişletme |
| Modify | `src/types/index.ts` | `User.innovation_roles` array |
| Modify | `src/lib/db.ts` | `dbLoadProfile` junction table okuma |
| Modify | `src/app/api/innovation/users/route.ts` | `innovation_roles[]` response |
| Modify | `src/app/api/innovation/users/[id]/route.ts` | `add/remove` action body |
| Modify | `src/app/(app)/innovation/settings/page.tsx` | Checkbox UI |
| Modify | `src/app/api/innovation/ideas/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/ideas/[id]/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/campaigns/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/campaigns/[id]/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/stages/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/stages/[id]/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/criteria/route.ts` | `hasRole` güncelleme |
| Modify | `src/app/api/innovation/criteria/[id]/route.ts` | `hasRole` güncelleme |

---

## Hata Yönetimi

| Senaryo | Davranış |
|---------|----------|
| PATCH yetkisiz kullanıcı | 403 döner, checkbox eski değerine döner |
| Junction table query hatası | `innovation_roles: []` döner, kullanıcı hiçbir özel erişim görmez |
| Kendi rolünü değiştirme denemesi | API 403, UI checkbox zaten disabled |
| Geçersiz rol değeri | API 400, checkbox eski değerine döner |
