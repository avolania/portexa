import type { WorkflowRequest, RequestStatus, WorkflowStepHistoryEntry } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete } from "@/lib/db";

export async function loadRequests(): Promise<WorkflowRequest[]> {
  return dbLoadAll<WorkflowRequest>("workflow_requests");
}

export async function createRequest(r: WorkflowRequest, orgId: string): Promise<void> {
  await dbUpsert("workflow_requests", r.id, r, orgId);
}

export async function updateRequest(
  id: string,
  patch: Partial<WorkflowRequest>,
  current: WorkflowRequest[]
): Promise<WorkflowRequest | null> {
  const existing = current.find((r) => r.id === id);
  if (!existing) return null;
  const updated: WorkflowRequest = {
    ...existing,
    ...patch,
    updatedAt: new Date().toISOString(),
  };
  await dbUpsert("workflow_requests", id, updated);
  return updated;
}

export async function deleteRequest(id: string): Promise<void> {
  await dbDelete("workflow_requests", id);
}

export async function reviewRequest(
  id: string,
  status: "approved" | "rejected",
  reviewedBy: string,
  current: WorkflowRequest[],
  note?: string
): Promise<WorkflowRequest | null> {
  const now = new Date().toISOString();
  return updateRequest(
    id,
    { status, reviewedBy, reviewedAt: now, reviewNote: note },
    current
  );
}

export async function advanceRequestStep(
  id: string,
  entry: WorkflowStepHistoryEntry,
  isLastStep: boolean,
  current: WorkflowRequest[]
): Promise<WorkflowRequest | null> {
  const existing = current.find((r) => r.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const history = [...(existing.stepHistory ?? []), entry];
  const currentIdx = existing.currentStepIndex ?? 0;

  let status: RequestStatus = existing.status;
  let nextIdx = currentIdx;

  if (entry.action === "rejected") {
    status = "rejected";
  } else if (isLastStep) {
    status = "approved";
  } else {
    status = "in_review";
    nextIdx = currentIdx + 1;
  }

  const updated: WorkflowRequest = {
    ...existing,
    status,
    stepHistory: history,
    currentStepIndex: nextIdx,
    reviewedBy: entry.actorId,
    reviewedAt: now,
    reviewNote: entry.note,
    updatedAt: now,
  };

  await dbUpsert("workflow_requests", id, updated);
  return updated;
}
