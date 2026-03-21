import { create } from "zustand";
import type { Project, Task, TaskStatus } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

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
    const [projects, tasks] = await Promise.all([
      dbLoadAll<Project>("projects"),
      dbLoadAll<Task>("tasks"),
    ]);
    set({ projects, tasks });
  },

  reset: (projects, tasks) => {
    set({ projects, tasks, selectedProjectId: null });
    projects.forEach((p) => dbUpsert("projects", p.id, p));
    tasks.forEach((t) => dbUpsert("tasks", t.id, t));
  },

  setSelectedProject: (id) => set({ selectedProjectId: id }),

  addProject: (project) => {
    set((s) => ({ projects: [...s.projects, project] }));
    dbUpsert("projects", project.id, project);
  },

  updateProject: (id, data) =>
    set((s) => {
      const projects = s.projects.map((p) => (p.id === id ? { ...p, ...data } : p));
      const updated = projects.find((p) => p.id === id);
      if (updated) dbUpsert("projects", id, updated);
      return { projects };
    }),

  deleteProject: (id) => {
    set((s) => {
      s.tasks.filter((t) => t.projectId === id).forEach((t) => dbDelete("tasks", t.id));
      dbDelete("projects", id);
      return {
        projects: s.projects.filter((p) => p.id !== id),
        tasks: s.tasks.filter((t) => t.projectId !== id),
      };
    });
  },

  addTask: (task) => {
    set((s) => ({ tasks: [...s.tasks, task] }));
    dbUpsert("tasks", task.id, task);
  },

  updateTask: (id, data) =>
    set((s) => {
      const tasks = s.tasks.map((t) => (t.id === id ? { ...t, ...data } : t));
      const updated = tasks.find((t) => t.id === id);
      if (updated) dbUpsert("tasks", id, updated);
      return { tasks };
    }),

  moveTask: (taskId, newStatus) =>
    set((s) => {
      const tasks = s.tasks.map((t) => (t.id === taskId ? { ...t, status: newStatus } : t));
      const updated = tasks.find((t) => t.id === taskId);
      if (updated) dbUpsert("tasks", taskId, updated);
      return { tasks };
    }),

  deleteTask: (id) => {
    set((s) => ({ tasks: s.tasks.filter((t) => t.id !== id) }));
    dbDelete("tasks", id);
  },

  getProjectTasks: (projectId) => get().tasks.filter((t) => t.projectId === projectId),
}));
