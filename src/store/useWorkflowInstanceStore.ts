import { create } from 'zustand';
import { useAuthStore } from './useAuthStore';
import {
  loadWorkflowInstances,
  submitDecision,
  cancelWorkflowInstance,
} from '@/services/workflowEngine';
import type {
  WorkflowInstance,
  WorkflowTicketType,
  StepDecisionResult,
} from '@/lib/itsm/types/workflow-engine.types';

interface WorkflowInstanceState {
  instances: WorkflowInstance[];
  loading: boolean;

  /** Tüm instance'ları Supabase'den yükler */
  load: () => Promise<void>;

  /**
   * Yeni oluşturulan instance'ı store'a ekler.
   * triggerWorkflow() çağrısından sonra SR/CR store tarafından kullanılır.
   */
  addInstance: (instance: WorkflowInstance) => void;

  /**
   * Bir ticket'a ait aktif (running) instance'ı döner.
   * Detail sayfalarında mevcut onay durumunu göstermek için.
   */
  getForTicket: (
    ticketType: WorkflowTicketType,
    ticketId: string,
  ) => WorkflowInstance | undefined;

  /**
   * Bir onay adımına karar gönderir.
   * Dönen StepDecisionResult.outcome değerine göre UI
   * ilgili ticket store'unda approve/reject çağrısı yapabilir.
   *
   * outcome === 'approved' → tüm workflow bitti, ticket onaylanabilir
   * outcome === 'rejected' → workflow reddedildi, ticket reddedilebilir
   * outcome === 'pending'  → adım henüz tamamlanmadı veya sonraki adıma geçildi
   */
  decide: (
    instanceId: string,
    stepDefId: string,
    decision: 'approved' | 'rejected',
    comment?: string,
  ) => Promise<StepDecisionResult | null>;

  /** Çalışan instance'ı iptal eder (ticket silindiğinde/iptal edildiğinde) */
  cancel: (instanceId: string) => Promise<void>;
}

export const useWorkflowInstanceStore = create<WorkflowInstanceState>()(
  (set, get) => ({
    instances: [],
    loading: false,

    load: async () => {
      set({ loading: true });
      const instances = await loadWorkflowInstances();
      set({ instances, loading: false });
    },

    addInstance: (instance) => {
      set((s) => ({ instances: [...s.instances, instance] }));
    },

    getForTicket: (ticketType, ticketId) => {
      return get().instances.find(
        (i) =>
          i.ticketType === ticketType &&
          i.ticketId === ticketId &&
          i.status === 'running',
      );
    },

    decide: async (instanceId, stepDefId, decision, comment) => {
      const user = useAuthStore.getState().user;
      if (!user) return null;

      const instance = get().instances.find((i) => i.id === instanceId);
      if (!instance) return null;

      const result = await submitDecision(
        instance,
        stepDefId,
        user.id,
        user.name,
        decision,
        comment,
      );

      set((s) => ({
        instances: s.instances.map((i) =>
          i.id === instanceId ? result.instance : i,
        ),
      }));

      return result;
    },

    cancel: async (instanceId) => {
      const instance = get().instances.find((i) => i.id === instanceId);
      if (!instance || instance.status !== 'running') return;

      const updated = await cancelWorkflowInstance(instance);
      set((s) => ({
        instances: s.instances.map((i) => (i.id === instanceId ? updated : i)),
      }));
    },
  }),
);
