import { dbLoadFiltered, dbUpsert, dbDelete, dbUploadFile, dbGetFileUrl, dbLoadOne, dbInsertNote, dbInsertEvent } from '@/lib/db';
import type { Attachment } from '@/types';
const uuid = () => crypto.randomUUID();

function riskToUrgency(risk: ChangeRisk): Urgency {
  if (risk === ChangeRisk.CRITICAL || risk === ChangeRisk.HIGH) return Urgency.HIGH;
  if (risk === ChangeRisk.MODERATE) return Urgency.MEDIUM;
  return Urgency.LOW;
}
import { calculatePriority } from '@/lib/itsm/types/interfaces';
import { generateTicketNumber } from '@/lib/itsm/utils/ticket-number';
import { ApprovalState, ChangeRequestState, ChangeRisk, TicketEventType, Urgency } from '@/lib/itsm/types/enums';
import type {
  ChangeRequest,
  CreateChangeRequestDto,
  UpdateChangeRequestDto,
  CloseChangeRequestDto,
  ApproveChangeRequestDto,
  RejectChangeRequestDto,
  AddWorkNoteDto,
  AddCommentDto,
  LinkIncidentDto,
  ChangeRequestFilters,
} from '@/lib/itsm/types/change-request.types';
import { isValidCRTransition } from '@/lib/itsm/types/change-request.types';
import type { ApproverEntry } from '@/lib/itsm/types/interfaces';

