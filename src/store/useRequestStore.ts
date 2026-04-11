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
  loading: boolean;
  error: string | null;
  load: () => Promise<void>;
  addRequest: (r: WorkflowRequest) => Promise<void>;
  updateRequest: (id: string, data: Partial<WorkflowRequest>) => Promise<void>;
  deleteRequest: (id: string) => Promise<void>;
  review: (id: string, status: "approved" | "rejected", reviewedBy: string, note?: string) => Promise<void>;
  advanceStep: (id: string, entry: WorkflowStepHistoryEntry, isLastStep: boolean) => Promise<void>;
}

export const useRequestStore = create<RequestState>()((set, get) => ({
  requests: [],
  loading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const requests = await loadRequests();
      set({ requests, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  addRequest: async (r) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ requests: [...s.requests, r] }));
    try {
      await createRequest(r, orgId);
    } catch (err) {
      set((s) => ({ requests: s.requests.filter((req) => req.id !== r.id) }));
      throw err;
    }
  },

  updateRequest: async (id, patch) => {
    const rollback = get().requests.find((r) => r.id === id);
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id ? { ...r, ...patch, updatedAt: new Date().toISOString() } : r
      ),
    }));
    try {
      const updated = await updateRequest(id, patch, get().requests);
      if (updated) set((s) => ({ requests: s.requests.map((r) => (r.id === id ? updated : r)) }));
    } catch (err) {
      if (rollback) set((s) => ({ requests: s.requests.map((r) => (r.id === id ? rollback : r)) }));
      throw err;
    }
  },

  deleteRequest: async (id) => {
    const rollback = get().requests.find((r) => r.id === id);
    set((s) => ({ requests: s.requests.filter((r) => r.id !== id) }));
    try {
      await deleteRequest(id);
    } catch (err) {
      if (rollback) set((s) => ({ requests: [...s.requests, rollback] }));
      throw err;
    }
  },

  review: async (id, status, reviewedBy, note) => {
    const rollback = get().requests.find((r) => r.id === id);
    const now = new Date().toISOString();
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? { ...r, status, reviewedBy, reviewedAt: now, reviewNote: note ?? r.reviewNote, updatedAt: now }
          : r
      ),
    }));
    try {
      const updated = await reviewRequest(id, status, reviewedBy, get().requests, note);
      if (updated) set((s) => ({ requests: s.requests.map((r) => (r.id === id ? updated : r)) }));
    } catch (err) {
      if (rollback) set((s) => ({ requests: s.requests.map((r) => (r.id === id ? rollback : r)) }));
      throw err;
    }
  },

  advanceStep: async (id, entry, isLastStep) => {
    const rollback = get().requests.find((r) => r.id === id);
    const now = new Date().toISOString();
    const existing = get().requests.find((r) => r.id === id);
    if (!existing) return;
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
    set((s) => ({
      requests: s.requests.map((r) =>
        r.id === id
          ? { ...r, status, stepHistory: history, currentStepIndex: nextIdx, reviewedBy: entry.actorId, reviewedAt: now, reviewNote: entry.note, updatedAt: now }
          : r
      ),
    }));
    try {
      const updated = await advanceRequestStep(id, entry, isLastStep, get().requests);
      if (updated) set((s) => ({ requests: s.requests.map((r) => (r.id === id ? updated : r)) }));
    } catch (err) {
      if (rollback) set((s) => ({ requests: s.requests.map((r) => (r.id === id ? rollback : r)) }));
      throw err;
    }
  },
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
