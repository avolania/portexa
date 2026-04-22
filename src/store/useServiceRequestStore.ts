import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { notifyEmail } from '@/lib/notifyEmail';
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
import { dbLoadNotes, dbLoadEvents } from '@/lib/db';
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
import type { WorkNote, TicketComment, TicketEvent } from '@/lib/itsm/types/interfaces';

interface SRStoreState {
  serviceRequests: ServiceRequest[];
  loading: boolean;
  error: string | null;
  activeTicketId: string | null;
  activeWorkNotes: WorkNote[];
  activeComments: TicketComment[];
  activeEvents: TicketEvent[];
  activityLoading: boolean;
  load: () => Promise<void>;
  loadTicketActivity: (ticketId: string) => Promise<void>;
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
  addTask: (id: string, task: import('@/types').ItsmTask) => Promise<void>;
  updateTask: (id: string, taskId: string, patch: Partial<import('@/types').ItsmTask>) => Promise<void>;
  deleteTask: (id: string, taskId: string) => Promise<void>;
}

export const useServiceRequestStore = create<SRStoreState>()((set, get) => ({
  serviceRequests: [],
  loading: false,
  error: null,
  activeTicketId: null,
  activeWorkNotes: [],
  activeComments: [],
  activeEvents: [],
  activityLoading: false,

  loadTicketActivity: async (ticketId) => {
    const orgId = useAuthStore.getState().user?.orgId;
    if (!orgId) return;
    set({ activityLoading: true, activeTicketId: ticketId, activeWorkNotes: [], activeComments: [], activeEvents: [] });
    try {
      const [noteRows, events] = await Promise.all([
        dbLoadNotes<WorkNote>(ticketId, orgId),
        dbLoadEvents<TicketEvent>(ticketId, orgId),
      ]);
      const workNotes = noteRows.filter((r) => r.noteType === 'work_note').map((r) => r.data);
      const comments  = noteRows.filter((r) => r.noteType === 'comment').map((r) => r.data);
      set({ activeWorkNotes: workNotes, activeComments: comments, activeEvents: events, activityLoading: false });
    } catch {
      set({ activeWorkNotes: [], activeComments: [], activeEvents: [], activityLoading: false });
    }
  },

  load: async () => {
    set({ loading: true, error: null });
    try {
      const orgId = useAuthStore.getState().user?.orgId;
      const serviceRequests = await loadServiceRequests(undefined, orgId);
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

    // SR direkt doğru state ile oluşturuluyor (DRAFT yok)
    const sr = await createServiceRequest({ ...dto, approvalRequired }, user.orgId, user.id, user.name);
    set((s) => ({ serviceRequests: [...s.serviceRequests, sr] }));

    // Onay gerekiyorsa workflow hemen tetikle
    if (approvalRequired) {
      const workflowId = config.srApprovalConfig.workflowId;
      const definition = workflowId
        ? config.approvalWorkflows.find((w) => w.id === workflowId)
        : undefined;
      if (definition) {
        try {
          const instance = await triggerWorkflow(
            definition,
            'service_request',
            sr.id,
            user.orgId,
            config,
            sr.requestedById,
          );
          useWorkflowInstanceStore.getState().addInstance(instance);
        } catch (err) {
          console.error('[SR] workflow trigger failed:', err);
        }
      }
    }

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
      const workflowId = config.srApprovalConfig.workflowId;
      const definition = workflowId
        ? config.approvalWorkflows.find((w) => w.id === workflowId)
        : undefined;

      if (!definition) {
        throw new Error(
          'Onay workflow şablonu bulunamadı. ITSM Ayarları > Servis Talebi Onayı bölümünden bir şablon seçin.'
        );
      }

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
  },

  approve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await approveServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) {
      set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
      if (updated.requestedForId) {
        notifyEmail("approval_decision", {
          requesterId:   updated.requestedForId,
          ticketStoreId: updated.id,
          ticketNumber:  updated.number,
          ticketTitle:   updated.shortDescription,
          ticketType:    "SR",
          decision:      "approved",
          approverName:  user.name,
          comments:      dto.comments,
        });
      }
    }
  },

  reject: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await rejectServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) {
      set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
      if (updated.requestedForId) {
        notifyEmail("approval_decision", {
          requesterId:   updated.requestedForId,
          ticketStoreId: updated.id,
          ticketNumber:  updated.number,
          ticketTitle:   updated.shortDescription,
          ticketType:    "SR",
          decision:      "rejected",
          approverName:  user.name,
          comments:      dto.comments,
        });
      }
    }
  },

  fulfill: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await fulfillServiceRequest(id, dto, get().serviceRequests, user.id, user.name, user.orgId);
    if (updated) {
      set((s) => ({ serviceRequests: s.serviceRequests.map((sr) => (sr.id === id ? updated : sr)) }));
      if (updated.requestedForId) {
        notifyEmail("ticket_resolved", {
          callerId:       updated.requestedForId,
          ticketStoreId:  updated.id,
          ticketNumber:   updated.number,
          ticketTitle:    updated.shortDescription,
          ticketType:     "SR",
          resolvedByName: user.name,
          resolution:     dto.fulfillmentNotes,
        });
      }
    }
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
    const note = await addSRWorkNote(id, dto, null, user.id, user.name, user.orgId);
    set((s) => ({
      activeWorkNotes: s.activeTicketId === id ? [...s.activeWorkNotes, note] : s.activeWorkNotes,
      serviceRequests: s.serviceRequests.map((sr) => sr.id === id ? { ...sr, updatedAt: note.createdAt } : sr),
    }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const comment = await addSRComment(id, dto, null, user.id, user.name, user.orgId);
    set((s) => ({
      activeComments: [...s.activeComments, comment],
      serviceRequests: s.serviceRequests.map((sr) => sr.id === id ? { ...sr, updatedAt: comment.createdAt } : sr),
    }));
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

  addTask: async (id, task) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const sr = get().serviceRequests.find((s) => s.id === id);
    if (!sr) return;
    const updated = { ...sr, tasks: [...(sr.tasks ?? []), task] };
    set((s) => ({ serviceRequests: s.serviceRequests.map((x) => (x.id === id ? updated : x)) }));
    await updateServiceRequest(id, { tasks: updated.tasks }, get().serviceRequests, user.id, user.name, user.orgId);
  },

  updateTask: async (id, taskId, patch) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const sr = get().serviceRequests.find((s) => s.id === id);
    if (!sr) return;
    const tasks = (sr.tasks ?? []).map((t) => (t.id === taskId ? { ...t, ...patch } : t));
    const updated = { ...sr, tasks };
    set((s) => ({ serviceRequests: s.serviceRequests.map((x) => (x.id === id ? updated : x)) }));
    await updateServiceRequest(id, { tasks }, get().serviceRequests, user.id, user.name, user.orgId);
  },

  deleteTask: async (id, taskId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const sr = get().serviceRequests.find((s) => s.id === id);
    if (!sr) return;
    const tasks = (sr.tasks ?? []).filter((t) => t.id !== taskId);
    const updated = { ...sr, tasks };
    set((s) => ({ serviceRequests: s.serviceRequests.map((x) => (x.id === id ? updated : x)) }));
    await updateServiceRequest(id, { tasks }, get().serviceRequests, user.id, user.name, user.orgId);
  },
}));
