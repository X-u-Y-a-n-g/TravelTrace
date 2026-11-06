import { Directory, Filesystem } from "@capacitor/filesystem";
import { Share } from "@capacitor/share";
import JSZip from "jszip";

import { isNativeApp } from "@/lib/mobile";
import { tripExportUrl } from "@/lib/api";
import { localDb } from "./db";

function safeName(value: string): string {
  return value.replace(/[\\/:*?"<>|]+/g, "-").slice(0, 80) || "trip";
}

function blobToBase64(blob: Blob): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = String(reader.result ?? "");
      resolve(result.slice(result.indexOf(",") + 1));
    };
    reader.onerror = () => reject(reader.error ?? new Error("无法读取文件"));
    reader.readAsDataURL(blob);
  });
}

export async function buildLocalTripZip(tripId: string): Promise<{ blob: Blob; filename: string }> {
  const trip = await localDb.trips.get(tripId);
  if (!trip) throw new Error("旅行不存在");
  const [photos, visits, places, events, links] = await Promise.all([
    localDb.photos.where("trip_id").equals(tripId).toArray(),
    localDb.visits.where("trip_id").equals(tripId).toArray(),
    localDb.places.toArray(),
    localDb.events.where("trip_id").equals(tripId).toArray(),
    localDb.eventPhotos.toArray(),
  ]);
  const placeMap = new Map(places.map((place) => [place.id, place]));
  const eventPhotoMap = new Map<string, string[]>();
  for (const link of links) {
    eventPhotoMap.set(link.event_id, [...(eventPhotoMap.get(link.event_id) ?? []), link.photo_id]);
  }

  const zip = new JSZip();
  const manifest = {
    format: "traveltrace-export",
    version: 2,
    exported_at: new Date().toISOString(),
    trip_id: trip.id,
    title: trip.title,
    photo_count: photos.length,
  };
  zip.file("manifest.json", JSON.stringify(manifest, null, 2));
  zip.file("trip.json", JSON.stringify(trip, null, 2));
  zip.file(
    "photos.json",
    JSON.stringify(
      photos.map((photo) => ({
        id: photo.id,
        filename: photo.original_filename,
        caption: photo.caption,
        taken_at: photo.taken_at,
        latitude: photo.latitude,
        longitude: photo.longitude,
        is_favorite: photo.is_favorite,
        camera_make: photo.camera_make,
        camera_model: photo.camera_model,
        lens: photo.lens,
      })),
      null,
      2,
    ),
  );
  zip.file(
    "timeline.json",
    JSON.stringify(
      events.map((event) => ({
        id: event.id,
        title: event.title,
        description: event.description,
        type: event.event_type,
        start_time: event.start_time,
        end_time: event.end_time,
        day: event.day,
        status: event.status,
        source: event.source,
        place_id: event.place_id,
        photo_ids: eventPhotoMap.get(event.id) ?? [],
      })),
      null,
      2,
    ),
  );
  zip.file(
    "places.geojson",
    JSON.stringify(
      {
        type: "FeatureCollection",
        features: visits
          .map((visit) => placeMap.get(visit.place_id))
          .filter((place): place is NonNullable<typeof place> => Boolean(place))
          .map((place) => ({
            type: "Feature",
            geometry:
              place.latitude !== null && place.longitude !== null
                ? { type: "Point", coordinates: [place.longitude, place.latitude] }
                : null,
            properties: {
              name: place.name,
              category: place.category,
              city: place.city,
              country: place.country,
            },
          })),
      },
      null,
      2,
    ),
  );

  const originals = zip.folder("originals");
  photos.forEach((photo, index) => {
    const prefix = String(index + 1).padStart(3, "0");
    originals?.file(`${prefix}-${safeName(photo.original_filename)}`, photo.original);
  });

  const blob = await zip.generateAsync({ type: "blob", compression: "DEFLATE" });
  return { blob, filename: `${safeName(trip.title)}-${trip.id.slice(0, 8)}.zip` };
}

export async function downloadTripZip(tripId: string): Promise<void> {
  if (!isNativeApp()) {
    window.location.assign(tripExportUrl(tripId));
    return;
  }
  const { blob, filename } = await buildLocalTripZip(tripId);
  const base64 = await blobToBase64(blob);
  try {
    const saved = await Filesystem.writeFile({
      path: filename,
      data: base64,
      directory: Directory.Cache,
      recursive: true,
    });
    await Share.share({
      title: filename,
      text: "TravelTrace 旅行导出",
      url: saved.uri,
      dialogTitle: "保存或分享旅行导出",
    });
  } catch {
    // Browser fallback (and a safety net if the native share bridge is
    // unavailable): trigger a normal download.
    const url = URL.createObjectURL(blob);
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = filename;
    document.body.appendChild(anchor);
    anchor.click();
    anchor.remove();
    window.setTimeout(() => URL.revokeObjectURL(url), 5_000);
  }
}
