import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { TeamMember, UserRole } from "@/types";

interface TeamState {
  members: TeamMember[];
  addMember: (member: TeamMember) => void;
  updateMember: (id: string, data: Partial<TeamMember>) => void;
  removeMember: (id: string) => void;
  changeRole: (id: string, role: UserRole) => void;
  assignProject: (memberId: string, projectId: string) => void;
  unassignProject: (memberId: string, projectId: string) => void;
  reset: (members: TeamMember[]) => void;
}

export const useTeamStore = create<TeamState>()(
  persist(
    (set) => ({
      members: [],
      addMember: (member) =>
        set((state) => ({ members: [...state.members, member] })),
      updateMember: (id, data) =>
        set((state) => ({
          members: state.members.map((m) => (m.id === id ? { ...m, ...data } : m)),
        })),
      removeMember: (id) =>
        set((state) => ({ members: state.members.filter((m) => m.id !== id) })),
      changeRole: (id, role) =>
        set((state) => ({
          members: state.members.map((m) => (m.id === id ? { ...m, role } : m)),
        })),
      assignProject: (memberId, projectId) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId && !m.projectIds.includes(projectId)
              ? { ...m, projectIds: [...m.projectIds, projectId] }
              : m
          ),
        })),
      unassignProject: (memberId, projectId) =>
        set((state) => ({
          members: state.members.map((m) =>
            m.id === memberId
              ? { ...m, projectIds: m.projectIds.filter((p) => p !== projectId) }
              : m
          ),
        })),
      reset: (members) => set({ members }),
    }),
    { name: "team-storage", partialize: (s) => ({ members: s.members }) }
  )
);
