"use client";

import { formatDistanceToNow } from "date-fns";
import { tr } from "date-fns/locale";
import type { SimilarIdea } from "@/lib/innovation/types";

export function SimilarIdeasModal({
  ideas,
  onClose,
  onConfirm,
}: {
  ideas: SimilarIdea[];
  onClose: () => void;
  onConfirm: () => void;
}) {
  return (
    <>
      <div className="fixed inset-0 bg-black/50 z-[60]" onClick={onClose} />
      <div className="fixed inset-0 z-[70] flex items-center justify-center p-4">
        <div className="bg-white rounded-xl shadow-2xl w-full max-w-lg">
          <div className="p-5 border-b">
            <h2 className="text-base font-bold text-gray-900">Bu fikre benzer fikirler bulundu</h2>
            <p className="text-xs text-gray-500 mt-1">
              Göndermeden önce aşağıdaki fikirleri incelemek isteyebilirsin.
            </p>
          </div>
          <div className="divide-y divide-gray-100 max-h-72 overflow-y-auto">
            {ideas.map((idea) => (
              <div key={idea.id} className="px-5 py-3">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="font-mono text-xs font-bold text-gray-400">
                    {idea.idea_number}
                  </span>
                  {idea.stage && (
                    <span
                      className="text-xs font-semibold px-2 py-0.5 rounded-full"
                      style={{
                        background: idea.stage.color + "22",
                        color: idea.stage.color,
                      }}
                    >
                      {idea.stage.name}
                    </span>
                  )}
                </div>
                <p className="text-sm font-semibold text-gray-900 mt-0.5">{idea.title}</p>
                {idea.description && (
                  <p className="text-xs text-gray-500 mt-0.5 line-clamp-2">{idea.description}</p>
                )}
                <div className="flex items-center gap-2 mt-1 text-xs text-gray-400">
                  {idea.submitter && <span>{idea.submitter.name}</span>}
                  <span>·</span>
                  <span>
                    {formatDistanceToNow(new Date(idea.created_at), {
                      addSuffix: true,
                      locale: tr,
                    })}
                  </span>
                </div>
              </div>
            ))}
          </div>
          <div className="flex gap-3 p-5 border-t">
            <button
              onClick={onClose}
              className="flex-1 py-2 border border-gray-200 rounded-lg text-sm font-semibold text-gray-600 hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              onClick={onConfirm}
              className="flex-1 py-2 bg-blue-600 text-white rounded-lg text-sm font-semibold hover:bg-blue-700 transition-colors"
            >
              Yine de Gönder
            </button>
          </div>
        </div>
      </div>
    </>
  );
}
