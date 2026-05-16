# RBAC Phase C Design — Runtime Permission Enforcement

## Goal

Make `hasPermission()` enforcement respect per-org role overrides stored in DB (Phase B). Both client-side UI gates and the server-side API auth helper must use the org's effective permissions instead of the static `ROLE_PERMISSIONS` defaults.

---

## Scope

**In scope:**
- `resolveEffectivePermissions()` helper in `permissions.ts`
- `effectivePermissions: Permission[]` field in auth store, populated on login
- `usePermission()` / `useAnyPermission()` hooks reading from store instead of static map
- `getSettingsCtx` in the roller API route using DB-fetched org permissions
- Two `hasPermission(user.role, ...)` calls in `roller/page.tsx` replaced with store field

**Out of scope (Phase D+):**
- Live/real-time permission refresh during an active session (re-login required)
- DB-aware enforcement in API routes other than `/api/yetkilendirme/roller`
- Per-user permission overrides
- Creating custom roles beyond the 7 system roles

---

## Shared Helper

Add to `src/lib/permissions.ts`:

```ts
export function resolveEffectivePermissions(
  role: UserRole,
  overrides: Record<string, Permission[]> | null
): Permission[] {
  return overrides?.[role] ?? [...ROLE_PERMISSIONS[role]];
}
```

Used by both the auth store (client) and the API route (server). If `overrides` is `null` (no row in DB) or does not contain the given role, returns the static default.

---

## New API Endpoint — `GET /api/me/izinler`

`org_role_permissions` tablosunun RLS'i `service_role` ile kısıtlıdır. Client-side `supabase` bu tabloya erişemez. Bu nedenle auth store, org permissions'ı doğrudan DB'den çekmek yerine yeni bir API endpoint'i çağırır.

**File:** `src/app/api/me/izinler/route.ts`

**Auth:** Bearer token — herhangi bir oturum açmış kullanıcı çağırabilir (`settings.manage` gerekmez).

**Logic:**
1. Bearer token'dan kullanıcıyı doğrula (`supabaseAdmin.auth.getUser`).
2. `auth_profiles`'dan `org_id` ve `role` çek.
3. `org_role_permissions`'dan org satırını çek (`supabaseAdmin`, `maybeSingle`).
4. `resolveEffectivePermissions(role, overrides)` ile effective set'i hesapla.
5. Döndür.

**Response:**
```json
{ "effectivePermissions": ["project.create", "project.edit", "project.view", "..."] }
```

**Error:** `401` (token geçersiz), `403` (profil bulunamadı). Her iki durumda da auth store statik default'a döner.

---

## Auth Store Changes

### New state field

```ts
interface AuthState {
  // ... existing fields ...
  effectivePermissions: Permission[];
}
```

Initialised to `[]`. Set after each successful auth event.

### `initAuth` — after profile load

After `dbLoadProfile` / `buildAndSaveProfile` resolves and `session` is available:

```ts
async function fetchEffectivePermissions(
  token: string,
  role: UserRole
): Promise<Permission[]> {
  try {
    const res = await fetch('/api/me/izinler', {
      headers: { Authorization: `Bearer ${token}` },
    });
    if (!res.ok) return [...ROLE_PERMISSIONS[role]];
    const json = await res.json() as { effectivePermissions: Permission[] };
    return json.effectivePermissions;
  } catch {
    return [...ROLE_PERMISSIONS[role]];
  }
}
```

Called in `initAuth` and the `SIGNED_IN` handler. If the fetch fails for any reason, falls back to the static default. Auth flow is never blocked.

### `SIGNED_IN` handler

Same fetch + compute logic as `initAuth`, applied after the auth state change event loads the profile.

### `signOut`

```ts
set({ user: null, isAuthenticated: false, profiles: {}, effectivePermissions: [] });
```

Clears effective permissions so a subsequent login does not briefly see the previous session's permissions.

---

## Hook Changes

`src/hooks/usePermission.ts`:

```ts
export function usePermission(permission: Permission): boolean {
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  return effectivePermissions.includes(permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  return permissions.some((p) => effectivePermissions.includes(p));
}
```

`useRole()` is unchanged.

`PermissionGate`, `projeler/page.tsx`, `ekip/page.tsx`, and `yetkilendirme/page.tsx` gain DB-aware enforcement automatically — no direct changes to those files.

---

## `roller/page.tsx` Changes

Replace the two static `hasPermission(user.role, "settings.manage")` calls with a store read:

```ts
const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
```

Then in the `useEffect` guard:
```ts
if (user && !effectivePermissions.includes("settings.manage")) {
  router.replace("/dashboard");
  return;
}
```

And the render guard:
```ts
if (!user || !effectivePermissions.includes("settings.manage")) return null;
```

The `hasPermission` import is kept — it is still used via `ROLE_PERMISSIONS` for the roller page's own permission editor display logic.

---

## API Route Changes (`getSettingsCtx`)

`src/app/api/yetkilendirme/roller/route.ts` — update `getSettingsCtx`:

```ts
const { data: orgPermsRow } = await supabaseAdmin
  .from('org_role_permissions')
  .select('data')
  .eq('org_id', profile.org_id)
  .maybeSingle();

const overrides = (orgPermsRow?.data ?? null) as Record<string, Permission[]> | null;
const effectivePerms = resolveEffectivePermissions(role, overrides);
if (!effectivePerms.includes('settings.manage')) return { ok: false, status: 403 };
```

If the DB fetch fails, the catch returns `null` overrides, which falls back to static defaults. For the API, a failed fetch results in a conservative 403 (no access granted on error).

---

## Error Handling

| Scenario | Client behaviour | Server behaviour |
|---|---|---|
| `org_role_permissions` row absent | Falls back to static `ROLE_PERMISSIONS[role]` | Falls back to static `ROLE_PERMISSIONS[role]` |
| DB fetch throws | Falls back to static default; auth completes | Returns `403` (safest fallback) |
| `effectivePermissions` is `[]` during loading | `authLoading: true` prevents any guarded UI from rendering | N/A |
| Role changed while session active | Old permissions held until re-login | Per-request DB fetch — always current |
| Org permissions changed while session active | Old permissions held until re-login | Per-request DB fetch — always current |

---

## Files

| Action | Path | Purpose |
|---|---|---|
| Modify | `src/lib/permissions.ts` | Add `resolveEffectivePermissions()` |
| Create | `src/app/api/me/izinler/route.ts` | Authenticated endpoint returning caller's effective permissions |
| Modify | `src/store/useAuthStore.ts` | Add `effectivePermissions`, fetch on auth events |
| Modify | `src/hooks/usePermission.ts` | Read from `effectivePermissions` store field |
| Modify | `src/app/(app)/yetkilendirme/roller/page.tsx` | Replace 2 static `hasPermission` calls |
| Modify | `src/app/api/yetkilendirme/roller/route.ts` | DB-aware auth check in `getSettingsCtx` |

---

## Out of Scope (Phase D+)

- Live permission refresh (WebSocket or polling)
- DB-aware enforcement in other API routes
- Per-user permission overrides
- Custom role creation
