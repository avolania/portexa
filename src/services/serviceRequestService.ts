import { dbLoadAll, dbUpsert, dbDelete, dbUploadFile, dbGetFileUrl } from '@/lib/db';
import type { Attachment } from '@/types';
const uuid = () => crypto.randomUUID();
import { createServiceRequestSLA, checkSRSLABreach } from '@/lib/itsm/utils/sla.engine';
import { generateTicketNumber } from '@/lib/itsm/utils/ticket-number';
import { calculatePriority } from '@/lib/itsm/types/interfaces';
import { ApprovalState, ServiceRequestState, TicketEventType, Priority } from '@/lib/itsm/types/enums';
import type {
  ServiceRequest,
  CreateServiceRequestDto,
  UpdateServiceRequestDto,
  FulfillServiceRequestDto,
  ApproveServiceRequestDto,
  RejectServiceRequestDto,
  AddWorkNoteDto,
  AddCommentDto,
  ServiceRequestFilters,
  ServiceRequestClosureCode,
  ServiceRequestPriority,
} from '@/lib/itsm/types/service-request.types';
import { isValidSRTransition } from '@/lib/itsm/types/service-request.types';
import type { ApproverEntry, TicketEvent } from '@/lib/itsm/types/interfaces';

const TABLE = 'itsm_service_requests';

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadServiceRequests(filters?: ServiceRequestFilters): Promise<ServiceRequest[]> {
  const all = await dbLoadAll<ServiceRequest>(TABLE);
  if (!filters) return all;

  return all.filter((sr) => {
    if (filters.state?.length       && !filters.state.includes(sr.state))              return false;
    if (filters.priority?.length    && !filters.priority.includes(sr.priority))            return false;
    if (filters.requestedForId      && sr.requestedForId !== filters.requestedForId)    return false;
    if (filters.requestedById       && sr.requestedById  !== filters.requestedById)     return false;
    if (filters.assignedToId        && sr.assignedToId   !== filters.assignedToId)      return false;
    if (filters.approvalState       && sr.approvalState  !== filters.approvalState)     return false;
    if (filters.slaBreached         && !sr.sla.slaBreached)                             return false;
    if (filters.createdAfter        && sr.createdAt < filters.createdAfter)             return false;
    if (filters.createdBefore       && sr.createdAt > filters.createdBefore)            return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!sr.shortDescription.toLowerCase().includes(q) && !sr.number.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export async function loadServiceRequestById(id: string): Promise<ServiceRequest | null> {
  const all = await dbLoadAll<ServiceRequest>(TABLE);
  return all.find((sr) => sr.id === id) ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createServiceRequest(
  dto: CreateServiceRequestDto,
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<ServiceRequest> {
  const now    = new Date().toISOString();
  const id     = uuid();
  const number = await generateTicketNumber('REQ');

  const rawPriority = calculatePriority(dto.impact, dto.urgency);
  // Service requests never get CRITICAL priority — cap at HIGH
  const priority = rawPriority === Priority.CRITICAL ? Priority.HIGH : rawPriority;

  const sla = createServiceRequestSLA(now, priority);

  const sr: ServiceRequest = {
    id,
    number,
    requestType:   dto.requestType,
    category:      dto.category,
    subcategory:   dto.subcategory,
    sapCategory:   dto.sapCategory,
    sapModule:     dto.sapModule,
    impact:        dto.impact,
    urgency:       dto.urgency,
    priority:      priority as ServiceRequest['priority'],
    state:         ServiceRequestState.DRAFT,
    requestedForId: dto.requestedForId,
    requestedById:  dto.requestedById,
    assignedToId:   dto.assignedToId,
    assignmentGroupId: dto.assignmentGroupId,
    shortDescription: dto.shortDescription,
    description:   dto.description,
    justification: dto.justification,
    approvalRequired: dto.approvalRequired ?? false,
    approvalState:    ApprovalState.NOT_REQUESTED,
    approvers:     [],
    workNotes:     [],
    comments:      [],
    attachments:   [],
    sla,
    timeline:      [
      { id: uuid(), type: TicketEventType.CREATED, actorId, actorName, timestamp: now },
      ...(dto.sourceIncidentNumber ? [{
        id: uuid(), type: TicketEventType.CONVERTED_FROM_INCIDENT,
        actorId, actorName, timestamp: now,
        note: `${dto.sourceIncidentNumber} numaralı incident'tan dönüştürüldü`,
        newValue: dto.sourceIncidentNumber,
      }] : []),
    ],
    createdAt: now,
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, sr, orgId);
  return sr;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateServiceRequest(
  id: string,
  dto: UpdateServiceRequestDto,
  current: ServiceRequest[],
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const events: TicketEvent[] = [];

  // Recalculate priority if impact/urgency changed
  let priority = existing.priority;
  if (dto.impact || dto.urgency) {
    const newImpact  = dto.impact  ?? existing.impact;
    const newUrgency = dto.urgency ?? existing.urgency;
    const newPriority = calculatePriority(newImpact, newUrgency) as ServiceRequestPriority;
    if (newPriority !== existing.priority) {
      priority = newPriority;
      events.push({
        id: uuid(), type: TicketEventType.PRIORITY_CHANGED,
        actorId, actorName,
        previousValue: existing.priority, newValue: newPriority,
        timestamp: now,
      });
    }
  }

  // Generic update event
  events.push({
    id: uuid(), type: TicketEventType.STATE_CHANGED,
    actorId, actorName,
    note: 'Ticket güncellendi',
    timestamp: now,
  });

  const updated: ServiceRequest = {
    ...existing,
    ...dto,
    priority,
    timeline: [...existing.timeline, ...events],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Submit ───────────────────────────────────────────────────────────────────

export async function submitServiceRequest(
  id: string,
  current: ServiceRequest[],
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const nextState = existing.approvalRequired
    ? ServiceRequestState.PENDING_APPROVAL
    : ServiceRequestState.SUBMITTED;
  if (!isValidSRTransition(existing.state, nextState)) return null;

  const updated: ServiceRequest = {
    ...existing,
    state: nextState,
    approvalState: existing.approvalRequired ? ApprovalState.REQUESTED : ApprovalState.NOT_REQUESTED,
    timeline: [
      ...existing.timeline,
      { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId, actorName, previousValue: existing.state, newValue: nextState, timestamp: now },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Approve ──────────────────────────────────────────────────────────────────

export async function approveServiceRequest(
  id: string,
  dto: ApproveServiceRequestDto,
  current: ServiceRequest[],
  approverId: string,
  approverName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const approverEntry: ApproverEntry = {
    approverId, approverName,
    approvalState: ApprovalState.APPROVED,
    decidedAt: now,
    comments: dto.comments,
  };

  const updated: ServiceRequest = {
    ...existing,
    state:         ServiceRequestState.APPROVED,
    approvalState: ApprovalState.APPROVED,
    approvers:     [...existing.approvers, approverEntry],
    timeline: [
      ...existing.timeline,
      { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId: approverId, actorName: approverName, previousValue: existing.state, newValue: ServiceRequestState.APPROVED, timestamp: now },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Reject ───────────────────────────────────────────────────────────────────

export async function rejectServiceRequest(
  id: string,
  dto: RejectServiceRequestDto,
  current: ServiceRequest[],
  approverId: string,
  approverName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const approverEntry: ApproverEntry = {
    approverId, approverName,
    approvalState: ApprovalState.REJECTED,
    decidedAt: now,
    comments: dto.comments,
  };

  const updated: ServiceRequest = {
    ...existing,
    state:         ServiceRequestState.REJECTED,
    approvalState: ApprovalState.REJECTED,
    approvers:     [...existing.approvers, approverEntry],
    timeline: [
      ...existing.timeline,
      { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId: approverId, actorName: approverName, previousValue: existing.state, newValue: ServiceRequestState.REJECTED, timestamp: now },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Fulfill ──────────────────────────────────────────────────────────────────

export async function fulfillServiceRequest(
  id: string,
  dto: FulfillServiceRequestDto,
  current: ServiceRequest[],
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  if (!isValidSRTransition(existing.state, ServiceRequestState.FULFILLED)) return null;

  const now = new Date().toISOString();
  const slaBreached = checkSRSLABreach(existing.sla, new Date(now));

  const updated: ServiceRequest = {
    ...existing,
    state:            ServiceRequestState.FULFILLED,
    fulfillmentNotes: dto.fulfillmentNotes,
    closureCode:      dto.closureCode,
    sla:              { ...existing.sla, slaBreached },
    fulfilledAt:      now,
    timeline: [
      ...existing.timeline,
      { id: uuid(), type: TicketEventType.STATE_CHANGED, actorId, actorName, previousValue: existing.state, newValue: ServiceRequestState.FULFILLED, timestamp: now },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Close ────────────────────────────────────────────────────────────────────

export async function closeServiceRequest(
  id: string,
  current: ServiceRequest[],
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  if (!isValidSRTransition(existing.state, ServiceRequestState.CLOSED)) return null;

  const now = new Date().toISOString();
  const updated: ServiceRequest = {
    ...existing,
    state:    ServiceRequestState.CLOSED,
    closedAt: now,
    timeline: [
      ...existing.timeline,
      { id: uuid(), type: TicketEventType.CLOSED, actorId, actorName, timestamp: now },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Notes & comments ─────────────────────────────────────────────────────────

export async function addSRWorkNote(
  id: string,
  dto: AddWorkNoteDto,
  current: ServiceRequest[],
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: ServiceRequest = {
    ...existing,
    workNotes: [...existing.workNotes, { id: uuid(), authorId: actorId, authorName: actorName, content: dto.content, createdAt: now }],
    timeline: [...existing.timeline, { id: uuid(), type: TicketEventType.WORK_NOTE_ADDED, actorId, actorName, timestamp: now }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

export async function addSRComment(
  id: string,
  dto: AddCommentDto,
  current: ServiceRequest[],
  actorId: string,
  actorName: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: ServiceRequest = {
    ...existing,
    comments: [...existing.comments, { id: uuid(), authorId: actorId, authorName: actorName, content: dto.content, createdAt: now }],
    timeline: [...existing.timeline, { id: uuid(), type: TicketEventType.COMMENT_ADDED, actorId, actorName, timestamp: now }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function addServiceRequestAttachment(
  id: string,
  file: File,
  uploadedBy: string,
  current: ServiceRequest[],
  orgId: string,
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  const fileId = uuid();
  const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
  const path = `itsm/${id}/${fileId}${ext ? '.' + ext : ''}`;
  await dbUploadFile(path, file);
  const url = await dbGetFileUrl(path);
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
  const updated: ServiceRequest = {
    ...existing,
    attachments: [...(existing.attachments ?? []), attachment],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

export async function removeServiceRequestAttachment(
  id: string,
  attachmentId: string,
  current: ServiceRequest[],
): Promise<ServiceRequest | null> {
  const existing = current.find((sr) => sr.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: ServiceRequest = {
    ...existing,
    attachments: (existing.attachments ?? []).filter((a) => a.id !== attachmentId),
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteServiceRequest(id: string): Promise<void> {
  await dbDelete(TABLE, id);
}
