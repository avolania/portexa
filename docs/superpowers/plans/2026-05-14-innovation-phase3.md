# Innovation Phase 3 — User Types & Authorization Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Allow `innovation_admin` users to assign `innovation_role` to org members through the Settings page, and surface that role in the auth store so the sidebar hides the Settings link from non-admins.

**Architecture:** Add `innovation_role` to the `User` type and load it from `auth_profiles` in `dbLoadProfile` — no extra API calls, no UI flicker. Two new API routes handle listing and updating user roles. The Settings page gains a third "Kullanıcılar" tab with an inline role dropdown.

**Tech Stack:** Next.js 16 App Router, TypeScript, Supabase (supabaseAdmin for server routes, supabase client for browser), Zustand auth store, Tailwind CSS v4

---

## File Map

| File | Action | Responsibility |
|---|---|---|
| `src/types/index.ts` | Modify | Add `innovation_role` field to `User` interface |
| `src/lib/db.ts` | Modify | `dbLoadProfile` reads `innovation_role` column; `dbUpsertProfile` writes it |
| `src/app/api/innovation/users/route.ts` | Create | `GET` — list all org users with their `innovation_role` |
| `src/app/api/innovation/users/[id]/route.ts` | Create | `PATCH` — update a user's `innovation_role` |
| `src/components/layout/Sidebar.tsx` | Modify | Hide innovation Settings link for non-`innovation_admin` users |
| `src/app/(app)/innovation/settings/page.tsx` | Modify | Add "Kullanıcılar" tab with user table and inline role dropdown |

---

### Task 1: Add `innovation_role` to the `User` type

**Files:**
- Modify: `src/types/index.ts`

- [ ] **Step 1: Open `src/types/index.ts` and locate the `User` interface (line 107)**

The current interface ends at `orgId: string;`. Add one optional field:

```ts
export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  title?: string;
  department?: string;
  company?: string;
  phone?: string;
  language: "tr" | "en";
  rememberMe?: boolean;
  orgId: string;
  innovation_role?: 'innovation_evaluator' | 'innovation_admin' | null;
}
```

- [ ] **Step 2: Verify TypeScript compiles**

```bash
cd /Users/dincercinar/Desktop/Uygulama/PPM/projeyonet && npx tsc --noEmit 2>&1 | head -30
```

Expected: no new errors related to `innovation_role`.

- [ ] **Step 3: Commit**

```bash
git add src/types/index.ts
git commit -m "feat(innovation): add innovation_role to User type"
```

---

### Task 2: Extend `dbLoadProfile` and `dbUpsertProfile` to handle `innovation_role`

**Files:**
- Modify: `src/lib/db.ts` (lines 229–243)

The `auth_profiles` table has a dedicated `innovation_role` TEXT column (separate from the `data` JSONB blob). We need to read and write both.

- [ ] **Step 1: Update `dbLoadProfile` to select and return `innovation_role`**

Replace the current `dbLoadProfile` (lines 229–233):

```ts
export async function dbLoadProfile(userId: string): Promise<User | null> {
  const { data, error } = await supabase
    .from("auth_profiles")
    .select("data, innovation_role")
    .eq("id", userId)
    .single();
  if (error || !data) return null;
  const profile = data.data as User;
  return { ...profile, innovation_role: (data.innovation_role ?? null) as User['innovation_role'] };
}
```

- [ ] **Step 2: Update `dbUpsertProfile` to write `innovation_role` column when present**

Replace the current `dbUpsertProfile` (lines 235–243):

```ts
export async function dbUpsertProfile(userId: string, data: unknown): Promise<void> {
  const d = data as Record<string, unknown>;
  const orgId = d?.orgId as string | undefined;
  const row: Record<string, unknown> = { id: userId, data };
  if (orgId) row.org_id = orgId;
  if ('innovation_role' in d) row.innovation_role = d.innovation_role ?? null;
  const { error } = await supabase.from("auth_profiles").upsert([row], { defaultToNull: false });
  if (error) {
    console.error("[db] upsert auth_profiles:", error.message);
    throw new Error(error.message);
  }
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/lib/db.ts
git commit -m "feat(innovation): persist and load innovation_role in dbLoadProfile/dbUpsertProfile"
```

---

### Task 3: Create `GET /api/innovation/users` and `PATCH /api/innovation/users/[id]`

**Files:**
- Create: `src/app/api/innovation/users/route.ts`
- Create: `src/app/api/innovation/users/[id]/route.ts`

Both routes use the same `getAdminCtx` discriminated union pattern already established in criteria/stages routes.

