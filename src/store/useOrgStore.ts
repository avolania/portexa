import { create } from "zustand";
import type { Organization } from "@/types";
import { dbLoadOrg, dbUpsertOrg } from "@/lib/db";
import { useAuthStore } from "@/store/useAuthStore";

interface OrgState {
  org: Organization | null;
  load: () => Promise<void>;
  update: (data: Partial<Organization>) => Promise<void>;
}

export const useOrgStore = create<OrgState>()((set, get) => ({
  org: null,

  load: async () => {
    const orgId = useAuthStore.getState().user?.orgId;
    if (!orgId) return;
    try {
      const org = await dbLoadOrg(orgId);
      if (org) set({ org });
    } catch {
      // organizations tablosu henüz yoksa yoksay
    }
  },

  update: async (patch) => {
    const current = get().org;
    if (!current) return;
    const updated = { ...current, ...patch };
    set({ org: updated });
    await dbUpsertOrg(current.id, updated);
  },
}));
