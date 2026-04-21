import type { OrgSettings } from "@/types";
import { dbUpsert } from "@/lib/db";
import { supabase } from "@/lib/supabase";

export const DEFAULT_PROJECT_ROLES = [
  "Proje Yöneticisi",
  "Proje Sahibi",
  "Konu Uzmanı (SME)",
  "Test Lideri",
  "Altyapı Sorumlusu",
  "Geliştirici",
  "Analist",
  "Paydaş",
  "Danışman",
  "Diğer",
];

export const SETTINGS_DEFAULTS: OrgSettings = {
  orgName: "Pixanto",
  timezone: "Europe/Istanbul",
  dateFormat: "DD/MM/YYYY",
  currency: "TRY",
  workingDays: [1, 2, 3, 4, 5],
  workingHoursPerDay: 8,
  fiscalYearStart: 1,
  projectRoles: DEFAULT_PROJECT_ROLES,
  integrations: {},
};

export async function loadOrgSettings(orgId: string): Promise<OrgSettings> {
  const { data, error } = await supabase
    .from("org_settings")
    .select("data")
    .eq("id", orgId)
    .single();
  if (error) {
    // PGRST116 = no rows found → org has no settings yet, use defaults
    if (error.code === 'PGRST116') return SETTINGS_DEFAULTS;
    throw new Error(`loadOrgSettings failed: ${error.message}`);
  }
  if (data?.data) {
    return { ...SETTINGS_DEFAULTS, ...(data.data as Partial<OrgSettings>) };
  }
  return SETTINGS_DEFAULTS;
}

export async function saveOrgSettings(orgId: string, settings: OrgSettings): Promise<void> {
  await dbUpsert("org_settings", orgId, settings);
}
