import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import {
  loadIncidents,
  createIncident,
  updateIncident,
  assignIncident,
  changeIncidentState,
  resolveIncident,
  closeIncident,
  addIncidentWorkNote,
  addIncidentComment,
  linkCRToIncident,
  deleteIncident,
  addIncidentAttachment,
  removeIncidentAttachment,
} from '@/services/incidentService';
import type {
  Incident,
  CreateIncidentDto,
  UpdateIncidentDto,
  AssignIncidentDto,
  ChangeIncidentStateDto,
  ResolveIncidentDto,
  CloseIncidentDto,
  AddWorkNoteDto,
  AddCommentDto,
  LinkCRDto,
} from '@/lib/itsm/types/incident.types';

interface IncidentState {
  incidents: Incident[];
  loading: boolean;
  load: () => Promise<void>;
  create: (dto: CreateIncidentDto) => Promise<Incident | null>;
  update: (id: string, dto: UpdateIncidentDto) => Promise<void>;
  assign: (id: string, dto: AssignIncidentDto) => Promise<void>;
  changeState: (id: string, dto: ChangeIncidentStateDto) => Promise<void>;
  resolve: (id: string, dto: ResolveIncidentDto) => Promise<void>;
  close: (id: string, dto: CloseIncidentDto) => Promise<void>;
  addWorkNote: (id: string, dto: AddWorkNoteDto) => Promise<void>;
  addComment: (id: string, dto: AddCommentDto) => Promise<void>;
  linkCR: (id: string, dto: LinkCRDto) => Promise<void>;
  addAttachment: (id: string, file: File) => Promise<void>;
  removeAttachment: (id: string, attachmentId: string) => Promise<void>;
  remove: (id: string) => void;
}

export const useIncidentStore = create<IncidentState>()((set, get) => ({
  incidents: [],
  loading: false,

  load: async () => {
    set({ loading: true });
    const incidents = await loadIncidents();
    set({ incidents, loading: false });
  },

  create: async (dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return null;
    const incident = await createIncident(dto, user.orgId, user.id, user.name);
    set((s) => ({ incidents: [...s.incidents, incident] }));
    return incident;
  },

  update: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await updateIncident(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  assign: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await assignIncident(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  changeState: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await changeIncidentState(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  resolve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await resolveIncident(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  close: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await closeIncident(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  addWorkNote: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addIncidentWorkNote(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addIncidentComment(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  linkCR: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await linkCRToIncident(id, dto, get().incidents, user.id, user.name);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  addAttachment: async (id, file) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await addIncidentAttachment(id, file, user.name, get().incidents, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  removeAttachment: async (id, attachmentId) => {
    const updated = await removeIncidentAttachment(id, attachmentId, get().incidents);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  remove: (id) => {
    set((s) => ({ incidents: s.incidents.filter((i) => i.id !== id) }));
    deleteIncident(id);
  },
}));
