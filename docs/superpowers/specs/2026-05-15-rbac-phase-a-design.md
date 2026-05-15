# RBAC Phase A + Kullanıcılar Toplu Kaydet Design

## Goal

Two independent improvements:
1. Replace auto-save in the Innovation Settings "Kullanıcılar" tab with an explicit batch Save/Cancel flow.
2. Add a new read-only `/yetkilendirme/roller` page that shows all system roles with their permission scopes.

---

## Part 1: Kullanıcılar Tab — Batch Save/Cancel

### Problem

Currently every role dropdown change in the Kullanıcılar tab fires an immediate PATCH request. The user has no chance to review or revert multiple changes before committing them.

### Solution

Introduce a `pendingRoles` state (`Record<string, InnovationRole>`) that tracks unsaved changes. Dropdowns write to `pendingRoles`, not directly to the server. A sticky action bar appears at the bottom of the tab only when there are pending changes, showing the count and Save/Cancel buttons.

### Behaviour

- **Dropdown change** → entry added to `pendingRoles[userId]`; original role preserved in `users` state; changed row gets a yellow left border indicator.
- **İptal** → `pendingRoles` cleared; dropdowns revert to values from `users` state.
- **Değişiklikleri Kaydet** → all `pendingRoles` entries are PATCHed in parallel; on full success `users` state is updated and `pendingRoles` cleared; on any error the failed rows show inline red messages and `pendingRoles` keeps only the failed entries.
- **Self row** → still disabled (dropdown + no pending entry possible).
- **Sticky bar** → only rendered when `Object.keys(pendingRoles).length > 0`; shows "N değişiklik var" + İptal + Kaydet buttons.

### State Changes

```ts
// Replace:
const [userSavingId, setUserSavingId] = useState<string | null>(null);

// With:
const [pendingRoles, setPendingRoles] = useState<Record<string, InnovationRole>>({});
const [userSaving, setUserSaving] = useState(false);
const [userErrors, setUserErrors] = useState<Record<string, string>>({});
```

The displayed role for each row is `pendingRoles[u.id] ?? u.innovation_role`.

### Files

- Modify: `src/app/(app)/innovation/settings/page.tsx`

---

## Part 2: `/yetkilendirme/roller` — Role Scope Viewer

### Goal

A read-only page that visualises all system roles and their permissions, sourced directly from `src/lib/permissions.ts`. No DB changes, no API routes.

### Access Control

Same as the existing `/yetkilendirme` page: users with `settings.manage` permission (admin + system_admin).

### Layout

```
/yetkilendirme/roller
┌─────────────────────────────────────────────────────────┐
│ Roller                                                  │
│ Sistem rollerini ve yetki kapsamlarını görüntüleyin     │
├─────────────────────────────────────────────────────────┤
│ [Admin] [PM] [Üye] [Onaycı] [Görüntüleyici] [SysAdmin] [Son Kullanıcı] │
│                  (7 role cards, horizontal scroll on small screens)      │
├─────────────────────────────────────────────────────────┤
│ Detail panel (opens when a card is clicked)             │
│ Role name + description                                 │
│ Permission groups: PROJE / GÖREV / BÜTÇE / RAPOR / EKİP / YÖNETİM / AYARLAR │
│ Each group: ✓ allowed  ✗ not allowed  for each action   │
└─────────────────────────────────────────────────────────┘
```

### Role Cards

Each card shows:
- Colored dot / badge matching `ROLE_META[role].color` and `.bg`
- Role label (`ROLE_META[role].label`)
- Short description (`ROLE_META[role].description`) — truncated to 1 line
- Permission count badge (number of permissions this role has)
- Selected state: blue ring + slightly elevated shadow

Default selected card: `admin` (first non-system role).

### Permission Detail Panel

Opens below the cards on click (no page navigation). Sections:

| Group label | Permission keys matched |
|---|---|
| Proje | `project.*` |
| Görev | `task.*` |
| Bütçe | `budget.*` |
| Rapor | `report.*` |
| Ekip | `team.*` |
| Yönetim | `governance.*` |
| Ayarlar | `settings.*` |

For each group, list all known actions (union of all roles' permissions for that prefix). Each action shows ✓ (green) if the selected role has it, ✗ (gray) if not.

Action display names:

| Key suffix | Turkish label |
|---|---|
| `create` | Oluştur |
| `edit` | Düzenle |
| `delete` | Sil |
| `view` | Görüntüle |
| `assign` | Ata |
| `approve` | Onayla |
| `manage` | Yönet |

### Sidebar

Under the "Sistem" section, add a "Roller" sub-link at `/yetkilendirme/roller`. The existing "Yetkilendirme" link stays. Both are shown together as sub-items (like existing `adminOnly` items).

### Files

- Create: `src/app/(app)/yetkilendirme/roller/page.tsx`
- Modify: `src/components/layout/Sidebar.tsx` (add Roller sub-link)

---

## Out of Scope (Phase B+)

- Creating or editing roles
- Storing roles in DB
- Dynamic permission assignments
- Innovation-specific roles on this page
