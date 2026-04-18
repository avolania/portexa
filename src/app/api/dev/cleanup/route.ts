import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

const TEST_TAG = "[TEST]";

const ITSM_TABLES = [
  "itsm_incidents",
  "itsm_service_requests",
  "itsm_change_requests",
  "projects",
];

async function deleteTestRowsFromTable(table: string): Promise<number> {
  const field = table === "projects" ? "name" : "shortDescription";

  // PostgREST JSONB syntax: data->>field (no quotes around field name)
  const { data, error } = await supabaseAdmin
    .from(table)
    .select("id")
    .like(`data->>${field}`, `${TEST_TAG}%`);

  if (error) {
    console.error(`[dev/cleanup] select error on ${table}:`, error.message);
    return 0;
  }
  if (!data || data.length === 0) return 0;

  const ids = data.map((r) => r.id as string);
  const { error: delError } = await supabaseAdmin.from(table).delete().in("id", ids);
  if (delError) {
    console.error(`[dev/cleanup] delete error on ${table}:`, delError.message);
    return 0;
  }
  return ids.length;
}

async function deleteTestOrgs(): Promise<number> {
  const { data, error } = await supabaseAdmin
    .from("organizations")
    .select("id")
    .like(`data->>name`, `${TEST_TAG}%`);

  if (error || !data || data.length === 0) return 0;
  const ids = data.map((r) => r.id as string);
  await supabaseAdmin.from("organizations").delete().in("id", ids);
  return ids.length;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const deleted: Record<string, number> = {};

  for (const table of ITSM_TABLES) {
    deleted[table] = await deleteTestRowsFromTable(table);
  }
  deleted["organizations"] = await deleteTestOrgs();

  const total = Object.values(deleted).reduce((a, b) => a + b, 0);
  return NextResponse.json({ ok: true, deleted, total });
}
