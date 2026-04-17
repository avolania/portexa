"use client";

import { useRef, useState, useMemo, useCallback } from "react";
import {
  Upload, Trash2, Download, FileText, FileImage, FileVideo,
  FileAudio, FileArchive, File as FileLucide, FolderOpen, FolderPlus,
  Folder, ChevronRight, ChevronDown, MoreVertical, X, Check,
  List, FolderTree,
} from "lucide-react";
import { useFileStore } from "@/store/useFileStore";
import { useProjectStore } from "@/store/useProjectStore";
import { useAuthStore } from "@/store/useAuthStore";
import { dbGetFileUrl } from "@/lib/db";
import { DEFAULT_PHASES } from "@/components/kanban/WaterfallBoard";
import type { ProjectFile, FileFolder, ProjectPhase } from "@/types";

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

function FileTypeIcon({ mime, className }: { mime: string; className?: string }) {
  const cls = className ?? "w-5 h-5";
  if (mime.startsWith("image/")) return <FileImage className={cls} />;
  if (mime.startsWith("video/")) return <FileVideo className={cls} />;
  if (mime.startsWith("audio/")) return <FileAudio className={cls} />;
  if (mime.includes("zip") || mime.includes("rar") || mime.includes("tar") || mime.includes("7z"))
    return <FileArchive className={cls} />;
  if (mime.includes("pdf") || mime.includes("word") || mime.includes("text") || mime.includes("sheet"))
    return <FileText className={cls} />;
  return <FileLucide className={cls} />;
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

// ─── NewFolderInput ───────────────────────────────────────────────────────────

function NewFolderInput({ onConfirm, onCancel }: { onConfirm: (name: string) => void; onCancel: () => void }) {
  const [name, setName] = useState("");
  return (
    <div className="flex items-center gap-2 p-2 border border-indigo-300 rounded-xl bg-indigo-50">
      <Folder className="w-8 h-8 text-indigo-400 flex-shrink-0" />
      <input
        autoFocus
        type="text"
        value={name}
        onChange={(e) => setName(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === "Enter" && name.trim()) onConfirm(name.trim());
          if (e.key === "Escape") onCancel();
        }}
        placeholder="Klasör adı"
        className="flex-1 text-sm bg-transparent border-none outline-none text-gray-900"
      />
      <button
        disabled={!name.trim()}
        onClick={() => name.trim() && onConfirm(name.trim())}
        className="p-1 text-indigo-600 hover:bg-indigo-100 rounded disabled:opacity-40"
      >
        <Check className="w-4 h-4" />
      </button>
      <button onClick={onCancel} className="p-1 text-gray-400 hover:bg-gray-100 rounded">
        <X className="w-4 h-4" />
      </button>
    </div>
  );
}

// ─── FolderCard ───────────────────────────────────────────────────────────────

function FolderCard({
  folder, fileCount, onClick, onDelete, canDelete,
}: {
  folder: FileFolder; fileCount: number; onClick: () => void; onDelete: () => void; canDelete: boolean;
}) {
  const [menuOpen, setMenuOpen] = useState(false);
  return (
    <div
      className="relative group flex flex-col items-center gap-2 p-4 bg-white border border-gray-200 rounded-xl hover:border-indigo-300 hover:shadow-sm cursor-pointer transition-all"
      onClick={onClick}
    >
      <FolderOpen className="w-10 h-10 text-amber-400" />
      <span className="text-sm font-medium text-gray-800 text-center leading-tight truncate w-full text-center">{folder.name}</span>
      <span className="text-xs text-gray-400">{fileCount} dosya</span>
      {canDelete && (
        <button
          className="absolute top-2 right-2 p-1 text-gray-300 hover:text-gray-600 opacity-0 group-hover:opacity-100 transition-opacity rounded"
          onClick={(e) => { e.stopPropagation(); setMenuOpen((v) => !v); }}
        >
          <MoreVertical className="w-4 h-4" />
        </button>
      )}
      {menuOpen && (
        <div className="absolute top-8 right-2 z-20 bg-white border border-gray-200 rounded-xl shadow-lg py-1 w-36" onClick={(e) => e.stopPropagation()}>
          <button className="w-full flex items-center gap-2 px-3 py-2 text-sm text-red-600 hover:bg-red-50 transition-colors" onClick={() => { setMenuOpen(false); onDelete(); }}>
            <Trash2 className="w-4 h-4" /> Sil
          </button>
        </div>
      )}
    </div>
  );
}

