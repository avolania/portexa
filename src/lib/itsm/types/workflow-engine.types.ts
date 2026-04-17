import type { ApproverStepType, ApprovalStepMode } from './config.types';

// ─── Step & Instance Durumları ────────────────────────────────────────────────

export type WorkflowStepStatus =
  | 'pending'   // henüz sırası gelmedi
  | 'active'    // şu an onay bekleniyor
  | 'approved'  // onaylandı
  | 'rejected'  // reddedildi
  | 'skipped';  // ileride koşullu adımlar için

export type WorkflowInstanceStatus =
  | 'running'    // devam ediyor
  | 'completed'  // tüm adımlar onaylandı
  | 'rejected'   // herhangi bir adım reddedildi
  | 'cancelled'; // manuel iptal

export type WorkflowTicketType = 'service_request' | 'change_request' | 'incident';

// ─── Karar Kaydı ─────────────────────────────────────────────────────────────

/** Bir onaylayıcının adım üzerindeki kararı */
export interface ApproverDecision {
  approverId: string;
  approverName: string;
  decision: 'approved' | 'rejected';
  comment?: string;
  decidedAt: string;
}

// ─── Adım Instance'ı ──────────────────────────────────────────────────────────

/**
 * Bir ApprovalWorkflowStep'in çalışma-zamanı kopyası.
 * resolvedApproverIds, tetiklenme anında role/group → userId listesine çevrilir.
 */
export interface WorkflowStepInstance {
  stepDefId: string;
  order: number;
  label: string;
  approverType: ApproverStepType;
  /** any = ilk onay yeterli, all = tanımlı herkesten onay gerekli */
  approvalMode: ApprovalStepMode;
  /** Tetiklenme anında çözümlenen onaylayıcı userId listesi */
  resolvedApproverIds: string[];
  status: WorkflowStepStatus;
  decisions: ApproverDecision[];
  activatedAt?: string;
  completedAt?: string;
}

// ─── Workflow Instance ────────────────────────────────────────────────────────

/** Bir ticket'a bağlı çalışan workflow kopyası */
export interface WorkflowInstance {
  id: string;
  /** Kaynak ApprovalWorkflowTemplate id'si */
  definitionId: string;
  ticketType: WorkflowTicketType;
  ticketId: string;
  orgId: string;
  /** Talep sahibinin userId — sonuç bildirimi için */
  ticketOwnerId?: string;
  status: WorkflowInstanceStatus;
  /** Aktif adımın steps[] içindeki index'i */
  currentStepIndex: number;
  steps: WorkflowStepInstance[];
  startedAt: string;
  completedAt?: string;
  /** H-4: Optimistik kilit versiyonu — her dbConditionalUpdate'te artırılır */
  version?: number;
}

// ─── submitDecision Dönüş Tipi ────────────────────────────────────────────────

export interface StepDecisionResult {
  instance: WorkflowInstance;
  /** Bu karar adımı tamamladı mı? */
  stepCompleted: boolean;
  /** Tüm workflow bitti mi? (approved veya rejected) */
  instanceCompleted: boolean;
  /**
   * - 'approved'  → tüm adımlar geçildi, ticket onaylanabilir
   * - 'rejected'  → bir adım reddedildi, ticket reddedilebilir
   * - 'pending'   → adım henüz tamamlanmadı ya da sonraki adıma geçildi
   */
  outcome: 'approved' | 'rejected' | 'pending';
}
