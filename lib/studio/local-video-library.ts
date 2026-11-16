export type RecentStudioVideo = {
  blob: Blob;
  durationSeconds: number;
  fileName: string;
  height: number;
  id: string;
  savedAt: number;
  size: number;
  width: number;
};

const databaseNamePrefix = "artistdeck-studio-workspace";
const storeName = "local-video-library";

export async function listRecentStudioVideos(workspaceId: string): Promise<RecentStudioVideo[]> {
  const database = await openLibrary(workspaceId);
  if (!database) return [];
  const records = await request<RecentStudioVideo[]>(database.transaction(storeName, "readonly").objectStore(storeName).getAll());
  database.close();
  return records.sort((first, second) => second.savedAt - first.savedAt);
}

export async function saveRecentStudioVideo(workspaceId: string, video: Omit<RecentStudioVideo, "id" | "savedAt">): Promise<RecentStudioVideo> {
  const database = await openLibrary(workspaceId);
  const record: RecentStudioVideo = { ...video, id: crypto.randomUUID(), savedAt: Date.now() };
  if (!database) return record;
  const transaction = database.transaction(storeName, "readwrite");
  transaction.objectStore(storeName).put(record);
  await completed(transaction);
  const records = await listRecentStudioVideos(workspaceId);
  const discarded = records.slice(5);
  if (discarded.length) {
    const cleanup = database.transaction(storeName, "readwrite");
    discarded.forEach((candidate) => cleanup.objectStore(storeName).delete(candidate.id));
    await completed(cleanup);
  }
  database.close();
  return record;
}

function openLibrary(workspaceId: string): Promise<IDBDatabase | null> {
  if (typeof indexedDB === "undefined" || !workspaceId) return Promise.resolve(null);
  return new Promise((resolve) => {
    const request = indexedDB.open(`${databaseNamePrefix}:${workspaceId}`, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(storeName, { keyPath: "id" });
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => resolve(null);
  });
}

function request<T>(value: IDBRequest<T>): Promise<T> {
  return new Promise((resolve, reject) => { value.onsuccess = () => resolve(value.result); value.onerror = () => reject(value.error); });
}

function completed(transaction: IDBTransaction): Promise<void> {
  return new Promise((resolve, reject) => { transaction.oncomplete = () => resolve(); transaction.onerror = () => reject(transaction.error); transaction.onabort = () => reject(transaction.error); });
}