const TABLE = 'itsm_change_requests';

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadChangeRequests(filters?: ChangeRequestFilters, orgId?: string): Promise<ChangeRequest[]> {
  // P7: Kapalı CR'ları varsayılan dışla
  const includesClosed = filters?.state?.includes(ChangeRequestState.CLOSED) ?? false;

  const scalarFilters: Record<string, string> = {};
  if (filters?.assignedToId)   scalarFilters['assignedToId']   = filters.assignedToId;
  if (filters?.requestedById)  scalarFilters['requestedById']  = filters.requestedById;
  if (filters?.changeManagerId) scalarFilters['changeManagerId'] = filters.changeManagerId;

  const all = await dbLoadFiltered<ChangeRequest>(TABLE, orgId ?? '', {
    excludeStates: includesClosed ? [] : [ChangeRequestState.CLOSED],
    scalarFilters,
  });

  if (!filters) return all;

  return all.filter((cr) => {
    if (filters.state?.length      && !filters.state.includes(cr.state))           return false;
    if (filters.type?.length       && !filters.type.includes(cr.type))             return false;
    if (filters.risk?.length       && !filters.risk.includes(cr.risk))             return false;
    if (filters.priority?.length   && !filters.priority.includes(cr.priority))     return false;
    if (filters.approvalState      && cr.approvalState !== filters.approvalState)  return false;
    if (filters.plannedStartAfter  && cr.plannedStartDate < filters.plannedStartAfter)  return false;
    if (filters.plannedStartBefore && cr.plannedStartDate > filters.plannedStartBefore) return false;
    if (filters.createdAfter       && cr.createdAt < filters.createdAfter)         return false;
    if (filters.createdBefore      && cr.createdAt > filters.createdBefore)        return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!cr.shortDescription.toLowerCase().includes(q) && !cr.number.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export async function loadChangeRequestById(id: string): Promise<ChangeRequest | null> {
  return dbLoadOne<ChangeRequest>(TABLE, id);
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createChangeRequest(
  dto: CreateChangeRequestDto,
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<ChangeRequest> {
  const now    = new Date().toISOString();
  const id     = uuid();
  const number = await generateTicketNumber('CHG', orgId);
  const priority = calculatePriority(dto.impact, riskToUrgency(dto.risk));

  const cr: ChangeRequest = {
    id,
    number,
    type:        dto.type,
    category:    dto.category,
    subcategory: dto.subcategory,
    sapCategory: dto.sapCategory,
    sapModule:   dto.sapModule,
    risk:        dto.risk,
    impact:      dto.impact,
    priority,
    state:       ChangeRequestState.PENDING_APPROVAL,
    requestedById:  dto.requestedById,
    changeManagerId: dto.changeManagerId,
    assignedToId:    dto.assignedToId,
    assignmentGroupId: dto.assignmentGroupId,
    shortDescription: dto.shortDescription,
    description:      dto.description,
    justification:    dto.justification,
    plannedStartDate: dto.plannedStartDate,
    plannedEndDate:   dto.plannedEndDate,
    implementationPlan: dto.implementationPlan,
    backoutPlan:  dto.backoutPlan,
    testPlan:     dto.testPlan,
    approvalState: ApprovalState.REQUESTED,
    approvers:    [],
    attachments:  [],
    relatedIncidentIds: dto.relatedIncidentIds ?? [],
    createdAt: now,
    updatedAt: now,
  };

  const eventWrites: Promise<void>[] = [
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.CREATED, actorId, actorName, timestamp: now }),
  ];
  if (dto.sourceIncidentNumber) {
    eventWrites.push(dbInsertEvent(id, 'change-request', orgId, {
      id: uuid(), type: TicketEventType.CONVERTED_FROM_INCIDENT,
      actorId, actorName, timestamp: now,
      note: `${dto.sourceIncidentNumber} numaralı incident'tan dönüştürüldü`,
      newValue: dto.sourceIncidentNumber,
    }));
  }

  await Promise.all([dbUpsert(TABLE, id, cr, orgId), ...eventWrites]);
  return cr;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateChangeRequest(
  id: string,
  dto: UpdateChangeRequestDto,
  current: ChangeRequest[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();

  // Recalculate priority if risk or impact changed
  let priority = existing.priority;
  if (dto.risk !== undefined || dto.impact !== undefined) {
    const newRisk   = dto.risk   ?? existing.risk;
    const newImpact = dto.impact ?? existing.impact;
    priority = calculatePriority(newImpact, riskToUrgency(newRisk));
  }

  const updated: ChangeRequest = {
    ...existing,
    ...dto,
    priority,
    updatedAt: now,
  };
  await Promise.all([
    dbUpsert(TABLE, id, updated, orgId),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.UPDATED, actorId, actorName, timestamp: now }),
  ]);
  return updated;
}

// ─── State transitions ────────────────────────────────────────────────────────

export async function changeRequestStateTransition(
  id: string,
  toState: ChangeRequestState,
  current: ChangeRequest[],
  actorId: string,
  actorName: string,
  orgId: string,
  note?: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  if (!isValidCRTransition(existing.state, toState)) {
    console.warn(`[change-request] invalid transition ${existing.state} → ${toState}`);
    return null;
  }

  const now = new Date().toISOString();

  // Request approval when moving to PENDING_APPROVAL
  const approvalState = toState === ChangeRequestState.PENDING_APPROVAL
    ? ApprovalState.REQUESTED
    : existing.approvalState;

  const updated: ChangeRequest = {
    ...existing,
    state:         toState,
    approvalState,
    updatedAt: now,
  };

  await Promise.all([
    dbUpsert(TABLE, id, updated, orgId),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId, actorName, previousValue: existing.state, newValue: toState, note, timestamp: now }),
  ]);
  return updated;
}

// ─── Approve / Reject ─────────────────────────────────────────────────────────

export async function approveChangeRequest(
  id: string,
  dto: ApproveChangeRequestDto,
  current: ChangeRequest[],
  approverId: string,
  approverName: string,
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  if (existing.state !== ChangeRequestState.PENDING_APPROVAL) return null;

  const now = new Date().toISOString();
  const entry: ApproverEntry = {
    approverId, approverName,
    approvalState: ApprovalState.APPROVED,
    decidedAt: now,
    comments: dto.comments,
  };

  const updated: ChangeRequest = {
    ...existing,
    approvalState: ApprovalState.APPROVED,
    approvers: [...existing.approvers, entry],
    updatedAt: now,
  };

  await Promise.all([
    dbUpsert(TABLE, id, updated, orgId),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId: approverId, actorName: approverName, newValue: 'approved', timestamp: now }),
  ]);
  return updated;
}

export async function rejectChangeRequest(
  id: string,
  dto: RejectChangeRequestDto,
  current: ChangeRequest[],
  approverId: string,
  approverName: string,
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  if (existing.state !== ChangeRequestState.PENDING_APPROVAL) return null;

  const now = new Date().toISOString();
  const entry: ApproverEntry = {
    approverId, approverName,
    approvalState: ApprovalState.REJECTED,
    decidedAt: now,
    comments: dto.comments,
  };

  const updated: ChangeRequest = {
    ...existing,
    approvalState: ApprovalState.REJECTED,
    approvers:     [...existing.approvers, entry],
    state:         ChangeRequestState.PENDING_APPROVAL,
    updatedAt: now,
  };

  await Promise.all([
    dbUpsert(TABLE, id, updated, orgId),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId: approverId, actorName: approverName, previousValue: existing.state, newValue: ChangeRequestState.PENDING_APPROVAL, note: dto.comments, timestamp: now }),
  ]);
  return updated;
}

