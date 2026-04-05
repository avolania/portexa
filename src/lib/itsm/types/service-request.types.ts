import {
  ApprovalState,
  Impact,
  Priority,
  ServiceRequestState,
  Urgency,
} from './enums';
import {
  ApproverEntry,
  ITSMUser,
  PaginationParams,
  ServiceRequestSLA,
  TicketComment,
  TicketEvent,
  WorkNote,
  AddWorkNoteDto,
  AddCommentDto,
} from './interfaces';
import type { Attachment } from '@/types';

export type ServiceRequestPriority = Exclude<Priority, Priority.CRITICAL>;

export enum ServiceRequestClosureCode {
  FULFILLED = 'Fulfilled',
  FULFILLED_PARTIALLY = 'Fulfilled Partially',
  REJECTED = 'Rejected',
  CANCELLED_BY_USER = 'Cancelled by User',
  CANCELLED_BY_IT = 'Cancelled by IT',
  DUPLICATE = 'Duplicate',
}

export interface ServiceRequest {
  id: string;
  number: string;
  requestType: string;
  category: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  impact: Impact;
  urgency: Urgency;
  priority: ServiceRequestPriority;
  state: ServiceRequestState;
  requestedForId: string;
  requestedFor?: ITSMUser;
  requestedById: string;
  requestedBy?: ITSMUser;
  assignedToId?: string;
  assignedTo?: ITSMUser;
  assignmentGroupId?: string;
  assignmentGroupName?: string;
  shortDescription: string;
  description: string;
  justification?: string;
  approvalRequired: boolean;
  approvalState: ApprovalState;
  approvers: ApproverEntry[];
  workNotes: WorkNote[];
  comments: TicketComment[];
  attachments: Attachment[];
  fulfillmentNotes?: string;
  closureCode?: ServiceRequestClosureCode;
  sla: ServiceRequestSLA;
  timeline: TicketEvent[];
  createdAt: string;
  updatedAt: string;
  fulfilledAt?: string;
  closedAt?: string;
}

export interface CreateServiceRequestDto {
  requestedForId: string;
  requestedById: string;
  requestType: string;
  category: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  impact: Impact;
  urgency: Urgency;
  shortDescription: string;
  description: string;
  justification?: string;
  approvalRequired?: boolean;
  assignedToId?: string;
  assignmentGroupId?: string;
  sourceIncidentNumber?: string;
  attachments?: Attachment[];
}

export interface UpdateServiceRequestDto {
  requestType?: string;
  category?: string;
  subcategory?: string;
  sapCategory?: string;
  sapModule?: string;
  impact?: Impact;
  urgency?: Urgency;
  shortDescription?: string;
  description?: string;
  justification?: string;
  assignedToId?: string;
  assignmentGroupId?: string;
}

export interface FulfillServiceRequestDto {
  fulfillmentNotes: string;
  closureCode: ServiceRequestClosureCode;
}

export interface ApproveServiceRequestDto {
  comments?: string;
}

export interface RejectServiceRequestDto {
  comments: string;
}

export type { AddWorkNoteDto, AddCommentDto } from './interfaces';

export const SR_STATE_TRANSITIONS: Record<ServiceRequestState, ServiceRequestState[]> = {
  [ServiceRequestState.DRAFT]: [
    ServiceRequestState.SUBMITTED,
    ServiceRequestState.CANCELLED,
  ],
  [ServiceRequestState.SUBMITTED]: [
    ServiceRequestState.PENDING_APPROVAL,
    ServiceRequestState.APPROVED,
    ServiceRequestState.CANCELLED,
  ],
  [ServiceRequestState.PENDING_APPROVAL]: [
    ServiceRequestState.APPROVED,
    ServiceRequestState.REJECTED,
  ],
  [ServiceRequestState.APPROVED]: [
    ServiceRequestState.IN_PROGRESS,
  ],
  [ServiceRequestState.IN_PROGRESS]: [
    ServiceRequestState.PENDING,
    ServiceRequestState.FULFILLED,
  ],
  [ServiceRequestState.PENDING]: [
    ServiceRequestState.IN_PROGRESS,
  ],
  [ServiceRequestState.FULFILLED]: [
    ServiceRequestState.CLOSED,
  ],
  [ServiceRequestState.CLOSED]: [],
  [ServiceRequestState.REJECTED]: [],
  [ServiceRequestState.CANCELLED]: [],
};

export function isValidSRTransition(
  from: ServiceRequestState,
  to: ServiceRequestState,
): boolean {
  return SR_STATE_TRANSITIONS[from].includes(to);
}

export interface ServiceRequestFilters extends PaginationParams {
  state?: ServiceRequestState[];
  priority?: ServiceRequestPriority[];
  requestedForId?: string;
  requestedById?: string;
  assignedToId?: string;
  approvalState?: ApprovalState;
  slaBreached?: boolean;
  createdAfter?: string;
  createdBefore?: string;
  search?: string;
}
