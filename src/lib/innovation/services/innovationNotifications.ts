import { Resend } from 'resend';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { createNotification } from '@/services/notificationService';
import type { Notification } from '@/types';
import type { InnovationIdea, InnovationCampaign } from '@/lib/innovation/types';

const resend = new Resend(process.env.RESEND_API_KEY);
const FROM = 'Pixanto <noreply@pixanto.app>';

async function notify({
  recipientId,
  orgId,
  type,
  title,
  message,
  link,
  emailSubject,
  emailHtml,
}: {
  recipientId: string;
  orgId: string;
  type: Notification['type'];
  title: string;
  message: string;
  link?: string;
  emailSubject: string;
  emailHtml: string;
}) {
  await createNotification(
    {
      id: crypto.randomUUID(),
      type,
      recipientId,
      title,
      message,
      read: false,
      link,
      createdAt: new Date().toISOString(),
    },
    orgId
  );

  const { data } = await supabaseAdmin.auth.admin.getUserById(recipientId);
  const email = data?.user?.email;
  if (!email) return;

  resend.emails
    .send({ from: FROM, to: email, subject: emailSubject, html: emailHtml })
    .catch((err) => console.error('[innovationNotifications] email:', err));
}

async function getEvaluatorsAndAdmins(orgId: string, excludeUserId: string): Promise<string[]> {
  const { data: roleRows, error } = await supabaseAdmin
    .from('innovation_user_roles')
    .select('user_id')
    .eq('org_id', orgId)
    .in('role', ['innovation_admin', 'innovation_evaluator'])
    .neq('user_id', excludeUserId);
  if (error) console.error('[getEvaluatorsAndAdmins]', error.message);
  return [...new Set((roleRows ?? []).map((r) => (r as { user_id: string }).user_id))];
}

export async function notifyIdeaSubmitted(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  submitterName: string,
  appUrl: string
) {
  const recipients = await getEvaluatorsAndAdmins(idea.org_id, idea.submitter_id);
  const link = `${appUrl}/innovation/pipeline`;
  await Promise.allSettled(
    recipients.map((recipientId) =>
      notify({
        recipientId,
        orgId: idea.org_id,
        type: 'idea_submitted',
        title: 'Yeni fikir gönderildi',
        message: `${submitterName}: "${idea.title}" (${idea.idea_number})`,
        link,
        emailSubject: `Yeni fikir: ${idea.title}`,
        emailHtml: `<p><strong>${submitterName}</strong> yeni bir fikir gönderdi.</p>
<p><strong>${idea.idea_number} — ${idea.title}</strong></p>
<p><a href="${link}">Fikri incele →</a></p>`,
      })
    )
  );
}

export async function notifyIdeaStageAdvanced(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  newStageName: string,
  appUrl: string
) {
  const link = `${appUrl}/innovation/pipeline`;
  await notify({
    recipientId: idea.submitter_id,
    orgId: idea.org_id,
    type: 'idea_stage_advanced',
    title: 'Fikrin yeni aşamaya geçti',
    message: `"${idea.title}" → ${newStageName}`,
    link,
    emailSubject: `Fikrin "${newStageName}" aşamasına geçti`,
    emailHtml: `<p>Fikrin <strong>${newStageName}</strong> aşamasına ilerledi.</p>
<p><strong>${idea.idea_number} — ${idea.title}</strong></p>
<p><a href="${link}">Fikri görüntüle →</a></p>`,
  });
}

export async function notifyIdeaEvaluated(
  idea: Pick<InnovationIdea, 'id' | 'idea_number' | 'title' | 'org_id' | 'submitter_id'>,
  evaluatorName: string,
  appUrl: string
) {
  const link = `${appUrl}/innovation/pipeline`;
  await notify({
    recipientId: idea.submitter_id,
    orgId: idea.org_id,
    type: 'idea_evaluated',
    title: 'Fikrin değerlendirildi',
    message: `${evaluatorName}, "${idea.title}" fikrini değerlendirdi`,
    link,
    emailSubject: 'Fikrin değerlendirildi',
    emailHtml: `<p><strong>${evaluatorName}</strong> fikrinin değerlendirmesini tamamladı.</p>
<p><strong>${idea.idea_number} — ${idea.title}</strong></p>
<p><a href="${link}">Sonucu görüntüle →</a></p>`,
  });
}

export async function notifyCampaignInvite(
  campaign: Pick<InnovationCampaign, 'id' | 'title' | 'org_id'>,
  invitedUserId: string,
  appUrl: string
) {
  const link = `${appUrl}/innovation/kampanyalar/${campaign.id}`;
  await notify({
    recipientId: invitedUserId,
    orgId: campaign.org_id,
    type: 'campaign_invite',
    title: 'Kampanyaya davet edildin',
    message: `"${campaign.title}" kampanyasına davet edildin`,
    link,
    emailSubject: `"${campaign.title}" kampanyasına davet edildin`,
    emailHtml: `<p>Bir fikir kampanyasına davet edildin.</p>
<p><strong>${campaign.title}</strong></p>
<p><a href="${link}">Kampanyayı görüntüle →</a></p>`,
  });
}

export async function notifyCampaignEnded(
  campaign: Pick<InnovationCampaign, 'id' | 'title' | 'org_id' | 'created_by'>,
  participantIds: string[],
  appUrl: string
) {
  const link = `${appUrl}/innovation/kampanyalar/${campaign.id}`;
  await Promise.allSettled(
    participantIds.map((recipientId) =>
      notify({
        recipientId,
        orgId: campaign.org_id,
        type: 'campaign_ended',
        title: 'Kampanya sona erdi',
        message: `"${campaign.title}" kampanyası sona erdi`,
        link,
        emailSubject: `"${campaign.title}" kampanyası sona erdi`,
        emailHtml: `<p><strong>${campaign.title}</strong> kampanyası sona erdi.</p>
<p><a href="${link}">Kampanya sonuçlarını görüntüle →</a></p>`,
      })
    )
  );
}
