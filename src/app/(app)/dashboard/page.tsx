"use client";

import {
  FolderKanban, CheckSquare, Trophy, AlertTriangle,
  TrendingUp, Clock, ArrowRight, Circle
} from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useNotificationStore } from "@/store/useNotificationStore";
import { PriorityBadge, StatusBadge, ProjectStatusBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";
import Link from "next/link";
import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import {
  BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, ResponsiveContainer,
  PieChart, Pie, Cell
} from "recharts";

const MEMBERS: Record<string, string> = {
  "1": "Ahmet Yılmaz",
  "2": "Ayşe Kara",
  "3": "Mehmet Demir",
  "4": "Zeynep Çelik",
};

const weeklyData = [
  { day: "Pzt", saat: 6 },
  { day: "Sal", saat: 8 },
  { day: "Çar", saat: 5 },
  { day: "Per", saat: 9 },
  { day: "Cum", saat: 7 },
  { day: "Cmt", saat: 2 },
  { day: "Paz", saat: 0 },
];

const PIE_COLORS = ["#10b981", "#ef4444", "#f59e0b", "#6b7280"];

export default function DashboardPage() {
  const user = useAuthStore((s) => s.user);
  const { projects, tasks } = useProjectStore();
  const notifications = useNotificationStore((s) => s.notifications);

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
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-4">
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
                  <div key={task.id} className="flex items-center gap-3 p-3 rounded-lg hover:bg-gray-50 transition-colors">
                    <Circle className="w-4 h-4 text-gray-300 flex-shrink-0" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-medium text-gray-900 truncate">{task.title}</div>
                      <div className="text-xs text-gray-500">
                        {task.dueDate && `Bitiş: ${new Date(task.dueDate).toLocaleDateString("tr-TR")}`}
                      </div>
                    </div>
                    <StatusBadge status={task.status} />
                    <PriorityBadge priority={task.priority} />
                  </div>
                ))
              )}
            </div>
          </div>

          {/* Weekly chart */}
          <div className="card">
            <h2 className="text-base font-semibold text-gray-900 mb-4">Haftalık Zaman Özeti</h2>
            <ResponsiveContainer width="100%" height={160}>
              <BarChart data={weeklyData} barSize={28}>
                <CartesianGrid strokeDasharray="3 3" stroke="#f3f4f6" />
                <XAxis dataKey="day" tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} />
                <YAxis tick={{ fontSize: 12, fill: "#9ca3af" }} axisLine={false} tickLine={false} unit="s" />
                <Tooltip formatter={(v) => [`${v} saat`, "Çalışılan"]} />
                <Bar dataKey="saat" fill="#4f46e5" radius={[6, 6, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
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
                  <Avatar name={MEMBERS[project.managerId] || "U"} size="sm" />
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

          {/* AI suggestion */}
          <div className="card border-indigo-200 bg-indigo-50">
            <div className="flex items-center gap-2 mb-3">
              <div className="w-6 h-6 bg-indigo-600 rounded-lg flex items-center justify-center">
                <span className="text-white text-xs">AI</span>
              </div>
              <h3 className="text-sm font-semibold text-indigo-900">AI Önerileri</h3>
            </div>
            <div className="space-y-2.5">
              <div className="text-xs text-indigo-800 bg-white rounded-lg p-2.5 border border-indigo-100">
                ⚠️ &quot;Mobil Uygulama Redesign&quot; projesinin bütçesi %88 tükendi. Mevcut harcama hızıyla 10 gün içinde aşılabilir.
              </div>
              <div className="text-xs text-indigo-800 bg-white rounded-lg p-2.5 border border-indigo-100">
                📌 3 görevin deadline&apos;ı bu hafta, henüz başlanmadı — önceliklendirmenizi öneririz.
              </div>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
