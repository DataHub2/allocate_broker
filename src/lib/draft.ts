/** Keeps what was written on the start page while the person creates an account. */
const DB = "allocate";
const STORE = "draft";
const KEY = "current";

export interface Draft {
  description: string;
  files: File[];
}

function open(): Promise<IDBDatabase> {
  return new Promise((resolve, reject) => {
    const request = indexedDB.open(DB, 1);
    request.onupgradeneeded = () => request.result.createObjectStore(STORE);
    request.onsuccess = () => resolve(request.result);
    request.onerror = () => reject(request.error);
  });
}

function run<T>(mode: IDBTransactionMode, fn: (store: IDBObjectStore) => IDBRequest<T>): Promise<T> {
  return open().then(
    (db) =>
      new Promise<T>((resolve, reject) => {
        const request = fn(db.transaction(STORE, mode).objectStore(STORE));
        request.onsuccess = () => resolve(request.result);
        request.onerror = () => reject(request.error);
      }),
  );
}

export const saveDraft = (draft: Draft) => run("readwrite", (s) => s.put(draft, KEY));
export const loadDraft = () => run<Draft | undefined>("readonly", (s) => s.get(KEY));
export const clearDraft = () => run("readwrite", (s) => s.delete(KEY));

const MAX_SIDE = 2000;

/** Re-encoding through a canvas also drops EXIF, so photos do not carry the home's GPS position. */
export async function compressImage(file: File): Promise<Blob> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    throw new Error("Den här bilden går inte att läsa. Spara den som JPG och försök igen.");
  }
  const scale = Math.min(1, MAX_SIDE / Math.max(bitmap.width, bitmap.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(bitmap.width * scale);
  canvas.height = Math.round(bitmap.height * scale);
  canvas.getContext("2d")!.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  return new Promise((resolve, reject) =>
    canvas.toBlob((blob) => (blob ? resolve(blob) : reject(new Error("Bilden kunde inte sparas."))), "image/jpeg", 0.85),
  );
}

export async function uploadFile(projectId: string, file: File, kind: "photo" | "drawing", questionId: string | null): Promise<{ id: string; name: string }> {
  const body = new FormData();
  const payload = kind === "photo" ? await compressImage(file) : file;
  body.set("file", payload, kind === "photo" ? file.name.replace(/\.[^.]+$/, "") + ".jpg" : file.name);
  body.set("kind", kind);
  if (questionId) body.set("questionId", questionId);
  const response = await fetch(`/api/projekt/${projectId}/filer`, { method: "POST", body });
  const data = (await response.json().catch(() => ({}))) as { error?: string; id?: string; name?: string };
  if (!response.ok || !data.id) throw new Error(data.error ?? "Uppladdningen misslyckades. Försök igen.");
  return { id: data.id, name: data.name ?? file.name };
}
