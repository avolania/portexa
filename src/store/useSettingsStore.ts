import { create } from "zustand";
import type { OrgSettings } from "@/types";
import { supabase } from "@/lib/supabase";

const ORG_ID = "org";

const DEFAULTS: OrgSettings = {
  orgName: "Portexa",
  timezone: "Europe/Istanbul",
  dateFormat: "DD/MM/YYYY",
  currency: "TRY",
  workingDays: [1, 2, 3, 4, 5], // Mon–Fri
  workingHoursPerDay: 8,
  fiscalYearStart: 1,
  integrations: {},
};

interface SettingsState {
  settings: OrgSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<OrgSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: DEFAULTS,
  loaded: false,

  load: async () => {
    const { data } = await supabase
      .from("org_settings")
      .select("data")
      .eq("id", ORG_ID)
      .single();
    if (data?.data) {
      set({ settings: { ...DEFAULTS, ...(data.data as Partial<OrgSettings>) }, loaded: true });
    } else {
      set({ loaded: true });
    }
  },

  update: async (patch) => {
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await supabase.from("org_settings").upsert({ id: ORG_ID, data: next });
  },
}));
