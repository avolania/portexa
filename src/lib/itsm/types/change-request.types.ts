import {
  ApprovalState,
  ChangeCloseCode,
  ChangeRequestState,
  ChangeRisk,
  ChangeType,
  Impact,
  Priority,
} from './enums';
import {
  ApproverEntry,
  ITSMUser,
  PaginationParams,
  TicketComment,
  TicketEvent,
  WorkNote,
  AddWorkNoteDto,
  AddCommentDto,
} from './interfaces';
import type { Attachment } from '@/types';

export interface ChangeRequest {
  id: string;
  number: string;
  type: ChangeType;
  category: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  risk: ChangeRisk;
  impact: Impact;
  priority: Priority;
  state: ChangeRequestState;
  requestedById: string;
  requestedBy?: ITSMUser;
  changeManagerId: string;
  changeManager?: ITSMUser;
  assignedToId?: string;
  assignedTo?: ITSMUser;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  shortDescription: string;
  description: string;
  justification: string;
  plannedStartDate: string;
  plannedEndDate: string;
  actualStartDate?: string;
  actualEndDate?: string;
  implementationPlan: string;
  backoutPlan: string;
  testPlan?: string;
  approvalState: ApprovalState;
  approvers: ApproverEntry[];
  workNotes: WorkNote[];
  comments: TicketComment[];
  attachments: Attachment[];
  closeCode?: ChangeCloseCode;
  closureNotes?: string;
  relatedIncidentIds: string[];
  timeline: TicketEvent[];
  createdAt: string;
  updatedAt: string;
  closedAt?: string;
}

export interface CreateChangeRequestDto {
  requestedById: string;
  changeManagerId: string;
  type: ChangeType;
  category: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  risk: ChangeRisk;
  impact: Impact;
  shortDescription: string;
  description: string;
  justification: string;
  plannedStartDate: string;
  plannedEndDate: string;
  implementationPlan: string;
  backoutPlan: string;
  testPlan?: string;
  assignedToId?: string;
  assignmentGroupId?: string;
  relatedIncidentIds?: string[];
  attachments?: Attachment[];
}

export interface UpdateChangeRequestDto {
  type?: ChangeType;
  category?: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  risk?: ChangeRisk;
  impact?: Impact;
  shortDescription?: string;
  description?: string;
  justification?: string;
  plannedStartDate?: string;
  plannedEndDate?: string;
  implementationPlan?: string;
  backoutPlan?: string;
  testPlan?: string;
  assignedToId?: string;
  assignmentGroupId?: string;
}

export interface CloseChangeRequestDto {
  closeCode: ChangeCloseCode;
  closureNotes: string;
  actualStartDate?: string;
  actualEndDate?: string;
}

export interface ApproveChangeRequestDto {
  comments?: string;
}

export interface RejectChangeRequestDto {
  comments: string;
}

export type { AddWorkNoteDto, AddCommentDto } from './interfaces';

export interface LinkIncidentDto {
  incidentId: string;
}

export const CR_STATE_TRANSITIONS: Record<ChangeRequestState, ChangeRequestState[]> = {
  [ChangeRequestState.NEW]: [
    ChangeRequestState.ASSESS,
    ChangeRequestState.CANCELLED,
  ],
  [ChangeRequestState.ASSESS]: [
    ChangeRequestState.AUTHORIZE,
    ChangeRequestState.CANCELLED,
  ],
  [ChangeRequestState.AUTHORIZE]: [
    ChangeRequestState.SCHEDULED,
    ChangeRequestState.ASSESS,
    ChangeRequestState.CANCELLED,
  ],
  [ChangeRequestState.SCHEDULED]: [
    ChangeRequestState.IMPLEMENT,
    ChangeRequestState.CANCELLED,
  ],
  [ChangeRequestState.IMPLEMENT]: [
    ChangeRequestState.REVIEW,
  ],
  [ChangeRequestState.REVIEW]: [
    ChangeRequestState.CLOSED,
  ],
  [ChangeRequestState.CLOSED]: [],
  [ChangeRequestState.CANCELLED]: [],
};

export function isValidCRTransition(
  from: ChangeRequestState,
  to: ChangeRequestState,
): boolean {
  return CR_STATE_TRANSITIONS[from].includes(to);
}

export interface ChangeRequestFilters extends PaginationParams {
  state?: ChangeRequestState[];
  type?: ChangeType[];
  risk?: ChangeRisk[];
  priority?: Priority[];
  requestedById?: string;
  changeManagerId?: string;
  assignedToId?: string;
  approvalState?: ApprovalState;
  plannedStartAfter?: string;
  plannedStartBefore?: string;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}
