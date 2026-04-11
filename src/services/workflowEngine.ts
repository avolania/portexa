/**
 * Workflow Engine — Faz 1
 *
 * Supabase'de `workflow_instances` tablosuna ihtiyaç duyar:
 *   create table workflow_instances (
 *     id   text primary key,
 *     data jsonb not null
 *   );
 *   alter table workflow_instances enable row level security;
 *   create policy "authenticated" on workflow_instances
 *     for all using (auth.role() = 'authenticated');
 */

import { dbLoadAll, dbLoadOne, dbUpsert } from '@/lib/db';
import { createNotification } from '@/services/notificationService';
import type { ApprovalWorkflowTemplate, ITSMConfig } from '@/lib/itsm/types/config.types';
import type {
  WorkflowInstance,
  WorkflowStepInstance,
  WorkflowTicketType,
  StepDecisionResult,
  ApproverDecision,
} from '@/lib/itsm/types/workflow-engine.types';

const uuid = () => crypto.randomUUID();
const TABLE = 'workflow_instances';

// ─── Bildirim Helpers ─────────────────────────────────────────────────────────

const TICKET_LABELS: Record<WorkflowTicketType, string> = {
  service_request: 'Servis Talebi',
  change_request:  'Değişiklik Talebi',
  incident:        'Incident',
};

const TICKET_LINKS: Record<WorkflowTicketType, string> = {
  service_request: '/itsm/service-requests',
  change_request:  '/itsm/change-requests',
  incident:        '/itsm/incidents',
};

/**
 * Aktive olan adımın tüm onaylayıcılarına "onay bekleniyor" bildirimi gönderir.
 * Bildirimler kişisel (recipientId) olarak saklanır; her onaylayıcıya ayrı kayıt.
 */
async function notifyApprovers(
  step: WorkflowStepInstance,
  ticketType: WorkflowTicketType,
  ticketId: string,
  orgId: string,
): Promise<void> {
  const now  = new Date().toISOString();
  const link = `${TICKET_LINKS[ticketType]}/${ticketId}`;
  const label = TICKET_LABELS[ticketType];

  await Promise.all(
    step.resolvedApproverIds.map((recipientId) =>
      createNotification(
        {
          id: uuid(),
          type: 'approval_requested',
          recipientId,
          title: `Onay Bekleniyor: ${step.label}`,
          message: `${label} için "${step.label}" adımında onayınız bekleniyor.`,
          read: false,
          link,
          createdAt: now,
        },
        orgId,
      ),
    ),
  );
}

/**
 * Instance tamamlandığında/reddedildiğinde ticket sahibine bildirim gönderir.
 * ticketOwnerId: SR'da requestedById, CR'da requestedById — çağıran tarafından iletilir.
 */
async function notifyOutcome(
  outcome: 'completed' | 'rejected',
  ticketType: WorkflowTicketType,
  ticketId: string,
  ticketOwnerId: string,
  orgId: string,
): Promise<void> {
  const now   = new Date().toISOString();
  const link  = `${TICKET_LINKS[ticketType]}/${ticketId}`;
  const label = TICKET_LABELS[ticketType];
  const approved = outcome === 'completed';

  await createNotification(
    {
      id: uuid(),
      type: 'approval_resolved',
      recipientId: ticketOwnerId,
      title: approved ? `${label} Onaylandı` : `${label} Reddedildi`,
      message: approved
        ? `${label} talebiniz tüm onay adımlarından geçti.`
        : `${label} talebiniz onay sürecinde reddedildi.`,
      read: false,
      link,
      createdAt: now,
    },
    orgId,
  );
}

// ─── Load ─────────────────────────────────────────────────────────────────────

export async function loadWorkflowInstances(): Promise<WorkflowInstance[]> {
  return dbLoadAll<WorkflowInstance>(TABLE);
}

/**
 * Bir ticket'a ait aktif (running) instance'ı döner.
 * Genellikle detail sayfasında mevcut onay durumunu göstermek için kullanılır.
 */
export async function getActiveInstance(
  ticketType: WorkflowTicketType,
  ticketId: string,
): Promise<WorkflowInstance | null> {
  const all = await loadWorkflowInstances();
  return (
    all.find(
      (i) =>
        i.ticketId === ticketId &&
        i.ticketType === ticketType &&
        i.status === 'running',
    ) ?? null
  );
}

// ─── Onaylayıcı ID Çözümlemesi ────────────────────────────────────────────────

/**
 * Adım tanımındaki role/group/user bilgisini somut userId listesine çevirir.
 * Bu işlem triggerWorkflow anında yapılır; config değişse bile instance'taki
 * resolvedApproverIds sabit kalır.
 */
