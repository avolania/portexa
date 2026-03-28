import { dbLoadAll, dbUpsert, dbDelete, dbUploadFile, dbGetFileUrl } from '@/lib/db';
import type { Attachment } from '@/types';
const uuid = () => crypto.randomUUID();
import { createIncidentSLA, checkIncidentSLABreaches, pauseIncidentSLA, resumeIncidentSLA } from '@/lib/itsm/utils/sla.engine';
import { generateTicketNumber } from '@/lib/itsm/utils/ticket-number';
import { calculatePriority } from '@/lib/itsm/types/interfaces';
import { IncidentState, TicketEventType } from '@/lib/itsm/types/enums';
import type {
  Incident,
  CreateIncidentDto,
  UpdateIncidentDto,
  AssignIncidentDto,
  ChangeIncidentStateDto,
  ResolveIncidentDto,
  CloseIncidentDto,
  AddWorkNoteDto,
  AddCommentDto,
  LinkCRDto,
  IncidentFilters,
} from '@/lib/itsm/types/incident.types';
import { isValidIncidentTransition } from '@/lib/itsm/types/incident.types';
import type { TicketEvent } from '@/lib/itsm/types/interfaces';

const TABLE = 'itsm_incidents';

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadIncidents(filters?: IncidentFilters): Promise<Incident[]> {
  const all = await dbLoadAll<Incident>(TABLE);
  if (!filters) return all;

  return all.filter((inc) => {
    if (filters.state?.length      && !filters.state.includes(inc.state))          return false;
    if (filters.priority?.length   && !filters.priority.includes(inc.priority))    return false;
    if (filters.assignedToId       && inc.assignedToId !== filters.assignedToId)   return false;
    if (filters.assignmentGroupId  && inc.assignmentGroupId !== filters.assignmentGroupId) return false;
    if (filters.callerId           && inc.callerId !== filters.callerId)            return false;
    if (filters.slaBreached        && !inc.sla.resolutionBreached)                 return false;
    if (filters.createdAfter       && inc.createdAt < filters.createdAfter)        return false;
    if (filters.createdBefore      && inc.createdAt > filters.createdBefore)       return false;
    if (filters.search) {
      const q = filters.search.toLowerCase();
      if (!inc.shortDescription.toLowerCase().includes(q) && !inc.number.toLowerCase().includes(q)) return false;
    }
    return true;
  });
}

export async function loadIncidentById(id: string): Promise<Incident | null> {
  const all = await dbLoadAll<Incident>(TABLE);
  return all.find((i) => i.id === id) ?? null;
}

// ─── Create ───────────────────────────────────────────────────────────────────