- [ ] **Step 1: Create `src/app/api/innovation/users/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  if ((profile?.innovation_role ?? null) !== 'innovation_admin') return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function GET(req: NextRequest) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { data: callerRow } = await supabaseAdmin
    .from('auth_profiles')
    .select('org_id')
    .eq('id', ctx.userId)
    .single();
  if (!callerRow?.org_id) return NextResponse.json({ error: 'Org bulunamadı' }, { status: 400 });

  const { data, error } = await supabaseAdmin
    .from('auth_profiles')
    .select('id, data, innovation_role')
    .eq('org_id', callerRow.org_id);
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const users = (data ?? []).map((row) => {
    const p = row.data as Record<string, unknown>;
    return {
      id: row.id as string,
      name: (p?.name as string) ?? 'Bilinmiyor',
      email: (p?.email as string) ?? '',
      department: (p?.department as string | null) ?? null,
      innovation_role: (row.innovation_role ?? null) as InnovationRole,
    };
  });

  return NextResponse.json(users);
}
```

- [ ] **Step 2: Create `src/app/api/innovation/users/[id]/route.ts`**

```ts
import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import type { InnovationRole } from '@/lib/innovation/types';

async function getAdminCtx(req: NextRequest): Promise<
  | { ok: true; userId: string }
  | { ok: false; status: 401 | 403 }
> {
  const token = req.headers.get('Authorization')?.replace('Bearer ', '');
  if (!token) return { ok: false, status: 401 };
  const { data: { user }, error } = await supabaseAdmin.auth.getUser(token);
  if (error || !user) return { ok: false, status: 401 };
  const { data: profile } = await supabaseAdmin
    .from('auth_profiles')
    .select('innovation_role')
    .eq('id', user.id)
    .single();
  if ((profile?.innovation_role ?? null) !== 'innovation_admin') return { ok: false, status: 403 };
  return { ok: true, userId: user.id };
}

export async function PATCH(
  req: NextRequest,
  { params }: { params: Promise<{ id: string }> }
) {
  const ctx = await getAdminCtx(req);
  if (!ctx.ok) return NextResponse.json({ error: 'Unauthorized' }, { status: ctx.status });

  const { id } = await params;

  let body: { innovation_role: InnovationRole };
  try {
    body = await req.json();
  } catch {
    return NextResponse.json({ error: 'Geçersiz JSON' }, { status: 400 });
  }

  const validRoles: Array<InnovationRole> = ['innovation_evaluator', 'innovation_admin', null];
  if (!validRoles.includes(body.innovation_role)) {
    return NextResponse.json({ error: 'Geçersiz rol değeri' }, { status: 400 });
  }

  const { data, error } = await supabaseAdmin
    .from('auth_profiles')
    .update({ innovation_role: body.innovation_role })
    .eq('id', id)
    .select('id, data, innovation_role')
    .single();
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const p = (data.data as Record<string, unknown>);
  return NextResponse.json({
    id: data.id as string,
    name: (p?.name as string) ?? 'Bilinmiyor',
    email: (p?.email as string) ?? '',
    department: (p?.department as string | null) ?? null,
    innovation_role: (data.innovation_role ?? null) as InnovationRole,
  });
}
```

- [ ] **Step 3: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 4: Commit**

```bash
git add src/app/api/innovation/users/route.ts src/app/api/innovation/users/[id]/route.ts
git commit -m "feat(innovation): add GET /api/innovation/users and PATCH /api/innovation/users/[id]"
```

---

### Task 4: Hide innovation Settings link in Sidebar for non-admins

**Files:**
- Modify: `src/components/layout/Sidebar.tsx`

The existing `NavItem` interface has `adminOnly?: boolean` filtered at line 241–243. We add a parallel `innovationAdminOnly` flag and update the filter.

- [ ] **Step 1: Add `innovationAdminOnly` to the `NavItem` interface (around line 33)**

```ts
interface NavItem {
  href: string;
  icon: React.ElementType;
  label: string;
  adminOnly?: boolean;
  innovationAdminOnly?: boolean;
}
```

- [ ] **Step 2: Mark the innovation Settings item with `innovationAdminOnly: true` (around line 90)**

```ts
{ href: "/innovation/settings", icon: SlidersHorizontal, label: "Ayarlar", innovationAdminOnly: true },
```

- [ ] **Step 3: Update the `visibleItems` filter (around line 241) to check `innovationAdminOnly`**

Replace:
```ts
const visibleItems = section.items.filter(
  (i) => !i.adminOnly || isAdmin || isSystemAdmin
);
```

With:
```ts
const isInnovationAdmin = user?.innovation_role === 'innovation_admin';
const visibleItems = section.items.filter((i) => {
  if (i.adminOnly && !isAdmin && !isSystemAdmin) return false;
  if (i.innovationAdminOnly && !isInnovationAdmin) return false;
  return true;
});
```

