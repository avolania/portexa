"use client";

import { useAuthStore } from "@/store/useAuthStore";
import { hasPermission, hasAnyPermission } from "@/lib/permissions";
import type { Permission } from "@/types";

export function usePermission(permission: Permission): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return hasPermission(role, permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const role = useAuthStore((s) => s.user?.role);
  return hasAnyPermission(role, permissions);
}

export function useRole() {
  return useAuthStore((s) => s.user?.role);
}
