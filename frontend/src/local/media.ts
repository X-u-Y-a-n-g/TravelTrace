import * as exifr from "exifr";

export interface PhotoMetadata {
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  width: number | null;
  height: number | null;
}

export interface PhotoDerivatives {
  thumb: Blob;
  preview: Blob;
  width: number;
  height: number;
}

function pad(value: number): string {
  return String(value).padStart(2, "0");
}

export function localDateTime(date: Date): string {
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}T${pad(
    date.getHours(),
  )}:${pad(date.getMinutes())}:${pad(date.getSeconds())}`;
}

export async function sha256(blob: Blob): Promise<string> {
  const buffer = await blob.arrayBuffer();
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

export async function readMetadata(file: File): Promise<PhotoMetadata> {
  let data: Record<string, unknown> | null = null;
  try {
    data = (await exifr.parse(file, {
      tiff: true,
      exif: true,
      gps: true,
      translateValues: true,
      reviveValues: true,
      pick: [
        "DateTimeOriginal",
        "CreateDate",
        "Make",
        "Model",
        "LensModel",
        "ImageWidth",
        "ImageHeight",
        "ExifImageWidth",
        "ExifImageHeight",
        "latitude",
        "longitude",
      ],
    })) as Record<string, unknown> | null;
  } catch {
    data = null;
  }

  const taken = data?.DateTimeOriginal ?? data?.CreateDate;
  const takenAt =
    taken instanceof Date && !Number.isNaN(taken.getTime())
      ? localDateTime(taken)
      : localDateTime(new Date(file.lastModified || Date.now()));

  const latitude = typeof data?.latitude === "number" ? data.latitude : null;
  const longitude = typeof data?.longitude === "number" ? data.longitude : null;
  const width =
    (typeof data?.ExifImageWidth === "number" && data.ExifImageWidth) ||
    (typeof data?.ImageWidth === "number" && data.ImageWidth) ||
    null;
  const height =
    (typeof data?.ExifImageHeight === "number" && data.ExifImageHeight) ||
    (typeof data?.ImageHeight === "number" && data.ImageHeight) ||
    null;

  return {
    taken_at: takenAt,
    latitude,
    longitude,
    camera_make: typeof data?.Make === "string" ? data.Make.trim() || null : null,
    camera_model: typeof data?.Model === "string" ? data.Model.trim() || null : null,
    lens: typeof data?.LensModel === "string" ? data.LensModel.trim() || null : null,
    width,
    height,
  };
}

async function draw(
  bitmap: ImageBitmap,
  maxEdge: number,
  quality = 0.82,
): Promise<Blob> {
  const scale = Math.min(1, maxEdge / Math.max(bitmap.width, bitmap.height));
  const width = Math.max(1, Math.round(bitmap.width * scale));
  const height = Math.max(1, Math.round(bitmap.height * scale));
  const canvas = document.createElement("canvas");
  canvas.width = width;
  canvas.height = height;
  const context = canvas.getContext("2d");
  if (!context) throw new Error("Canvas 2D is unavailable");
  context.fillStyle = "#ffffff";
  context.fillRect(0, 0, width, height);
  context.drawImage(bitmap, 0, 0, width, height);
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      (blob) => (blob ? resolve(blob) : reject(new Error("Thumbnail generation failed"))),
      "image/jpeg",
      quality,
    );
  });
}

export async function createDerivatives(file: File): Promise<PhotoDerivatives> {
  const bitmap = await createImageBitmap(file);
  try {
    const thumb = await draw(bitmap, 640, 0.8);
    const preview = await draw(bitmap, 1600, 0.85);
    return { thumb, preview, width: bitmap.width, height: bitmap.height };
  } finally {
    bitmap.close();
  }
}
