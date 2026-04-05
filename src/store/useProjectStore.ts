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
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => void;
  addTask: (task: Task) => void;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
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
    set({ projects: _syncProgress(tasks, projects), tasks });
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

  updateProject: async (id, patch) => {
    const current = get().projects;
    // Optimistic update
    set({ projects: current.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    const updated = await updateProject(id, patch, current);
    if (updated) set((s) => ({ projects: s.projects.map((p) => (p.id === id ? updated : p)) }));
  },

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

  updateTask: async (id, patch) => {
    const current = get().tasks;
    set({ tasks: current.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    const updated = await updateTask(id, patch, current);
    if (updated) {
      set((s) => {
        const tasks = s.tasks.map((t) => (t.id === id ? updated : t));
        const projects = _syncProgress(tasks, s.projects);
        return { tasks, projects };
      });
    } else {
      set((s) => ({ projects: _syncProgress(s.tasks, s.projects) }));
    }
  },

  moveTask: (taskId, newStatus) =>
    set((s) => {
      const tasks = s.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
      moveTask(taskId, newStatus, s.tasks).then((updated) => {
        if (updated) set((s2) => ({ tasks: s2.tasks.map((t) => (t.id === taskId ? updated : t)) }));
      });
      return { tasks, projects: _syncProgress(tasks, s.projects) };
    }),

  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    deleteTask(id);
  },

  getProjectTasks: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
}));

// Tüm projelerin progress değerini görevlere göre hesaplar
function _syncProgress(tasks: import("@/types").Task[], projects: import("@/types").Project[]): import("@/types").Project[] {
  return projects.map((p) => {
    const pt = tasks.filter((t) => t.projectId === p.id);
    if (pt.length === 0) return p;
    const done = pt.filter((t) => t.status === "done").length;
    const progress = Math.round((done / pt.length) * 100);
    return progress !== p.progress ? { ...p, progress } : p;
  });
}
