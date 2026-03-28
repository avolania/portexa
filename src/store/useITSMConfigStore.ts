import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { loadITSMConfig, saveITSMConfig } from '@/services/itsmConfigService';
import { DEFAULT_ITSM_CONFIG } from '@/lib/itsm/types/config.types';
import type {
  ITSMConfig, ITSMConfigGroup, SRSLAEntry,
  ApprovalWorkflowTemplate, CRApprovalWorkflows, SRApprovalConfig,
} from '@/lib/itsm/types/config.types';
import type { ITSMRole } from '@/lib/itsm/types/enums';
import type { SLAPolicyEntry, BusinessHoursConfig } from '@/lib/itsm/types/interfaces';

interface ITSMConfigState {
  config: ITSMConfig;
  loading: boolean;
  load: () => Promise<void>;
  saveGroups: (groups: ITSMConfigGroup[]) => Promise<void>;
  saveUserRoles: (userRoles: Record<string, ITSMRole>) => Promise<void>;
  saveCategories: (categories: ITSMConfig['categories']) => Promise<void>;
  saveIncidentSLA: (policies: SLAPolicyEntry[]) => Promise<void>;
  saveSRSLA: (policies: SRSLAEntry[]) => Promise<void>;
  saveBusinessHours: (hours: BusinessHoursConfig) => Promise<void>;
  saveApprovalWorkflows: (workflows: ApprovalWorkflowTemplate[]) => Promise<void>;
  saveCRApprovalWorkflows: (crWorkflows: CRApprovalWorkflows) => Promise<void>;
  saveSRApprovalConfig: (srConfig: SRApprovalConfig) => Promise<void>;
}

async function persist(get: () => ITSMConfigState, set: (s: Partial<ITSMConfigState>) => void, updated: ITSMConfig) {
  const user = useAuthStore.getState().user;
  if (!user) throw new Error('Kullanıcı oturumu bulunamadı');
  await saveITSMConfig(updated, user.orgId); // throws on error
  set({ config: updated });
}

export const useITSMConfigStore = create<ITSMConfigState>()((set, get) => ({
  config: { ...DEFAULT_ITSM_CONFIG },
  loading: false,

  load: async () => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    set({ loading: true });
    try {
      const config = await loadITSMConfig(user.orgId);
      set({ config, loading: false });
    } catch {
      set({ loading: false });
    }
  },

  saveGroups:            async (groups)             => persist(get, set, { ...get().config, groups }),
  saveUserRoles:         async (userRoles)           => persist(get, set, { ...get().config, userRoles }),
  saveCategories:        async (categories)          => persist(get, set, { ...get().config, categories }),
  saveIncidentSLA:       async (incidentSLAPolicies) => persist(get, set, { ...get().config, incidentSLAPolicies }),
  saveSRSLA:             async (srSLAPolicies)       => persist(get, set, { ...get().config, srSLAPolicies }),
  saveBusinessHours:     async (businessHours)       => persist(get, set, { ...get().config, businessHours }),
  saveApprovalWorkflows: async (approvalWorkflows)   => persist(get, set, { ...get().config, approvalWorkflows }),
  saveCRApprovalWorkflows: async (crApprovalWorkflows) => persist(get, set, { ...get().config, crApprovalWorkflows }),
  saveSRApprovalConfig:  async (srApprovalConfig)   => persist(get, set, { ...get().config, srApprovalConfig }),
}));
