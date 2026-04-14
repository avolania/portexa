import { dbLoadAll, dbUpsert, dbDelete, dbUploadFile, dbGetFileUrl, dbLoadOne } from '@/lib/db';
import type { Attachment } from '@/types';
const uuid = () => crypto.randomUUID();
const makeNote = (authorId: string, authorName: string, content: string, now: string) =>
  ({ id: uuid(), authorId, authorName, content, createdAt: now });
import { createIncidentSLA, checkIncidentSLABreaches, pauseIncidentSLA, resumeIncidentSLA } from '@/lib/itsm/utils/sla.engine';
import { generateTicketNumber } from '@/lib/itsm/utils/ticket-number';
import { calculatePriority, DEFAULT_BUSINESS_HOURS } from '@/lib/itsm/types/interfaces';
import { IncidentState, TicketEventType, IncidentResolutionCode } from '@/lib/itsm/types/enums';
import type { Impact, Urgency, ChangeType, ChangeRisk } from '@/lib/itsm/types/enums';
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
  return dbLoadOne<Incident>(TABLE, id);
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
    state:         dto.assignedToId ? IncidentState.ASSIGNED : IncidentState.NEW,
    callerId:      dto.callerId,
    reportedById:  dto.reportedById ?? actorId,
    assignedToId:  dto.assignedToId,
    assignmentGroupId:   dto.assignmentGroupId,
    assignmentGroupName: dto.assignmentGroupName,
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
  orgId: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;

  const now = new Date().toISOString();
  const events: TicketEvent[] = [];

  // Recalculate priority if impact/urgency changed, or apply explicit override
  let priority = existing.priority;
  if (dto.priorityOverride !== undefined) {
    // Explicit override value takes precedence
    if (dto.priorityOverride !== existing.priority) {
      priority = dto.priorityOverride;
      events.push({
        id: uuid(), type: TicketEventType.PRIORITY_CHANGED,
        actorId, actorName,
        previousValue: existing.priority, newValue: dto.priorityOverride,
        timestamp: now,
      });
    }
  } else if ((dto.impact || dto.urgency) && !existing.priorityOverride) {
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

  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Assign ───────────────────────────────────────────────────────────────────

export async function assignIncident(
  id: string,
  dto: AssignIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
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
    ? [...existing.workNotes, makeNote(actorId, actorName, dto.workNote, now)]
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

  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── State change ─────────────────────────────────────────────────────────────

export async function changeIncidentState(
  id: string,
  dto: ChangeIncidentStateDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
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
    sla = resumeIncidentSLA(sla, new Date(now), DEFAULT_BUSINESS_HOURS);
  }
  // Check breaches
  const breaches = checkIncidentSLABreaches(sla, new Date(), existing.resolvedAt);
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

  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Resolve ──────────────────────────────────────────────────────────────────

export async function resolveIncident(
  id: string,
  dto: ResolveIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  if (!isValidIncidentTransition(existing.state, IncidentState.RESOLVED)) return null;

  const now = new Date().toISOString();
  const breaches = checkIncidentSLABreaches(existing.sla, new Date(), existing.resolvedAt);

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

  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Close ────────────────────────────────────────────────────────────────────

export async function closeIncident(
  id: string,
  dto: CloseIncidentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
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

  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Notes & comments ─────────────────────────────────────────────────────────

export async function addIncidentWorkNote(
  id: string,
  dto: AddWorkNoteDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    workNotes: [...existing.workNotes, makeNote(actorId, actorName, dto.content, now)],
    timeline: [...existing.timeline, { id: uuid(), type: TicketEventType.WORK_NOTE_ADDED, actorId, actorName, timestamp: now }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

export async function addIncidentComment(
  id: string,
  dto: AddCommentDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    comments: [...existing.comments, makeNote(actorId, actorName, dto.content, now)],
    timeline: [...existing.timeline, { id: uuid(), type: TicketEventType.COMMENT_ADDED, actorId, actorName, timestamp: now }],
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Link CR ──────────────────────────────────────────────────────────────────

export async function linkCRToIncident(
  id: string,
  dto: LinkCRDto,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
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
  await dbUpsert(TABLE, id, updated, orgId);
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
  orgId: string,
): Promise<Incident | null> {
  const existing = current.find((i) => i.id === id);
  if (!existing) return null;
  const now = new Date().toISOString();
  const updated: Incident = {
    ...existing,
    attachments: (existing.attachments ?? []).filter((a) => a.id !== attachmentId),
    updatedAt: now,
  };
  await dbUpsert(TABLE, id, updated, orgId);
  return updated;
}

// ─── Delete ───────────────────────────────────────────────────────────────────

export async function deleteIncident(id: string): Promise<void> {
  await dbDelete(TABLE, id);
}

// ─── L2 Workbench: Convert & Merge ───────────────────────────────────────────

/**
 * INC'in resolve edilebilir duruma getirilmesini sağlar.
 * New veya Assigned ise önce In Progress'e alır.
 * Not: PENDING state için ayrı geçiş gerekmez — PENDING → RESOLVED transition zaten geçerli.
 */
async function ensureResolvable(
  id: string,
  current: Incident[],
  actorId: string,
  actorName: string,
  orgId: string,
): Promise<Incident[]> {
  const inc = current.find((i) => i.id === id);
  if (!inc) return current;
  if (inc.state === IncidentState.NEW || inc.state === IncidentState.ASSIGNED) {
    const updated = await changeIncidentState(
      id,
      { state: IncidentState.IN_PROGRESS },
      current,
      actorId,
      actorName,
      orgId,
    );
    if (updated) {
      return current.map((i) => (i.id === id ? updated : i));
    }
  }
  return current;
}

/**
 * Bir Incident'ı Service Request'e dönüştürür.
 * INC → Resolved (Converted) olarak kapatılır, yeni SR oluşturulur.
 * Çağıran: L2 workbench Convert Modal
 */
export async function convertIncidentToSR(
  incId: string,
  dto: {
    requestType: string;
    category: string;
    impact: Impact;
    urgency: Urgency;
    note: string;
  },
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<{ srId: string; srNumber: string }> {
  const inc = current.find((i) => i.id === incId);
  if (!inc) throw new Error('Incident bulunamadı');

  // 1. SR oluştur
  const { createServiceRequest } = await import('./serviceRequestService');
  const sr = await createServiceRequest(
    {
      requestedForId: inc.callerId,
      requestedById:  actorId,
      requestType:    dto.requestType,
      category:       dto.category,
      impact:         dto.impact,
      urgency:        dto.urgency,
      shortDescription: inc.shortDescription,
      description:    inc.description,
      sourceIncidentNumber: inc.number,
    },
    orgId,
    actorId,
    actorName,
  );

  // 2. INC'i resolve edilebilir duruma getir
  const freshList = await ensureResolvable(incId, current, actorId, actorName, orgId);

  // 3. INC'e work note ekle ve güncel Incident'ı yakala
  const afterNote = await addIncidentWorkNote(
    incId,
    { content: `[CONVERT→SR] ${sr.number} numaralı Service Request oluşturuldu. ${dto.note}` },
    freshList,
    actorId,
    actorName,
    orgId,
  );
  const listForResolve = afterNote
    ? freshList.map((i) => (i.id === incId ? afterNote : i))
    : freshList;

  // 4. INC'i güncel listeyle resolve et (work note korunur)
  await resolveIncident(
    incId,
    {
      resolutionCode: IncidentResolutionCode.CONVERTED,
      resolutionNotes: `Service Request'e dönüştürüldü: ${sr.number}. ${dto.note}`,
    },
    listForResolve,
    actorId,
    actorName,
    orgId,
  );

  return { srId: sr.id, srNumber: sr.number };
}

/**
 * Bir Incident'ı Change Request'e dönüştürür.
 * INC → Resolved (Converted), yeni CR oluşturulur.
 */
export async function convertIncidentToCR(
  incId: string,
  dto: {
    changeType: ChangeType;
    risk: ChangeRisk;
    note: string;
  },
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<{ crId: string; crNumber: string }> {
  const inc = current.find((i) => i.id === incId);
  if (!inc) throw new Error('Incident bulunamadı');

  const { createChangeRequest } = await import('./changeRequestService');
  const now = new Date();
  const plannedEnd = new Date(now.getTime() + 7 * 24 * 60 * 60 * 1000);

  const cr = await createChangeRequest(
    {
      requestedById:    actorId,
      changeManagerId:  actorId,
      type:             dto.changeType,
      category:         inc.category,
      risk:             dto.risk,
      impact:           inc.impact,
      shortDescription: inc.shortDescription,
      description:      inc.description,
      justification:    dto.note,
      plannedStartDate: now.toISOString(),
      plannedEndDate:   plannedEnd.toISOString(),
      implementationPlan: '',
      backoutPlan:        '',
      relatedIncidentIds: [incId],
      sourceIncidentNumber: inc.number,
    },
    orgId,
    actorId,
    actorName,
  );

  const freshList = await ensureResolvable(incId, current, actorId, actorName, orgId);

  const afterNote = await addIncidentWorkNote(
    incId,
    { content: `[CONVERT→CR] ${cr.number} numaralı Change Request oluşturuldu. ${dto.note}` },
    freshList,
    actorId,
    actorName,
    orgId,
  );
  const listForResolve = afterNote
    ? freshList.map((i) => (i.id === incId ? afterNote : i))
    : freshList;

  await resolveIncident(
    incId,
    {
      resolutionCode: IncidentResolutionCode.CONVERTED,
      resolutionNotes: `Change Request'e dönüştürüldü: ${cr.number}. ${dto.note}`,
    },
    listForResolve,
    actorId,
    actorName,
    orgId,
  );

  return { crId: cr.id, crNumber: cr.number };
}

/**
 * Bir Incident'tan Problem kaydı açar (INC category="Problem").
 * Orijinal INC → Resolved (Converted).
 */
export async function convertIncidentToProblem(
  incId: string,
  note: string,
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<{ problemId: string; problemNumber: string }> {
  const inc = current.find((i) => i.id === incId);
  if (!inc) throw new Error('Incident bulunamadı');

  const problem = await createIncident(
    {
      callerId:         inc.callerId,
      reportedById:     actorId,
      category:         'Problem',
      subcategory:      inc.category,
      impact:           inc.impact,
      urgency:          inc.urgency,
      shortDescription: `Problem: ${inc.shortDescription}`,
      description:      `${inc.description}\n\n---\nKaynak Incident: ${inc.number}\n${note}`,
      assignedToId:     actorId,
    },
    orgId,
    actorId,
    actorName,
  );

  const freshList = await ensureResolvable(incId, current, actorId, actorName, orgId);

  const afterNote = await addIncidentWorkNote(
    incId,
    { content: `[CONVERT→PROBLEM] ${problem.number} numaralı Problem kaydı açıldı. ${note}` },
    freshList,
    actorId,
    actorName,
    orgId,
  );
  const listForResolve = afterNote
    ? freshList.map((i) => (i.id === incId ? afterNote : i))
    : freshList;

  await resolveIncident(
    incId,
    {
      resolutionCode: IncidentResolutionCode.CONVERTED,
      resolutionNotes: `Problem kaydına dönüştürüldü: ${problem.number}. ${note}`,
    },
    listForResolve,
    actorId,
    actorName,
    orgId,
  );

  return { problemId: problem.id, problemNumber: problem.number };
}

/**
 * İki incident'ı birleştirir: duplicate → Resolved (Duplicate), master'a note eklenir.
 */
export async function mergeDuplicateIncident(
  masterId: string,
  duplicateId: string,
  note: string,
  current: Incident[],
  orgId: string,
  actorId: string,
  actorName: string,
): Promise<void> {
  const master = current.find((i) => i.id === masterId);
  const dup    = current.find((i) => i.id === duplicateId);
  if (!master || !dup) throw new Error('Incident bulunamadı');

  // Duplicate'i resolve edilebilir duruma getir
  const freshList = await ensureResolvable(duplicateId, current, actorId, actorName, orgId);

  // Duplicate'i resolve et (Duplicate resolution code)
  await resolveIncident(
    duplicateId,
    {
      resolutionCode: IncidentResolutionCode.DUPLICATE,
      resolutionNotes: `${master.number} numaralı incident ile birleştirildi. ${note}`,
    },
    freshList,
    actorId,
    actorName,
    orgId,
  );

  // Master'a birleştirme notu ekle
  await addIncidentWorkNote(
    masterId,
    { content: `[MERGE] ${dup.number} numaralı incident bu kayıtla birleştirildi (duplicate olarak kapatıldı). ${note}` },
    current,
    actorId,
    actorName,
    orgId,
  );
}
