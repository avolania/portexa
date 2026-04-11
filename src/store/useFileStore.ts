import { create } from "zustand";
import type { ProjectFile, FileFolder } from "@/types";
import { useAuthStore } from "@/store/useAuthStore";
import {
  loadFiles,
  createFolder,
  renameFolder,
  deleteFolder,
  uploadFile,
  deleteFile,
} from "@/services/fileService";

interface FileState {
  files: ProjectFile[];
  folders: FileFolder[];
  loading: boolean;
  uploading: boolean;
  error: string | null;
  load: () => Promise<void>;
  addFolder: (folder: FileFolder) => void;
  renameFolder: (id: string, name: string) => void;
  deleteFolder: (id: string) => void;
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
  loading: false,
  uploading: false,
  error: null,

  load: async () => {
    set({ loading: true, error: null });
    try {
      const { files, folders } = await loadFiles();
      set({ files, folders, loading: false });
    } catch (err) {
      set({ loading: false, error: err instanceof Error ? err.message : "Yüklenemedi" });
    }
  },

  addFolder: (folder) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set((s) => ({ folders: [...s.folders, folder] }));
    createFolder(folder, orgId);
  },

  renameFolder: (id, name) => {
    set((s) => ({ folders: s.folders.map((f) => (f.id === id ? { ...f, name } : f)) }));
    renameFolder(id, name, get().folders);
  },

  deleteFolder: (id) => {
    const { folders, files } = get();
    deleteFolder(id, folders, files).then(({ deletedFolderIds, deletedFiles }) => {
      const deletedFileIds = new Set(deletedFiles.map((f) => f.id));
      set((s) => ({
        folders: s.folders.filter((f) => !deletedFolderIds.has(f.id)),
        files: s.files.filter((f) => !deletedFileIds.has(f.id)),
      }));
    });
  },

  uploadFile: async (file, projectId, phaseId, userId, folderId) => {
    const orgId = useAuthStore.getState().user?.orgId ?? "";
    set({ uploading: true });
    try {
      const entry = await uploadFile(file, projectId, phaseId, userId, orgId, folderId);
      set((s) => ({ files: [entry, ...s.files] }));
    } finally {
      set({ uploading: false });
    }
  },

  deleteFile: async (fileId) => {
    const rollback = get().files.find((f) => f.id === fileId);
    set((s) => ({ files: s.files.filter((f) => f.id !== fileId) }));
    try {
      await deleteFile(fileId, get().files);
    } catch (err) {
      if (rollback) set((s) => ({ files: [...s.files, rollback] }));
      throw err;
    }
  },
}));
