import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import { notifyEmail } from '@/lib/notifyEmail';
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
import { dbLoadNotes, dbLoadEvents } from '@/lib/db';
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
import type { WorkNote, TicketComment, TicketEvent } from '@/lib/itsm/types/interfaces';

interface IncidentState {
  incidents: Incident[];
  loading: boolean;
  error: string | null;
  // P1: Aktif ticket'ın notları ve event'ları ayrı yüklenir
  activeTicketId: string | null;
  activeWorkNotes: WorkNote[];
  activeComments: TicketComment[];
  activeEvents: TicketEvent[];
  activityLoading: boolean;
  load: () => Promise<void>;
  loadTicketActivity: (ticketId: string) => Promise<void>;
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
  remove: (id: string) => Promise<void>;
}

export const useIncidentStore = create<IncidentState>()((set, get) => ({
  incidents: [],
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
    // Ticket değişince eski notları hemen temizle — yeni yüklenene kadar karışma olmaz
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
      // Hata olsa bile eski ticket'ın notları görünmesin
      set({ activeWorkNotes: [], activeComments: [], activeEvents: [], activityLoading: false });
    }
  },

  load: async () => {
    set({ loading: true, error: null });
    try {
      const orgId = useAuthStore.getState().user?.orgId;
      const incidents = await loadIncidents(undefined, orgId);
      set({ incidents, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
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
    const updated = await updateIncident(id, dto, get().incidents, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  assign: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await assignIncident(id, dto, get().incidents, user.id, user.name, user.orgId);
    if (updated) {
      set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
      if (dto.assignedToId && dto.assignedToId !== user.id) {
        notifyEmail("ticket_assigned", {
          assignedToId:   dto.assignedToId,
          ticketNumber:   updated.number,
          ticketTitle:    updated.shortDescription,
          ticketType:     "INC",
          assignedByName: user.name,
        });
      }
    }
  },

  changeState: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await changeIncidentState(id, dto, get().incidents, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  resolve: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await resolveIncident(id, dto, get().incidents, user.id, user.name, user.orgId);
    if (updated) {
      set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
      if (updated.callerId) {
        notifyEmail("ticket_resolved", {
          callerId:       updated.callerId,
          ticketNumber:   updated.number,
          ticketTitle:    updated.shortDescription,
          ticketType:     "INC",
          resolvedByName: user.name,
          resolution:     dto.resolutionNotes,
        });
      }
    }
  },

  close: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await closeIncident(id, dto, get().incidents, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  addWorkNote: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const note = await addIncidentWorkNote(id, dto, null, user.id, user.name, user.orgId);
    set((s) => ({
      // Sadece bu ticket aktif ise UI'ya ekle — farklı bir ticket seçiliyken ekleme
      activeWorkNotes: s.activeTicketId === id ? [...s.activeWorkNotes, note] : s.activeWorkNotes,
      incidents: s.incidents.map((i) => i.id === id ? { ...i, updatedAt: note.createdAt } : i),
    }));
  },

  addComment: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const comment = await addIncidentComment(id, dto, null, user.id, user.name, user.orgId);
    set((s) => ({
      activeComments: [...s.activeComments, comment],
      incidents: s.incidents.map((i) => i.id === id ? { ...i, updatedAt: comment.createdAt } : i),
    }));
  },

  linkCR: async (id, dto) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await linkCRToIncident(id, dto, get().incidents, user.id, user.name, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  addAttachment: async (id, file) => {
    const user = useAuthStore.getState().user;
    if (!user) throw new Error("Kullanıcı oturumu bulunamadı.");
    const updated = await addIncidentAttachment(id, file, user.name, get().incidents, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  removeAttachment: async (id, attachmentId) => {
    const user = useAuthStore.getState().user;
    if (!user) return;
    const updated = await removeIncidentAttachment(id, attachmentId, get().incidents, user.orgId);
    if (updated) set((s) => ({ incidents: s.incidents.map((i) => (i.id === id ? updated : i)) }));
  },

  remove: async (id) => {
    const rollback = get().incidents.find((i) => i.id === id);
    set((s) => ({ incidents: s.incidents.filter((i) => i.id !== id) }));
    try {
      await deleteIncident(id);
    } catch (err) {
      if (rollback) set((s) => ({ incidents: [...s.incidents, rollback] }));
      throw err;
    }
  },
}));
