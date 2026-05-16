"use client";

import { useAuthStore } from "@/store/useAuthStore";
import type { Permission } from "@/types";

export function usePermission(permission: Permission): boolean {
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  return effectivePermissions.includes(permission);
}

export function useAnyPermission(permissions: Permission[]): boolean {
  const effectivePermissions = useAuthStore((s) => s.effectivePermissions);
  return permissions.some((p) => effectivePermissions.includes(p));
}

export function useRole() {
  return useAuthStore((s) => s.user?.role);
}