// ─── FileRow ─────────────────────────────────────────────────────────────────

function FileRow({
  file, locationLabel, selected, onToggle, canDelete, onDelete, onDownload, showLocation,
}: {
  file: ProjectFile;
  locationLabel?: string;
  selected: boolean;
  onToggle: () => void;
  canDelete: boolean;
  onDelete: () => void;
  onDownload: () => void;
  showLocation?: boolean;
}) {
  return (
    <tr className={`border-b border-gray-100 transition-colors ${selected ? "bg-indigo-50" : "hover:bg-gray-50"}`}>
      {/* Checkbox */}
      <td className="py-2.5 pl-4 pr-2 w-8">
        <input
          type="checkbox"
          checked={selected}
          onChange={onToggle}
          className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
        />
      </td>
      <td className="py-2.5 px-2">
        <div className="flex items-center gap-3">
          <div className={`flex-shrink-0 ${mimeColor(file.mimeType)}`}>
            <FileTypeIcon mime={file.mimeType} />
          </div>
          <div className="min-w-0">
            <p className="text-sm font-medium text-gray-900 truncate max-w-[180px]">{file.name}</p>
            {showLocation && locationLabel && (
              <p className="text-xs text-gray-400 truncate max-w-[180px]">{locationLabel}</p>
            )}
          </div>
        </div>
      </td>
      <td className="py-2.5 px-4 text-sm text-gray-500 hidden sm:table-cell">{formatSize(file.size)}</td>
      <td className="py-2.5 px-4 text-sm text-gray-500 hidden md:table-cell">{formatDate(file.createdAt)}</td>
      <td className="py-2.5 px-4 pr-4">
        <div className="flex items-center gap-1 justify-end">
          <button onClick={onDownload} className="p-1.5 text-gray-400 hover:text-indigo-600 hover:bg-indigo-50 rounded-lg transition-colors" title="İndir">
            <Download className="w-4 h-4" />
          </button>
          {canDelete && (
            <button onClick={onDelete} className="p-1.5 text-gray-400 hover:text-red-600 hover:bg-red-50 rounded-lg transition-colors" title="Sil">
              <Trash2 className="w-4 h-4" />
            </button>
          )}
        </div>
      </td>
    </tr>
  );
}

// ─── BulkBar ─────────────────────────────────────────────────────────────────

function BulkBar({
  count, onDownloadAll, onDeleteAll, onClear, canDelete,
}: {
  count: number; onDownloadAll: () => void; onDeleteAll: () => void; onClear: () => void; canDelete: boolean;
}) {
  return (
    <div className="flex items-center gap-3 px-4 py-2.5 bg-indigo-600 text-white rounded-xl">
      <button onClick={onClear} className="p-1 hover:bg-indigo-500 rounded transition-colors">
        <X className="w-4 h-4" />
      </button>
      <span className="text-sm font-medium flex-1">{count} dosya seçildi</span>
      <button
        onClick={onDownloadAll}
        className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-indigo-500 hover:bg-indigo-400 rounded-lg transition-colors"
      >
        <Download className="w-4 h-4" />
        <span className="hidden sm:inline">İndir</span>
      </button>
      {canDelete && (
        <button
          onClick={onDeleteAll}
          className="flex items-center gap-1.5 px-3 py-1.5 text-sm bg-red-500 hover:bg-red-400 rounded-lg transition-colors"
        >
          <Trash2 className="w-4 h-4" />
          <span className="hidden sm:inline">Sil</span>
        </button>
      )}
    </div>
  );
}

// ─── Page ─────────────────────────────────────────────────────────────────────

const GENERAL_PHASE: ProjectPhase = { id: "general", label: "Genel", icon: "📁" };
type ViewMode = "explorer" | "list";

