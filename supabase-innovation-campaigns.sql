-- supabase-innovation-campaigns.sql

CREATE TABLE IF NOT EXISTS innovation_campaigns (
  id             uuid DEFAULT gen_random_uuid() PRIMARY KEY,
  org_id         uuid NOT NULL,
  created_by     uuid NOT NULL,
  title          text NOT NULL,
  description    text,
  goal           text,
  start_date     date NOT NULL,
  end_date       date NOT NULL,
  is_invite_only boolean NOT NULL DEFAULT false,
  created_at     timestamptz DEFAULT now(),
  updated_at     timestamptz DEFAULT now(),
  CONSTRAINT end_after_start CHECK (end_date >= start_date)
);

ALTER TABLE innovation_campaigns ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON innovation_campaigns
  USING (auth.role() = 'service_role');

CREATE TABLE IF NOT EXISTS innovation_campaign_invites (
  campaign_id uuid NOT NULL REFERENCES innovation_campaigns(id) ON DELETE CASCADE,
  user_id     uuid NOT NULL,
  created_at  timestamptz DEFAULT now(),
  PRIMARY KEY (campaign_id, user_id)
);

ALTER TABLE innovation_campaign_invites ENABLE ROW LEVEL SECURITY;
CREATE POLICY "service_role_only" ON innovation_campaign_invites
  USING (auth.role() = 'service_role');

ALTER TABLE innovation_ideas
  ADD COLUMN IF NOT EXISTS campaign_id uuid REFERENCES innovation_campaigns(id) ON DELETE SET NULL;

CREATE INDEX ON innovation_ideas (campaign_id);
CREATE INDEX ON innovation_campaigns (org_id);
CREATE INDEX ON innovation_campaign_invites (user_id);
