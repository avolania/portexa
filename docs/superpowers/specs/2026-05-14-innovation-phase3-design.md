# Innovation Phase 3 — User Types & Authorization Design

## Goal

Allow `innovation_admin` users to assign `innovation_role` to org members via a UI tab in the Innovation Settings page, without needing SQL access. Surface the role in the auth store so the sidebar can conditionally show admin-only links.

---

## Architecture

### Approach

Load `innovation_role` into the existing auth store by extending `dbLoadProfile` to read the column from `auth_profiles`. This makes the role available everywhere `useAuthStore` is consumed, with no extra API calls and no UI flicker.

### Files Changed or Created

| File | Change |
|---|---|
| `src/types/index.ts` | Add `innovation_role?: InnovationRole \| null` to `User` interface |
| `src/lib/db.ts` | `dbLoadProfile` reads `innovation_role`; `dbUpsertProfile` writes it when present |
| `src/app/api/innovation/users/route.ts` | New — `GET` lists all org users with their `innovation_role` (admin-only) |
| `src/app/api/innovation/users/[id]/route.ts` | New — `PATCH` updates `innovation_role` for a user (admin-only) |
| `src/components/layout/Sidebar.tsx` | Innovation "Ayarlar" item hidden unless `user.innovation_role === 'innovation_admin'` |
| `src/app/(app)/innovation/settings/page.tsx` | Add third "Kullanıcılar" tab with user table and inline role dropdown |

### Data Flow

1. `initAuth` calls `dbLoadProfile` → returns profile including `innovation_role`
2. `user.innovation_role` is set in the auth store on login
3. Sidebar reads `user.innovation_role` — renders Settings link only for `innovation_admin`
4. Settings page "Kullanıcılar" tab calls `GET /api/innovation/users` to list all org members
5. Admin changes role via dropdown → `PATCH /api/innovation/users/[id]` → DB updated
6. Store synced via `updateProfile({ innovation_role: newRole })` so current user's own role reflects immediately (relevant if admin changes their own role)

---

## API Design

### `GET /api/innovation/users`

- Auth: `innovation_admin` only (uses `getAdminCtx` discriminated union pattern)
- `org_id` resolution: after auth, query `auth_profiles.org_id` for the caller's `userId`, then fetch all profiles with the same `org_id`
- Response: `Array<{ id, name, email, department, innovation_role }>`

### `PATCH /api/innovation/users/[id]`

- Auth: `innovation_admin` only
- Body: `{ innovation_role: 'innovation_evaluator' | 'innovation_admin' | null }`
- Writes to `auth_profiles.innovation_role`
- Response: updated user object

---

## UI Design

### Sidebar

The innovation section's "Ayarlar" `NavItem` gains a filter: only rendered when `user.innovation_role === 'innovation_admin'`. Uses the existing `NavItem` shape — no structural changes to the sidebar component.

### Settings Page — "Kullanıcılar" Tab

Third tab alongside "Aşamalar" and "Kriterler".

**Table columns:** Avatar + Ad | E-posta | Departman | İnovasyon Rolü

**Role dropdown values:**
- `Yok` → `null`
- `Değerlendirici` → `'innovation_evaluator'`
- `Admin` → `'innovation_admin'`

**Behaviour:**
- Selecting a role auto-saves immediately (no separate Save button); row shows "Kaydediliyor…" spinner during the PATCH
- On error: row shows inline red message; dropdown reverts to previous value
- Current user's own row: dropdown disabled with tooltip "Kendi rolünüzü değiştiremezsiniz"

**Role badge colours:**
- Admin: `#7C3AED` (mor)
- Değerlendirici: `#2563EB` (mavi)
- Yok: `#9CA3AF` (gri)

---

## Types

`InnovationRole` is already defined in `src/lib/innovation/types/index.ts`:

```ts
export type InnovationRole = 'innovation_evaluator' | 'innovation_admin' | null;
```

The `User` interface gains one optional field:

```ts
innovation_role?: InnovationRole | null;
```

---

## Edge Cases

- **Non-admin visits `/innovation/settings`**: existing page-level redirect remains (stats API role check). Sidebar link is also hidden — belt-and-suspenders.
- **Admin demotes themselves**: allowed. If `user.id === id`, store runs `updateProfile({ innovation_role: newRole })` after successful PATCH, which will cause sidebar to hide Settings link on next render.
- **User has no `auth_profiles` row**: `dbLoadProfile` returns null → `buildAndSaveProfile` creates one without `innovation_role` → defaults to `null`.
