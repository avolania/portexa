import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useITSMConfigStore } from './useITSMConfigStore';
import { useWorkflowInstanceStore } from './useWorkflowInstanceStore';
import { triggerWorkflow } from '@/services/workflowEngine';
import { ServiceRequestState } from '@/lib/itsm/types/enums';
import {
  loadServiceRequests,
  createServiceRequest,
  updateServiceRequest,
  submitServiceRequest,
  approveServiceRequest,
  rejectServiceRequest,
  fulfillServiceRequest,
  closeServiceRequest,
  changeServiceRequestState,
  addSRWorkNote,
  addSRComment,
  deleteServiceRequest,
  addServiceRequestAttachment,
  removeServiceRequestAttachment,
} from '@/services/serviceRequestService';
import type {
  ServiceRequest,
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
  FulfillServiceRequestDto,
  ApproveServiceRequestDto,
  RejectServiceRequestDto,
  AddWorkNoteDto,
  AddCommentDto,
} from '@/lib/itsm/types/service-request.types';

interface SRStoreState {
  serviceRequests: ServiceRequest[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (dto: CreateServiceRequestDto) => Promise<ServiceRequest | null>;
  update: (id: string, dto: UpdateServiceRequestDto) => Promise<void>;
  submit: (id: string) => Promise<void>;
  approve: (id: string, dto: ApproveServiceRequestDto) => Promise<void>;
  reject: (id: string, dto: RejectServiceRequestDto) => Promise<void>;
  fulfill: (id: string, dto: FulfillServiceRequestDto) => Promise<void>;
  close: (id: string) => Promise<void>;
  changeState: (id: string, targetState: ServiceRequestState) => Promise<void>;
  addWorkNote: (id: string, dto: AddWorkNoteDto) => Promise<void>;
  addComment: (id: string, dto: AddCommentDto) => Promise<void>;
  addAttachment: (id: string, file: File) => Promise<void>;
  removeAttachment: (id: string, attachmentId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useServiceRequestStore = create<SRStoreState>()((set, get) => ({
  serviceRequests: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const serviceRequests = await loadServiceRequests();
      set({ serviceRequests, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  create: async (dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;

    // Config'den onay zorunluluğunu otomatik belirle — her zaman taze yükle
    const configStore = useITSMConfigStore.getState();
    if (!configStore.loading) await configStore.load();
    const { config } = useITSMConfigStore.getState();
    const approvalRequired = config.srApprovalConfig.requireApproval && !!config.srApprovalConfig.workflowId;

    const sr = await createServiceRequest({ ...dto, approvalRequired }, user.orgId, user.id, user.name);
    set((s) => ({ serviceRequests: [...s.serviceRequests, sr] }));
    return sr;
  },

  update: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await updateServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  submit: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;

    // Her zaman güncel config'i yükle — eski SR'lardaki yanlış approvalRequired değerini düzelt
    const configStore = useITSMConfigStore.getState();
    if (!configStore.loading) await configStore.load();
    const { config } = useITSMConfigStore.getState();
    const approvalRequiredFromConfig = config.srApprovalConfig.requireApproval && !!config.srApprovalConfig.workflowId;

    // Eğer SR'daki approvalRequired config ile uyuşmuyorsa, yerel listeyi düzelt
    const currentList = get().serviceRequests.map((sr) =>
      sr.id === id ? { ...sr, approvalRequired: approvalRequiredFromConfig } : sr
    );

    const updated = await submitServiceRequest(id, currentList, user.id, user.name, user.orgId);
    if (!updated) return;
    set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));

    // Onay gerekiyorsa workflow engine'i tetikle
    if (updated.approvalRequired) {
      try {
        const workflowId = config.srApprovalConfig.workflowId;
        const definition = workflowId
          ? config.approvalWorkflows.find((w) => w.id === workflowId)
          : undefined;
        if (definition) {
          const instance = await triggerWorkflow(
            definition,
            'service_request',
            id,
            user.orgId,
            config,
            updated.requestedById,
          );
          useWorkflowInstanceStore.getState().addInstance(instance);
        }
      } catch (err) {
        console.error('[workflow] SR submit workflow trigger failed:', err);
      }
    }
  },

  approve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await approveServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  reject: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await rejectServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  fulfill: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await fulfillServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  close: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await closeServiceRequest(id, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  changeState: async (id, targetState) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await changeServiceRequestState(id, targetState, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  addWorkNote: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addSRWorkNote(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addSRComment(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  addAttachment: async (id, file) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addServiceRequestAttachment(id, file, user.name, get().serviceRequests, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  removeAttachment: async (id, attachmentId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await removeServiceRequestAttachment(id, attachmentId, get().serviceRequests, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  remove: async (id) => {
    const rollback = get().serviceRequests.find((sr) => sr.id === id);
    set((s) => ({ serviceRequests: s.serviceRequests.filter((sr) => sr.id !== id) }));
    try {
      await deleteServiceRequest(id);
    } catch (err) {
      if (rollback) set((s) => ({ serviceRequests: [...s.serviceRequests, rollback] }));
      throw err;
    }
  },
}));
