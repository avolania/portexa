# RBAC Phase C Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Make `hasPermission()` enforcement respect per-org role overrides stored in DB — both client-side UI gates and the server-side roller API auth helper use the org's effective permissions instead of the static `ROLE_PERMISSIONS` defaults.

**Architecture:** A `resolveEffectivePermissions(role, overrides)` helper in `permissions.ts` is shared by client and server. The auth store fetches the caller's effective permissions from a new `GET /api/me/izinler` endpoint on every login and stores them as `effectivePermissions: Permission[]`. The `usePermission()` hook reads this field instead of calling `hasPermission()`. The roller API route's `getSettingsCtx` fetches org overrides from DB per-request and applies the same helper.

**Tech Stack:** Next.js 16 App Router, TypeScript (strict), Supabase (PostgreSQL + service_role client), Zustand (auth store)

---

## File Map

| Action | Path | Responsibility |
|---|---|---|
| Modify | `src/lib/permissions.ts` | Add `resolveEffectivePermissions()` helper |
| Create | `src/app/api/me/izinler/route.ts` | Return caller's effective permissions (any auth'd user) |
| Modify | `src/store/useAuthStore.ts` | Add `effectivePermissions` state; fetch on login |
| Modify | `src/hooks/usePermission.ts` | Read from `effectivePermissions` instead of static map |
| Modify | `src/app/(app)/yetkilendirme/roller/page.tsx` | Replace 2 static `hasPermission` calls |
| Modify | `src/app/api/yetkilendirme/roller/route.ts` | DB-aware `getSettingsCtx` |

---

## Task 1: `resolveEffectivePermissions` helper

**Files:**
- Modify: `src/lib/permissions.ts`

Current file ends at line 72. Add the new export below `hasAnyPermission`.

- [ ] **Step 1: Add the helper to `src/lib/permissions.ts`**

Open `src/lib/permissions.ts`. Append at the end (after `hasAnyPermission`):

```ts
export function resolveEffectivePermissions(
  role: UserRole,
  overrides: Record<string, Permission[]> | null
): Permission[] {
  return overrides?.[role] ?? [...ROLE_PERMISSIONS[role]];
}
```

The full file should now end with:

```ts
export function hasAnyPermission(role: UserRole | undefined, permissions: Permission[]): boolean {
  return permissions.some((p) => hasPermission(role, p));
}

export function resolveEffectivePermissions(
  role: UserRole,
  overrides: Record<string, Permission[]> | null
): Permission[] {
  return overrides?.[role] ?? [...ROLE_PERMISSIONS[role]];
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Commit**

```bash
git add src/lib/permissions.ts
git commit -m "feat(rbac-c): add resolveEffectivePermissions helper"
```

---

## Task 2: `GET /api/me/izinler` endpoint

**Files:**
- Create: `src/app/api/me/izinler/route.ts`

This endpoint is called by the auth store on every login. It uses `supabaseAdmin` (service role) to bypass RLS on `org_role_permissions`. Any authenticated user can call it — no `settings.manage` check.

- [ ] **Step 1: Create `src/app/api/me/izinler/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { resolveEffectivePermissions } from '@/lib/permissions';
import type { UserRole, Permission } from '@/types';

export async function GET(req: NextRequest) {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });

  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('data, org_id')
    .eq('id', user.id)
    .single();

  const role = (profile?.data as Record<string, unknown> | null)?.role as UserRole | undefined;
  if (!role || !profile?.org_id) {
    return NextResponse.json({ error: 'Profil bulunamadı' }, { status: 403 });
  }

  const { data: orgPermsRow } = await supabaseAdmin
    .from('org_role_permissions')
    .select('data')
    .eq('org_id', profile.org_id)
    .maybeSingle();

  const overrides = (orgPermsRow?.data ?? null) as Record<string, Permission[]> | null;
  const effectivePermissions = resolveEffectivePermissions(role, overrides);

  return NextResponse.json({ effectivePermissions });
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 3: Manual smoke test**

Start the dev server (`npm run dev`) and run:

```bash
# Get a session token first — log in via the app, then grab it from browser devtools
# Application → Local Storage → sb-*-auth-token → access_token

curl -s http://localhost:3000/api/me/izinler \
  -H "Authorization: Bearer <YOUR_TOKEN>" | jq .
```

