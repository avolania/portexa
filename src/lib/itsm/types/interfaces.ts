import {
  ApprovalState,
  Impact,
  NotificationType,
  Priority,
  TicketEventType,
  Urgency,
} from './enums';

export interface ITSMUser {
  id: string;
  fullName: string;
  email: string;
  avatarUrl?: string;
}

export interface ITSMGroup {
  id: string;
  name: string;
}

export interface WorkNote {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface TicketComment {
  id: string;
  authorId: string;
  authorName: string;
  content: string;
  createdAt: string;
}

export interface TicketEvent {
  id: string;
  type: TicketEventType;
  actorId: string;
  actorName: string;
  previousValue?: string;
  newValue?: string;
  note?: string;
  timestamp: string;
}

export interface ApproverEntry {
  approverId: string;
  approverName: string;
  approvalState: ApprovalState;
  decidedAt?: string;
  comments?: string;
}

export interface IncidentSLA {
  responseDeadline: string;
  resolutionDeadline: string;
  responseBreached: boolean;
  resolutionBreached: boolean;
  respondedAt?: string;
  pausedAt?: string;
  totalPausedMinutes: number;
  warningNotifiedAt?: string;
}

export interface ServiceRequestSLA {
  fulfillmentDeadline: string;
  slaBreached: boolean;
  warningNotifiedAt?: string;
}

export interface SLAPolicyEntry {
  priority: Priority;
  responseMinutes: number;
  resolutionMinutes: number;
  useBusinessHours: boolean;
}

export const DEFAULT_SLA_POLICIES: SLAPolicyEntry[] = [
  {
    priority: Priority.CRITICAL,
    responseMinutes: 15,
    resolutionMinutes: 240,
    useBusinessHours: false,
  },
  {
    priority: Priority.HIGH,
    responseMinutes: 60,
    resolutionMinutes: 480,
    useBusinessHours: true,
  },
  {
    priority: Priority.MEDIUM,
    responseMinutes: 240,
    resolutionMinutes: 1440,
    useBusinessHours: true,
  },
  {
    priority: Priority.LOW,
    responseMinutes: 480,
    resolutionMinutes: 4320,
    useBusinessHours: true,
  },
];

export const PRIORITY_MATRIX: Record<Impact, Record<Urgency, Priority>> = {
  [Impact.HIGH]: {
    [Urgency.HIGH]:   Priority.CRITICAL,
    [Urgency.MEDIUM]: Priority.HIGH,
    [Urgency.LOW]:    Priority.HIGH,
  },
  [Impact.MEDIUM]: {
    [Urgency.HIGH]:   Priority.HIGH,
    [Urgency.MEDIUM]: Priority.MEDIUM,
    [Urgency.LOW]:    Priority.MEDIUM,
  },
  [Impact.LOW]: {
    [Urgency.HIGH]:   Priority.MEDIUM,
    [Urgency.MEDIUM]: Priority.MEDIUM,
    [Urgency.LOW]:    Priority.LOW,
  },
};

export function calculatePriority(impact: Impact, urgency: Urgency): Priority {
  return PRIORITY_MATRIX[impact][urgency];
}

export interface BusinessHoursConfig {
  timezone: string;
  workDays: number[];
  startHour: number;
  startMinute: number;
  endHour: number;
  endMinute: number;
  holidays: string[];
}

export const DEFAULT_BUSINESS_HOURS: BusinessHoursConfig = {
  timezone: 'Europe/Istanbul',
  workDays: [1, 2, 3, 4, 5],
  startHour: 9,
  startMinute: 0,
  endHour: 18,
  endMinute: 0,
  holidays: [],
};

export interface NotificationPayload {
  type: NotificationType;
  recipientIds: string[];
  ticketNumber: string;
  ticketType: 'incident' | 'service-request' | 'change-request';
  subject: string;
  body: string;
  metadata?: Record<string, unknown>;
}

export interface ApiSuccess<T> {
  data: T;
  meta?: {
    total?: number;
    page?: number;
    pageSize?: number;
  };
}

export interface ApiError {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}

export type ApiResponse<T> = ApiSuccess<T> | ApiError;

export interface PaginationParams {
  page?: number;
  pageSize?: number;
}

export interface AddWorkNoteDto {
  content: string;
}

export interface AddCommentDto {
  content: string;
}
