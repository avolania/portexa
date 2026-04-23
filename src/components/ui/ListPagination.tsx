"use client";
import { ChevronLeft, ChevronRight } from "lucide-react";
import { cn } from "@/lib/utils";

interface Props {
  currentPage: number;
  totalCount: number;
  pageSize: number;
  onChange: (page: number) => void;
  className?: string;
}

export function ListPagination({ currentPage, totalCount, pageSize, onChange, className }: Props) {
  const totalPages = Math.ceil(totalCount / pageSize);
  if (totalPages <= 1) return null;

  const from = currentPage * pageSize + 1;
  const to = Math.min((currentPage + 1) * pageSize, totalCount);

  return (
    <div className={cn("flex items-center justify-between px-3 py-2 border-t border-gray-100 bg-white flex-shrink-0", className)}>
      <span className="text-[10px] text-gray-400">
        {from}–{to} / {totalCount}
      </span>
      <div className="flex items-center gap-1">
        <button
          onClick={() => onChange(currentPage - 1)}
          disabled={currentPage === 0}
          className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronLeft className="w-3.5 h-3.5" />
        </button>
        <span className="text-[10px] text-gray-500 px-1">
          {currentPage + 1}/{totalPages}
        </span>
        <button
          onClick={() => onChange(currentPage + 1)}
          disabled={currentPage >= totalPages - 1}
          className="p-0.5 rounded text-gray-400 hover:text-gray-600 hover:bg-gray-100 disabled:opacity-30 disabled:cursor-not-allowed transition-colors"
        >
          <ChevronRight className="w-3.5 h-3.5" />
        </button>
      </div>
    </div>
  );
}
