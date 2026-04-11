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
  /** Demo-only: fire-and-forget by design. DB errors are non-critical; UI shows the new data immediately. */
  reset: (projects: Project[], tasks: Task[]) => void;
  setSelectedProject: (id: string | null) => void;
  addProject: (project: Project) => Promise<void>;
  updateProject: (id: string, data: Partial<Project>) => Promise<void>;
  deleteProject: (id: string) => Promise<void>;
  addTask: (task: Task) => Promise<void>;
  updateTask: (id: string, data: Partial<Task>) => Promise<void>;
  moveTask: (taskId: string, newStatus: TaskStatus) => void;
  deleteTask: (id: string) => Promise<void>;
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
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set({ projects, tasks, selectedProjectId: null });
    resetProjectsAndTasks(projects, tasks, orgId);
  },

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  addProject: async (project) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ projects: [...s.projects, project] }));
    try {
      await createProject(project, orgId);
    } catch (err) {
      set((s) => ({ projects: s.projects.filter((p) => p.id !== project.id) }));
      throw err;
    }
  },

  updateProject: async (id, patch) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    const current = get().projects;
    set({ projects: current.map((p) => (p.id === id ? { ...p, ...patch } : p)) });
    try {
      const updated = await updateProject(id, patch, current, orgId);
      if (updated) set((s) => ({ projects: s.projects.map((p) => (p.id === id ? updated : p)) }));
    } catch (err) {
      const original = current.find((p) => p.id === id);
      set((s) => ({ projects: s.projects.map((p) => (p.id === id ? (original ?? p) : p)) }));
      throw err;
    }
  },

  deleteProject: async (id) => {
    const { projects, tasks } = get();
    const rollbackProject = projects.find((p) => p.id === id);
    const rollbackTasks   = tasks.filter((t) => t.projectId === id);
    set((s) => ({
      projects: s.projects.filter((p) => p.id !== id),
      tasks:    s.tasks.filter((t) => t.projectId !== id),
    }));
    try {
      await deleteProject(id, tasks);
    } catch (err) {
      set((s) => ({
        projects: rollbackProject ? [...s.projects, rollbackProject] : s.projects,
        tasks:    [...s.tasks, ...rollbackTasks],
      }));
      throw err;
    }
  },

  addTask: async (task) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ tasks: [...s.tasks, task] }));
    try {
      await createTask(task, orgId);
    } catch (err) {
      set((s) => ({ tasks: s.tasks.filter((t) => t.id !== task.id) }));
      throw err;
    }
  },

  updateTask: async (id, patch) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    const current = get().tasks;
    const projectId = current.find((t) => t.id === id)?.projectId;
    set({ tasks: current.map((t) => (t.id === id ? { ...t, ...patch } : t)) });
    try {
      const updated = await updateTask(id, patch, current, orgId);
      if (updated) {
        set((s) => {
          const tasks = s.tasks.map((t) => (t.id === id ? updated : t));
          const projects = projectId ? _syncOneProject(tasks, s.projects, projectId) : s.projects;
          return { tasks, projects };
        });
      } else if (projectId) {
        set((s) => ({ projects: _syncOneProject(s.tasks, s.projects, projectId) }));
      }
    } catch (err) {
      const original = current.find((t) => t.id === id);
      set((s) => {
        const tasks = s.tasks.map((t) => (t.id === id ? (original ?? t) : t));
        const projects = projectId ? _syncOneProject(tasks, s.projects, projectId) : s.projects;
        return { tasks, projects };
      });
      throw err;
    }
  },

  moveTask: (taskId, newStatus) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    const rollbackTasks    = get().tasks;
    const rollbackProjects = get().projects;
    const projectId = rollbackTasks.find((t) => t.id === taskId)?.projectId;
    set((s) => {
      const tasks = s.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
      moveTask(taskId, newStatus, rollbackTasks, orgId)
        .then((updated) => {
          if (updated) set((s2) => ({ tasks: s2.tasks.map((t) => (t.id === taskId ? updated : t)) }));
        })
        .catch(() => {
          const projects = projectId
            ? _syncOneProject(rollbackTasks, rollbackProjects, projectId)
            : _syncProgress(rollbackTasks, rollbackProjects);
          set({ tasks: rollbackTasks, projects });
        });
      const projects = projectId
        ? _syncOneProject(tasks, s.projects, projectId)
        : _syncProgress(tasks, s.projects);
      return { tasks, projects };
    });
  },

  deleteTask: async (id) => {
    const rollback = get().tasks.find((t) => t.id === id);
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    try {
      await deleteTask(id);
    } catch (err) {
      if (rollback) set((s) => ({ tasks: [...s.tasks, rollback] }));
      throw err;
    }
  },

  getProjectTasks: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
}));

// Tüm projelerin progress değerini görevlere göre hesaplar (load / deleteProject)
function _syncProgress(tasks: import("@/types").Task[], projects: import("@/types").Project[]): import("@/types").Project[] {
  return projects.map((p) => _calcProgress(tasks, p));
}

// Tek bir projenin progress değerini günceller (updateTask / moveTask)
function _syncOneProject(tasks: import("@/types").Task[], projects: import("@/types").Project[], projectId: string): import("@/types").Project[] {
  return projects.map((p) => (p.id === projectId ? _calcProgress(tasks, p) : p));
}

function _calcProgress(tasks: import("@/types").Task[], project: import("@/types").Project): import("@/types").Project {
  const pt = tasks.filter((t) => t.projectId === project.id);
  if (pt.length === 0) return project;
  const done = pt.filter((t) => t.status === "done").length;
  const progress = Math.round((done / pt.length) * 100);
  return progress !== project.progress ? { ...project, progress } : project;
}
