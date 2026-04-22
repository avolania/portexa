import { NextRequest, NextResponse } from "next/server";
import { Resend } from "resend";
import { supabaseAdmin } from "@/lib/supabaseAdmin";
import {
  ticketAssignedEmail,
  approvalNeededEmail,
  approvalDecisionEmail,
  ticketResolvedEmail,
  escalationEmail,
  newCommentEmail,
} from "@/lib/emailTemplates";

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = "Pixanto <noreply@pixanto.app>";

export type NotifyType =
  | "ticket_assigned"
  | "approval_needed"
  | "approval_decision"
  | "ticket_resolved"
  | "escalation"
  | "new_comment";

// Supabase auth.users tablosundan e-posta al (service role gerektirir)
async function getUserEmail(userId: string): Promise<string | null> {
  try {
    const { data, error } = await supabaseAdmin.auth.admin.getUserById(userId);
    if (error || !data?.user?.email) return null;
    return data.user.email;
  } catch {
    return null;
  }
}

function getAppUrl(req: NextRequest): string {
  return (
    process.env.NEXT_PUBLIC_APP_URL ??
    req.headers.get("origin") ??
    req.nextUrl.origin
  ).replace(/\s+/g, "");
}

export async function POST(req: NextRequest) {
  // Caller doğrulama
  const token = req.headers.get("authorization")?.replace("Bearer ", "");
  if (!token) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const { data: { user }, error: authError } = await supabaseAdmin.auth.getUser(token);
  if (authError || !user) return NextResponse.json({ error: "Unauthorized" }, { status: 401 });

  const body = await req.json() as { type: NotifyType; payload: Record<string, unknown> };
  const { type, payload } = body;
  const appUrl = getAppUrl(req);

  try {
    let toEmail: string | null = null;
    let subject: string;
    let html: string;

    switch (type) {
      case "ticket_assigned": {
        const recipientId = payload.assignedToId as string;
        toEmail = await getUserEmail(recipientId);
        if (!toEmail) break;
        ({ subject, html } = ticketAssignedEmail({
          ticketNumber:  payload.ticketNumber  as string,
          ticketTitle:   payload.ticketTitle   as string,
          ticketType:    payload.ticketType    as string,
          assignedByName: payload.assignedByName as string,
          appUrl,
        }));
        break;
      }

      case "approval_needed": {
        const recipientId = payload.approverId as string;
        toEmail = await getUserEmail(recipientId);
        if (!toEmail) break;
        ({ subject, html } = approvalNeededEmail({
          ticketNumber:  payload.ticketNumber  as string,
          ticketTitle:   payload.ticketTitle   as string,
          ticketType:    payload.ticketType    as string,
          requesterName: payload.requesterName as string,
          appUrl,
        }));
        break;
      }

      case "approval_decision": {
        const recipientId = payload.requesterId as string;
        toEmail = await getUserEmail(recipientId);
        if (!toEmail) break;
        ({ subject, html } = approvalDecisionEmail({
          ticketNumber:  payload.ticketNumber  as string,
          ticketTitle:   payload.ticketTitle   as string,
          ticketType:    payload.ticketType    as string,
          decision:      payload.decision      as "approved" | "rejected",
          approverName:  payload.approverName  as string,
          comments:      payload.comments      as string | undefined,
          appUrl,
        }));
        break;
      }

      case "ticket_resolved": {
        const recipientId = payload.callerId as string;
        toEmail = await getUserEmail(recipientId);
        if (!toEmail) break;
        ({ subject, html } = ticketResolvedEmail({
          ticketNumber:   payload.ticketNumber   as string,
          ticketTitle:    payload.ticketTitle    as string,
          ticketType:     payload.ticketType     as string,
          resolvedByName: payload.resolvedByName as string,
          resolution:     payload.resolution     as string | undefined,
          appUrl,
        }));
        break;
      }

      case "escalation": {
        const recipientId = payload.assignedToId as string;
        toEmail = await getUserEmail(recipientId);
        if (!toEmail) break;
        ({ subject, html } = escalationEmail({
          ticketNumber:    payload.ticketNumber    as string,
          ticketTitle:     payload.ticketTitle     as string,
          ticketType:      payload.ticketType      as string,
          escalatedByName: payload.escalatedByName as string,
          targetGroup:     payload.targetGroup     as string,
          appUrl,
        }));
        break;
      }

      case "new_comment": {
        const recipientId = payload.callerId as string;
        toEmail = await getUserEmail(recipientId);
        if (!toEmail) break;
        ({ subject, html } = newCommentEmail({
          ticketNumber: payload.ticketNumber as string,
          ticketTitle:  payload.ticketTitle  as string,
          ticketType:   payload.ticketType   as string,
          agentName:    payload.agentName    as string,
          comment:      payload.comment      as string,
          appUrl,
        }));
        break;
      }

      default:
        return NextResponse.json({ error: "Bilinmeyen bildirim tipi" }, { status: 400 });
    }

    if (!toEmail) {
      // Alıcı bulunamadı — sessizce geç (kullanıcı silinmiş olabilir)
      return NextResponse.json({ ok: true, skipped: true });
    }

    const { error: emailError } = await resend.emails.send({
      from: FROM,
      to: toEmail,
      subject: subject!,
      html: html!,
    });

    if (emailError) {
      console.error("[notify]", type, emailError.message);
      return NextResponse.json({ error: emailError.message }, { status: 500 });
    }

    return NextResponse.json({ ok: true });
  } catch (err) {
    console.error("[notify]", type, err);
    return NextResponse.json({ error: "Sunucu hatası" }, { status: 500 });
  }
}
