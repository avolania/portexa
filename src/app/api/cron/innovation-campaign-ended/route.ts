import { NextRequest, NextResponse } from 'next/server';
import { supabaseAdmin } from '@/lib/supabaseAdmin';
import { notifyCampaignEnded } from '@/lib/innovation/services/innovationNotifications';

export async function GET(req: NextRequest) {
  const auth = req.headers.get('authorization');
  if (auth !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 });
  }

  const yesterday = new Date();
  yesterday.setDate(yesterday.getDate() - 1);
  const dateStr = yesterday.toISOString().slice(0, 10); // YYYY-MM-DD

  const { data: campaigns } = await supabaseAdmin
    .from('innovation_campaigns')
    .select('id, title, org_id, created_by')
    .eq('end_date', dateStr);

  if (!campaigns?.length) {
    return NextResponse.json({ ok: true, processed: 0 });
  }

  const appUrl = process.env.NEXT_PUBLIC_APP_URL ?? '';
  let processed = 0;

  for (const campaign of campaigns) {
    const { data: ideas } = await supabaseAdmin
      .from('innovation_ideas')
      .select('submitter_id')
      .eq('campaign_id', campaign.id);

    const submitterIds = [
      ...new Set((ideas ?? []).map((i) => i.submitter_id as string)),
    ];
    const allRecipients = [
      ...new Set([campaign.created_by as string, ...submitterIds]),
    ];

    await notifyCampaignEnded(
      campaign as { id: string; title: string; org_id: string; created_by: string },
      allRecipients,
      appUrl
    ).catch(console.error);

    processed++;
  }

  return NextResponse.json({ ok: true, processed });
}
