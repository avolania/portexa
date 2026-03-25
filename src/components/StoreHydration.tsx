"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useReportStore } from "@/store/useReportStore";
import { useActivityStore } from "@/store/useActivityStore";
import { useFileStore } from "@/store/useFileStore";
import { useSettingsStore } from "@/store/useSettingsStore";
import { useRequestStore } from "@/store/useRequestStore";
import { useWorkflowStore } from "@/store/useWorkflowStore";

export default function StoreHydration() {
  useEffect(() => {
    // Supabase Auth session kontrolü + listener kurulumu
    useAuthStore.getState().initAuth();

    // Uygulama verileri: Supabase'den yükle
    useAuthStore.getState().loadProfiles();
    useProjectStore.getState().load();
    useTeamStore.getState().load();
    useGovernanceStore.getState().load();
    useNotificationStore.getState().load();
    useReportStore.getState().load();
    useActivityStore.getState().load();
    useFileStore.getState().load();
    useSettingsStore.getState().load();
    useRequestStore.getState().load();
    useWorkflowStore.getState().load();
  }, []);

  return null;
}
