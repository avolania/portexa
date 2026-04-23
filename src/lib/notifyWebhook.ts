import { supabase } from "./supabase";
import { useITSMConfigStore } from "@/store/useITSMConfigStore";
import type { WebhookEventType } from "@/app/api/webhook/route";

interface WebhookArgs {
  event:        WebhookEventType;
  ticketId:     string;
  ticketNumber: string;
  ticketTitle:  string;
  ticketType:   "INC" | "SR" | "CR";
  priority?:    string;
  assignedTo?:  string;
  resolvedBy?:  string;
}

export async function notifyWebhook(args: WebhookArgs): Promise<void> {
  const { config } = useITSMConfigStore.getState();
  const { integrations } = config;

  const slackUrl = integrations?.slackWebhookUrl?.trim();
  const teamsUrl = integrations?.teamsWebhookUrl?.trim();
  if (!slackUrl && !teamsUrl) return;

  // Check event toggles
  if (args.event === "incident_p1_created" && !integrations.notifyOnP1)       return;
  if (args.event === "ticket_assigned"     && !integrations.notifyOnAssign)    return;
  if (args.event === "ticket_resolved"     && !integrations.notifyOnResolve)   return;
  if (args.event === "sla_breached"        && !integrations.notifyOnSLABreach) return;

  try {
    const { data: { session } } = await supabase.auth.getSession();
    const token = session?.access_token;
    if (!token) return;

    await fetch("/api/webhook", {
      method: "POST",
      headers: { "Content-Type": "application/json", "Authorization": `Bearer ${token}` },
      body: JSON.stringify({
        slackUrl: slackUrl || undefined,
        teamsUrl: teamsUrl || undefined,
        ticketId: args.ticketId,
        payload: {
          event:        args.event,
          ticketNumber: args.ticketNumber,
          ticketTitle:  args.ticketTitle,
          ticketType:   args.ticketType,
          ticketUrl:    "",   // API route fills this in
          priority:     args.priority,
          assignedTo:   args.assignedTo,
          resolvedBy:   args.resolvedBy,
        },
      }),
    });
  } catch (e) {
    console.warn("[notifyWebhook] failed:", args.event, e);
  }
}