function resolveApproverIds(
  step: ApprovalWorkflowTemplate['steps'][number],
  config: ITSMConfig,
): string[] {
  // Sabit kullanıcı her zaman önce denenir
  if (step.fixedUserId) {
    return [step.fixedUserId];
  }

  if (step.approverType === 'user') {
    return step.userId ? [step.userId] : [];
  }
  if (step.approverType === 'role') {
    return Object.entries(config.userRoles)
      .filter(([, role]) => role === step.itsmRole)
      .map(([userId]) => userId);
  }
  if (step.approverType === 'group') {
    const group = config.groups.find((g) => g.id === step.groupId);
    return group?.memberIds ?? [];
  }
  return [];
}

// ─── Trigger ──────────────────────────────────────────────────────────────────

/**
 * Bir ApprovalWorkflowTemplate'den yeni bir WorkflowInstance oluşturur ve
 * ilk adımı aktive eder. Oluşturulan instance Supabase'e yazılır.
 *
 * @param definition  Kaynak şablon (useITSMConfigStore.config.approvalWorkflows içinden)
 * @param ticketType  'service_request' | 'change_request' | 'incident'
 * @param ticketId    İlgili ticket'ın id'si
 * @param orgId       Organizasyon id'si (RLS için)
 * @param config      Tam ITSM config (role/group çözümlemesi için)
 */
export async function triggerWorkflow(
  definition: ApprovalWorkflowTemplate,
  ticketType: WorkflowTicketType,
  ticketId: string,
  orgId: string,
  config: ITSMConfig,
  ticketOwnerId?: string,
): Promise<WorkflowInstance> {
  const now = new Date().toISOString();
  const id = uuid();

  const sortedSteps = [...definition.steps].sort((a, b) => a.order - b.order);

  const steps: WorkflowStepInstance[] = sortedSteps.map((stepDef, idx) => {
    const resolvedApproverIds = resolveApproverIds(stepDef, config);
    if (resolvedApproverIds.length === 0) {
      throw new Error(
        `Workflow "${definition.name}" adım "${stepDef.label}" için onaylayıcı çözümlenemedi ` +
        `(approverType: ${stepDef.approverType}). ` +
        `İlgili rol/grup/kullanıcıyı ITSM Ayarları'ndan yapılandırın.`,
      );
    }
    return {
      stepDefId: stepDef.id,
      order: stepDef.order,
      label: stepDef.label,
      approverType: stepDef.approverType,
      approvalMode: stepDef.approvalMode,
      resolvedApproverIds,
      status: idx === 0 ? 'active' : 'pending',
      decisions: [],
      activatedAt: idx === 0 ? now : undefined,
    };
  });

  const instance: WorkflowInstance = {
    id,
    definitionId: definition.id,
    ticketType,
    ticketId,
    orgId,
    ticketOwnerId,
    status: 'running',
    currentStepIndex: 0,
    steps,
    startedAt: now,
  };

  await dbUpsert(TABLE, id, instance, orgId);

  // İlk adım aktivasyonunda onaylayıcılara bildirim gönder
  try {
    await notifyApprovers(steps[0], ticketType, ticketId, orgId);
  } catch (err) {
    console.error('[workflow] notifyApprovers failed:', err);
  }

  return instance;
}

// ─── Submit Decision ──────────────────────────────────────────────────────────

/**
 * Bir onaylayıcının kararını işler ve adımı/instance'ı ilerletir.
 *
 * Kurallar:
 * - Aynı onaylayıcı aynı adıma iki kez karar veremez.
 * - Herhangi bir red, adımı ve instance'ı anında reddeder (any/all farkı yok).
 * - approvalMode === 'any': ilk onay adımı tamamlar.
 * - approvalMode === 'all': resolvedApproverIds sayısı kadar onay gerekir.
 * - Son adım onaylandığında instance 'completed' olur → outcome: 'approved'.
 * - Herhangi bir adım reddedildiğinde instance 'rejected' olur → outcome: 'rejected'.
 */
