import { create } from "zustand";
import type { TeamMember, UserRole } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

interface TeamState {
  members: TeamMember[];
  load: () => Promise<void>;
  addMember: (member: TeamMember) => void;
  updateMember: (id: string, data: Partial<TeamMember>) => void;
  removeMember: (id: string) => void;
  changeRole: (id: string, role: UserRole) => void;
  assignProject: (memberId: string, projectId: string) => void;
  unassignProject: (memberId: string, projectId: string) => void;
  reset: (members: TeamMember[]) => void;
}

export const useTeamStore = create<TeamState>()((set) => ({
  members: [],

  load: async () => {
    const members = await dbLoadAll<TeamMember>("team_members");
    set({ members });
  },

  reset: (members) => {
    set({ members });
    members.forEach((m) => dbUpsert("team_members", m.id, m));
  },

  addMember: (member) => {
    set((s) => ({ members: [...s.members, member] }));
    dbUpsert("team_members", member.id, member);
  },

  updateMember: (id, data) =>
    set((s) => {
      const members = s.members.map((m) => (m.id === id ? { ...m, ...data } : m));
      const updated = members.find((m) => m.id === id);
      if (updated) dbUpsert("team_members", id, updated);
      return { members };
    }),

  removeMember: (id) => {
    set((s) => ({ members: s.members.filter((m) => m.id !== id) }));
    dbDelete("team_members", id);
  },

  changeRole: (id, role) =>
    set((s) => {
      const members = s.members.map((m) => (m.id === id ? { ...m, role } : m));
      const updated = members.find((m) => m.id === id);
      if (updated) dbUpsert("team_members", id, updated);
      return { members };
    }),

  assignProject: (memberId, projectId) =>
    set((s) => {
      const members = s.members.map((m) =>
        m.id === memberId && !m.projectIds.includes(projectId)
          ? { ...m, projectIds: [...m.projectIds, projectId] }
          : m
      );
      const updated = members.find((m) => m.id === memberId);
      if (updated) dbUpsert("team_members", memberId, updated);
      return { members };
    }),

  unassignProject: (memberId, projectId) =>
    set((s) => {
      const members = s.members.map((m) =>
        m.id === memberId
          ? { ...m, projectIds: m.projectIds.filter((p) => p !== projectId) }
          : m
      );
      const updated = members.find((m) => m.id === memberId);
      if (updated) dbUpsert("team_members", memberId, updated);
      return { members };
    }),
}));
