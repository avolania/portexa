export type UserRole = "admin" | "pm" | "member" | "approver" | "viewer";
export type ProjectType = "agile" | "waterfall";

export type Permission =
  | "project.create" | "project.edit" | "project.delete" | "project.view"
  | "task.create" | "task.edit" | "task.delete" | "task.assign" | "task.view"
  | "governance.create" | "governance.edit" | "governance.delete" | "governance.approve" | "governance.view"
  | "report.create" | "report.edit" | "report.view"
  | "team.view" | "team.manage"
  | "budget.view" | "budget.edit"
  | "settings.manage";

export interface TeamMember {
  id: string;
  name: string;
  email: string;
  role: UserRole;
  title?: string;
  department?: string;
  avatar?: string;
  projectIds: string[]; // atandığı projeler
  status: "active" | "pending" | "inactive";
  joinedAt: string;
}

export interface User {
  id: string;
  name: string;
  email: string;
  avatar?: string;
  role: UserRole;
  title?: string;
  department?: string;
  company?: string;
  phone?: string;
  language: "tr" | "en";
  rememberMe?: boolean;
}

export type Priority = "low" | "medium" | "high" | "critical";
export type TaskStatus = "todo" | "in_progress" | "review" | "done";
export type ProjectStatus = "active" | "on_hold" | "completed" | "at_risk";

// Jira-style issue types
export type IssueType =
  | "epic"
  | "story"
  | "task"
  | "bug"
  | "subtask"
  | "improvement"
  | "test";

export const ISSUE_TYPE_META: Record<IssueType, { label: string; icon: string; color: string; bg: string }> = {
  epic:        { label: "Epic",       icon: "⚡", color: "text-violet-700", bg: "bg-violet-100" },
  story:       { label: "Story",      icon: "📖", color: "text-emerald-700", bg: "bg-emerald-100" },
  task:        { label: "Task",       icon: "✅", color: "text-blue-700",   bg: "bg-blue-100" },
  bug:         { label: "Bug",        icon: "🐛", color: "text-red-700",    bg: "bg-red-100" },
  subtask:     { label: "Alt Görev",  icon: "↳",  color: "text-gray-600",   bg: "bg-gray-100" },
  improvement: { label: "İyileştirme",icon: "✨", color: "text-amber-700",  bg: "bg-amber-100" },
  test:        { label: "Test",       icon: "🧪", color: "text-cyan-700",   bg: "bg-cyan-100" },
};

export interface PhasePlanEntry {
  startDate?: string;
  endDate?: string;
  owner?: string;
  notes?: string;
}

export interface ProjectPhase {
  id: string;
  label: string;
  icon?: string;
}

export interface Project {
  id: string;
  name: string;
  description?: string;
  status: ProjectStatus;
  priority: Priority;
  projectType: ProjectType;
  startDate: string;
  endDate: string;
  progress: number;
  budget?: number;
  budgetUsed?: number;
  managerId: string;
  members: string[];
  tags: string[];
  currentSprint?: number;
  phases?: ProjectPhase[];           // özel faz listesi; yoksa varsayılan 5 faz kullanılır
  phasePlan?: Partial<Record<string, PhasePlanEntry>>;
  createdAt: string;
  updatedAt: string;
}

export type WaterfallPhase =
  | "requirements"
  | "design"
  | "development"
  | "testing"
  | "deployment";

export interface Task {
  id: string;
  projectId: string;
  title: string;
  description?: string;
  status: TaskStatus;
  priority: Priority;
  issueType?: IssueType;
  assigneeId?: string;
  startDate?: string;
  dueDate?: string;
  estimatedHours?: number;
  loggedHours?: number;
  tags: string[];
  subtasks: Subtask[];
  dependencies: string[];
  attachments: Attachment[];
  comments: Comment[];
  // Agile
  storyPoints?: number;
  sprint?: number;
  // Waterfall
  phase?: string;
  createdAt: string;
  updatedAt: string;
  order: number;
}

export interface Subtask {
  id: string;
  title: string;
  completed: boolean;
}

export interface Attachment {
  id: string;
  name: string;
  url: string;
  size: number;
  type: string;
  uploadedBy: string;
  uploadedAt: string;
}

export interface Comment {
  id: string;
  content: string;
  authorId: string;
  createdAt: string;
  updatedAt?: string;
}