export async function submitDecision(
  instanceOrId: WorkflowInstance | string,
  stepDefId: string,
  approverId: string,
  approverName: string,
  decision: 'approved' | 'rejected',
  comment?: string,
): Promise<StepDecisionResult> {
  // Always fetch a fresh copy from DB to avoid concurrent-write race conditions
  const instanceId = typeof instanceOrId === 'string' ? instanceOrId : instanceOrId.id;
  const instance = await dbLoadOne<WorkflowInstance>(TABLE, instanceId);

  const noop: StepDecisionResult = {
    instance: instance ?? (typeof instanceOrId === 'object' ? instanceOrId : ({} as WorkflowInstance)),
    stepCompleted: false,
    instanceCompleted: false,
    outcome: 'pending',
  };

  if (!instance) return noop;

  const stepIdx = instance.steps.findIndex((s) => s.stepDefId === stepDefId);
  if (stepIdx === -1) return noop;

  const step = instance.steps[stepIdx];
  if (step.status !== 'active') return noop;

  // Aynı onaylayıcıdan tekrar karar gelmesin
  if (step.decisions.some((d) => d.approverId === approverId)) return noop;

  const now = new Date().toISOString();
  const newDecision: ApproverDecision = {
    approverId,
    approverName,
    decision,
    comment,
    decidedAt: now,
  };

  const updatedDecisions = [...step.decisions, newDecision];

  // ─ Adım tamamlandı mı? ────────────────────────────────────────────────────
  let stepCompleted = false;
  let stepOutcome: 'approved' | 'rejected' | 'pending' = 'pending';

  if (decision === 'rejected') {
    // Red her zaman anında adımı (ve instance'ı) sonlandırır
    stepCompleted = true;
    stepOutcome = 'rejected';
  } else if (step.approvalMode === 'any') {
    stepCompleted = true;
    stepOutcome = 'approved';
  } else {
    // 'all' modu: tüm resolvedApproverIds onaylamalı
    const needed = step.resolvedApproverIds.length || 1;
    const approvedCount = updatedDecisions.filter((d) => d.decision === 'approved').length;
    if (approvedCount >= needed) {
      stepCompleted = true;
      stepOutcome = 'approved';
    }
  }

  const isLastStep = stepIdx === instance.steps.length - 1;

  // ─ Adım durumlarını güncelle ──────────────────────────────────────────────
  const updatedSteps: WorkflowStepInstance[] = instance.steps.map((s, i) => {
    if (i === stepIdx) {
      return {
        ...s,
        decisions: updatedDecisions,
        status: stepCompleted ? stepOutcome : 'active',
        completedAt: stepCompleted ? now : undefined,
      };
    }
    // Sonraki adımı aktive et
    if (stepCompleted && stepOutcome === 'approved' && i === stepIdx + 1) {
      return { ...s, status: 'active' as const, activatedAt: now };
    }
    return s;
  });

  // ─ Instance durumunu belirle ──────────────────────────────────────────────
  let instanceStatus = instance.status;
  let instanceCompleted = false;
  let finalOutcome: StepDecisionResult['outcome'] = 'pending';

  if (stepCompleted) {
    if (stepOutcome === 'rejected') {
      instanceStatus = 'rejected';
      instanceCompleted = true;
      finalOutcome = 'rejected';
    } else if (isLastStep) {
      instanceStatus = 'completed';
      instanceCompleted = true;
      finalOutcome = 'approved';
    }
    // Approved ama son adım değil → pending (sonraki adım aktive edildi)
  }

  const updatedInstance: WorkflowInstance = {
    ...instance,
    steps: updatedSteps,
    currentStepIndex:
      stepCompleted && stepOutcome === 'approved' && !isLastStep
        ? stepIdx + 1
        : instance.currentStepIndex,
    status: instanceStatus,
    completedAt: instanceCompleted ? now : undefined,
  };

  await dbUpsert(TABLE, instance.id, updatedInstance, instance.orgId);

  // Sonraki adım aktive olduysa o adımın onaylayıcılarına bildirim gönder
  if (stepCompleted && stepOutcome === 'approved' && !isLastStep) {
    const nextStep = updatedInstance.steps[stepIdx + 1];
    if (nextStep) {
      await notifyApprovers(nextStep, instance.ticketType, instance.ticketId, instance.orgId);
    }
  }

  // Instance kapandıysa ticket sahibine sonuç bildirimi gönder
  if (instanceCompleted && instance.ticketOwnerId) {
    await notifyOutcome(
      updatedInstance.status as 'completed' | 'rejected',
      instance.ticketType,
      instance.ticketId,
      instance.ticketOwnerId,
      instance.orgId,
    );
  }

  return {
    instance: updatedInstance,
    stepCompleted,
    instanceCompleted,
    outcome: finalOutcome,
  };
}

// ─── Cancel ───────────────────────────────────────────────────────────────────

/** Çalışan bir instance'ı iptal eder (ticket iptal/silme durumunda kullanılır). */
export async function cancelWorkflowInstance(
  instance: WorkflowInstance,
): Promise<WorkflowInstance> {
  const updated: WorkflowInstance = {
    ...instance,
    status: 'cancelled',
    completedAt: new Date().toISOString(),
  };
  await dbUpsert(TABLE, instance.id, updated, instance.orgId);
  return updated;
}
