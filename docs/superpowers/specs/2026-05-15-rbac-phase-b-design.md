# RBAC Phase B Design — Per-Org Role Permission Overrides

## Goal

Allow admins to edit the permission set of any of the 7 system roles on a per-org basis. Changes are stored in DB; the existing static `permissions.ts` serves as the default fallback. Runtime enforcement (`hasPermission()`) is **not** changed in this phase — that is Phase C.

---

## Scope

**In scope:**
- DB table to store per-org role permission overrides
- `GET /api/yetkilendirme/roller` — returns effective permissions per role for the caller's org
- `PATCH /api/yetkilendirme/roller` — saves or resets one role's permissions
- `/yetkilendirme/roller` page becomes editable: checkboxes, pending state, sticky save bar, per-role reset

**Out of scope (Phase C+):**
- Changing `hasPermission()` to read from DB at runtime
- Creating new custom roles
- Per-user permission overrides
- Workflow step role updates

---

## DB Schema

```sql
CREATE TABLE org_role_permissions (
  id         uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id     uuid NOT NULL,
  data       jsonb NOT NULL DEFAULT '{}',
  updated_at timestamptz DEFAULT now(),
  UNIQUE(org_id)
);

ALTER TABLE org_role_permissions ENABLE ROW LEVEL SECURITY;

CREATE POLICY "service_role_only" ON org_role_permissions
  USING (auth.role() = 'service_role');
```

`data` shape: `Record<UserRole, Permission[]>` — only overridden roles are stored. Example:
```json
{
  "pm":     ["project.create", "project.edit", "project.view", "task.create", "task.edit", "task.view"],
  "viewer": ["project.view", "report.view"]
}
```

If a role key is absent from `data`, the static default from `ROLE_PERMISSIONS` is used.

---

## API Routes

### GET `/api/yetkilendirme/roller`

**Auth:** Bearer token; caller must have `settings.manage` (role = `admin` or `system_admin`).

**Logic:**
1. Resolve caller's `org_id` from `auth_profiles`.
2. Fetch the row from `org_role_permissions` where `org_id` matches (may be absent).
3. For each `UserRole`, use `data[role]` if present, else `ROLE_PERMISSIONS[role]`.
4. Return merged effective permissions + a `customized` array listing which roles have overrides.

**Response:**
```json
{
  "permissions": {
    "system_admin": ["project.create", "..."],
    "admin":        ["project.create", "..."],
    "pm":           ["project.create", "project.edit", "project.view"],
    "member":       ["project.view", "task.view"],
    "approver":     ["project.view", "task.view", "governance.approve"],
    "viewer":       ["project.view"],
    "end_user":     []
  },
  "customized": ["pm"]
}
```

### PATCH `/api/yetkilendirme/roller`

**Auth:** Same as GET.

**Request body:**
```json
{ "role": "pm", "permissions": ["project.view", "task.view"] }
```
Or to reset to default:
```json
{ "role": "pm", "permissions": null }
```

**Validation:**
- `role` must be one of the 7 known `UserRole` values.
- `permissions` must be `null` or an array where every element is a known `Permission` string. Validate by checking each element against `ALL_PERMISSIONS` — a `Set<string>` derived from `Object.values(ROLE_PERMISSIONS).flat()` (computed once at module level in the route file).
- `system_admin` role cannot be overridden — return `400` if `role === "system_admin"` with a non-null permissions body.

**Logic:**
- Upsert the `org_role_permissions` row for this org.
- If `permissions` is `null`: remove the key from `data` (JSONB delete operator `- 'role'`).
- If `permissions` is an array: set `data['role'] = permissions`.
- Update `updated_at`.

**Response:** `{ "ok": true }` or `{ "error": "..." }`.

---

## UI — `/yetkilendirme/roller` Page Changes

### New state

