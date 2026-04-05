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
  load: () => Promise<void>;
  addMember: (member: TeamMember) => Promise<void>;
  updateMember: (id: string, data: Partial<TeamMember>) => void;
  removeMember: (id: string) => void;
  changeRole: (id: string, role: UserRole) => void;
  assignProject: (memberId: string, projectId: string) => void;
  unassignProject: (memberId: string, projectId: string) => void;
  reset: (members: TeamMember[]) => void;
}

export const useTeamStore = create<TeamState>()((set, get) => ({
  members: [],

  load: async () => {
    const members = await loadTeamMembers();
    set({ members });
  },

  reset: (members) => {
    set({ members });
    resetMembers(members);
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

  updateMember: (id, patch) =>
    set((s) => {
      updateMember(id, patch, s.members).then((updated) => {
        if (updated) set((s2) => ({ members: s2.members.map((m) => (m.id === id ? updated : m)) }));
      });
      return { members: s.members.map((m) => (m.id === id ? { ...m, ...patch } : m)) };
    }),

  removeMember: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    removeMember(id);
  },

  changeRole: (id, role) =>
    set((s) => {
      changeMemberRole(id, role, s.members).then((updated) => {
        if (updated) set((s2) => ({ members: s2.members.map((m) => (m.id === id ? updated : m)) }));
      });
      return { members: s.members.map((m) => (m.id === id ? { ...m, role } : m)) };
    }),

  assignProject: (memberId, projectId) =>
    set((s) => {
      assignMemberToProject(memberId, projectId, s.members).then((updated) => {
        if (updated)
          set((s2) => ({ members: s2.members.map((m) => (m.id === memberId ? updated : m)) }));
      });
      return {
        members: s.members.map((m) =>
          m.id === memberId && !m.projectIds.includes(projectId)
            ? { ...m, projectIds: [...m.projectIds, projectId] }
            : m
        ),
      };
    }),

  unassignProject: (memberId, projectId) =>
    set((s) => {
      unassignMemberFromProject(memberId, projectId, s.members).then((updated) => {
        if (updated)
          set((s2) => ({ members: s2.members.map((m) => (m.id === memberId ? updated : m)) }));
      });
      return {
        members: s.members.map((m) =>
          m.id === memberId
            ? { ...m, projectIds: m.projectIds.filter((p) => p !== projectId) }
            : m
        ),
      };
    }),
}));
