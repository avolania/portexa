import {
  Impact,
  IncidentClosureCode,
  IncidentResolutionCode,
  IncidentState,
  Priority,
  Urgency,
} from './enums';
import {
  IncidentSLA,
  ITSMUser,
  PaginationParams,
  TicketComment,
  TicketEvent,
  WorkNote,
  AddWorkNoteDto,
  AddCommentDto,
} from './interfaces';
import type { Attachment } from '@/types';

export interface Incident {
  id: string;
  number: string;
  category: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  impact: Impact;
  urgency: Urgency;
  priority: Priority;
  priorityOverride: boolean;
  priorityOverrideReason?: string;
  state: IncidentState;
  callerId: string;
  caller?: ITSMUser;
  reportedById: string;
  reportedBy?: ITSMUser;
  assignedToId?: string;
  assignedTo?: ITSMUser;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  shortDescription: string;
  description: string;
  workNotes: WorkNote[];
  comments: TicketComment[];
  attachments: Attachment[];
  resolutionCode?: IncidentResolutionCode;
  resolutionNotes?: string;
  closureCode?: IncidentClosureCode;
  closureNotes?: string;
  relatedCRId?: string;
  parentIncidentId?: string;
  sla: IncidentSLA;
  timeline: TicketEvent[];
  createdAt: string;
  updatedAt: string;
  resolvedAt?: string;
  closedAt?: string;
  rcaData?: Record<string, unknown>;
}

export interface CreateIncidentDto {
  callerId: string;
  reportedById?: string;
  category: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  impact: Impact;
  urgency: Urgency;
  priorityOverride?: Priority;
  priorityOverrideReason?: string;
  shortDescription: string;
  description: string;
  assignedToId?: string;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  attachments?: Attachment[];
}

export interface UpdateIncidentDto {
  category?: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  impact?: Impact;
  urgency?: Urgency;
  priorityOverride?: Priority;
  priorityOverrideReason?: string;
  assignedToId?: string;
  assignmentGroupId?: string;
  shortDescription?: string;
  description?: string;
  rcaData?: Record<string, unknown>;
}

export interface AssignIncidentDto {
  assignedToId: string;
  assignmentGroupId?: string;
  workNote?: string;
}

export interface ChangeIncidentStateDto {
  state: IncidentState;
  note?: string;
}

export interface ResolveIncidentDto {
  resolutionCode: IncidentResolutionCode;
  resolutionNotes: string;
}

export interface CloseIncidentDto {
  closureCode: IncidentClosureCode;
  closureNotes: string;
}

export type { AddWorkNoteDto, AddCommentDto } from './interfaces';

export interface LinkCRDto {
  changeRequestId: string;
}

export const INCIDENT_STATE_TRANSITIONS: Record<IncidentState, IncidentState[]> = {
  [IncidentState.NEW]: [
    IncidentState.ASSIGNED,
    IncidentState.IN_PROGRESS,
  ],
  [IncidentState.ASSIGNED]: [
    IncidentState.IN_PROGRESS,
    IncidentState.PENDING,
  ],
  [IncidentState.IN_PROGRESS]: [
    IncidentState.PENDING,
    IncidentState.RESOLVED,
  ],
  [IncidentState.PENDING]: [
    IncidentState.IN_PROGRESS,
    IncidentState.RESOLVED,
  ],
  [IncidentState.RESOLVED]: [
    IncidentState.CLOSED,
    IncidentState.IN_PROGRESS,
  ],
  [IncidentState.CLOSED]: [],
};

export function isValidIncidentTransition(
  from: IncidentState,
  to: IncidentState,
): boolean {
  return INCIDENT_STATE_TRANSITIONS[from].includes(to);
}

export interface IncidentFilters extends PaginationParams {
  state?: IncidentState[];
  priority?: Priority[];
  assignedToId?: string;
  assignmentGroupId?: string;
  callerId?: string;
  slaBreached?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}