// ─── Close ────────────────────────────────────────────────────────────────────

export async function closeChangeRequest(
  id: string,
  dto: CloseChangeRequestDto,
  current: ChangeRequest[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  if (!isValidCRTransition(existing.state, ChangeRequestState.CLOSED)) return null;

  const now = new Date().toISOString();
  const updated: ChangeRequest = {
    ...existing,
    state:            ChangeRequestState.CLOSED,
    closeCode:        dto.closeCode,
    closureNotes:     dto.closureNotes,
    actualStartDate:  dto.actualStartDate,
    actualEndDate:    dto.actualEndDate,
    closedAt:         now,
    updatedAt: now,
  };

  await Promise.all([
    dbUpsert(TABLE, id, updated, orgId),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.CLOSED, actorId, actorName, timestamp: now }),
  ]);
  return updated;
}

// ─── Notes & comments ─────────────────────────────────────────────────────────

export async function addCRWorkNote(
  id: string,
  dto: AddWorkNoteDto,
  _current: unknown,
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<import('@/lib/itsm/types/interfaces').WorkNote> {
  const now = new Date().toISOString();
  const note = { id: uuid(), authorId: actorId, authorName: actorName, content: dto.content, createdAt: now };
  await Promise.all([
    dbInsertNote(id, 'change-request', 'work_note', orgId, note),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.WORK_NOTE_ADDED, actorId, actorName, timestamp: now }),
  ]);
  return note;
}

export async function addCRComment(
  id: string,
  dto: AddCommentDto,
  _current: unknown,
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<import('@/lib/itsm/types/interfaces').TicketComment> {
  const now = new Date().toISOString();
  const comment = { id: uuid(), authorId: actorId, authorName: actorName, content: dto.content, createdAt: now };
  await Promise.all([
    dbInsertNote(id, 'change-request', 'comment', orgId, comment),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.COMMENT_ADDED, actorId, actorName, timestamp: now }),
  ]);
  return comment;
}

// ─── Link incident ────────────────────────────────────────────────────────────

export async function linkIncidentToCR(
  id: string,
  dto: LinkIncidentDto,
  current: ChangeRequest[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  if (existing.relatedIncidentIds.includes(dto.incidentId)) return existing;

  const now = new Date().toISOString();
  const updated: ChangeRequest = {
    ...existing,
    relatedIncidentIds: [...existing.relatedIncidentIds, dto.incidentId],
    updatedAt: now,
  };
  await Promise.all([
    dbUpsert(TABLE, id, updated, orgId),
    dbInsertEvent(id, 'change-request', orgId, { id: uuid(), type: TicketEventType.RELATED_INCIDENT_LINKED, actorId, actorName, newValue: dto.incidentId, timestamp: now }),
  ]);
  return updated;
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function addChangeRequestAttachment(
  id: string,
  file: File,
  uploadedBy: string,
  current: ChangeRequest[],
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  const fileId = uuid();
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const path = `itsm/${id}/${fileId}${ext ? '.' + ext : ''}`;
  await dbUploadFile(orgId, path, file);
  const url = await dbGetFileUrl(orgId, path);
  const attachment: Attachment = {
    id: fileId,
    name: file.name,
    url,
    size: file.size,
    type: file.type || 'application/octet-stream',
    uploadedBy,
    uploadedAt: new Date().toISOString(),
  };
  const now = new Date().toISOString();
  const updated: ChangeRequest = {
    ...existing,
    attachments: [...(existing.attachments ?? []), attachment],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

export async function removeChangeRequestAttachment(
  id: string,
  attachmentId: string,
  current: ChangeRequest[],
  orgId: string,
): Promise<ChangeRequest | null> {
  const existing = current.find((cr) => cr.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: ChangeRequest = {
    ...existing,
    attachments: (existing.attachments ?? []).filter((a) => a.id !== attachmentId),
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteChangeRequest(id: string): Promise<void> {
  await dbDelete(TABLE, id);
}
