import { create } from "zustand";
import type { WorkflowRequest, RequestStatus, WorkflowStepHistoryEntry } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadRequests,
  createRequest,
  updateRequest,
  deleteRequest,
  reviewRequest,
  advanceRequestStep,
} from "@/services/requestService";

interface RequestState {
  requests: WorkflowRequest[];
  load: () => Promise<void>;
  addRequest: (r: WorkflowRequest) => void;
  updateRequest: (id: string, data: Partial<WorkflowRequest>) => void;
  deleteRequest: (id: string) => void;
  review: (id: string, status: "approved" | "rejected", reviewedBy: string, note?: string) => void;
  advanceStep: (id: string, entry: WorkflowStepHistoryEntry, isLastStep: boolean) => void;
}

export const useRequestStore = create<RequestState>()((set) => ({
  requests: [],

  load: async () => {
    const requests = await loadRequests();
    set({ requests });
  },

  addRequest: (r) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ requests: [...s.requests, r] }));
    createRequest(r, orgId);
  },

  updateRequest: (id, patch) =>
    set((s) => {
      updateRequest(id, patch, s.requests).then((updated) => {
        if (updated)
          set((s2) => ({ requests: s2.requests.map((r) => (r.id === id ? updated : r)) }));
      });
      return {
        requests: s.requests.map((r) =>
          r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
        ),
      };
    }),

  deleteRequest: (id) => {
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
    deleteRequest(id);
  },

  review: (id, status, reviewedBy, note) =>
    set((s) => {
      reviewRequest(id, status, reviewedBy, s.requests, note).then((updated) => {
        if (updated)
          set((s2) => ({ requests: s2.requests.map((r) => (r.id === id ? updated : r)) }));
      });
      const now = new Date().toISOString();
      return {
        requests: s.requests.map((r) =>
          r.id === id
            ? { ...r, status, reviewedBy, reviewedAt: now, reviewNote: note ?? r.reviewNote, updatedAt: now }
            : r
        ),
      };
    }),

  advanceStep: (id, entry, isLastStep) =>
    set((s) => {
      advanceRequestStep(id, entry, isLastStep, s.requests).then((updated) => {
        if (updated)
          set((s2) => ({ requests: s2.requests.map((r) => (r.id === id ? updated : r)) }));
      });
      const now = new Date().toISOString();
      const existing = s.requests.find((r) => r.id === id);
      if (!existing) return {};
      const history = [...(existing.stepHistory ?? []), entry];
      const currentIdx = existing.currentStepIndex ?? 0;
      let status: RequestStatus = existing.status;
      let nextIdx = currentIdx;
      if (entry.action === "rejected") {
        status = "rejected";
      } else if (isLastStep) {
        status = "approved";
      } else {
        status = "in_review";
        nextIdx = currentIdx + 1;
      }
      return {
        requests: s.requests.map((r) =>
          r.id === id
            ? { ...r, status, stepHistory: history, currentStepIndex: nextIdx, reviewedBy: entry.actorId, reviewedAt: now, reviewNote: entry.note, updatedAt: now }
            : r
        ),
      };
    }),
}));

export const REQUEST_TYPE_META: Record<WorkflowRequest["type"], { label: string; icon: string; color: string; bg: string }> = {
  project_idea:       { label: "Proje Fikri",       icon: "💡", color: "text-yellow-700", bg: "bg-yellow-100" },
  change_request:     { label: "Değişiklik Talebi",  icon: "🔄", color: "text-violet-700", bg: "bg-violet-100" },
  budget_approval:    { label: "Bütçe Onayı",        icon: "💰", color: "text-emerald-700",bg: "bg-emerald-100"},
  resource_request:   { label: "Kaynak Talebi",      icon: "👥", color: "text-blue-700",   bg: "bg-blue-100"  },
  deadline_extension: { label: "Süre Uzatma",        icon: "📅", color: "text-amber-700",  bg: "bg-amber-100" },
  risk_report:        { label: "Risk Bildirimi",     icon: "⚠️",  color: "text-red-700",    bg: "bg-red-100"   },
  general:            { label: "Genel Talep",        icon: "📝", color: "text-gray-700",   bg: "bg-gray-100"  },
};

export const REQUEST_STATUS_META: Record<RequestStatus, { label: string; color: string; bg: string }> = {
  pending:   { label: "Bekliyor",    color: "text-amber-700",   bg: "bg-amber-100"   },
  in_review: { label: "İncelemede", color: "text-blue-700",    bg: "bg-blue-100"    },
  approved:  { label: "Onaylandı",  color: "text-emerald-700", bg: "bg-emerald-100" },
  rejected:  { label: "Reddedildi", color: "text-red-700",     bg: "bg-red-100"     },
};
