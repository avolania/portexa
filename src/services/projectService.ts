import type { Project, Task, TaskStatus } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

// ─── Load ──────────────────────────────────────────────────────────────────────

export async function loadProjects(): Promise<{ projects: Project[]; tasks: Task[] }> {
  const [projects, tasks] = await Promise.all([
    dbLoadAll<Project>("projects"),
    dbLoadAll<Task>("tasks"),
  ]);
  return { projects, tasks };
}

// ─── Project CRUD ──────────────────────────────────────────────────────────────

export async function createProject(project: Project, orgId: string): Promise<void> {
  await dbUpsert("projects", project.id, project, orgId);
}

export async function updateProject(
  id: string,
  patch: Partial<Project>,
  current: Project[]
): Promise<Project | null> {
  const existing = current.find((p) => p.id === id);
  if (!existing) return null;
  const updated: Project = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await dbUpsert("projects", id, updated);
  return updated;
}

export async function deleteProject(id: string, tasks: Task[]): Promise<void> {
  const relatedTasks = tasks.filter((t) => t.projectId === id);
  await Promise.all([
    ...relatedTasks.map((t) => dbDelete("tasks", t.id)),
    dbDelete("projects", id),
  ]);
}

// ─── Task CRUD ─────────────────────────────────────────────────────────────────

export async function createTask(task: Task, orgId: string): Promise<void> {
  await dbUpsert("tasks", task.id, task, orgId);
}

export async function updateTask(
  id: string,
  patch: Partial<Task>,
  current: Task[]
): Promise<Task | null> {
  const existing = current.find((t) => t.id === id);
  if (!existing) return null;
  const updated: Task = { ...existing, ...patch, updatedAt: new Date().toISOString() };
  await dbUpsert("tasks", id, updated);
  return updated;
}

export async function moveTask(
  taskId: string,
  newStatus: TaskStatus,
  current: Task[]
): Promise<Task | null> {
  return updateTask(taskId, { status: newStatus }, current);
}

export async function deleteTask(id: string): Promise<void> {
  await dbDelete("tasks", id);
}

// ─── Bulk reset (demo data) ────────────────────────────────────────────────────

export async function resetProjectsAndTasks(projects: Project[], tasks: Task[]): Promise<void> {
  await Promise.all([
    ...projects.map((p) => dbUpsert("projects", p.id, p)),
    ...tasks.map((t) => dbUpsert("tasks", t.id, t)),
  ]);
}
