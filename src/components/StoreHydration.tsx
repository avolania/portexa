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
import { useIncidentStore } from "@/store/useIncidentStore";
import { useServiceRequestStore } from "@/store/useServiceRequestStore";
import { useChangeRequestStore } from "@/store/useChangeRequestStore";

function loadAllStores() {
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
  useIncidentStore.getState().load();
  useServiceRequestStore.getState().load();
  useChangeRequestStore.getState().load();
}

export default function StoreHydration() {
  useEffect(() => {
    // Auth listener başlat
    useAuthStore.getState().initAuth();

    // isAuthenticated true olduğunda store'ları yükle
    // (Supabase v2'de session onAuthStateChange ile async gelir)
    if (useAuthStore.getState().isAuthenticated) {
      loadAllStores();
      return;
    }

    const unsub = useAuthStore.subscribe((state) => {
      if (state.isAuthenticated) {
        loadAllStores();
        unsub();
      }
    });

    return () => unsub();
  }, []);

  return null;
}
