"use client";

import { Bell, Check, CheckCheck } from "lucide-react";
import { useNotificationStore } from "@/store/useNotificationStore";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import Button from "@/components/ui/Button";

const typeIcons: Record<string, string> = {
  task_assigned: "📋",
  task_updated: "✏️",
  comment: "💬",
  deadline: "⏰",
  budget_alert: "💰",
  mention: "🔔",
};

export default function BildirimlerPage() {
  const { notifications, markAsRead, markAllAsRead } = useNotificationStore();
  const unread = notifications.filter((n) => !n.read).length;

  return (
    <div className="max-w-2xl mx-auto space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Bildirimler</h1>
          {unread > 0 && <p className="text-sm text-gray-500 mt-1">{unread} okunmamış bildirim</p>}
        </div>
        {unread > 0 && (
          <Button variant="secondary" size="sm" onClick={markAllAsRead}>
            <CheckCheck className="w-4 h-4" />
            Tümünü Okundu İşaretle
          </Button>
        )}
      </div>

      <div className="card p-0 divide-y divide-gray-100">
        {notifications.length === 0 ? (
          <div className="py-16 text-center">
            <Bell className="w-12 h-12 text-gray-300 mx-auto mb-3" />
            <p className="text-gray-500">Bildirim bulunmuyor.</p>
          </div>
        ) : (
          notifications.map((n) => (
            <div
              key={n.id}
              className={`flex items-start gap-4 px-5 py-4 hover:bg-gray-50 transition-colors ${!n.read ? "bg-indigo-50/50" : ""}`}
            >
              <div className="text-2xl flex-shrink-0 mt-0.5">{typeIcons[n.type] || "🔔"}</div>
              <div className="flex-1 min-w-0">
                <div className="flex items-start justify-between gap-2">
                  <div>
                    <p className={`text-sm font-medium ${!n.read ? "text-gray-900" : "text-gray-700"}`}>{n.title}</p>
                    <p className="text-sm text-gray-500 mt-0.5">{n.message}</p>
                  </div>
                  {!n.read && (
                    <button
                      onClick={() => markAsRead(n.id)}
                      className="p-1.5 hover:bg-gray-100 rounded-lg text-gray-400 hover:text-gray-600 flex-shrink-0"
                      title="Okundu işaretle"
                    >
                      <Check className="w-3.5 h-3.5" />
                    </button>
                  )}
                </div>
                <p className="text-xs text-gray-400 mt-1">
                  {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
                </p>
              </div>
              {!n.read && <div className="w-2 h-2 bg-indigo-500 rounded-full flex-shrink-0 mt-2" />}
            </div>
          ))
        )}
      </div>
    </div>
  );
}
