"use client";

import { useEffect } from "react";
import { Bell, X, AlertCircle, CheckCircle, Clock, MessageSquare } from "lucide-react";
import { useNotificationStore } from "@/store/useNotificationStore";
import type { Notification } from "@/types";
import { useRouter } from "next/navigation";

const TOAST_DURATION = 5000;

const TYPE_CONFIG: Record<string, { icon: React.ElementType; color: string; bg: string }> = {
  task_assigned:       { icon: Bell,          color: "#3B82F6", bg: "#EFF6FF" },
  task_updated:        { icon: Bell,          color: "#6B7280", bg: "#F9FAFB" },
  comment:             { icon: MessageSquare, color: "#8B5CF6", bg: "#F5F3FF" },
  deadline:            { icon: Clock,         color: "#F59E0B", bg: "#FFFBEB" },
  budget_alert:        { icon: AlertCircle,   color: "#EF4444", bg: "#FEF2F2" },
  mention:             { icon: MessageSquare, color: "#3B82F6", bg: "#EFF6FF" },
  approval_requested:  { icon: Clock,         color: "#D97706", bg: "#FFFBEB" },
  approval_resolved:   { icon: CheckCircle,   color: "#10B981", bg: "#ECFDF5" },
};

function Toast({ notification, onDismiss }: { notification: Notification; onDismiss: () => void }) {
  const router = useRouter();
  const cfg = TYPE_CONFIG[notification.type] ?? TYPE_CONFIG.task_assigned;
  const Icon = cfg.icon;

  useEffect(() => {
    const t = setTimeout(onDismiss, TOAST_DURATION);
    return () => clearTimeout(t);
  }, [onDismiss]);

  const handleClick = () => {
    onDismiss();
    if (notification.link) router.push(notification.link);
  };

  return (
    <div
      onClick={handleClick}
      style={{
        display: "flex", alignItems: "flex-start", gap: 12,
        background: "#fff", border: "1px solid #E5E7EB",
        borderLeft: `4px solid ${cfg.color}`,
        borderRadius: 10, padding: "12px 14px",
        boxShadow: "0 4px 16px rgba(0,0,0,0.1)",
        cursor: notification.link ? "pointer" : "default",
        animation: "slideInRight 0.25s ease",
        minWidth: 300, maxWidth: 380,
      }}
    >
      <div style={{
        width: 32, height: 32, borderRadius: 8, flexShrink: 0,
        background: cfg.bg, display: "flex", alignItems: "center", justifyContent: "center",
      }}>
        <Icon style={{ width: 16, height: 16, color: cfg.color }} />
      </div>
      <div style={{ flex: 1, minWidth: 0 }}>
        <p style={{ fontSize: 13, fontWeight: 600, color: "#111827", margin: 0, lineHeight: 1.4 }}>
          {notification.title}
        </p>
        <p style={{ fontSize: 12, color: "#6B7280", margin: "2px 0 0", lineHeight: 1.4 }}>
          {notification.message}
        </p>
      </div>
      <button
        onClick={(e) => { e.stopPropagation(); onDismiss(); }}
        style={{
          background: "none", border: "none", cursor: "pointer",
          color: "#9CA3AF", padding: 2, flexShrink: 0,
        }}
      >
        <X style={{ width: 14, height: 14 }} />
      </button>
    </div>
  );
}

export default function NotificationToastContainer() {
  const toasts = useNotificationStore((s) => s.toasts);
  const dismissToast = useNotificationStore((s) => s.dismissToast);

  if (toasts.length === 0) return null;

  return (
    <>
      <style>{`
        @keyframes slideInRight {
          from { opacity: 0; transform: translateX(16px); }
          to   { opacity: 1; transform: translateX(0); }
        }
      `}</style>
      <div style={{
        position: "fixed", top: 72, right: 16,
        display: "flex", flexDirection: "column", gap: 8,
        zIndex: 9999, fontFamily: "IBM Plex Sans, sans-serif",
      }}>
        {toasts.map((t) => (
          <Toast key={t.id} notification={t} onDismiss={() => dismissToast(t.id)} />
        ))}
      </div>
    </>
  );
}
