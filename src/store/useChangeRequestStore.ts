import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { useITSMConfigStore } from './useITSMConfigStore';
import { useWorkflowInstanceStore } from './useWorkflowInstanceStore';
import { triggerWorkflow } from '@/services/workflowEngine';
import {
  loadChangeRequests,
  createChangeRequest,
  updateChangeRequest,
  changeRequestStateTransition,
  approveChangeRequest,
  rejectChangeRequest,
  closeChangeRequest,
  addCRWorkNote,
  addCRComment,
  linkIncidentToCR,
  deleteChangeRequest,
  addChangeRequestAttachment,
  removeChangeRequestAttachment,
} from '@/services/changeRequestService';
import type {
  ChangeRequest,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
  CloseChangeRequestDto,
  ApproveChangeRequestDto,
  RejectChangeRequestDto,
  AddWorkNoteDto,
  AddCommentDto,
  LinkIncidentDto,
} from '@/lib/itsm/types/change-request.types';
import type { ChangeRequestState as CRState } from '@/lib/itsm/types/enums';

interface ChangeRequestState {
  changeRequests: ChangeRequest[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  create: (dto: CreateChangeRequestDto) => Promise<ChangeRequest | null>;
  update: (id: string, dto: UpdateChangeRequestDto) => Promise<void>;
  transition: (id: string, toState: CRState, note?: string) => Promise<void>;
  approve: (id: string, dto: ApproveChangeRequestDto) => Promise<void>;
  reject: (id: string, dto: RejectChangeRequestDto) => Promise<void>;
  close: (id: string, dto: CloseChangeRequestDto) => Promise<void>;
  addWorkNote: (id: string, dto: AddWorkNoteDto) => Promise<void>;
  addComment: (id: string, dto: AddCommentDto) => Promise<void>;
  linkIncident: (id: string, dto: LinkIncidentDto) => Promise<void>;
  addAttachment: (id: string, file: File) => Promise<void>;
  removeAttachment: (id: string, attachmentId: string) => Promise<void>;
  remove: (id: string) => Promise<void>;
}

export const useChangeRequestStore = create<ChangeRequestState>()((set, get) => ({
  changeRequests: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const changeRequests = await loadChangeRequests();
      set({ changeRequests, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  create: async (dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    const cr = await createChangeRequest(dto, user.orgId, user.id, user.name);
    set((s) => ({ changeRequests: [...s.changeRequests, cr] }));

    // Yaratılınca otomatik workflow tetikle
    try {
      const configStore = useITSMConfigStore.getState();
      if (!configStore.config.approvalWorkflows.length && !configStore.loading) {
        await configStore.load();
      }
      const { config } = useITSMConfigStore.getState();
      const workflowId = config.crApprovalWorkflows[cr.type] ?? null;
      const definition = workflowId
        ? config.approvalWorkflows.find((w) => w.id === workflowId)
        : undefined;
      if (definition) {
        const instance = await triggerWorkflow(
          definition,
          'change_request',
          cr.id,
          user.orgId,
          config,
          cr.requestedById,
        );
        useWorkflowInstanceStore.getState().addInstance(instance);
      }
    } catch (err) {
      console.error('[workflow] CR create workflow trigger failed:', err);
    }

    return cr;
  },

  update: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await updateChangeRequest(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  transition: async (id: string, toState: CRState, note?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await changeRequestStateTransition(id, toState, get().changeRequests, user.id, user.name, user.orgId, note);
    if (!updated) return;
    set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));

  },

  approve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await approveChangeRequest(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  reject: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await rejectChangeRequest(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  close: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await closeChangeRequest(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  addWorkNote: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addCRWorkNote(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addCRComment(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  linkIncident: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await linkIncidentToCR(id, dto, get().changeRequests, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  addAttachment: async (id, file) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addChangeRequestAttachment(id, file, user.name, get().changeRequests, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  removeAttachment: async (id, attachmentId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await removeChangeRequestAttachment(id, attachmentId, get().changeRequests, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  remove: async (id) => {
    const rollback = get().changeRequests.find((cr) => cr.id === id);
    set((s) => ({ changeRequests: s.changeRequests.filter((cr) => cr.id !== id) }));
    try {
      await deleteChangeRequest(id);
    } catch (err) {
      if (rollback) set((s) => ({ changeRequests: [...s.changeRequests, rollback] }));
      throw err;
    }
  },
}));