export default function DosyalarPage() {
  const { files, folders, uploading, uploadFile, deleteFile, addFolder, deleteFolder } = useFileStore();
  const { projects } = useProjectStore();
  const { user } = useAuthStore();
  const inputRef = useRef<HTMLInputElement>(null);

  const [selectedProjectId, setSelectedProjectId] = useState<string>(() => projects[0]?.id ?? "");
  const [selectedPhaseId, setSelectedPhaseId] = useState<string>("");
  const [currentFolderId, setCurrentFolderId] = useState<string | undefined>(undefined);
  const [folderPath, setFolderPath] = useState<FileFolder[]>([]);
  const [creatingFolder, setCreatingFolder] = useState(false);
  const [uploadError, setUploadError] = useState<string | null>(null);
  const [viewMode, setViewMode] = useState<ViewMode>("explorer");
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());

  const isManager = user?.role === "admin" || user?.role === "pm";

  const project = projects.find((p) => p.id === selectedProjectId);

  const phases: ProjectPhase[] = useMemo(() => {
    if (!project) return [];
    if (project.projectType === "waterfall") return project.phases ?? DEFAULT_PHASES;
    return [GENERAL_PHASE];
  }, [project]);

  const activePhaseId = selectedPhaseId && phases.some((p) => p.id === selectedPhaseId)
    ? selectedPhaseId : phases[0]?.id ?? "";

  // Explorer: folders + files at current location
  const currentFolders = useMemo(() =>
    folders.filter((f) =>
      f.projectId === selectedProjectId &&
      f.phaseId === activePhaseId &&
      f.parentFolderId === currentFolderId
    ), [folders, selectedProjectId, activePhaseId, currentFolderId]);

  const currentFiles = useMemo(() =>
    files.filter((f) =>
      f.projectId === selectedProjectId &&
      f.phaseId === activePhaseId &&
      f.folderId === currentFolderId
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [files, selectedProjectId, activePhaseId, currentFolderId]);

  // List view: ALL files in current phase
  const allPhaseFiles = useMemo(() =>
    files.filter((f) =>
      f.projectId === selectedProjectId && f.phaseId === activePhaseId
    ).sort((a, b) => b.createdAt.localeCompare(a.createdAt)),
    [files, selectedProjectId, activePhaseId]);

  // build folder path label for list view
  const folderPathLabel = useCallback((folderId: string | undefined): string => {
    if (!folderId) return "Kök";
    const parts: string[] = [];
    let cur: string | undefined = folderId;
    while (cur) {
      const f = folders.find((x) => x.id === cur);
      if (!f) break;
      parts.unshift(f.name);
      cur = f.parentFolderId;
    }
    return parts.join(" / ") || "Kök";
  }, [folders]);

  const countFilesUnder = useCallback((folderId: string): number => {
    const childIds = folders.filter((f) => f.parentFolderId === folderId).map((f) => f.id);
    return files.filter((f) => f.folderId === folderId).length +
      childIds.reduce((sum, id) => sum + countFilesUnder(id), 0);
  }, [folders, files]);

  // displayed file list (context-dependent)
  const displayedFiles = viewMode === "list" ? allPhaseFiles : currentFiles;

  // selection helpers
  const toggleSelect = (id: string) =>
    setSelectedIds((prev) => {
      const next = new Set(prev);
      next.has(id) ? next.delete(id) : next.add(id);
      return next;
    });

  const allSelected = displayedFiles.length > 0 && displayedFiles.every((f) => selectedIds.has(f.id));
  const toggleAll = () =>
    setSelectedIds(allSelected ? new Set() : new Set(displayedFiles.map((f) => f.id)));

  const clearSelection = () => setSelectedIds(new Set());

  const selectedFiles = displayedFiles.filter((f) => selectedIds.has(f.id));
  const canDeleteSelected = selectedFiles.every(
    (f) => isManager || f.uploadedBy === user?.id
  );

  // navigation
  const navigateToFolder = (folder: FileFolder) => {
    setFolderPath((p) => [...p, folder]);
    setCurrentFolderId(folder.id);
    clearSelection();
  };

  const navigateToBreadcrumb = (index: number) => {
    if (index === -1) { setFolderPath([]); setCurrentFolderId(undefined); }
    else {
      const trail = folderPath.slice(0, index + 1);
      setFolderPath(trail);
      setCurrentFolderId(trail[trail.length - 1]?.id);
    }
    clearSelection();
  };

  const handleSelectProject = (id: string) => {
    setSelectedProjectId(id);
    setSelectedPhaseId("");
    setCurrentFolderId(undefined);
    setFolderPath([]);
    setCreatingFolder(false);
    clearSelection();
  };

  const handleSelectPhase = (phaseId: string) => {
    setSelectedPhaseId(phaseId);
    setCurrentFolderId(undefined);
    setFolderPath([]);
    setCreatingFolder(false);
    clearSelection();
  };

  const handleCreateFolder = (name: string) => {
    if (!user) return;
    addFolder({
      id: crypto.randomUUID(), name,
      projectId: selectedProjectId, phaseId: activePhaseId,
      parentFolderId: currentFolderId,
      createdBy: user.id, createdAt: new Date().toISOString(),
    });
    setCreatingFolder(false);
  };

  const handleFileChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const picked = Array.from(e.target.files ?? []);
    if (!picked.length || !user || !selectedProjectId || !activePhaseId) return;
    setUploadError(null);
    try {
      for (const f of picked) {
        await uploadFile(f, selectedProjectId, activePhaseId, user.id, currentFolderId);
      }
    } catch (err) {
      setUploadError(err instanceof Error ? err.message : "Yükleme başarısız");
    }
    e.target.value = "";
  };

  const handleDownload = async (file: ProjectFile) => {
    const url = await dbGetFileUrl(user?.orgId ?? "", file.storagePath);
    const a = document.createElement("a");
    a.href = url; a.download = file.name; a.target = "_blank"; a.click();
  };

  const handleDownloadSelected = async () => {
    for (const f of selectedFiles) await handleDownload(f);
  };

  const handleDeleteSelected = async () => {
    for (const f of selectedFiles) await deleteFile(f.id);
    clearSelection();
  };

  const activePhase = phases.find((p) => p.id === activePhaseId);

  if (projects.length === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-24 text-gray-400">
        <FolderOpen className="w-14 h-14 mb-3 text-gray-200" />
        <p className="text-sm font-medium">Henüz proje yok</p>
        <p className="text-xs mt-1">Dosya yüklemek için önce bir proje oluşturun</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Upload error */}
      {uploadError && (
        <div className="flex items-center gap-2 px-4 py-3 bg-red-50 border border-red-200 rounded-xl text-sm text-red-700">
          <X className="w-4 h-4 flex-shrink-0" />
          <span className="flex-1">{uploadError}</span>
          <button onClick={() => setUploadError(null)} className="p-0.5 hover:bg-red-100 rounded">
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Bulk action bar */}
      {selectedIds.size > 0 && (
        <BulkBar
          count={selectedIds.size}
          onDownloadAll={handleDownloadSelected}
          onDeleteAll={handleDeleteSelected}
          onClear={clearSelection}
          canDelete={canDeleteSelected}
        />
      )}

      {/* Header */}
      <div className="flex flex-col sm:flex-row sm:items-center gap-3">
        <h1 className="text-xl font-bold text-gray-900">Dosya Yönetimi</h1>

        <div className="sm:ml-auto flex items-center gap-2">
          {/* View toggle */}
          <div className="flex items-center bg-gray-100 rounded-lg p-0.5">
            <button
              onClick={() => { setViewMode("explorer"); clearSelection(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "explorer" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <FolderTree className="w-4 h-4" />
              <span className="hidden sm:inline">Klasör</span>
            </button>
            <button
              onClick={() => { setViewMode("list"); clearSelection(); }}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-md text-sm font-medium transition-colors ${viewMode === "list" ? "bg-white text-gray-900 shadow-sm" : "text-gray-500 hover:text-gray-700"}`}
            >
              <List className="w-4 h-4" />
              <span className="hidden sm:inline">Liste</span>
            </button>
          </div>

          {/* Project selector */}
          <div className="relative">
            <select
              value={selectedProjectId}
              onChange={(e) => handleSelectProject(e.target.value)}
              className="appearance-none pl-3 pr-8 py-2 text-sm font-medium border border-gray-200 rounded-lg bg-white focus:outline-none focus:ring-2 focus:ring-indigo-500"
            >
              {projects.map((p) => (
                <option key={p.id} value={p.id}>{p.name}</option>
              ))}
            </select>
            <ChevronDown className="absolute right-2 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400 pointer-events-none" />
          </div>
        </div>
      </div>

      {/* Phase tabs */}
      <div className="flex items-center gap-1 overflow-x-auto pb-1">
        {phases.map((phase) => {
          const isActive = phase.id === activePhaseId;
          const count = files.filter((f) => f.projectId === selectedProjectId && f.phaseId === phase.id).length;
          return (
            <button
              key={phase.id}
              onClick={() => handleSelectPhase(phase.id)}
              className={`flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-sm font-medium whitespace-nowrap transition-colors ${isActive ? "bg-indigo-600 text-white" : "text-gray-600 hover:bg-gray-100"}`}
            >
              {phase.icon && <span>{phase.icon}</span>}
              {phase.label}
              {count > 0 && (
                <span className={`text-xs px-1.5 py-0.5 rounded-full ${isActive ? "bg-indigo-500 text-white" : "bg-gray-200 text-gray-600"}`}>
                  {count}
                </span>
              )}
            </button>
          );
        })}
      </div>

      {/* Content */}
      <div className="bg-white border border-gray-200 rounded-xl overflow-hidden">

        {/* Toolbar */}
        <div className="flex items-center gap-2 px-4 py-3 border-b border-gray-100">
          {viewMode === "explorer" ? (
            /* Breadcrumb */
            <div className="flex items-center gap-1 text-sm text-gray-500 flex-1 min-w-0 overflow-hidden">
              <button onClick={() => navigateToBreadcrumb(-1)} className="flex items-center gap-1 hover:text-indigo-600 transition-colors whitespace-nowrap">
                {activePhase?.icon && <span>{activePhase.icon}</span>}
                <span>{activePhase?.label ?? "—"}</span>
              </button>
              {folderPath.map((f, i) => (
                <span key={f.id} className="flex items-center gap-1">
                  <ChevronRight className="w-3.5 h-3.5 flex-shrink-0" />
                  <button onClick={() => navigateToBreadcrumb(i)} className="hover:text-indigo-600 transition-colors truncate max-w-[100px]">
                    {f.name}
                  </button>
                </span>
              ))}
            </div>
          ) : (
            <p className="text-sm text-gray-500 flex-1">
              <span className="font-medium text-gray-700">{activePhase?.icon} {activePhase?.label}</span>
              {" "}— tüm dosyalar ({allPhaseFiles.length})
            </p>
          )}

          <div className="flex items-center gap-2 flex-shrink-0">
            {viewMode === "explorer" && (
              <button
                onClick={() => setCreatingFolder(true)}
                className="flex items-center gap-1.5 px-3 py-1.5 text-sm text-gray-600 border border-gray-200 hover:bg-gray-50 rounded-lg transition-colors"
              >
                <FolderPlus className="w-4 h-4" />
                <span className="hidden sm:inline">Klasör</span>
              </button>
            )}
            <button
              onClick={() => inputRef.current?.click()}
              disabled={uploading || !activePhaseId}
              className="flex items-center gap-1.5 px-3 py-1.5 text-sm font-medium text-white bg-indigo-600 hover:bg-indigo-700 rounded-lg transition-colors disabled:opacity-50"
            >
              <Upload className="w-4 h-4" />
              {uploading ? "Yükleniyor..." : <span className="hidden sm:inline">Yükle</span>}
            </button>
            <input ref={inputRef} type="file" multiple className="hidden" onChange={handleFileChange} />
          </div>
        </div>

        {/* ── EXPLORER VIEW ── */}
        {viewMode === "explorer" && (
          <>
            {/* Folders grid */}
            {(currentFolders.length > 0 || creatingFolder) && (
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Klasörler</p>
                <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-2">
                  {currentFolders.map((folder) => (
                    <FolderCard
                      key={folder.id}
                      folder={folder}
                      fileCount={countFilesUnder(folder.id)}
                      onClick={() => navigateToFolder(folder)}
                      canDelete={isManager || folder.createdBy === user?.id}
                      onDelete={() => deleteFolder(folder.id)}
                    />
                  ))}
                  {creatingFolder && (
                    <div className="col-span-2 sm:col-span-3 md:col-span-4 lg:col-span-6">
                      <NewFolderInput onConfirm={handleCreateFolder} onCancel={() => setCreatingFolder(false)} />
                    </div>
                  )}
                </div>
              </div>
            )}

            {creatingFolder && currentFolders.length === 0 && (
              <div className="px-4 pt-3 pb-2">
                <p className="text-xs font-medium text-gray-400 uppercase tracking-wider mb-2">Klasörler</p>
                <NewFolderInput onConfirm={handleCreateFolder} onCancel={() => setCreatingFolder(false)} />
              </div>
            )}

            {/* Files */}
            {currentFiles.length === 0 && currentFolders.length === 0 && !creatingFolder ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <FolderOpen className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm font-medium">Bu konumda dosya yok</p>
                <p className="text-xs mt-1">Dosya yükle veya klasör oluştur</p>
              </div>
            ) : currentFiles.length > 0 ? (
              <FileTable
                files={currentFiles}
                selectedIds={selectedIds}
                allSelected={currentFiles.every((f) => selectedIds.has(f.id))}
                onToggleAll={() => {
                  const all = currentFiles.every((f) => selectedIds.has(f.id));
                  if (all) {
                    setSelectedIds((p) => { const n = new Set(p); currentFiles.forEach((f) => n.delete(f.id)); return n; });
                  } else {
                    setSelectedIds((p) => { const n = new Set(p); currentFiles.forEach((f) => n.add(f.id)); return n; });
                  }
                }}
                onToggle={toggleSelect}
                isManager={isManager}
                userId={user?.id}
                onDelete={deleteFile}
                onDownload={handleDownload}
                showLocation={false}
                folderPathLabel={folderPathLabel}
                hasFolders={currentFolders.length > 0 || creatingFolder}
              />
            ) : null}
          </>
        )}

        {/* ── LIST VIEW ── */}
        {viewMode === "list" && (
          <>
            {allPhaseFiles.length === 0 ? (
              <div className="flex flex-col items-center justify-center py-14 text-gray-400">
                <FolderOpen className="w-12 h-12 mb-3 text-gray-200" />
                <p className="text-sm font-medium">Bu fazda henüz dosya yok</p>
              </div>
            ) : (
              <FileTable
                files={allPhaseFiles}
                selectedIds={selectedIds}
                allSelected={allSelected}
                onToggleAll={toggleAll}
                onToggle={toggleSelect}
                isManager={isManager}
                userId={user?.id}
                onDelete={deleteFile}
                onDownload={handleDownload}
                showLocation={true}
                folderPathLabel={folderPathLabel}
                hasFolders={false}
              />
            )}
          </>
        )}
      </div>
    </div>
  );
}

// ─── FileTable (shared between explorer + list) ───────────────────────────────

function FileTable({
  files, selectedIds, allSelected, onToggleAll, onToggle,
  isManager, userId, onDelete, onDownload, showLocation, folderPathLabel, hasFolders,
}: {
  files: ProjectFile[];
  selectedIds: Set<string>;
  allSelected: boolean;
  onToggleAll: () => void;
  onToggle: (id: string) => void;
  isManager: boolean;
  userId?: string;
  onDelete: (id: string) => void;
  onDownload: (f: ProjectFile) => void;
  showLocation: boolean;
  folderPathLabel: (folderId: string | undefined) => string;
  hasFolders: boolean;
}) {
  return (
    <div className={hasFolders ? "border-t border-gray-100" : ""}>
      {hasFolders && (
        <p className="text-xs font-medium text-gray-400 uppercase tracking-wider px-4 pt-3 pb-2">Dosyalar</p>
      )}
      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50 text-xs text-gray-500 uppercase tracking-wider">
              <th className="py-2.5 pl-4 pr-2 w-8">
                <input
                  type="checkbox"
                  checked={allSelected}
                  onChange={onToggleAll}
                  className="w-4 h-4 rounded border-gray-300 text-indigo-600 focus:ring-indigo-500 cursor-pointer"
                />
              </th>
              <th className="py-2.5 px-2 text-left font-medium">Ad {showLocation && <span className="normal-case text-gray-400">/ Konum</span>}</th>
              <th className="py-2.5 px-4 text-left font-medium hidden sm:table-cell">Boyut</th>
              <th className="py-2.5 px-4 text-left font-medium hidden md:table-cell">Tarih</th>
              <th className="py-2.5 px-4 text-right font-medium pr-4">İşlem</th>
            </tr>
          </thead>
          <tbody>
            {files.map((file) => (
              <FileRow
                key={file.id}
                file={file}
                locationLabel={showLocation ? folderPathLabel(file.folderId) : undefined}
                selected={selectedIds.has(file.id)}
                onToggle={() => onToggle(file.id)}
                canDelete={isManager || file.uploadedBy === userId}
                onDelete={() => onDelete(file.id)}
                onDownload={() => onDownload(file)}
                showLocation={showLocation}
              />
            ))}
          </tbody>
        </table>
      </div>
    </div>
  );
}
