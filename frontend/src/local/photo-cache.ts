import type { PhotoSize } from "@/lib/types";

interface CacheEntry {
  thumb: Blob;
  preview: Blob;
  original: Blob;
  thumbUrl?: string;
  previewUrl?: string;
  originalUrl?: string;
}

const cache = new Map<string, CacheEntry>();
const EMPTY =
  "data:image/gif;base64,R0lGODlhAQABAIAAAAAAAP///ywAAAAAAQABAAACAUwAOw==";

export function registerLocalPhoto(
  id: string,
  blobs: { thumb: Blob; preview: Blob; original: Blob },
): void {
  const existing = cache.get(id);
  if (existing?.originalUrl) URL.revokeObjectURL(existing.originalUrl);
  cache.set(id, { ...blobs });
}

export function localPhotoUrl(id: string, size: PhotoSize = "thumb"): string {
  const entry = cache.get(id);
  if (!entry) return EMPTY;
  if (size === "thumb") {
    entry.thumbUrl ??= URL.createObjectURL(entry.thumb);
    return entry.thumbUrl;
  }
  if (size === "preview") {
    entry.previewUrl ??= URL.createObjectURL(entry.preview);
    return entry.previewUrl;
  }
  entry.originalUrl ??= URL.createObjectURL(entry.original);
  return entry.originalUrl;
}

export function forgetLocalPhoto(id: string): void {
  const entry = cache.get(id);
  if (!entry) return;
  for (const url of [entry.thumbUrl, entry.previewUrl, entry.originalUrl]) {
    if (url) URL.revokeObjectURL(url);
  }
  cache.delete(id);
}

export function clearLocalPhotoCache(): void {
  for (const id of [...cache.keys()]) forgetLocalPhoto(id);
}
