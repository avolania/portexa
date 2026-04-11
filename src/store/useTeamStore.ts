import { create } from "zustand";
import type { TeamMember, UserRole } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadTeamMembers,
  createMember,
  updateMember,
  removeMember,
  changeMemberRole,
  assignMemberToProject,
  unassignMemberFromProject,
  resetMembers,
} from "@/services/teamService";

interface TeamState {
  members: TeamMember[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  addMember: (member: TeamMember) => Promise<void>;
  updateMember: (id: string, data: Partial<TeamMember>) => Promise<void>;
  removeMember: (id: string) => Promise<void>;
  changeRole: (id: string, role: UserRole) => Promise<void>;
  assignProject: (memberId: string, projectId: string) => Promise<void>;
  unassignProject: (memberId: string, projectId: string) => Promise<void>;
  reset: (members: TeamMember[]) => void;
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  members: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const members = await loadTeamMembers();
      set({ members, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  reset: (members) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set({ members });
    resetMembers(members, orgId);
  },

  addMember: async (member) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ members: [...s.members, member] }));
    try {
      await createMember(member, orgId);
    } catch (err) {
      // Geri al
      set((s) => ({ members: s.members.filter((m) => m.id !== member.id) }));
      throw err;
    }
  },

  updateMember: async (id, patch) => {
    const rollback = get().members.find((m) => m.id === id);
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) }));
    try {
      const updated = await updateMember(id, patch, get().members);
      if (updated) set((s) => ({ members: s.members.map((m) => (m.id === id ? updated : m)) }));
    } catch (err) {
      if (rollback) set((s) => ({ members: s.members.map((m) => (m.id === id ? rollback : m)) }));
      throw err;
    }
  },

  removeMember: async (id) => {
    const rollback = get().members.find((m) => m.id === id);
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    try {
      await removeMember(id);
    } catch (err) {
      if (rollback) set((s) => ({ members: [...s.members, rollback] }));
      throw err;
    }
  },

  changeRole: async (id, role) => {
    const rollback = get().members.find((m) => m.id === id);
    set((s) => ({ members: s.members.map((m) => (m.id === id ? { ...m, role } : m)) }));
    try {
      const updated = await changeMemberRole(id, role, get().members);
      if (updated) set((s) => ({ members: s.members.map((m) => (m.id === id ? updated : m)) }));
    } catch (err) {
      if (rollback) set((s) => ({ members: s.members.map((m) => (m.id === id ? rollback : m)) }));
      throw err;
    }
  },

  assignProject: async (memberId, projectId) => {
    const rollback = get().members.find((m) => m.id === memberId);
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId && !m.projectIds.includes(projectId)
          ? { ...m, projectIds: [...m.projectIds, projectId] }
          : m
      ),
    }));
    try {
      const updated = await assignMemberToProject(memberId, projectId, get().members);
      if (updated) set((s) => ({ members: s.members.map((m) => (m.id === memberId ? updated : m)) }));
    } catch (err) {
      if (rollback) set((s) => ({ members: s.members.map((m) => (m.id === memberId ? rollback : m)) }));
      throw err;
    }
  },

  unassignProject: async (memberId, projectId) => {
    const rollback = get().members.find((m) => m.id === memberId);
    set((s) => ({
      members: s.members.map((m) =>
        m.id === memberId
          ? { ...m, projectIds: m.projectIds.filter((p) => p !== projectId) }
          : m
      ),
    }));
    try {
      const updated = await unassignMemberFromProject(memberId, projectId, get().members);
      if (updated) set((s) => ({ members: s.members.map((m) => (m.id === memberId ? updated : m)) }));
    } catch (err) {
      if (rollback) set((s) => ({ members: s.members.map((m) => (m.id === memberId ? rollback : m)) }));
      throw err;
    }
  },
}));
