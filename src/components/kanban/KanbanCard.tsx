"use client";

import { Calendar, MessageSquare, Paperclip, CheckSquare } from "lucide-react";
import type { Task } from "@/types";
import { ISSUE_TYPE_META } from "@/types";
import { PriorityBadge } from "@/components/ui/Badge";
import Avatar from "@/components/ui/Avatar";

const MEMBERS: Record<string, string> = {
  "1": "Ahmet Yılmaz",
  "2": "Ayşe Kara",
  "3": "Mehmet Demir",
  "4": "Zeynep Çelik",
};

const priorityBorder: Record<string, string> = {
  low: "border-l-gray-400",
  medium: "border-l-amber-400",
  high: "border-l-red-400",
  critical: "border-l-pink-500",
};

interface Props {
  task: Task;
  onDragStart: () => void;
  onClick: () => void;
}

export default function KanbanCard({ task, onDragStart, onClick }: Props) {
  const completedSubtasks = task.subtasks.filter((s) => s.completed).length;
  const isOverdue = task.dueDate && new Date(task.dueDate) < new Date() && task.status !== "done";

  return (
    <div
      draggable
      onDragStart={onDragStart}
      onClick={onClick}
      className={`bg-white rounded-lg shadow-sm border border-gray-200 border-l-4 ${priorityBorder[task.priority]} p-3 cursor-pointer hover:shadow-md transition-shadow group select-none`}
    >
      {/* Issue type + Tags */}
      <div className="flex flex-wrap gap-1 mb-2">
        {task.issueType && (() => {
          const m = ISSUE_TYPE_META[task.issueType];
          return (
            <span className={`text-xs font-medium px-1.5 py-0.5 rounded flex items-center gap-0.5 ${m.bg} ${m.color}`}>
              <span>{m.icon}</span>
              {m.label}
            </span>
          );
        })()}
        {task.tags.slice(0, 2).map((tag) => (
          <span key={tag} className="text-xs bg-gray-100 text-gray-600 px-1.5 py-0.5 rounded">
            {tag}
          </span>
        ))}
      </div>

      {/* Title */}
      <p className="text-sm font-medium text-gray-900 mb-3 line-clamp-2">{task.title}</p>

      {/* Subtasks progress */}
      {task.subtasks.length > 0 && (
        <div className="mb-3">
          <div className="flex items-center gap-2 mb-1">
            <CheckSquare className="w-3.5 h-3.5 text-gray-400" />
            <span className="text-xs text-gray-500">
              {completedSubtasks}/{task.subtasks.length}
            </span>
          </div>
          <div className="w-full bg-gray-100 rounded-full h-1">
            <div
              className="h-full bg-indigo-500 rounded-full"
              style={{
                width: `${task.subtasks.length > 0 ? (completedSubtasks / task.subtasks.length) * 100 : 0}%`,
              }}
            />
          </div>
        </div>
      )}

      {/* Footer */}
      <div className="flex items-center justify-between">
        <div className="flex items-center gap-2">
          {task.dueDate && (
            <div className={`flex items-center gap-1 text-xs ${isOverdue ? "text-red-500" : "text-gray-400"}`}>
              <Calendar className="w-3.5 h-3.5" />
              {new Date(task.dueDate).toLocaleDateString("tr-TR", { day: "2-digit", month: "short" })}
            </div>
          )}
          {task.comments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <MessageSquare className="w-3.5 h-3.5" />
              {task.comments.length}
            </div>
          )}
          {task.attachments.length > 0 && (
            <div className="flex items-center gap-1 text-xs text-gray-400">
              <Paperclip className="w-3.5 h-3.5" />
              {task.attachments.length}
            </div>
          )}
        </div>

        <div className="flex items-center gap-1.5">
          {task.storyPoints ? (
            <span className="text-xs bg-indigo-100 text-indigo-600 font-semibold px-1.5 py-0.5 rounded">
              {task.storyPoints}pt
            </span>
          ) : null}
          <PriorityBadge priority={task.priority} />
          {task.assigneeId && (
            <Avatar name={MEMBERS[task.assigneeId] || "U"} size="sm" />
          )}
        </div>
      </div>
    </div>
  );
}
