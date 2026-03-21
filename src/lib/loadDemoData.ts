import { useProjectStore } from "@/store/useProjectStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useReportStore } from "@/store/useReportStore";
import { useTeamStore } from "@/store/useTeamStore";
import { DEMO_PROJECTS, DEMO_TASKS, DEMO_GOVERNANCE, DEMO_NOTIFICATIONS } from "./demoData";

export function loadDemoData() {
  useProjectStore.getState().reset(DEMO_PROJECTS, DEMO_TASKS);
  useGovernanceStore.getState().reset(DEMO_GOVERNANCE);
  useNotificationStore.getState().reset(DEMO_NOTIFICATIONS);
  useReportStore.getState().reset([]);
  useTeamStore.getState().reset([]);
}

export function clearAllData() {
  useProjectStore.getState().reset([], []);
  useGovernanceStore.getState().reset([]);
  useNotificationStore.getState().reset([]);
  useReportStore.getState().reset([]);
  useTeamStore.getState().reset([]);
}
