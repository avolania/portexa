import { supabase } from "./supabase";

export type AuditAction =
  // Kimlik doğrulama
  | "user.login"
  | "user.logout"
  | "user.invite_accepted"
  | "user.password_reset"
  // Kullanıcı / rol
  | "user.role_changed"
  | "user.profile_updated"
  | "user.removed"
  // Proje
  | "project.created"
  | "project.updated"
  | "project.deleted"
  // Görev
  | "task.created"
  | "task.updated"
  | "task.deleted"
  // ITSM
  | "incident.created"
  | "incident.state_changed"
  | "service_request.created"
  | "service_request.state_changed"
  | "change_request.created"
  | "change_request.state_changed"
  // Ayarlar
  | "settings.updated"
  | "org.updated";

export interface AuditLogOptions {
  resourceType?: string;
  resourceId?: string;
  resourceName?: string;
  changes?: { before?: unknown; after?: unknown };
  metadata?: Record<string, unknown>;
}

/**
 * Audit log kaydı yazar — fire-and-forget.
 * Ana iş akışını asla bloke etmez; hata olursa sessizce loglar.
 *
 * @example
 * logAudit(user, "user.login")
 * logAudit(user, "project.created", { resourceId: project.id, resourceName: project.name })
 * logAudit(user, "user.role_changed", {
 *   resourceId: targetUser.id,
 *   resourceName: targetUser.email,
 *   changes: { before: { role: "member" }, after: { role: "admin" } },
 * })
 */
export function logAudit(
  user: { id: string; email: string; orgId: string },
  action: AuditAction,
  opts: AuditLogOptions = {},
): void {
  const row = {
    id: crypto.randomUUID(),
    org_id: user.orgId,
    user_id: user.id,
    user_email: user.email,
    action,
    resource_type: opts.resourceType ?? "",
    resource_id: opts.resourceId ?? "",
    resource_name: opts.resourceName ?? "",
    changes: opts.changes ?? {},
    metadata: opts.metadata ?? {},
  };

  // Fire-and-forget — ana akışı bloke etmez
  supabase
    .from("audit_logs")
    .insert([row])
    .then(({ error }) => {
      if (error) {
        console.warn("[audit] log yazılamadı:", error.message);
      }
    });
}