```ts
const [effectivePerms, setEffectivePerms] = useState<Record<string, Permission[]>>({});
const [customized, setCustomized] = useState<Set<UserRole>>(new Set());
const [pendingChanges, setPendingChanges] = useState<Record<string, Permission[]>>({});
const [saving, setSaving] = useState(false);
const [apiLoading, setApiLoading] = useState(true);
const [saveErrors, setSaveErrors] = useState<Record<string, string>>({});
```

`apiLoading` is separate from the auth store's `loading` — it tracks whether the GET call has returned.

### Page load

On mount (after auth store `loading` is false and user is confirmed), call `GET /api/yetkilendirme/roller` with the user's session token. Populate `effectivePerms` and `customized` from the response, then set `apiLoading = false`. While `apiLoading` is true, render a spinner inside the detail panel area (the role cards can render immediately from the static `ROLE_PERMISSIONS`).

### Displayed permissions

For the selected role's detail panel, displayed permissions come from:
```ts
pendingChanges[selected] ?? effectivePerms[selected] ?? ROLE_PERMISSIONS[selected]
```

### Checkbox toggle (replaces ✓/✗ icons)

Each permission row becomes a checkbox (`<input type="checkbox">`). On toggle:
```ts
const current = pendingChanges[selected] ?? effectivePerms[selected] ?? ROLE_PERMISSIONS[selected];
const next = checked
  ? [...current, perm]
  : current.filter((p) => p !== perm);
setPendingChanges((prev) => ({ ...prev, [selected]: next }));
```

After computing `next`, if `next` equals `effectivePerms[selected]` (same elements, order-insensitive), remove `selected` from `pendingChanges` to avoid a spurious dirty state. Otherwise store `next`.

Pending rows (permissions that differ from `effectivePerms[selected]`) get a yellow left border on their row.

### Role card badge

Cards for roles in `customized` (server-confirmed overrides) show an amber "özelleştirildi" badge. Cards with a pending change (in `pendingChanges`) show a yellow dot indicator.

### Sticky save bar

Appears when `Object.keys(pendingChanges).length > 0`:

```
[N rol için değişiklik var]    [İptal]  [Değişiklikleri Kaydet]
```

- **İptal:** clears `pendingChanges`.
- **Değişiklikleri Kaydet:** set `saving = true`, then for each entry in `pendingChanges` send `PATCH /api/yetkilendirme/roller` with `{ role, permissions }` in parallel (`Promise.all`). Use try/finally to guarantee `saving = false` regardless of outcome. On full success: merge `pendingChanges` into `effectivePerms`, update `customized`, clear `pendingChanges` and `saveErrors`. On partial failure: keep failed roles in `pendingChanges`, store error message in `saveErrors[role]` shown below the detail panel header.

### Varsayılana sıfırla (per-role reset)

A "Varsayılana sıfırla" button appears on the detail panel header when `customized.has(selected) || selected in pendingChanges`. On click:

1. Remove `selected` from `pendingChanges` (if present).
2. Send `PATCH /api/yetkilendirme/roller` with `{ role: selected, permissions: null }` immediately.
3. On success: set `effectivePerms[selected]` back to `ROLE_PERMISSIONS[selected]`, remove from `customized`.

Reset does **not** go through the pending/batch flow — it is applied immediately.

### `system_admin` role

The `system_admin` card is always shown but checkboxes are disabled (all checked, non-interactive). No "Varsayılana sıfırla" button. The detail panel header shows a lock icon and "Bu rol düzenlenemez" note.

---

## Files

| Action | Path | Purpose |
|--------|------|---------|
| Create | `supabase-org-role-permissions.sql` | DB migration |
| Create | `src/app/api/yetkilendirme/roller/route.ts` | GET + PATCH handler |
| Modify | `src/app/(app)/yetkilendirme/roller/page.tsx` | Add editing UI |

---

## Out of Scope (Phase C+)

- Updating `hasPermission()` to read from DB at runtime
- Migrating existing `ROLE_PERMISSIONS` static references to DB lookups
- Creating new custom roles beyond the 7 system roles
- Per-user permission overrides
