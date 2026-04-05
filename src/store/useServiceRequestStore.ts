import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useITSMConfigStore } from './useITSMConfigStore';
import { useWorkflowInstanceStore } from './useWorkflowInstanceStore';
import { triggerWorkflow } from '@/services/workflowEngine';
import {
  loadServiceRequests,
  createServiceRequest,
  updateServiceRequest,
  submitServiceRequest,
  approveServiceRequest,
  rejectServiceRequest,
  fulfillServiceRequest,
  closeServiceRequest,
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

interface ServiceRequestState {
  serviceRequests: ServiceRequest[];
  loading: boolean;
  load: () => Promise<void>;
  create: (dto: CreateServiceRequestDto) => Promise<ServiceRequest | null>;
  update: (id: string, dto: UpdateServiceRequestDto) => Promise<void>;
  submit: (id: string) => Promise<void>;
  approve: (id: string, dto: ApproveServiceRequestDto) => Promise<void>;
  reject: (id: string, dto: RejectServiceRequestDto) => Promise<void>;
  fulfill: (id: string, dto: FulfillServiceRequestDto) => Promise<void>;
  close: (id: string) => Promise<void>;
  addWorkNote: (id: string, dto: AddWorkNoteDto) => Promise<void>;
  addComment: (id: string, dto: AddCommentDto) => Promise<void>;
  addAttachment: (id: string, file: File) => Promise<void>;
  removeAttachment: (id: string, attachmentId: string) => Promise<void>;
  remove: (id: string) => void;
}

export const useServiceRequestStore = create<ServiceRequestState>()((set, get) => ({
  serviceRequests: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const serviceRequests = await loadServiceRequests();
    set({ serviceRequests, loading: false });
  },

  create: async (dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    const sr = await createServiceRequest(dto, user.orgId, user.id, user.name);
    set((s) => ({ serviceRequests: [...s.serviceRequests, sr] }));
    return sr;
  },

  update: async (id, dto) => {
    const updated = await updateServiceRequest(id, dto, get().serviceRequests);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  submit: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await submitServiceRequest(id, get().serviceRequests, user.id, user.name);
    if (!updated) return;
    set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));

    // Onay gerekiyorsa ve bir workflow tanımlanmışsa engine'i tetikle
    if (updated.approvalRequired) {
      const configStore = useITSMConfigStore.getState();
      if (!configStore.config.approvalWorkflows.length && !configStore.loading) {
        await configStore.load();
      }
      const { config } = useITSMConfigStore.getState();
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
    }
  },

  approve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await approveServiceRequest(id, dto, get().serviceRequests, user.id, user.name);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  reject: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await rejectServiceRequest(id, dto, get().serviceRequests, user.id, user.name);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  fulfill: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await fulfillServiceRequest(id, dto, get().serviceRequests, user.id, user.name);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  close: async (id) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await closeServiceRequest(id, get().serviceRequests, user.id, user.name);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  addWorkNote: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addSRWorkNote(id, dto, get().serviceRequests, user.id, user.name);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addSRComment(id, dto, get().serviceRequests, user.id, user.name);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  addAttachment: async (id, file) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addServiceRequestAttachment(id, file, user.name, get().serviceRequests, user.orgId);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  removeAttachment: async (id, attachmentId) => {
    const updated = await removeServiceRequestAttachment(id, attachmentId, get().serviceRequests);
    if (updated) set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
  },

  remove: (id) => {
    set((s) => ({ serviceRequests: s.serviceRequests.filter((sr) => sr.id !== id) }));
    deleteServiceRequest(id);
  },
}));
