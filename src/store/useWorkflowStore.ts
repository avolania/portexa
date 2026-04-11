import { create } from "zustand";
import type { WorkflowTemplate } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadWorkflowTemplates,
  createWorkflowTemplate,
  updateWorkflowTemplate,
  deleteWorkflowTemplate,
} from "@/services/workflowService";

interface WorkflowState {
  templates: WorkflowTemplate[];
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  addTemplate: (t: WorkflowTemplate) => Promise<void>;
  updateTemplate: (id: string, data: Partial<WorkflowTemplate>) => void;
  deleteTemplate: (id: string) => Promise<void>;
}

export const useWorkflowStore = create<WorkflowState>()((set, get) => ({
  templates: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const templates = await loadWorkflowTemplates();
      set({ templates, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  addTemplate: async (t) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ templates: [...s.templates, t] }));
    try {
      await createWorkflowTemplate(t, orgId);
    } catch (err) {
      set((s) => ({ templates: s.templates.filter((tmpl) => tmpl.id !== t.id) }));
      throw err;
    }
  },

  updateTemplate: (id, patch) =>
    set((s) => {
      updateWorkflowTemplate(id, patch, s.templates).then((updated) => {
        if (updated)
          set((s2) => ({
            templates: s2.templates.map((t) => (t.id === id ? updated : t)),
          }));
      });
      return {
        templates: s.templates.map((t) =>
          t.id === id ? { ...t, ...patch, updatedAt: new Date().toISOString() } : t
        ),
      };
    }),

  deleteTemplate: async (id) => {
    const rollback = get().templates.find((t) => t.id === id);
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
    try {
      await deleteWorkflowTemplate(id);
    } catch (err) {
      if (rollback) set((s) => ({ templates: [...s.templates, rollback] }));
      throw err;
    }
  },
}));
