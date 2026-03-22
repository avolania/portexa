import { create } from "zustand";
import type { ProjectFile, FileFolder } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete, dbUploadFile, dbDeleteFile } from "@/lib/db";

interface FileState {
  files: ProjectFile[];
  folders: FileFolder[];
  uploading: boolean;
  load: () => Promise<void>;
  // folders
  addFolder: (folder: FileFolder) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
  // files
  uploadFile: (
    file: File,
    projectId: string,
    phaseId: string,
    userId: string,
    folderId?: string
  ) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
}

export const useFileStore = create<FileState>()((set, get) => ({
  files: [],
  folders: [],
  uploading: false,

  load: async () => {
    const [files, folders] = await Promise.all([
      dbLoadAll<ProjectFile>("project_files"),
      dbLoadAll<FileFolder>("file_folders"),
    ]);
    set({ files, folders });
  },

  addFolder: (folder) => {
    set((s) => ({ folders: [...s.folders, folder] }));
    dbUpsert("file_folders", folder.id, folder);
  },

  renameFolder: (id, name) => {
    set((s) => ({
      folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)),
    }));
    const updated = get().folders.find((f) => f.id === id);
    if (updated) dbUpsert("file_folders", id, updated);
  },

  deleteFolder: (id) => {
    // also delete child folders and their files recursively
    const { folders, files } = get();
    const toDelete = new Set<string>();
    const queue = [id];
    while (queue.length) {
      const cur = queue.pop()!;
      toDelete.add(cur);
      folders.filter((f) => f.parentFolderId === cur).forEach((f) => queue.push(f.id));
    }
    const filesToDelete = files.filter((f) => f.folderId && toDelete.has(f.folderId));
    set((s) => ({
      folders: s.folders.filter((f) => !toDelete.has(f.id)),
      files: s.files.filter((f) => !f.folderId || !toDelete.has(f.folderId)),
    }));
    toDelete.forEach((fid) => dbDelete("file_folders", fid));
    filesToDelete.forEach((f) => {
      dbDeleteFile(f.storagePath);
      dbDelete("project_files", f.id);
    });
  },

  uploadFile: async (file, projectId, phaseId, userId, folderId) => {
    set({ uploading: true });
    try {
      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "";
      const folderSegment = folderId ?? "root";
      const storagePath = `${projectId}/${phaseId}/${folderSegment}/${id}${ext ? "." + ext : ""}`;

      await dbUploadFile(storagePath, file);

      const entry: ProjectFile = {
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        projectId,
        phaseId,
        folderId,
        uploadedBy: userId,
        storagePath,
        createdAt: new Date().toISOString(),
      };

      set((s) => ({ files: [entry, ...s.files] }));
      await dbUpsert("project_files", id, entry);
    } finally {
      set({ uploading: false });
    }
  },

  deleteFile: async (fileId) => {
    const file = get().files.find((f) => f.id === fileId);
    if (!file) return;
    set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
    await dbDeleteFile(file.storagePath);
    await dbDelete("project_files", fileId);
  },
}));
