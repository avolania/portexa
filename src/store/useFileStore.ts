import { create } from "zustand";
import type { ProjectFile } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete, dbUploadFile, dbDeleteFile } from "@/lib/db";

interface FileState {
  files: ProjectFile[];
  uploading: boolean;
  load: () => Promise<void>;
  uploadFile: (file: File, projectId: string, userId: string) => Promise<void>;
  deleteFile: (fileId: string) => Promise<void>;
}

export const useFileStore = create<FileState>()((set, get) => ({
  files: [],
  uploading: false,

  load: async () => {
    const files = await dbLoadAll<ProjectFile>("project_files");
    set({ files });
  },

  uploadFile: async (file, projectId, userId) => {
    set({ uploading: true });
    try {
      const id = crypto.randomUUID();
      const ext = file.name.split(".").pop() ?? "";
      const storagePath = `${projectId}/${id}${ext ? "." + ext : ""}`;

      await dbUploadFile(storagePath, file);

      const entry: ProjectFile = {
        id,
        name: file.name,
        size: file.size,
        mimeType: file.type,
        projectId,
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
