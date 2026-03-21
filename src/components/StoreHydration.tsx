"use client";

import { useEffect } from "react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useTeamStore } from "@/store/useTeamStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useReportStore } from "@/store/useReportStore";

export default function StoreHydration() {
  useEffect(() => {
    useAuthStore.persist.rehydrate();
    useProjectStore.persist.rehydrate();
    useTeamStore.persist.rehydrate();
    useGovernanceStore.persist.rehydrate();
    useNotificationStore.persist.rehydrate();
    useReportStore.persist.rehydrate();
  }, []);

  return null;
}
