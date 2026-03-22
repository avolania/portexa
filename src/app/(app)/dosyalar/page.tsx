"use client";

import { useRef, useState, useMemo } from "react";
import {
  Upload, Trash2, Download, FileText, FileImage, FileVideo,
  FileAudio, FileArchive, File, FolderOpen, Search, ChevronDown,
} from "lucide-react";
import { useFileStore } from "@/store/useFileStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import { dbGetFileUrl } from "@/lib/db";
import type { ProjectFile } from "@/types";

// ─── helpers ─────────────────────────────────────────────────────────────────

function formatSize(bytes: number): string {
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / 1024 / 1024).toFixed(1)} MB`;
}

function formatDate(iso: string) {
  return new Date(iso).toLocaleDateString("tr-TR", {
    day: "2-digit", month: "short", year: "numeric",
  });
}

function FileIcon({ mime, className }: { mime: string; className?: string }) {
  const cls = className ?? "w-6 h-6";
  if (mime.startsWith("image/")) return <FileImage className={cls} />;
  if (mime.startsWith("video/")) return <FileVideo className={cls} />;
  if (mime.startsWith("audio/")) return <FileAudio className={cls} />;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("7z"))
    return <FileArchive className={cls} />;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("text") || mime.includes("sheet"))
    return <FileText className={cls} />;
  return <File className={cls} />;
}

function mimeColor(mime: string): string {
  if (mime.startsWith("image/")) return "text-purple-500";
  if (mime.startsWith("video/")) return "text-pink-500";
  if (mime.startsWith("audio/")) return "text-amber-500";
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar")) return "text-orange-500";
  if (mime.includes("pdf")) return "text-red-500";
  if (mime.includes("word") || mime.includes("document")) return "text-blue-500";
  if (mime.includes("sheet") || mime.includes("excel")) return "text-green-500";
  return "text-gray-500";
}

// ─── FileRow ─────────────────────────────────────────────────────────────────

function FileRow({
  file,
  projectName,
  uploaderName,
  canDelete,
  onDelete,
  onDownload,
}: {
  file: ProjectFile;
  projectName: string;
  uploaderName: string;
  canDelete: boolean;
  onDelete: () => void;
  onDownload: () => void;
}) {
  return (
    <tr className="border-b border-gray-100 hover:bg-gray-50 transition-colors">
      <td className="py-3 px-4">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 ${mimeColor(file.mimeType)}`}>
            <FileIcon mime={file.mimeType} className="w-6 h-6" />
          </div>
          <span className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{file.name}</span>
        </div>
      </td>
      <td className="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">{projectName}</td>
      <td className="py-3 px-4 text-sm text-gray-500 hidden lg:table-cell truncate max-w-[140px]">{uploaderName}</td>
      <td className="py-3 px-4 text-sm text-gray-500 hidden sm:table-cell">{formatSize(file.size)}</td>
      <td className="py-3 px-4 text-sm text-gray-500 hidden md:table-cell">{formatDate(file.createdAt)}</td>
      <td className="py-3 px-4">
        <div className="flex items-center gap-1 justify-end">
          <button
            onClick={onDownload}
            className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors"
            title="İndir"
          >
            <Download className="w-4 h-4" />
          </button>
          {canDelete && (
            <button
              onClick={onDelete}
              className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors"
              title="Sil"
            >
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

export default function DosyalarPage() {
  const { files, uploading, uploadFile, deleteFile } = useFileStore();
  const { projects } = useProjectStore();
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [projectFilter, setProjectFilter] = useState("all");
  const [search, setSearch] = useState("");
  const [uploadProjectId, setUploadProjectId] = useState<string>("");

  const isManager = user?.role === "admin" || user?.role === "pm";

  const filtered = useMemo(() => {
    let list = files;
    if (projectFilter !== "all") list = list.filter((f) => f.projectId === projectFilter);
    if (search.trim()) {
      const q = search.toLowerCase();
      list = list.filter((f) => f.name.toLowerCase().includes(q));
    }
    return list.sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  }, [files, projectFilter, search]);

  const projectMap = useMemo(
    () => Object.fromEntries(projects.map((p) => [p.id, p.name])),
    [projects]
  );

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length || !user) return;
    const pid = uploadProjectId || projects[0]?.id;
    if (!pid) return;
    for (const f of picked) {
      await uploadFile(f, pid, user.id);
    }
    e.target.value = "";
  };

  const handleDownload = async (file: ProjectFile) => {
    const url = await dbGetFileUrl(file.storagePath);
    const a = document.createElement("a");
    a.href = url;
    a.download = file.name;
    a.target = "_blank";
    a.click();
  };

  return (
    <div className="space-y-4">
      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <div>
          <h1 className="text-xl font-bold text-gray-900">Dosya Yönetimi</h1>
          <p className="text-sm text-gray-500 mt-0.5">{files.length} dosya</p>
        </div>

        <div className="sm:ml-auto flex flex-col sm:flex-row gap-2">
          {/* Project selector for upload */}
          {projects.length > 0 && (
            <div className="relative">
              <select
                value={uploadProjectId || projects[0]?.id || ""}
                onChange={(e) => setUploadProjectId(e.target.value)}
                className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
              >
                {projects.map((p) => (
                  <option key={p.id} value={p.id}>{p.name}</option>
                ))}
              </select>
              <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
            </div>
          )}

          <button
            onClick={() => inputRef.current?.click()}
            disabled={uploading || projects.length === 0}
            className="flex items-center gap-2 px-4 py-2 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
          >
            <Upload className="w-4 h-4" />
            {uploading ? "Yükleniyor..." : "Dosya Yükle"}
          </button>
          <input
            ref={inputRef}
            type="file"
            multiple
            className="hidden"
            onChange={handleFileChange}
          />
        </div>
      </div>

      {/* Filters */}
      <div className="flex flex-col sm:flex-row gap-2">
        <div className="relative flex-1 max-w-xs">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
          <input
            type="text"
            placeholder="Dosya ara..."
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            className="w-full pl-9 pr-4 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          />
        </div>

        <div className="relative">
          <select
            value={projectFilter}
            onChange={(e) => setProjectFilter(e.target.value)}
            className="appearance-none pl-3 pr-8 py-2 text-sm border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
          >
            <option value="all">Tüm Projeler</option>
            {projects.map((p) => (
              <option key={p.id} value={p.id}>{p.name}</option>
            ))}
          </select>
          <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
        </div>
      </div>

      {/* Table */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">
        {filtered.length === 0 ? (
          <div className="flex flex-col items-center justify-center py-16 text-gray-400">
            <FolderOpen className="w-12 h-12 mb-3 text-gray-300" />
            <p className="text-sm font-medium">Henüz dosya yok</p>
            <p className="text-xs mt-1">Yukarıdan dosya yükleyebilirsiniz</p>
          </div>
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead>
                <tr className="border-b border-gray-200 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
                  <th className="py-3 px-4 text-left font-medium">Dosya Adı</th>
                  <th className="py-3 px-4 text-left font-medium hidden md:table-cell">Proje</th>
                  <th className="py-3 px-4 text-left font-medium hidden lg:table-cell">Yükleyen</th>
                  <th className="py-3 px-4 text-left font-medium hidden sm:table-cell">Boyut</th>
                  <th className="py-3 px-4 text-left font-medium hidden md:table-cell">Tarih</th>
                  <th className="py-3 px-4 text-right font-medium">İşlem</th>
                </tr>
              </thead>
              <tbody>
                {filtered.map((file) => {
                  const canDelete = isManager || file.uploadedBy === user?.id;
                  return (
                    <FileRow
                      key={file.id}
                      file={file}
                      projectName={projectMap[file.projectId] ?? "—"}
                      uploaderName={file.uploadedBy}
                      canDelete={canDelete}
                      onDelete={() => deleteFile(file.id)}
                      onDownload={() => handleDownload(file)}
                    />
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </div>
    </div>
  );
}