export async function createIncident(
  dto: CreateIncidentDto,
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<Incident> {
  const now = new Date().toISOString();
  const id  = uuid();
  const number = await generateTicketNumber('INC');

  const priority = dto.priorityOverride
    ?? calculatePriority(dto.impact, dto.urgency);

  const sla = createIncidentSLA(now, priority);

  const incident: Incident = {
    id,
    number,
    category:      dto.category,
    subcategory:   dto.subcategory,
    sapCategory:   dto.sapCategory,
    sapModule:     dto.sapModule,
    impact:        dto.impact,
    urgency:       dto.urgency,
    priority,
    priorityOverride:       !!dto.priorityOverride,
    priorityOverrideReason: dto.priorityOverrideReason,
    state:         IncidentState.NEW,
    callerId:      dto.callerId,
    reportedById:  dto.reportedById ?? actorId,
    assignedToId:  dto.assignedToId,
    assignmentGroupId: dto.assignmentGroupId,
    shortDescription: dto.shortDescription,
    description:   dto.description,
    workNotes:     [],
    comments:      [],
    attachments:   [],
    relatedCRId:   undefined,
    parentIncidentId: undefined,
    sla,
    timeline:      [
      {
        id:        uuid(),
        type:      TicketEventType.CREATED,
        actorId,
        actorName,
        timestamp: now,
      },
    ],
    createdAt:  now,
    updatedAt:  now,
  };

  await dbUpsert(TABLE, id, incident, orgId);
  return incident;
}

// ─── Update ───────────────────────────────────────────────────────────────────

export async function updateIncident(
  id: string,
  dto: UpdateIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const events: TicketEvent[] = [];

  // Recalculate priority if impact/urgency changed
  let priority = existing.priority;
  if ((dto.impact || dto.urgency) && !existing.priorityOverride) {
    const newImpact  = dto.impact  ?? existing.impact;
    const newUrgency = dto.urgency ?? existing.urgency;
    const newPriority = calculatePriority(newImpact, newUrgency);
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

  const updated: Incident = {
    ...existing,
    category:               dto.category               ?? existing.category,
    subcategory:            dto.subcategory            ?? existing.subcategory,
    sapCategory:            dto.sapCategory            ?? existing.sapCategory,
    sapModule:              dto.sapModule              ?? existing.sapModule,
    impact:                 dto.impact                 ?? existing.impact,
    urgency:                dto.urgency                ?? existing.urgency,
    assignedToId:           dto.assignedToId           ?? existing.assignedToId,
    assignmentGroupId:      dto.assignmentGroupId      ?? existing.assignmentGroupId,
    shortDescription:       dto.shortDescription       ?? existing.shortDescription,
    description:            dto.description            ?? existing.description,
    priorityOverride:       dto.priorityOverride !== undefined ? true : existing.priorityOverride,
    priorityOverrideReason: dto.priorityOverrideReason ?? existing.priorityOverrideReason,
    priority,
    updatedAt: now,
    timeline: [...existing.timeline, ...events],
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Assign ───────────────────────────────────────────────────────────────────

export async function assignIncident(
  id: string,
  dto: AssignIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const event: TicketEvent = {
    id: uuid(), type: TicketEventType.ASSIGNED,
    actorId, actorName,
    previousValue: existing.assignedToId,
    newValue:      dto.assignedToId,
    timestamp: now,
  };

  const workNotes = dto.workNote
    ? [...existing.workNotes, { id: uuid(), authorId: actorId, authorName: actorName, content: dto.workNote, createdAt: now }]
    : existing.workNotes;

  const updated: Incident = {
    ...existing,
    assignedToId:      dto.assignedToId,
    assignmentGroupId: dto.assignmentGroupId ?? existing.assignmentGroupId,
    state: existing.state === IncidentState.NEW ? IncidentState.ASSIGNED : existing.state,
    workNotes,
    timeline:  [...existing.timeline, event],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── State change ─────────────────────────────────────────────────────────────

export async function changeIncidentState(
  id: string,
  dto: ChangeIncidentStateDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  if (!isValidIncidentTransition(existing.state, dto.state)) {
    console.warn(`[incident] invalid transition ${existing.state} → ${dto.state}`);
    return null;
  }

  const now = new Date().toISOString();

  // Handle SLA pause/resume
  let sla = existing.sla;
  if (dto.state === IncidentState.PENDING && !sla.pausedAt) {
    sla = pauseIncidentSLA(sla, new Date(now));
  } else if (existing.state === IncidentState.PENDING && dto.state === IncidentState.IN_PROGRESS) {
    sla = resumeIncidentSLA(sla, new Date(now));
  }
  // Check breaches
  const breaches = checkIncidentSLABreaches(sla);
  sla = { ...sla, ...breaches };

  const event: TicketEvent = {
    id: uuid(), type: TicketEventType.STATE_CHANGED,
    actorId, actorName,
    previousValue: existing.state,
    newValue:      dto.state,
    note:          dto.note,
    timestamp: now,
  };

  const updated: Incident = {
    ...existing,
    state: dto.state,
    sla,
    timeline:  [...existing.timeline, event],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

export async function resolveIncident(
  id: string,
  dto: ResolveIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  if (!isValidIncidentTransition(existing.state, IncidentState.RESOLVED)) return null;

  const now = new Date().toISOString();
  const breaches = checkIncidentSLABreaches(existing.sla);

  const updated: Incident = {
    ...existing,
    state:           IncidentState.RESOLVED,
    resolutionCode:  dto.resolutionCode,
    resolutionNotes: dto.resolutionNotes,
    resolvedAt:      now,
    sla: { ...existing.sla, ...breaches },
    timeline: [
      ...existing.timeline,
      { id: uuid(), type: TicketEventType.RESOLVED, actorId, actorName, timestamp: now },
    ],
    updatedAt: now,
  };

  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Close ────────────────────────────────────────────────────────────────────

export async function closeIncident(
  id: string,
  dto: CloseIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  if (!isValidIncidentTransition(existing.state, IncidentState.CLOSED)) return null;

  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    state:        IncidentState.CLOSED,
    closureCode:  dto.closureCode,
    closureNotes: dto.closureNotes,
    closedAt:     now,
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

export async function addIncidentWorkNote(
  id: string,
  dto: AddWorkNoteDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    workNotes: [...existing.workNotes, { id: uuid(), authorId: actorId, authorName: actorName, content: dto.content, createdAt: now }],
    timeline: [...existing.timeline, { id: uuid(), type: TicketEventType.WORK_NOTE_ADDED, actorId, actorName, timestamp: now }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

export async function addIncidentComment(
  id: string,
  dto: AddCommentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    comments: [...existing.comments, { id: uuid(), authorId: actorId, authorName: actorName, content: dto.content, createdAt: now }],
    timeline: [...existing.timeline, { id: uuid(), type: TicketEventType.COMMENT_ADDED, actorId, actorName, timestamp: now }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Link CR ──────────────────────────────────────────────────────────────────

export async function linkCRToIncident(
  id: string,
  dto: LinkCRDto,
  current: Incident[],
  actorId: string,
  actorName: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    relatedCRId: dto.changeRequestId,
    timeline: [...existing.timeline, {
      id: uuid(), type: TicketEventType.RELATED_CR_LINKED,
      actorId, actorName, newValue: dto.changeRequestId, timestamp: now,
    }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Attachments ──────────────────────────────────────────────────────────────

export async function addIncidentAttachment(
  id: string,
  file: File,
  uploadedBy: string,
  current: Incident[],
  orgId: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
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
  const updated: Incident = {
    ...existing,
    attachments: [...(existing.attachments ?? []), attachment],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

export async function removeIncidentAttachment(
  id: string,
  attachmentId: string,
  current: Incident[],
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    attachments: (existing.attachments ?? []).filter((a) => a.id !== attachmentId),
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated);
  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteIncident(id: string): Promise<void> {
  await dbDelete(TABLE, id);
}