- [ ] **Step 4: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 5: Commit**

```bash
git add src/components/layout/Sidebar.tsx
git commit -m "feat(innovation): hide Settings sidebar link for non-innovation_admin users"
```

---

### Task 5: Add "Kullanıcılar" tab to Innovation Settings page

**Files:**
- Modify: `src/app/(app)/innovation/settings/page.tsx`

- [ ] **Step 1: Add `InnovationRole` import and `OrgUser` type, update `Tab` type**

At the top of the file, update the imports and type definitions:

```ts
import type {
  InnovationStage, EvaluationCriterion,
  CreateStageDto, UpdateStageDto,
  CreateCriterionDto, UpdateCriterionDto,
  InnovationRole,
} from "@/lib/innovation/types";

type Tab = "stages" | "criteria" | "users";

type OrgUser = {
  id: string;
  name: string;
  email: string;
  department: string | null;
  innovation_role: InnovationRole;
};
```

- [ ] **Step 2: Add user-related state variables after the existing `criterionError` state**

```ts
// Users state
const [users, setUsers] = useState<OrgUser[]>([]);
const [userSavingId, setUserSavingId] = useState<string | null>(null);
const [userErrors, setUserErrors] = useState<Record<string, string>>({});
const [currentUserId, setCurrentUserId] = useState<string>("");
```

- [ ] **Step 3: Update the `init()` function to store `currentUserId` and fetch users**

In the `useEffect`, after `setToken(session.access_token)`, add:

```ts
setCurrentUserId(session.user.id);
```

And extend the `Promise.all` to include users:

```ts
const [stagesRes, criteriaRes, usersRes] = await Promise.all([
  fetch("/api/innovation/stages?all=1", { headers: { Authorization: `Bearer ${session.access_token}` } }),
  fetch("/api/innovation/criteria", { headers: { Authorization: `Bearer ${session.access_token}` } }),
  fetch("/api/innovation/users", { headers: { Authorization: `Bearer ${session.access_token}` } }),
]);
if (stagesRes.ok) setStages(await stagesRes.json());
if (criteriaRes.ok) setCriteria(await criteriaRes.json());
if (usersRes.ok) setUsers(await usersRes.json());
```

- [ ] **Step 4: Add `handleRoleChange` handler after the existing criterion handlers**

```ts
const handleRoleChange = useCallback(async (userId: string, newRole: InnovationRole) => {
  const prevRole = users.find((u) => u.id === userId)?.innovation_role ?? null;
  setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, innovation_role: newRole } : u));
  setUserSavingId(userId);
  setUserErrors((prev) => { const next = { ...prev }; delete next[userId]; return next; });
  const res = await apiCall(`/api/innovation/users/${userId}`, "PATCH", token, { innovation_role: newRole });
  setUserSavingId(null);
  if (!res.ok) {
    const err = await res.json();
    setUserErrors((prev) => ({ ...prev, [userId]: err.error ?? "Hata" }));
    setUsers((prev) => prev.map((u) => u.id === userId ? { ...u, innovation_role: prevRole } : u));
  }
}, [token, users]);
```

- [ ] **Step 5: Update the page description text and tabs bar**

Replace the existing description paragraph:
```tsx
<p className="text-sm text-gray-500 mt-0.5">Aşama ve değerlendirme kriteri yönetimi</p>
```
With:
```tsx
<p className="text-sm text-gray-500 mt-0.5">Aşama, değerlendirme kriteri ve kullanıcı rol yönetimi</p>
```

Replace the tabs bar (the `{(["stages", "criteria"] as Tab[]).map(...)}` block) with:

```tsx
<div className="flex gap-1 border-b border-gray-200">
  {(["stages", "criteria", "users"] as Tab[]).map((t) => (
    <button
      key={t}
      onClick={() => { setTab(t); setStageError(""); setCriterionError(""); }}
      className={`px-4 py-2 text-sm font-semibold border-b-2 transition-colors ${
        tab === t ? "border-blue-600 text-blue-600" : "border-transparent text-gray-500 hover:text-gray-700"
      }`}
    >
      {t === "stages" ? "Aşamalar" : t === "criteria" ? "Değerlendirme Kriterleri" : "Kullanıcılar"}
    </button>
  ))}
</div>
```

- [ ] **Step 6: Add the `RoleBadge` helper component above the `InnovationSettings` function**

```tsx
function RoleBadge({ role }: { role: InnovationRole }) {
  if (role === 'innovation_admin') {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#F3E8FF", color: "#7C3AED" }}>
        Admin
      </span>
    );
  }
  if (role === 'innovation_evaluator') {
    return (
      <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#DBEAFE", color: "#2563EB" }}>
        Değerlendirici
      </span>
    );
  }
  return (
    <span style={{ fontSize: 10, fontWeight: 600, padding: "2px 8px", borderRadius: 4, background: "#F3F4F6", color: "#9CA3AF" }}>
      Yok
    </span>
  );
}
```

