import type { WorkflowTemplate } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

export async function loadWorkflowTemplates(): Promise<WorkflowTemplate[]> {
  return dbLoadAll<WorkflowTemplate>("workflow_templates");
}

export async function createWorkflowTemplate(template: WorkflowTemplate, orgId: string): Promise<void> {
  await dbUpsert("workflow_templates", template.id, template, orgId);
}

export async function updateWorkflowTemplate(
  id: string,
  patch: Partial<WorkflowTemplate>,
  current: WorkflowTemplate[]
): Promise<WorkflowTemplate | null> {
  const existing = current.find((t) => t.id === id);
  if (!existing) return null;
  const updated: WorkflowTemplate = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await dbUpsert("workflow_templates", id, updated);
  return updated;
}

export async function deleteWorkflowTemplate(id: string): Promise<void> {
  await dbDelete("workflow_templates", id);
}