Expected:
```json
{ "effectivePermissions": ["project.create", "..."] }
```

If no org override exists yet, the list matches the static `ROLE_PERMISSIONS` for your role.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/me/izinler/route.ts
git commit -m "feat(rbac-c): add GET /api/me/izinler endpoint"
```

---

## Task 3: Auth store — `effectivePermissions`

**Files:**
- Modify: `src/store/useAuthStore.ts`

Three changes: (1) add state field, (2) add module-level fetch helper, (3) update `initAuth`, `SIGNED_IN` handler, and `signOut`.

- [ ] **Step 1: Add imports and module-level fetch helper**

At the top of `src/store/useAuthStore.ts`, extend the existing `@/types` import and add the permissions import:

```ts
import { create } from "zustand";
import type { User, Organization, UserRole, Permission } from "@/types";
import { supabase } from "@/lib/supabase";
import { ROLE_PERMISSIONS } from "@/lib/permissions";
import { dbLoadProfiles, dbLoadProfile, dbUpsertProfile, dbLoadOrg, dbUpsertOrg } from "@/lib/db";
import { logAudit } from "@/lib/audit";
```

Then add this helper function **before** the `useAuthStore = create(...)` call (after `buildAndSaveProfile`):

```ts
async function fetchEffectivePermissions(token: string, role: UserRole): Promise<Permission[]> {
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

- [ ] **Step 2: Add `effectivePermissions` to `AuthState` interface**

Find:
```ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  profiles: Record<string, User>;
```

Replace with:
```ts
interface AuthState {
  user: User | null;
  isAuthenticated: boolean;
  loading: boolean;
  profiles: Record<string, User>;
  effectivePermissions: Permission[];
```

- [ ] **Step 3: Add `effectivePermissions: []` to the initial store state**

Find:
```ts
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  profiles: {},
```

Replace with:
```ts
export const useAuthStore = create<AuthState>()((set, get) => ({
  user: null,
  isAuthenticated: false,
  loading: true,
  profiles: {},
  effectivePermissions: [],
```

- [ ] **Step 4: Update `initAuth` to fetch and set `effectivePermissions`**

Find the `initAuth` body. Currently the two branches that call `set(...)` are:

```ts
if (existing) {
  set({ user: existing, isAuthenticated: true, loading: false });
} else {
  const profile = await buildAndSaveProfile(
    session.user.id,
    session.user.email ?? "",
    session.user.user_metadata ?? {}
  );
  set({ user: profile, isAuthenticated: true, loading: false });
}
```

Replace with:

```ts
if (existing) {
  const effectivePermissions = await fetchEffectivePermissions(session.access_token, existing.role);
  set({ user: existing, isAuthenticated: true, loading: false, effectivePermissions });
} else {
  const profile = await buildAndSaveProfile(
    session.user.id,
    session.user.email ?? "",
    session.user.user_metadata ?? {}
  );
  const effectivePermissions = await fetchEffectivePermissions(session.access_token, profile.role);
  set({ user: profile, isAuthenticated: true, loading: false, effectivePermissions });
}
```

- [ ] **Step 5: Update the `SIGNED_IN` handler the same way**

Find the `SIGNED_IN` branch inside `supabase.auth.onAuthStateChange(...)`:

```ts
if (event === "SIGNED_IN" && session?.user && get().isAuthenticated === false && get().user === null) {
  const existing = await dbLoadProfile(session.user.id);
  if (existing) {
    set({ user: existing, isAuthenticated: true, loading: false });
    logAudit(existing, "user.login");
  } else {
    const profile = await buildAndSaveProfile(
      session.user.id,
      session.user.email ?? "",
      session.user.user_metadata ?? {}
    );
    set({ user: profile, isAuthenticated: true, loading: false });
    logAudit(profile, "user.login");
  }
}
```

Replace with:

```ts
if (event === "SIGNED_IN" && session?.user && get().isAuthenticated === false && get().user === null) {
  const existing = await dbLoadProfile(session.user.id);
  if (existing) {
    const effectivePermissions = await fetchEffectivePermissions(session.access_token, existing.role);
    set({ user: existing, isAuthenticated: true, loading: false, effectivePermissions });
    logAudit(existing, "user.login");
  } else {
    const profile = await buildAndSaveProfile(
      session.user.id,
      session.user.email ?? "",
      session.user.user_metadata ?? {}
    );
    const effectivePermissions = await fetchEffectivePermissions(session.access_token, profile.role);
    set({ user: profile, isAuthenticated: true, loading: false, effectivePermissions });
    logAudit(profile, "user.login");
  }
}
```

- [ ] **Step 6: Update `signOut` and `SIGNED_OUT` handler to clear `effectivePermissions`**

There are two places that clear user state. Update both.

**`signOut` action** (end of the `signOut` function body):
```ts
// Before:
set({ user: null, isAuthenticated: false, profiles: {} });

// After:
set({ user: null, isAuthenticated: false, profiles: {}, effectivePermissions: [] });
```

**`SIGNED_OUT` event** (inside `onAuthStateChange` listener):
```ts
// Before:
set({ user: null, isAuthenticated: false, loading: false, profiles: {} });

// After:
set({ user: null, isAuthenticated: false, loading: false, profiles: {}, effectivePermissions: [] });
```

- [ ] **Step 7: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 8: Manual smoke test**

With `npm run dev` running:
1. Open the app and log in.
2. Open browser devtools → Console.
3. Run: `window.__zustand_auth = window.__zustand_auth ?? require('./store/useAuthStore').useAuthStore.getState()` — or simply look at the Network tab: on login, `GET /api/me/izinler` should fire.
4. Confirm the request returns 200 and `effectivePermissions` is populated.

- [ ] **Step 9: Commit**

```bash
git add src/store/useAuthStore.ts
git commit -m "feat(rbac-c): add effectivePermissions to auth store"
```

---

## Task 4: Client enforcement — hooks and `roller/page.tsx`

**Files:**
- Modify: `src/hooks/usePermission.ts`
- Modify: `src/app/(app)/yetkilendirme/roller/page.tsx`

After this task, `usePermission()`, `useAnyPermission()`, `PermissionGate`, and the roller page's own access guard all use DB-driven permissions.

- [ ] **Step 1: Update `src/hooks/usePermission.ts`**

Replace the entire file content with:

```ts
"use client";

import { useAuthStore } from "@/store/useAuthStore";
import type { Permission } from "@/types";

export function usePermission(permission: Permission): boolean {
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  return effectivePermissions.includes(permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  return permissions.some((p) => effectivePermissions.includes(p));
}

export function useRole() {
  return useAuthStore((s) => s.user?.role);
}
```

Note: `hasPermission` and `hasAnyPermission` imports are removed. `useRole()` is unchanged.

- [ ] **Step 2: Update `src/app/(app)/yetkilendirme/roller/page.tsx`**

Add `effectivePermissions` to the store reads at the top of the component (around line 77, with the other `useAuthStore` calls):

```ts
const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
```

Then replace the guard inside `useEffect` (around line 102):

```ts
// Before:
if (user && !hasPermission(user.role, "settings.manage")) {

// After:
if (user && !effectivePermissions.includes("settings.manage")) {
```

Then replace the render guard (around line 216):

```ts
// Before:
if (!user || !hasPermission(user.role, "settings.manage")) return null;

// After:
if (!user || !effectivePermissions.includes("settings.manage")) return null;
```

The `hasPermission` import on line 8 stays — it is still used in the permission editor logic for displaying role permissions (`hasPermission` is not called with `user.role` anywhere else in this file after these two changes).

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

With `npm run dev` running:
1. Log in as an `admin` user.
2. Via the Supabase dashboard (or `psql`), insert a row in `org_role_permissions` for your org that removes `team.manage` from the `admin` role:
   ```sql
   INSERT INTO org_role_permissions (org_id, data)
   VALUES (
     '<your-org-id>',
     '{"admin": ["project.create","project.edit","project.delete","project.view","task.create","task.edit","task.delete","task.assign","task.view","governance.create","governance.edit","governance.delete","governance.approve","governance.view","report.create","report.edit","report.view","team.view","budget.view","budget.edit","settings.manage"]}'
   )
   ON CONFLICT (org_id) DO UPDATE SET data = EXCLUDED.data;
   ```
   (This removes `team.manage` from admin.)
3. Log out and log back in.
4. Navigate to `/ekip` — the management buttons should be hidden.
5. Restore the override via the `/yetkilendirme/roller` editor UI and log in again — buttons reappear.

- [ ] **Step 5: Commit**

```bash
git add src/hooks/usePermission.ts "src/app/(app)/yetkilendirme/roller/page.tsx"
git commit -m "feat(rbac-c): client-side enforcement via effectivePermissions store"
```

---

## Task 5: Server enforcement — `getSettingsCtx` in roller route

**Files:**
- Modify: `src/app/api/yetkilendirme/roller/route.ts`

The `getSettingsCtx` helper currently calls `hasPermission(role, 'settings.manage')` against the static map. Phase C replaces this with a DB-fetched org permissions check.

- [ ] **Step 1: Add `resolveEffectivePermissions` import**

Find the imports at the top of `src/app/api/yetkilendirme/roller/route.ts`:

```ts
import { hasPermission, ROLE_PERMISSIONS } from '@/lib/permissions';
```

Replace with:

```ts
import { hasPermission, resolveEffectivePermissions, ROLE_PERMISSIONS } from '@/lib/permissions';
```

(`hasPermission` stays imported — it is used indirectly via `resolveEffectivePermissions`; `ROLE_PERMISSIONS` stays for `ALL_PERMISSIONS` and `isDefault` logic. Actually `hasPermission` is no longer called directly in this file after the change — but the import is harmless. If you want to be clean, remove it: `import { resolveEffectivePermissions, ROLE_PERMISSIONS } from '@/lib/permissions';`)

- [ ] **Step 2: Update `getSettingsCtx` to fetch org permissions**

Find the current `getSettingsCtx` body (the auth check section, after profile load):

```ts
  const role = (profile?.data as Record<string, unknown> | null)?.role as UserRole | undefined;
  if (!role || !hasPermission(role, 'settings.manage')) return { ok: false, status: 403 };
  if (!profile?.org_id) return { ok: false, status: 403 };

  return { ok: true, orgId: profile.org_id as string };
```

Replace with:

```ts
  const role = (profile?.data as Record<string, unknown> | null)?.role as UserRole | undefined;
  if (!role) return { ok: false, status: 403 };
  if (!profile?.org_id) return { ok: false, status: 403 };

  const { data: orgPermsRow } = await supabaseAdmin
    .from('org_role_permissions')
    .select('data')
    .eq('org_id', profile.org_id)
    .maybeSingle();

  const overrides = (orgPermsRow?.data ?? null) as Record<string, Permission[]> | null;
  const effectivePerms = resolveEffectivePermissions(role, overrides);
  if (!effectivePerms.includes('settings.manage')) return { ok: false, status: 403 };

  return { ok: true, orgId: profile.org_id as string };
```

Also clean up the `hasPermission` import since it is no longer called in this file:

```ts
import { resolveEffectivePermissions, ROLE_PERMISSIONS } from '@/lib/permissions';
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit
```

Expected: no errors.

- [ ] **Step 4: Manual smoke test**

1. With an org that has a custom override removing `settings.manage` from `admin` (set up in Task 4 Step 4), try accessing the roller page — you should be redirected to `/dashboard`.
2. Use curl to hit the API:
   ```bash
   curl -s -X GET http://localhost:3000/api/yetkilendirme/roller \
     -H "Authorization: Bearer <ADMIN_TOKEN_FROM_ORG_WITH_OVERRIDE>" | jq .
   ```
   Expected: `{ "error": "Unauthorized" }` with HTTP 403, since `settings.manage` was removed from that org's admin role.
3. Restore the override via the UI, log back in, and confirm the page and API become accessible again.

- [ ] **Step 5: Commit**

```bash
git add src/app/api/yetkilendirme/roller/route.ts
git commit -m "feat(rbac-c): server-side DB-aware auth check in getSettingsCtx"
```

---

## Self-Review

**Spec coverage:**

| Spec requirement | Task |
|---|---|
| `resolveEffectivePermissions()` in `permissions.ts` | Task 1 |
| `GET /api/me/izinler` endpoint | Task 2 |
| `effectivePermissions` in auth store, populated on login | Task 3 |
| `usePermission()` / `useAnyPermission()` read from store | Task 4 |
| `roller/page.tsx` 2 static calls replaced | Task 4 |
| `getSettingsCtx` uses DB-fetched org permissions | Task 5 |
| Fallback to static defaults on DB failure | Tasks 2, 3 |
| `signOut` clears `effectivePermissions` | Task 3 Step 6 |

All spec requirements covered.
