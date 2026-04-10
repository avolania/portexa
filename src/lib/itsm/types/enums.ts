export enum Impact {
  HIGH = '1-High',
  MEDIUM = '2-Medium',
  LOW = '3-Low',
}

export enum Urgency {
  HIGH = '1-High',
  MEDIUM = '2-Medium',
  LOW = '3-Low',
}

export enum Priority {
  CRITICAL = '1-Critical',
  HIGH = '2-High',
  MEDIUM = '3-Medium',
  LOW = '4-Low',
}

export enum IncidentState {
  NEW = 'New',
  ASSIGNED = 'Assigned',
  IN_PROGRESS = 'In Progress',
  PENDING = 'Pending',
  RESOLVED = 'Resolved',
  CLOSED = 'Closed',
}

export enum IncidentResolutionCode {
  SOLVED_WORKAROUND = 'Solved (Work Around)',
  SOLVED_PERMANENTLY = 'Solved (Permanently)',
  SOLVED_REMOTELY_WORKAROUND = 'Solved Remotely (Work Around)',
  SOLVED_REMOTELY_PERMANENTLY = 'Solved Remotely (Permanently)',
  NOT_SOLVED_NOT_REPRODUCIBLE = 'Not Solved (Not Reproducible)',
  NOT_SOLVED_TOO_COSTLY = 'Not Solved (Too Costly)',
  CLOSED_BY_CALLER = 'Closed/Resolved by Caller',
}

export enum IncidentClosureCode {
  SOLVED_WORKAROUND = 'Solved (Work Around)',
  SOLVED_PERMANENTLY = 'Solved (Permanently)',
  SOLVED_BY_USER = 'Solved by User',
  CLOSED_BY_CALLER = 'Closed/Resolved by Caller',
  NO_LONGER_AN_ISSUE = 'No Longer an Issue',
}

export enum ServiceRequestState {
  DRAFT = 'Draft',
  SUBMITTED = 'Submitted',
  PENDING_APPROVAL = 'Pending Approval',
  APPROVED = 'Approved',
  IN_PROGRESS = 'In Progress',
  PENDING = 'Pending',
  FULFILLED = 'Fulfilled',
  CLOSED = 'Closed',
  REJECTED = 'Rejected',
  CANCELLED = 'Cancelled',
}

export enum ApprovalState {
  NOT_REQUESTED = 'Not Yet Requested',
  REQUESTED = 'Requested',
  APPROVED = 'Approved',
  REJECTED = 'Rejected',
}

export enum ChangeType {
  STANDARD = 'Standard',
  NORMAL = 'Normal',
  EMERGENCY = 'Emergency',
}

export enum ChangeRequestState {
  PENDING_APPROVAL = 'Pending Approval',
  SCHEDULED = 'Scheduled',
  IMPLEMENT = 'Implement',
  REVIEW = 'Review',
  CLOSED = 'Closed',
  CANCELLED = 'Cancelled',
}

export enum ChangeRisk {
  CRITICAL = '1-Critical',
  HIGH = '2-High',
  MODERATE = '3-Moderate',
  LOW = '4-Low',
}

export enum ChangeCloseCode {
  SUCCESSFUL = 'Successful',
  SUCCESSFUL_WITH_ISSUES = 'Successful with Issues',
  UNSUCCESSFUL = 'Unsuccessful',
  CANCELLED = 'Cancelled',
}

export enum TicketEventType {
  CREATED = 'created',
  ASSIGNED = 'assigned',
  STATE_CHANGED = 'state_changed',
  PRIORITY_CHANGED = 'priority_changed',
  COMMENT_ADDED = 'comment_added',
  WORK_NOTE_ADDED = 'work_note_added',
  SLA_RESPONSE_BREACHED = 'sla_response_breached',
  SLA_RESOLUTION_BREACHED = 'sla_resolution_breached',
  SLA_PAUSED = 'sla_paused',
  SLA_RESUMED = 'sla_resumed',
  RESOLVED = 'resolved',
  CLOSED = 'closed',
  REOPENED = 'reopened',
  RELATED_CR_LINKED = 'related_cr_linked',
  RELATED_INCIDENT_LINKED = 'related_incident_linked',
  CONVERTED_FROM_INCIDENT = 'converted_from_incident',
}

export enum NotificationType {
  TICKET_CREATED = 'ticket_created',
  TICKET_ASSIGNED = 'ticket_assigned',
  TICKET_RESOLVED = 'ticket_resolved',
  SLA_WARNING = 'sla_warning',
  SLA_BREACHED = 'sla_breached',
  APPROVAL_REQUESTED = 'approval_requested',
  APPROVAL_RESOLVED = 'approval_resolved',
}

export enum SapModule {
  FI   = 'FI',
  CO   = 'CO',
  MM   = 'MM',
  SD   = 'SD',
  PP   = 'PP',
  HR   = 'HR/HCM',
  PS   = 'PS',
  PM   = 'PM',
  QM   = 'QM',
  WM   = 'WM',
  BASIS = 'Basis',
  ABAP  = 'ABAP',
  OTHER = 'Diğer',
}

export enum SapCategory {
  SYSTEM_ERROR    = 'Sistem Hatası',
  AUTHORIZATION   = 'Yetki / Erişim',
  PERFORMANCE     = 'Performans',
  DATA            = 'Veri',
  CONFIGURATION   = 'Konfigürasyon',
  INTEGRATION     = 'Entegrasyon',
  REPORTING       = 'Raporlama',
  CHANGE_REQUEST  = 'Değişiklik Talebi',
  NEW_DEVELOPMENT = 'Yeni Geliştirme',
  OTHER           = 'Diğer',
}

export enum ITSMRole {
  END_USER = 'end_user',
  L1_AGENT = 'l1_agent',
  L2_L3_SPECIALIST = 'l2_l3_specialist',
  CHANGE_MANAGER = 'change_manager',
  SERVICE_DESK_MANAGER = 'service_desk_manager',
  ADMIN = 'admin',
}
