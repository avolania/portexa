import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import { Impact, Urgency, ChangeRisk, ChangeType } from "@/lib/itsm/types/enums";

const TEST_TAG = "[TEST]";
const uuid = () => crypto.randomUUID();

async function adminUpsert(table: string, id: string, data: unknown, orgId: string) {
  const { error } = await supabaseAdmin
    .from(table)
    .upsert([{ id, data, org_id: orgId }], { defaultToNull: false });
  if (error) throw new Error(`${table} upsert: ${error.message}`);
}

async function generateTicketNumber(prefix: string, orgId: string): Promise<string> {
  const { data, error } = await supabaseAdmin.rpc("next_ticket_number", {
    p_prefix: prefix,
    p_org_id: orgId,
  });
  if (error || !data) {
    // fallback: timestamp tabanlı
    return `${prefix}-${Date.now().toString().slice(-6)}`;
  }
  return data as string;
}

export async function POST(req: NextRequest) {
  if (process.env.NODE_ENV === 'production') {
    return NextResponse.json({ error: 'Not found' }, { status: 404 });
  }

  // Auth check
  const token = req.headers.get("Authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });
  const { error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { orgs: { id: string; name: string }[] };
  const { orgs } = body;

  if (!Array.isArray(orgs) || orgs.length === 0) {
    return NextResponse.json({ error: "orgs[] required" }, { status: 400 });
  }

  const results: Record<string, { projects: number; incidents: number; sr: number; cr: number }> = {};

  for (const org of orgs) {
    const { id: orgId, name: orgName } = org;
    const now = new Date().toISOString();
    const start = new Date(Date.now() + 7 * 86400000).toISOString();
    const end   = new Date(Date.now() + 14 * 86400000).toISOString();

    // ─── Organization kaydı ──────────────────────────────────────────────────
    await supabaseAdmin.from("organizations").upsert([{
      id: orgId,
      data: {
        id: orgId, name: orgName, plan: "trial", status: "active", createdAt: now,
      },
    }], { defaultToNull: false });

    // ─── Projeler ─────────────────────────────────────────────────────────────
    const projectSamples = [
      { name: `${TEST_TAG} [${orgName}] ERP Modernizasyon`, status: "active", priority: "high", projectType: "waterfall" },
      { name: `${TEST_TAG} [${orgName}] Mobil Uygulama`, status: "active", priority: "medium", projectType: "agile" },
    ];
    for (const s of projectSamples) {
      const id = uuid();
      await adminUpsert("projects", id, {
        id, ...s, description: `Test projesi — ${orgName}`,
        startDate: now.slice(0, 10), endDate: end.slice(0, 10),
        progress: 0, managerId: orgId, members: [], tags: ["test"],
        createdAt: now, updatedAt: now,
      }, orgId);
    }

    // ─── Incidents ────────────────────────────────────────────────────────────
    const incidentSamples = [
      { shortDescription: `${TEST_TAG} [${orgName}] SAP Login Sorunu`, impact: Impact.HIGH, urgency: Urgency.HIGH },
      { shortDescription: `${TEST_TAG} [${orgName}] Raporlama Yavaş`, impact: Impact.MEDIUM, urgency: Urgency.MEDIUM },
    ];
    for (const s of incidentSamples) {
      const id = uuid();
      const number = await generateTicketNumber("INC", orgId);
      await adminUpsert("itsm_incidents", id, {
        id, number, category: "SAP", state: "New",
        impact: s.impact, urgency: s.urgency, priority: "3-Medium",
        priorityOverride: false, callerId: orgId, reportedById: orgId,
        shortDescription: s.shortDescription, description: `Test incident for ${orgName}`,
        workNotes: [], comments: [], attachments: [],
        sla: { responseTarget: now, resolutionTarget: end, responseBreached: false, resolutionBreached: false },
        timeline: [{ id: uuid(), type: "created", actorId: orgId, actorName: orgName, timestamp: now }],
        createdAt: now, updatedAt: now,
      }, orgId);
    }

    // ─── Service Requests ─────────────────────────────────────────────────────
    const srSamples = [
      { shortDescription: `${TEST_TAG} [${orgName}] SAP Yetki Talebi` },
      { shortDescription: `${TEST_TAG} [${orgName}] VPN Erişim Talebi` },
    ];
    for (const s of srSamples) {
      const id = uuid();
      const number = await generateTicketNumber("REQ", orgId);
      await adminUpsert("itsm_service_requests", id, {
        id, number, requestType: "Yetki Talebi", category: "SAP",
        state: "Draft", impact: Impact.LOW, urgency: Urgency.LOW, priority: "4-Low",
        requestedForId: orgId, requestedById: orgId,
        shortDescription: s.shortDescription, description: `Test SR for ${orgName}`,
        approvalRequired: false, approvalState: "Not Yet Requested",
        approvers: [], workNotes: [], comments: [], attachments: [],
        sla: { target: end, slaBreached: false },
        timeline: [{ id: uuid(), type: "created", actorId: orgId, actorName: orgName, timestamp: now }],
        createdAt: now, updatedAt: now,
      }, orgId);
    }

    // ─── Change Requests ──────────────────────────────────────────────────────
    const crSamples = [
      { shortDescription: `${TEST_TAG} [${orgName}] Firewall Kural Değişikliği`, type: ChangeType.NORMAL, risk: ChangeRisk.MODERATE },
      { shortDescription: `${TEST_TAG} [${orgName}] SAP Config Güncellemesi`, type: ChangeType.STANDARD, risk: ChangeRisk.LOW },
    ];
    for (const s of crSamples) {
      const id = uuid();
      const number = await generateTicketNumber("CHG", orgId);
      await adminUpsert("itsm_change_requests", id, {
        id, number, type: s.type, risk: s.risk, impact: Impact.LOW, priority: "4-Low",
        category: "SAP", state: "Pending Approval", approvalState: "Requested",
        requestedById: orgId, changeManagerId: orgId,
        shortDescription: s.shortDescription, description: `Test CR for ${orgName}`,
        justification: "Test verisi", implementationPlan: "Test", backoutPlan: "Test",
        plannedStartDate: start, plannedEndDate: end,
        approvers: [], workNotes: [], comments: [], attachments: [], relatedIncidentIds: [],
        timeline: [{ id: uuid(), type: "created", actorId: orgId, actorName: orgName, timestamp: now }],
        createdAt: now, updatedAt: now,
      }, orgId);
    }

    results[orgId] = { projects: 2, incidents: 2, sr: 2, cr: 2 };
  }

  return NextResponse.json({ ok: true, seeded: results });
}
