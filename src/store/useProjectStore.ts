import { create } from "zustand";
import type { Project, Task, TaskStatus } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadProjects,
  createProject,
  updateProject,
  deleteProject,
  createTask,
  updateTask,
  moveTask,
  deleteTask,
  resetProjectsAndTasks,
} from "@/services/projectService";

interface ProjectState {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string | null;
  load: () => Promise<void>;
  reset: (projects: Project[], tasks: Task[]) => void;
  setSelectedProject: (id: string | null) => void;
  addProject: (project: Project) => void;
  updateProject: (id: string, data: Partial<Project>) => void;
  deleteProject: (id: string) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => void;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  deleteTask: (id: string) => void;
  getProjectTasks: (projectId: string) => Task[];
}

export const useProjectStore = create<ProjectState>()((set, get) => ({
  projects: [],
  tasks: [],
  selectedProjectId: null,

  load: async () => {
    const { projects, tasks } = await loadProjects();
    set({ projects, tasks });
  },

  reset: (projects, tasks) => {
    set({ projects, tasks, selectedProjectId: null });
    resetProjectsAndTasks(projects, tasks);
  },

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  addProject: (project) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ projects: [...s.projects, project] }));
    createProject(project, orgId);
  },

  updateProject: (id, patch) =>
    set((s) => {
      updateProject(id, patch, s.projects).then((updated) => {
        if (updated) set((s2) => ({ projects: s2.projects.map((p) => (p.id === id ? updated : p)) }));
      });
      // Optimistic: apply patch immediately in UI
      return { projects: s.projects.map((p) => (p.id === id ? { ...p, ...patch } : p)) };
    }),

  deleteProject: (id) => {
    const { tasks } = get();
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks: s.tasks.filter((t) => t.projectId !== id),
    }));
    deleteProject(id, tasks);
  },

  addTask: (task) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ tasks: [...s.tasks, task] }));
    createTask(task, orgId);
  },

  updateTask: (id, patch) =>
    set((s) => {
      updateTask(id, patch, s.tasks).then((updated) => {
        if (updated) set((s2) => ({ tasks: s2.tasks.map((t) => (t.id === id ? updated : t)) }));
      });
      return { tasks: s.tasks.map((t) => (t.id === id ? { ...t, ...patch } : t)) };
    }),

  moveTask: (taskId, newStatus) =>
    set((s) => {
      moveTask(taskId, newStatus, s.tasks).then((updated) => {
        if (updated) set((s2) => ({ tasks: s2.tasks.map((t) => (t.id === taskId ? updated : t)) }));
      });
      return { tasks: s.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t)) };
    }),

  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    deleteTask(id);
  },

  getProjectTasks: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
}));
