import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
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
  remove: (id: string) => void;
}

export const useChangeRequestStore = create<ChangeRequestState>()((set, get) => ({
  changeRequests: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const changeRequests = await loadChangeRequests();
    set({ changeRequests, loading: false });
  },

  create: async (dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    const cr = await createChangeRequest(dto, user.orgId, user.id, user.name);
    set((s) => ({ changeRequests: [...s.changeRequests, cr] }));
    return cr;
  },

  update: async (id, dto) => {
    const updated = await updateChangeRequest(id, dto, get().changeRequests);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  transition: async (id: string, toState: CRState, note?: string) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await changeRequestStateTransition(id, toState, get().changeRequests, user.id, user.name, note);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  approve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await approveChangeRequest(id, dto, get().changeRequests, user.id, user.name);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  reject: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await rejectChangeRequest(id, dto, get().changeRequests, user.id, user.name);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  close: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await closeChangeRequest(id, dto, get().changeRequests, user.id, user.name);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  addWorkNote: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addCRWorkNote(id, dto, get().changeRequests, user.id, user.name);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addCRComment(id, dto, get().changeRequests, user.id, user.name);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  linkIncident: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await linkIncidentToCR(id, dto, get().changeRequests, user.id, user.name);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  addAttachment: async (id, file) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addChangeRequestAttachment(id, file, user.name, get().changeRequests, user.orgId);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  removeAttachment: async (id, attachmentId) => {
    const updated = await removeChangeRequestAttachment(id, attachmentId, get().changeRequests);
    if (updated) set((s) => ({ changeRequests: s.changeRequests.map((cr) => (cr.id === id ? updated : cr)) }));
  },

  remove: (id) => {
    set((s) => ({ changeRequests: s.changeRequests.filter((cr) => cr.id !== id) }));
    deleteChangeRequest(id);
  },
}));
