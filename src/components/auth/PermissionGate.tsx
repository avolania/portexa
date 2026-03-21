"use client";

import { usePermission, useAnyPermission } from "@/hooks/usePermission";
import type { Permission } from "@/types";

interface Props {
  permission?: Permission;
  anyOf?: Permission[];
  fallback?: React.ReactNode;
  children: React.ReactNode;
}

/**
 * Kullanıcının gerekli yetkisi yoksa children'ı render etmez.
 * permission: tek yetki kontrolü
 * anyOf: listeden herhangi biri yeterliyse
 * fallback: yetki yoksa gösterilecek içerik (opsiyonel)
 */
export default function PermissionGate({ permission, anyOf, fallback = null, children }: Props) {
  const single = usePermission(permission ?? "project.view");
  const any = useAnyPermission(anyOf ?? []);

  const allowed = permission ? single : anyOf ? any : true;
  return allowed ? <>{children}</> : <>{fallback}</>;
}