- [ ] **Step 7: Add the "Kullanıcılar" tab panel JSX after the existing criteria tab panel**

Add this block after the closing `}` of `{tab === "criteria" && (...)}`:

```tsx
{/* ── Users Tab ─────────────────────────────────────────────────────── */}
{tab === "users" && (
  <div className="bg-white rounded-lg border border-gray-200">
    <div className="p-4 border-b border-gray-100 flex items-center justify-between">
      <h2 className="text-sm font-semibold text-gray-700">Kullanıcılar</h2>
      <span className="text-xs text-gray-400">{users.length} kullanıcı</span>
    </div>
    <table className="w-full text-sm">
      <thead>
        <tr className="border-b border-gray-100 text-xs font-semibold text-gray-500 uppercase tracking-wide">
          <th className="text-left px-4 py-2">Kullanıcı</th>
          <th className="text-left px-4 py-2">E-posta</th>
          <th className="text-left px-4 py-2">Departman</th>
          <th className="text-left px-4 py-2">İnovasyon Rolü</th>
        </tr>
      </thead>
      <tbody>
        {users.map((u) => {
          const isSelf = u.id === currentUserId;
          const isSaving = userSavingId === u.id;
          const errMsg = userErrors[u.id];
          const initials = u.name.split(" ").map((w) => w[0]).join("").slice(0, 2).toUpperCase();
          return (
            <tr key={u.id} className="border-b border-gray-50 last:border-0 hover:bg-gray-50 transition-colors">
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  <div className="w-7 h-7 rounded-full bg-blue-100 flex items-center justify-center text-blue-700 text-xs font-bold flex-shrink-0">
                    {initials}
                  </div>
                  <span className="font-medium text-gray-800">{u.name}</span>
                </div>
              </td>
              <td className="px-4 py-3 text-gray-500">{u.email}</td>
              <td className="px-4 py-3 text-gray-500">{u.department ?? "—"}</td>
              <td className="px-4 py-3">
                <div className="flex items-center gap-2">
                  {isSaving ? (
                    <Loader2 className="w-4 h-4 animate-spin text-gray-400" />
                  ) : (
                    <RoleBadge role={u.innovation_role} />
                  )}
                  <div className="relative group">
                    <select
                      disabled={isSelf || isSaving}
                      value={u.innovation_role ?? ""}
                      onChange={(e) => handleRoleChange(u.id, (e.target.value || null) as InnovationRole)}
                      className="text-xs border border-gray-200 rounded-md px-2 py-1 bg-white text-gray-700 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-blue-500"
                    >
                      <option value="">Yok</option>
                      <option value="innovation_evaluator">Değerlendirici</option>
                      <option value="innovation_admin">Admin</option>
                    </select>
                    {isSelf && (
                      <span className="absolute -top-7 left-1/2 -translate-x-1/2 bg-gray-800 text-white text-xs rounded px-2 py-1 whitespace-nowrap opacity-0 group-hover:opacity-100 transition-opacity pointer-events-none z-10">
                        Kendi rolünüzü değiştiremezsiniz
                      </span>
                    )}
                  </div>
                  {errMsg && (
                    <span className="text-xs text-red-600 flex items-center gap-1">
                      <AlertCircle className="w-3 h-3" />
                      {errMsg}
                    </span>
                  )}
                </div>
              </td>
            </tr>
          );
        })}
        {users.length === 0 && (
          <tr>
            <td colSpan={4} className="px-4 py-8 text-center text-sm text-gray-400">
              Kullanıcı bulunamadı
            </td>
          </tr>
        )}
      </tbody>
    </table>
  </div>
)}
```

- [ ] **Step 8: Verify TypeScript compiles**

```bash
npx tsc --noEmit 2>&1 | head -30
```

Expected: no errors.

- [ ] **Step 9: Start dev server and manually verify**

```bash
npm run dev
```

1. Log in as `innovation_admin` user
2. Open sidebar — "Ayarlar" link should be visible under İnovasyon
3. Navigate to `/innovation/settings`
4. "Kullanıcılar" tab should appear
5. Tab shows all org users with their current roles
6. Change a non-self user's role via dropdown — row should show spinner, then update badge
7. Log out and log in as a non-admin user — "Ayarlar" link should NOT appear in sidebar

- [ ] **Step 10: Commit**

```bash
git add src/app/(app)/innovation/settings/page.tsx
git commit -m "feat(innovation): add Kullanıcılar tab to Settings page with inline role management"
```
