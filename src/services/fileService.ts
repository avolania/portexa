import type { ProjectFile, FileFolder } from "@/types";
import { dbLoadAll, dbUpsert, dbDelete, dbUploadFile, dbDeleteFile } from "@/lib/db";

export async function loadFiles(): Promise<{ files: ProjectFile[]; folders: FileFolder[] }> {
  const [files, folders] = await Promise.all([
    dbLoadAll<ProjectFile>("project_files"),
    dbLoadAll<FileFolder>("file_folders"),
  ]);
  return { files, folders };
}

export async function createFolder(folder: FileFolder, orgId: string): Promise<void> {
  await dbUpsert("file_folders", folder.id, folder, orgId);
}

export async function renameFolder(
  id: string,
  name: string,
  current: FileFolder[]
): Promise<FileFolder | null> {
  const existing = current.find((f) => f.id === id);
  if (!existing) return null;
  const updated: FileFolder = { ...existing, name };
  await dbUpsert("file_folders", id, updated);
  return updated;
}

export async function deleteFolder(
  id: string,
  folders: FileFolder[],
  files: ProjectFile[]
): Promise<{ deletedFolderIds: Set<string>; deletedFiles: ProjectFile[] }> {
  // Collect folder id's recursively
  const deletedFolderIds = new Set<string>();
  const queue = [id];
  while (queue.length) {
    const cur = queue.pop()!;
    deletedFolderIds.add(cur);
    folders
      .filter((f) => f.parentFolderId === cur)
      .forEach((f) => queue.push(f.id));
  }

  const deletedFiles = files.filter((f) => f.folderId && deletedFolderIds.has(f.folderId));

  // DB first — if this fails nothing has been touched in storage
  await Promise.all([
    ...[...deletedFolderIds].map((fid) => dbDelete("file_folders", fid)),
    ...deletedFiles.map((f) => dbDelete("project_files", f.id)),
  ]);

  // Storage best-effort — orphan storage files are recoverable; broken DB references are not
  await Promise.allSettled(deletedFiles.map((f) => dbDeleteFile(f.storagePath)));

  return { deletedFolderIds, deletedFiles };
}

export async function uploadFile(
  file: File,
  projectId: string,
  phaseId: string,
  userId: string,
  orgId: string,
  folderId?: string
): Promise<ProjectFile> {
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

  try {
    await dbUpsert("project_files", id, entry, orgId);
  } catch (err) {
    await dbDeleteFile(storagePath).catch(() => {});
    throw err;
  }
  return entry;
}

export async function deleteFile(fileId: string, files: ProjectFile[]): Promise<void> {
  const file = files.find((f) => f.id === fileId);
  if (!file) return;
  await dbDelete("project_files", fileId);
  await dbDeleteFile(file.storagePath).catch(() => {});
}
