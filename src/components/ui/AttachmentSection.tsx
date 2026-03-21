"use client";

import { useRef } from "react";
import { Paperclip, Upload, X, FileText, Image, FileArchive, File } from "lucide-react";
import { useAuthStore } from "@/store/useAuthStore";
import type { Attachment } from "@/types";

function formatBytes(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function fileIcon(type: string) {
  if (type.startsWith("image/")) return <Image className="w-4 h-4 text-blue-500" />;
  if (type.includes("zip") || type.includes("rar") || type.includes("archive"))
    return <FileArchive className="w-4 h-4 text-amber-500" />;
  if (type.includes("pdf") || type.includes("document") || type.includes("word"))
    return <FileText className="w-4 h-4 text-red-500" />;
  return <File className="w-4 h-4 text-gray-400" />;
}

interface Props {
  attachments: Attachment[];
  onAdd: (attachment: Attachment) => void;
  onRemove: (id: string) => void;
}

export default function AttachmentSection({ attachments, onAdd, onRemove }: Props) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const { user } = useAuthStore();

  function handleFiles(files: FileList | null) {
    if (!files) return;
    Array.from(files).forEach((file) => {
      const url = URL.createObjectURL(file);
      onAdd({
        id: crypto.randomUUID(),
        name: file.name,
        url,
        size: file.size,
        type: file.type,
        uploadedBy: user?.name ?? "Kullanıcı",
        uploadedAt: new Date().toISOString(),
      });
    });
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    handleFiles(e.dataTransfer.files);
  }

  function handleDragOver(e: React.DragEvent) {
    e.preventDefault();
  }

  return (
    <div className="space-y-3">
      <div className="flex items-center gap-1.5">
        <Paperclip className="w-3.5 h-3.5 text-gray-400" />
        <span className="text-xs font-semibold text-gray-500 uppercase">
          Ekler {attachments.length > 0 && `(${attachments.length})`}
        </span>
      </div>

      {/* Existing attachments */}
      {attachments.length > 0 && (
        <div className="space-y-1.5">
          {attachments.map((att) => (
            <div
              key={att.id}
              className="flex items-center gap-3 px-3 py-2 bg-gray-50 rounded-lg border border-gray-200 group"
            >
              <div className="shrink-0">{fileIcon(att.type)}</div>
              <div className="flex-1 min-w-0">
                <a
                  href={att.url}
                  target="_blank"
                  rel="noopener noreferrer"
                  download={att.name}
                  className="text-sm font-medium text-gray-800 hover:text-indigo-600 truncate block"
                >
                  {att.name}
                </a>
                <div className="text-xs text-gray-400 flex items-center gap-1.5 mt-0.5">
                  <span>{formatBytes(att.size)}</span>
                  <span>·</span>
                  <span>{att.uploadedBy}</span>
                  <span>·</span>
                  <span>{new Date(att.uploadedAt).toLocaleDateString("tr-TR")}</span>
                </div>
              </div>
              {att.type.startsWith("image/") && (
                <img
                  src={att.url}
                  alt={att.name}
                  className="w-10 h-10 object-cover rounded border border-gray-200 shrink-0"
                />
              )}
              <button
                onClick={() => onRemove(att.id)}
                className="p-1 rounded hover:bg-red-50 text-gray-300 hover:text-red-500 transition-colors opacity-0 group-hover:opacity-100"
                title="Kaldır"
              >
                <X className="w-3.5 h-3.5" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* Drop zone */}
      <div
        onDrop={handleDrop}
        onDragOver={handleDragOver}
        onClick={() => fileInputRef.current?.click()}
        className="flex flex-col items-center justify-center gap-2 border-2 border-dashed border-gray-200 rounded-lg py-4 cursor-pointer hover:border-indigo-400 hover:bg-indigo-50/40 transition-colors group"
      >
        <Upload className="w-5 h-5 text-gray-300 group-hover:text-indigo-400 transition-colors" />
        <div className="text-center">
          <span className="text-xs font-medium text-gray-500 group-hover:text-indigo-600">
            Dosya seçin
          </span>
          <span className="text-xs text-gray-400 block">veya sürükleyip bırakın</span>
        </div>
        <input
          ref={fileInputRef}
          type="file"
          multiple
          className="hidden"
          onChange={(e) => { handleFiles(e.target.files); e.target.value = ""; }}
        />
      </div>
    </div>
  );
}
