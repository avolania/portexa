import { create } from "zustand";
import { persist } from "zustand/middleware";
import type { Project, Task, TaskStatus } from "@/types";

interface ProjectState {
  projects: Project[];
  tasks: Task[];
  selectedProjectId: string | null;
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

export const useProjectStore = create<ProjectState>()(
  persist(
    (set, get) => ({
  projects: [],
  tasks: [],
  selectedProjectId: null,
  reset: (projects, tasks) => set({ projects, tasks, selectedProjectId: null }),
  setSelectedProject: (id) => set({ selectedProjectId: id }),
  addProject: (project) =>
    set((state) => ({ projects: [...state.projects, project] })),
  updateProject: (id, data) =>
    set((state) => ({
      projects: state.projects.map((p) => (p.id === id ? { ...p, ...data } : p)),
    })),
  deleteProject: (id) =>
    set((state) => ({
      projects: state.projects.filter((p) => p.id !== id),
    })),
  addTask: (task) =>
    set((state) => ({ tasks: [...state.tasks, task] })),
  updateTask: (id, data) =>
    set((state) => ({
      tasks: state.tasks.map((t) => (t.id === id ? { ...t, ...data } : t)),
    })),
  moveTask: (taskId, newStatus) =>
    set((state) => ({
      tasks: state.tasks.map((t) =>
        t.id === taskId ? { ...t, status: newStatus } : t
      ),
    })),
  deleteTask: (id) =>
    set((state) => ({ tasks: state.tasks.filter((t) => t.id !== id) })),
  getProjectTasks: (projectId) =>
    get().tasks.filter((t) => t.projectId === projectId),
    }),
    {
      name: "project-storage",
      skipHydration: true,
      partialize: (state) => ({
        projects: state.projects,
        tasks: state.tasks,
        selectedProjectId: state.selectedProjectId,
      }),
    }
  )
);
