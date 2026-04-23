import { NextRequest, NextResponse } from "next/server";
import { supabaseAdmin } from "@/lib/supabaseAdmin";

export type WebhookEventType =
  | "incident_p1_created"
  | "ticket_assigned"
  | "ticket_resolved"
  | "sla_breached";

interface WebhookPayload {
  event:         WebhookEventType;
  ticketNumber:  string;
  ticketTitle:   string;
  ticketType:    "INC" | "SR" | "CR";
  ticketUrl:     string;
  priority?:     string;
  assignedTo?:   string;
  resolvedBy?:   string;
  agentName?:    string;
}

function slackMessage(p: WebhookPayload): object {
  const emoji = p.ticketType === "INC" ? "🔴" : p.ticketType === "SR" ? "🔵" : "🟣";
  const eventLabel: Record<WebhookEventType, string> = {
    incident_p1_created: "🚨 Yeni P1 Incident",
    ticket_assigned:     "📌 Ticket Atandı",
    ticket_resolved:     "✅ Ticket Çözüldü",
    sla_breached:        "⏰ SLA İhlali",
  };
  const detail =
    p.event === "ticket_assigned" ? `\n*Atanan:* ${p.assignedTo ?? "–"}` :
    p.event === "ticket_resolved" ? `\n*Çözen:* ${p.resolvedBy ?? "–"}` :
    p.priority                    ? `\n*Öncelik:* ${p.priority}` : "";

  return {
    text: `${eventLabel[p.event]}: ${p.ticketNumber}`,
    blocks: [
      {
        type: "section",
        text: {
          type: "mrkdwn",
          text: `*${eventLabel[p.event]}*\n${emoji} \`${p.ticketNumber}\` — ${p.ticketTitle}${detail}`,
        },
        accessory: {
          type: "button",
          text: { type: "plain_text", text: "Görüntüle →" },
          url: p.ticketUrl,
          style: p.event === "incident_p1_created" || p.event === "sla_breached" ? "danger" : "primary",
        },
      },
    ],
  };
}

function teamsMessage(p: WebhookPayload): object {
  const colorMap: Record<WebhookEventType, string> = {
    incident_p1_created: "DC2626",
    ticket_assigned:     "2563EB",
    ticket_resolved:     "059669",
    sla_breached:        "D97706",
  };
  const titleMap: Record<WebhookEventType, string> = {
    incident_p1_created: "🚨 Yeni P1 Incident",
    ticket_assigned:     "📌 Ticket Atandı",
    ticket_resolved:     "✅ Ticket Çözüldü",
    sla_breached:        "⏰ SLA İhlali",
  };
  const facts = [
    { name: "Ticket", value: p.ticketNumber },
    { name: "Tür", value: p.ticketType },
    ...(p.priority   ? [{ name: "Öncelik", value: p.priority }]   : []),
    ...(p.assignedTo ? [{ name: "Atanan",  value: p.assignedTo }] : []),
    ...(p.resolvedBy ? [{ name: "Çözen",   value: p.resolvedBy }] : []),
  ];

  return {
    "@type": "MessageCard",
    "@context": "http://schema.org/extensions",
    themeColor: colorMap[p.event],
    summary: `${titleMap[p.event]}: ${p.ticketNumber}`,
    sections: [
      {
        activityTitle: titleMap[p.event],
        activitySubtitle: p.ticketTitle,
        facts,
      },
    ],
    potentialAction: [
      {
        "@type": "OpenUri",
        name: "Ticket'ı Aç",
        targets: [{ os: "default", uri: p.ticketUrl }],
      },
    ],
  };
}

function getAppUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    req.nextUrl.origin
  ).replace(/\s+/g, "");
}

function ticketUrl(appUrl: string, type: string, id: string): string {
  const section = type === "INC" ? "incidents" : type === "SR" ? "service-requests" : "change-requests";
  return `${appUrl}/itsm/${section}?ticketId=${id}`;
}

export async function POST(req: NextRequest) {
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as {
    slackUrl?: string;
    teamsUrl?: string;
    ticketId: string;
    payload: WebhookPayload;
  };

  const appUrl = getAppUrl(req);
  const payload: WebhookPayload = {
    ...body.payload,
    ticketUrl: ticketUrl(appUrl, body.payload.ticketType, body.ticketId),
  };

  const results: { slack?: string; teams?: string } = {};

  if (body.slackUrl) {
    try {
      const r = await fetch(body.slackUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(slackMessage(payload)),
      });
      results.slack = r.ok ? "ok" : `${r.status}`;
    } catch (e) {
      results.slack = `error: ${e}`;
    }
  }

  if (body.teamsUrl) {
    try {
      const r = await fetch(body.teamsUrl, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(teamsMessage(payload)),
      });
      results.teams = r.ok ? "ok" : `${r.status}`;
    } catch (e) {
      results.teams = `error: ${e}`;
    }
  }

  return NextResponse.json({ ok: true, results });
}
