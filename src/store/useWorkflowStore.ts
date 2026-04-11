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
  addTemplate: (t: WorkflowTemplate) => void;
  updateTemplate: (id: string, data: Partial<WorkflowTemplate>) => void;
  deleteTemplate: (id: string) => void;
}

export const useWorkflowStore = create<WorkflowState>()((set) => ({
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

  addTemplate: (t) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ templates: [...s.templates, t] }));
    createWorkflowTemplate(t, orgId);
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

  deleteTemplate: (id) => {
    set((s) => ({ templates: s.templates.filter((t) => t.id !== id) }));
    deleteWorkflowTemplate(id);
  },
}));
