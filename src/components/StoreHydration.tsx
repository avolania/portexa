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

export default function StoreHydration() {
  useEffect(() => {
    // Auth session: localStorage ile yükle (oturum cihaza özel)
    useAuthStore.persist.rehydrate();

    // Diğer tüm veriler: Supabase'den yükle (tüm cihazlarda paylaşımlı)
    useAuthStore.getState().loadProfiles();
    useProjectStore.getState().load();
    useTeamStore.getState().load();
    useGovernanceStore.getState().load();
    useNotificationStore.getState().load();
    useReportStore.getState().load();
    useActivityStore.getState().load();
    useFileStore.getState().load();
    useSettingsStore.getState().load();
  }, []);

  return null;
}
