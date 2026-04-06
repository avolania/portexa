"use client";

import {
  FolderKanban, CheckSquare, Trophy, AlertTriangle,
  TrendingUp, ArrowRight, Circle, CalendarDays, Users, ChevronRight,
} from "lucide-react";
import AISuggestions from "@/components/AISuggestions";
import PendingApprovalsWidget from "@/components/itsm/PendingApprovalsWidget";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { useGovernanceStore } from "@/store/useGovernanceStore";
import { PriorityBadge, StatusBadge, ProjectStatusBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import { format, formatDistanceToNow, isAfter, isBefore, addDays, startOfDay } from "date-fns";
import { tr } from "date-fns/locale";
import { cn } from "@/lib/utils";
import {
  PieChart, Pie, Cell, Tooltip, ResponsiveContainer,
} from "recharts";

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6b7280"];

const TASK_STATUS_CONFIG = {
  todo:        { label: "Yapılacak",   color: "bg-gray-400",    text: "text-gray-600",   bar: "bg-gray-300" },
  in_progress: { label: "Devam Eden",  color: "bg-indigo-500",  text: "text-indigo-700", bar: "bg-indigo-500" },
  review:      { label: "İncelemede", color: "bg-amber-400",   text: "text-amber-700",  bar: "bg-amber-400" },
  done:        { label: "Tamamlandı", color: "bg-emerald-500", text: "text-emerald-700",bar: "bg-emerald-500" },
};

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const profiles = useAuthStore((s) => s.profiles);
  const { projects, tasks } = useProjectStore();
  const notifications = useNotificationStore((s) => s.notifications);
  const governanceItems = useGovernanceStore((s) => s.items);

  const activeProjects = projects.filter((p) => p.status === "active").length;
  const openTasks = tasks.filter((t) => t.status !== "done").length;
  const doneTasks = tasks.filter((t) => t.status === "done").length;
  const upcomingDeadlines = tasks.filter((t) => {
    if (!t.dueDate || t.status === "done") return false;
    const d = new Date(t.dueDate);
    const now = new Date();
    const diff = (d.getTime() - now.getTime()) / (1000 * 60 * 60 * 24);
    return diff <= 7 && diff >= 0;
  }).length;

  const myTasks = tasks.filter((t) => t.assigneeId === user?.id && t.status !== "done").slice(0, 5);

  // Görev durumu dağılımı
  const taskStatusCounts = {
    todo:        tasks.filter((t) => t.status === "todo").length,
    in_progress: tasks.filter((t) => t.status === "in_progress").length,
    review:      tasks.filter((t) => t.status === "review").length,
    done:        tasks.filter((t) => t.status === "done").length,
  };
  const totalTasks = Object.values(taskStatusCounts).reduce((a, b) => a + b, 0);

  // Yaklaşan toplantılar — önümüzdeki 14 gün
  const today = startOfDay(new Date());
  const in14 = addDays(today, 14);
  const upcomingMeetings = governanceItems
    .filter((g) => {
      if (g.category !== "meeting" || !g.meetingDate) return false;
      const d = new Date(g.meetingDate);
      return isAfter(d, new Date()) && isBefore(d, in14);
    })
    .sort((a, b) => new Date(a.meetingDate!).getTime() - new Date(b.meetingDate!).getTime())
    .slice(0, 5);

  const pieData = [
    { name: "Aktif", value: projects.filter((p) => p.status === "active").length },
    { name: "Riskli", value: projects.filter((p) => p.status === "at_risk").length },
    { name: "Beklemede", value: projects.filter((p) => p.status === "on_hold").length },
    { name: "Tamamlandı", value: projects.filter((p) => p.status === "completed").length },
  ];

  return (
    <div className="max-w-7xl mx-auto space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-2xl font-bold text-gray-900">
          Hoş geldiniz, {user?.name?.split(" ")[0]} 👋
        </h1>
        <p className="text-sm text-gray-500 mt-1">İşte bugünkü genel durumunuz.</p>
      </div>

      {/* Summary Cards */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-4">
        {[
          { label: "Aktif Proje", value: activeProjects, icon: FolderKanban, color: "text-indigo-600", bg: "bg-indigo-50" },
          { label: "Açık Görev", value: openTasks, icon: CheckSquare, color: "text-amber-600", bg: "bg-amber-50" },
          { label: "Tamamlanan", value: doneTasks, icon: Trophy, color: "text-emerald-600", bg: "bg-emerald-50" },
          { label: "Yaklaşan Deadline", value: upcomingDeadlines, icon: AlertTriangle, color: "text-red-600", bg: "bg-red-50" },
        ].map((card) => {
          const Icon = card.icon;
          return (
            <div key={card.label} className="card">
              <div className="flex items-center justify-between mb-3">
                <div className={`w-10 h-10 ${card.bg} rounded-xl flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${card.color}`} />
                </div>
                <TrendingUp className="w-4 h-4 text-emerald-500" />
              </div>
              <div className="text-3xl font-bold text-gray-900">{card.value}</div>
              <div className="text-sm text-gray-500 mt-1">{card.label}</div>
            </div>
          );
        })}
      </div>

      {/* Main Grid */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-6">
        {/* Left col - 2/3 */}
        <div className="lg:col-span-2 space-y-6">
          {/* My tasks */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Bana Atanan Görevler</h2>
              <Link href="/gorevler" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                Tümünü gör <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-3">
              {myTasks.length === 0 ? (
                <p className="text-sm text-gray-500 py-4 text-center">Atanmış görev bulunmuyor.</p>
              ) : (
                myTasks.map((task) => (
                  <div key={task.id} className="flex items-start gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Circle className="w-4 h-4 text-gray-300 flex-shrink-0 mt-0.5" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                      <div className="flex items-center gap-1.5 mt-1 flex-wrap">
                        <StatusBadge status={task.status} />
                        <PriorityBadge priority={task.priority} />
                        {task.dueDate && (
                          <span className="text-xs text-gray-400">· {new Date(task.dueDate).toLocaleDateString("tr-TR")}</span>
                        )}
                      </div>
                    </div>
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Görev Durumu */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Görev Durumu</h2>
              <Link href="/gorevler" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                Tümü <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            {totalTasks === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Henüz görev yok.</p>
            ) : (
              <div className="space-y-3">
                {(Object.keys(taskStatusCounts) as Array<keyof typeof taskStatusCounts>).map((status) => {
                  const count = taskStatusCounts[status];
                  const pct = totalTasks > 0 ? Math.round((count / totalTasks) * 100) : 0;
                  const cfg = TASK_STATUS_CONFIG[status];
                  return (
                    <div key={status}>
                      <div className="flex items-center justify-between text-sm mb-1">
                        <div className="flex items-center gap-2">
                          <span className={cn("w-2.5 h-2.5 rounded-full", cfg.color)} />
                          <span className="text-gray-600">{cfg.label}</span>
                        </div>
                        <span className={cn("font-semibold tabular-nums", cfg.text)}>{count}</span>
                      </div>
                      <div className="w-full bg-gray-100 rounded-full h-1.5">
                        <div className={cn("h-full rounded-full transition-all", cfg.bar)} style={{ width: `${pct}%` }} />
                      </div>
                    </div>
                  );
                })}
                <p className="text-xs text-gray-400 pt-1">Toplam {totalTasks} görev</p>
              </div>
            )}
          </div>

          {/* Yaklaşan Toplantılar */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900 flex items-center gap-2">
                <CalendarDays className="w-4 h-4 text-indigo-500" />
                Yaklaşan Toplantılar
              </h2>
              <span className="text-xs text-gray-400">Önümüzdeki 14 gün</span>
            </div>
            {upcomingMeetings.length === 0 ? (
              <p className="text-sm text-gray-400 text-center py-4">Planlanmış toplantı yok.</p>
            ) : (
              <div className="space-y-3">
                {upcomingMeetings.map((meeting) => {
                  const project = projects.find((p) => p.id === meeting.projectId);
                  const meetingDt = new Date(meeting.meetingDate!);
                  const isToday = format(meetingDt, "yyyy-MM-dd") === format(new Date(), "yyyy-MM-dd");
                  return (
                    <div key={meeting.id} className={cn(
                      "flex items-start gap-3 p-3 rounded-lg border transition-colors",
                      isToday ? "border-indigo-200 bg-indigo-50/50" : "border-gray-100 bg-white hover:bg-gray-50"
                    )}>
                      <div className={cn(
                        "w-10 h-10 rounded-lg flex flex-col items-center justify-center shrink-0 text-center",
                        isToday ? "bg-indigo-600 text-white" : "bg-gray-100 text-gray-700"
                      )}>
                        <span className="text-xs font-medium leading-tight">{format(meetingDt, "MMM", { locale: tr })}</span>
                        <span className="text-base font-bold leading-tight">{format(meetingDt, "d")}</span>
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="text-sm font-medium text-gray-900 truncate">{meeting.title}</div>
                        <div className="flex items-center gap-2 mt-0.5 flex-wrap">
                          {project && (
                            <span className="text-xs text-gray-500 truncate">{project.name}</span>
                          )}
                          {meeting.attendees && meeting.attendees.length > 0 && (
                            <span className="flex items-center gap-1 text-xs text-gray-400">
                              <Users className="w-3 h-3" /> {meeting.attendees.length}
                            </span>
                          )}
                          {isToday && (
                            <span className="text-xs px-1.5 py-0.5 bg-indigo-100 text-indigo-700 rounded-full font-medium">Bugün</span>
                          )}
                        </div>
                      </div>
                      <span className="text-xs text-gray-400 shrink-0">
                        {format(meetingDt, "HH:mm") !== "00:00" ? format(meetingDt, "HH:mm") : ""}
                      </span>
                    </div>
                  );
                })}
              </div>
            )}
          </div>

          {/* Projects list */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Aktif Projeler</h2>
              <Link href="/projeler" className="text-sm text-indigo-600 hover:underline flex items-center gap-1">
                Tümünü gör <ArrowRight className="w-3 h-3" />
              </Link>
            </div>
            <div className="space-y-4">
              {projects.filter((p) => p.status === "active" || p.status === "at_risk").map((project) => (
                <div key={project.id} className="flex items-center gap-4">
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-2 mb-1">
                      <Link href={`/projeler/${project.id}`} className="text-sm font-medium text-gray-900 hover:text-indigo-600 truncate">
                        {project.name}
                      </Link>
                      <ProjectStatusBadge status={project.status} />
                    </div>
                    <div className="flex items-center gap-2">
                      <div className="flex-1 bg-gray-200 rounded-full h-1.5">
                        <div
                          className="h-full bg-indigo-500 rounded-full"
                          style={{ width: `${project.progress}%` }}
                        />
                      </div>
                      <span className="text-xs text-gray-500 w-8">{project.progress}%</span>
                    </div>
                  </div>
                  <Avatar name={profiles[project.managerId]?.name ?? "PM"} size="sm" />
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Right col - 1/3 */}
        <div className="space-y-6">
          {/* Pie chart */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Proje Dağılımı</h2>
            <ResponsiveContainer width="100%" height={160}>
              <PieChart>
                <Pie
                  data={pieData}
                  cx="50%"
                  cy="50%"
                  innerRadius={45}
                  outerRadius={70}
                  dataKey="value"
                  paddingAngle={3}
                >
                  {pieData.map((_, i) => (
                    <Cell key={i} fill={PIE_COLORS[i]} />
                  ))}
                </Pie>
                <Tooltip />
              </PieChart>
            </ResponsiveContainer>
            <div className="space-y-2 mt-2">
              {pieData.map((entry, i) => (
                <div key={entry.name} className="flex items-center justify-between text-sm">
                  <div className="flex items-center gap-2">
                    <div className="w-2.5 h-2.5 rounded-full" style={{ background: PIE_COLORS[i] }} />
                    <span className="text-gray-600">{entry.name}</span>
                  </div>
                  <span className="font-medium text-gray-900">{entry.value}</span>
                </div>
              ))}
            </div>
          </div>

          {/* Notifications */}
          <div className="card">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-base font-semibold text-gray-900">Son Aktiviteler</h2>
              <Link href="/bildirimler" className="text-xs text-indigo-600 hover:underline">Tümü</Link>
            </div>
            <div className="space-y-3">
              {notifications.slice(0, 4).map((n) => (
                <div key={n.id} className={`flex items-start gap-3 p-2 rounded-lg ${!n.read ? "bg-indigo-50" : ""}`}>
                  <div className={`w-2 h-2 rounded-full mt-2 flex-shrink-0 ${!n.read ? "bg-indigo-500" : "bg-gray-300"}`} />
                  <div className="min-w-0">
                    <div className="text-sm font-medium text-gray-900">{n.title}</div>
                    <div className="text-xs text-gray-500 mt-0.5 line-clamp-2">{n.message}</div>
                    <div className="text-xs text-gray-400 mt-1">
                      {formatDistanceToNow(new Date(n.createdAt), { addSuffix: true, locale: tr })}
                    </div>
                  </div>
                </div>
              ))}
            </div>
          </div>

          {/* Pending approvals */}
          <PendingApprovalsWidget />

          {/* AI suggestion */}
          <AISuggestions />
        </div>
      </div>
    </div>
  );
}
