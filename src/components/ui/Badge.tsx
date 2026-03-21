import { cn } from "@/lib/utils";
import type { Priority, TaskStatus, ProjectStatus } from "@/types";

const priorityMap: Record<Priority, { label: string; className: string }> = {
  low: { label: "Düşük", className: "bg-gray-100 text-gray-600" },
  medium: { label: "Orta", className: "bg-amber-100 text-amber-700" },
  high: { label: "Yüksek", className: "bg-red-100 text-red-600" },
  critical: { label: "Kritik", className: "bg-pink-100 text-pink-700" },
};

const statusMap: Record<TaskStatus, { label: string; className: string }> = {
  todo: { label: "Yapılacak", className: "bg-gray-100 text-gray-600" },
  in_progress: { label: "Devam Ediyor", className: "bg-blue-100 text-blue-700" },
  review: { label: "İncelemede", className: "bg-amber-100 text-amber-700" },
  done: { label: "Tamamlandı", className: "bg-emerald-100 text-emerald-700" },
};

const projectStatusMap: Record<ProjectStatus, { label: string; className: string }> = {
  active: { label: "Aktif", className: "bg-emerald-100 text-emerald-700" },
  on_hold: { label: "Beklemede", className: "bg-gray-100 text-gray-600" },
  completed: { label: "Tamamlandı", className: "bg-blue-100 text-blue-700" },
  at_risk: { label: "Riskli", className: "bg-red-100 text-red-600" },
};

interface PriorityBadgeProps {
  priority: Priority;
  className?: string;
}

export function PriorityBadge({ priority, className }: PriorityBadgeProps) {
  const { label, className: pClass } = priorityMap[priority];
  return (
    <span className={cn("badge", pClass, className)}>{label}</span>
  );
}

interface StatusBadgeProps {
  status: TaskStatus;
  className?: string;
}

export function StatusBadge({ status, className }: StatusBadgeProps) {
  const { label, className: sClass } = statusMap[status];
  return (
    <span className={cn("badge", sClass, className)}>{label}</span>
  );
}

interface ProjectStatusBadgeProps {
  status: ProjectStatus;
  className?: string;
}

export function ProjectStatusBadge({ status, className }: ProjectStatusBadgeProps) {
  const { label, className: pClass } = projectStatusMap[status];
  return (
    <span className={cn("badge", pClass, className)}>{label}</span>
  );
}
