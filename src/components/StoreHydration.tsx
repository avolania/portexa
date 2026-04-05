"use client";

import { useEffect, useRef } from "react";
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
import { useOrgStore } from "@/store/useOrgStore";
import { useWorkflowInstanceStore } from "@/store/useWorkflowInstanceStore";
import { useITSMConfigStore } from "@/store/useITSMConfigStore";

function loadAllStores() {
  useAuthStore.getState().loadProfiles();
  useOrgStore.getState().load();
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
  useITSMConfigStore.getState().load();
  useWorkflowInstanceStore.getState().load();
}

const IDLE_TIMEOUT_MS = 30 * 60 * 1000; // 30 dakika
const IDLE_EVENTS = ["mousemove", "mousedown", "keydown", "touchstart", "scroll", "click"];

export default function StoreHydration() {
  const idleTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    useAuthStore.getState().initAuth();

    // Her isAuthenticated: false → true geçişinde store'ları yükle
    let prevAuthenticated = useAuthStore.getState().isAuthenticated;

    if (prevAuthenticated) loadAllStores();

    const unsub = useAuthStore.subscribe((state) => {
      if (state.isAuthenticated && !prevAuthenticated) {
        loadAllStores();
      }
      prevAuthenticated = state.isAuthenticated;
    });

    // ── Otomatik çıkış (30 dk hareketsizlik) ──────────────────────────────────
    const resetTimer = () => {
      if (!useAuthStore.getState().isAuthenticated) return;
      if (idleTimer.current) clearTimeout(idleTimer.current);
      idleTimer.current = setTimeout(() => {
        if (useAuthStore.getState().isAuthenticated) {
          useAuthStore.getState().signOut();
        }
      }, IDLE_TIMEOUT_MS);
    };

    resetTimer();
    IDLE_EVENTS.forEach((e) => window.addEventListener(e, resetTimer, { passive: true }));

    return () => {
      unsub();
      if (idleTimer.current) clearTimeout(idleTimer.current);
      IDLE_EVENTS.forEach((e) => window.removeEventListener(e, resetTimer));
    };
  }, []);

  return null;
}
