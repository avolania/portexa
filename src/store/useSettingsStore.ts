import { create } from "zustand";
import type { OrgSettings } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import { loadOrgSettings, saveOrgSettings, SETTINGS_DEFAULTS } from "@/services/settingsService";

interface SettingsState {
  settings: OrgSettings;
  loaded: boolean;
  load: () => Promise<void>;
  update: (patch: Partial<OrgSettings>) => Promise<void>;
}

export const useSettingsStore = create<SettingsState>()((set, get) => ({
  settings: SETTINGS_DEFAULTS,
  loaded: false,

  load: async () => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    const settings = await loadOrgSettings(orgId);
    set({ settings, loaded: true });
  },

  update: async (patch) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    const next = { ...get().settings, ...patch };
    set({ settings: next });
    await saveOrgSettings(orgId, next);
  },
}));