export interface Notification {
  id: string;
  type: "task_assigned" | "task_updated" | "comment" | "deadline" | "budget_alert" | "mention";
  title: string;
  message: string;
  read: boolean;
  link?: string;
  createdAt: string;
}

export interface KanbanColumn {
  id: TaskStatus;
  title: string;
  tasks: Task[];
}

// ─── Governance ───────────────────────────────────────────────────────────────

export type GovernanceCategory =
  | "charter"    // Proje Tüzüğü
  | "meeting"    // Yürütme Komitesi Toplantısı
  | "risk"       // Risk Kaydı
  | "change"     // Değişiklik Talebi
  | "issue"      // Sorun Kaydı
  | "decision";  // Karar Kaydı

export type GovernanceStatus =
  | "draft" | "pending" | "approved" | "rejected" | "closed"
  | "open" | "mitigated" | "scheduled" | "completed";

// ─── Reports ──────────────────────────────────────────────────────────────────

export type ReportType = "weekly" | "steerco" | "dashboard";
export type ReportStatus = "green" | "amber" | "red";

export interface ReportSection {
  id: string;
  label: string;
  content: string;
}

export interface Report {
  id: string;
  type: ReportType;
  projectId?: string; // dashboard raporunda boş olabilir
  title: string;
  period: string;     // "2025-W12" veya "2025-03" veya "2025-Q1"
  status: ReportStatus;
  sections: ReportSection[];
  createdAt: string;
  updatedAt: string;
}

// ─── Activities ───────────────────────────────────────────────────────────────

export type ActivityType =
  | "development"
  | "design"
  | "meeting"
  | "testing"
  | "review"
  | "documentation"
  | "deployment"
  | "planning"
  | "other";

export type ActivityStatus = "draft" | "submitted" | "approved" | "rejected";

export const ACTIVITY_TYPE_META: Record<ActivityType, { label: string; icon: string; color: string; bg: string }> = {
  development:   { label: "Geliştirme",     icon: "💻", color: "text-blue-700",    bg: "bg-blue-100"    },
  design:        { label: "Tasarım",         icon: "🎨", color: "text-violet-700",  bg: "bg-violet-100"  },
  meeting:       { label: "Toplantı",        icon: "👥", color: "text-indigo-700",  bg: "bg-indigo-100"  },
  testing:       { label: "Test",            icon: "🧪", color: "text-orange-700",  bg: "bg-orange-100"  },
  review:        { label: "İnceleme",        icon: "🔍", color: "text-cyan-700",    bg: "bg-cyan-100"    },
  documentation: { label: "Dokümantasyon",   icon: "📝", color: "text-gray-700",    bg: "bg-gray-100"    },
  deployment:    { label: "Dağıtım",         icon: "🚀", color: "text-emerald-700", bg: "bg-emerald-100" },
  planning:      { label: "Planlama",        icon: "📋", color: "text-amber-700",   bg: "bg-amber-100"   },
  other:         { label: "Diğer",           icon: "✏️",  color: "text-slate-700",   bg: "bg-slate-100"   },
};

export interface ActivityEntry {
  id: string;
  userId: string;
  projectId: string;
  type: ActivityType;
  title: string;
  description?: string;
  date: string;         // YYYY-MM-DD
  hours: number;
  status: ActivityStatus;
  submittedAt?: string;
  reviewedBy?: string;
  reviewedAt?: string;
  rejectionNote?: string;
  createdAt: string;
  updatedAt: string;
}

// ─── Governance ───────────────────────────────────────────────────────────────

export interface GovernanceItem {
  id: string;
  projectId: string;
  category: GovernanceCategory;
  title: string;
  description?: string;
  status: GovernanceStatus;
  priority?: Priority;
  owner?: string;
  dueDate?: string;
  createdAt: string;
  // Risk specific
  impact?: "low" | "medium" | "high";
  probability?: "low" | "medium" | "high";
  mitigationPlan?: string;
  // Change request specific
  requestedBy?: string;
  impactAssessment?: string;
  // Meeting specific
  meetingDate?: string;
  attendees?: string[];
  minutes?: string;
  // Decision
  decidedBy?: string;
  rationale?: string;
  // Attachments
  attachments?: Attachment[];
}
