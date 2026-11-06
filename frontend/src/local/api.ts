import type {
  Bootstrap,
  CountryStat,
  EventType,
  GeocodeResult,
  ImportTask,
  InstanceSettings,
  MapMarker,
  MapMarkersResponse,
  MapRoutes,
  Page,
  Photo,
  PhotoFilters,
  PhotoMini,
  Place,
  PlaceCategory,
  PlaceFilters,
  StatsOverview,
  Timeline,
  TimelineDay,
  TimelineEvent,
  TimelineGenerateResult,
  TokenResponse,
  Trip,
  TripDetail,
  TripFilters,
  TripPlace,
  User,
  YearStat,
} from "@/lib/types";
import type {
  EventInput,
  PhotoUpdateInput,
  PlaceInput,
  TripInput,
} from "@/lib/api";

import { LOCAL_USER_META, localDb, type EventRow, type PhotoRow, type PlaceRow, type TripRow, type VisitRow } from "./db";
import { createDerivatives, readMetadata, sha256 } from "./media";
import { forgetLocalPhoto, registerLocalPhoto } from "./photo-cache";

const LOCAL_TOKEN = "local-device";
const LOCAL_VERSION = "0.3.0";
const DEFAULT_PAGE_SIZE = 24;
const LOCAL_USER_ID = "local-user";

const now = () => new Date().toISOString();
const uuid = () =>
  typeof crypto !== "undefined" && "randomUUID" in crypto
    ? crypto.randomUUID()
    : `local-${Date.now()}-${Math.random().toString(16).slice(2)}`;

function dayOf(value: string | null | undefined): string | null {
  return value ? value.slice(0, 10) : null;
}

function parseDay(value: string | null | undefined): Date | null {
  if (!value) return null;
  const date = new Date(`${value.slice(0, 10)}T00:00:00`);
  return Number.isNaN(date.getTime()) ? null : date;
}

function dayCount(start: string | null, end: string | null): number {
  const from = parseDay(start);
  const to = parseDay(end);
  if (!from || !to) return from || to ? 1 : 0;
  return Math.max(1, Math.round((to.getTime() - from.getTime()) / 86_400_000) + 1);
}

function pageOf<T>(items: T[], page = 1, size = DEFAULT_PAGE_SIZE): Page<T> {
  const total = items.length;
  const pages = Math.max(1, Math.ceil(total / size));
  const current = Math.min(Math.max(page, 1), pages);
  const start = (current - 1) * size;
  return {
    items: items.slice(start, start + size),
    total,
    page: current,
    size,
    pages,
  };
}

function placeSummary(row: PlaceRow) {
  return {
    id: row.id,
    name: row.name,
    category: row.category,
    city: row.city,
    country: row.country,
    latitude: row.latitude,
    longitude: row.longitude,
  };
}

function photoMini(row: PhotoRow): PhotoMini {
  return {
    id: row.id,
    taken_at: row.taken_at,
    latitude: row.latitude,
    longitude: row.longitude,
    is_favorite: row.is_favorite,
    caption: row.caption,
    width: row.width,
    height: row.height,
  };
}

function photoOut(row: PhotoRow, place: PlaceRow | undefined): Photo {
  return {
    id: row.id,
    trip_id: row.trip_id,
    place_id: row.place_id,
    place: place ? placeSummary(place) : null,
    original_filename: row.original_filename,
    mime_type: row.mime_type,
    file_size: row.file_size,
    width: row.width,
    height: row.height,
    taken_at: row.taken_at,
    taken_at_offset_minutes: row.taken_at_offset_minutes,
    latitude: row.latitude,
    longitude: row.longitude,
    has_gps: row.has_gps,
    gps_source: row.gps_source,
    camera_make: row.camera_make,
    camera_model: row.camera_model,
    lens: row.lens,
    caption: row.caption,
    is_favorite: row.is_favorite,
    status: row.status,
    created_at: row.created_at,
  };
}

function distanceKm(
  lat1: number,
  lon1: number,
  lat2: number,
  lon2: number,
): number {
  const radius = 6371;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return radius * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

async function localUser(): Promise<User> {
  const row = await localDb.meta.get(LOCAL_USER_META);
  if (row?.value) return row.value as User;
  const user: User = {
    id: LOCAL_USER_ID,
    username: "local",
    email: "",
    display_name: "本地旅行者",
    created_at: now(),
    last_login_at: now(),
  };
  await localDb.meta.put({ key: LOCAL_USER_META, value: user });
  return user;
}

async function tripsWithData() {
  const [trips, photos, visits, places] = await Promise.all([
    localDb.trips.filter((trip) => !trip.deleted_at).toArray(),
    localDb.photos.toArray(),
    localDb.visits.toArray(),
    localDb.places.toArray(),
  ]);
  const placeMap = new Map(places.map((place) => [place.id, place]));
  return { trips, photos, visits, places, placeMap };
}

function buildTrip(
  row: TripRow,
  photos: PhotoRow[],
  visits: VisitRow[],
): Trip {
  const tripPhotos = photos.filter((photo) => photo.trip_id === row.id);
  const tripVisits = visits.filter((visit) => visit.trip_id === row.id);
  const cover =
    tripPhotos.find((photo) => photo.id === row.cover_photo_id) ??
    [...tripPhotos].sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""))[0];
  if (cover) {
    registerLocalPhoto(cover.id, {
      thumb: cover.thumb,
      preview: cover.preview,
      original: cover.original,
    });
  }
  return {
    id: row.id,
    title: row.title,
    description: row.description,
    start_date: row.start_date,
    end_date: row.end_date,
    visibility: row.visibility,
    cover_photo_id: row.cover_photo_id,
    cover_photo: cover ? photoMini(cover) : null,
    day_count: dayCount(row.start_date, row.end_date),
    photo_count: tripPhotos.length,
    place_count: new Set(tripVisits.map((visit) => visit.place_id)).size,
    created_at: row.created_at,
    updated_at: row.updated_at,
  };
}

function tripStats(row: TripRow, photos: PhotoRow[], visits: VisitRow[]) {
  const tripPhotos = photos.filter((photo) => photo.trip_id === row.id);
  const visitPlaces = new Set(
    visits.filter((visit) => visit.trip_id === row.id).map((visit) => visit.place_id),
  );
  const photoDays = new Set(
    tripPhotos.map((photo) => photo.taken_at?.slice(0, 10)).filter(Boolean),
  ).size;
  const timestamps = tripPhotos
    .map((photo) => photo.taken_at)
    .filter((value): value is string => Boolean(value))
    .sort();
  return {
    photo_count: tripPhotos.length,
    place_count: visitPlaces.size,
    day_count: dayCount(row.start_date, row.end_date),
    photo_days: photoDays,
    gps_photo_count: tripPhotos.filter((photo) => photo.has_gps).length,
    favorite_count: tripPhotos.filter((photo) => photo.is_favorite).length,
    first_photo_at: timestamps[0] ?? null,
    last_photo_at: timestamps[timestamps.length - 1] ?? null,
  };
}

async function tripDetail(row: TripRow): Promise<TripDetail> {
  const [photos, visits, places] = await Promise.all([
    localDb.photos.toArray(),
    localDb.visits.where("trip_id").equals(row.id).toArray(),
    localDb.places.toArray(),
  ]);
  const placeMap = new Map(places.map((place) => [place.id, place]));
  const tripPhotos = photos.filter((photo) => photo.trip_id === row.id);
  const tripVisits = visits
    .filter((visit) => visit.trip_id === row.id)
    .sort((a, b) => a.sort_order - b.sort_order);
  const trip = buildTrip(row, photos, visits);
  return {
    ...trip,
    places: tripVisits.map((visit) => ({
      id: visit.id,
      place: placeSummary(placeMap.get(visit.place_id)!),
      arrival_time: visit.arrival_time,
      departure_time: visit.departure_time,
      day: visit.day,
      sort_order: visit.sort_order,
      notes: visit.notes,
    })),
    stats: tripStats(row, photos, visits),
    photos_preview: tripPhotos
      .sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""))
      .slice(0, 8)
      .map(photoMini),
  };
}

async function getTripRow(tripId: string): Promise<TripRow> {
  const trip = await localDb.trips.get(tripId);
  if (!trip || trip.deleted_at) throw new Error("旅行不存在");
  return trip;
}

async function photoOutById(row: PhotoRow): Promise<Photo> {
  const place = row.place_id ? await localDb.places.get(row.place_id) : undefined;
  registerLocalPhoto(row.id, {
    thumb: row.thumb,
    preview: row.preview,
    original: row.original,
  });
  return photoOut(row, place);
}

async function eventOut(row: EventRow): Promise<TimelineEvent> {
  const [place, links] = await Promise.all([
    row.place_id ? localDb.places.get(row.place_id) : undefined,
    localDb.eventPhotos.where("event_id").equals(row.id).toArray(),
  ]);
  const photos = (
    await localDb.photos.bulkGet(links.map((link) => link.photo_id))
  )
    .filter((photo): photo is PhotoRow => Boolean(photo))
    .sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""));
  for (const photo of photos) {
    registerLocalPhoto(photo.id, {
      thumb: photo.thumb,
      preview: photo.preview,
      original: photo.original,
    });
  }
  return {
    id: row.id,
    trip_id: row.trip_id,
    title: row.title,
    description: row.description,
    event_type: row.event_type,
    start_time: row.start_time,
    end_time: row.end_time,
    day: row.day,
    sort_order: row.sort_order,
    source: row.source,
    status: row.status,
    place: place ? placeSummary(place) : null,
    photos: photos.map(photoMini),
  };
}

async function buildTimeline(tripId: string): Promise<Timeline> {
  const trip = await getTripRow(tripId);
  const rows = await localDb.events.where("trip_id").equals(tripId).toArray();
  rows.sort(
    (a, b) =>
      a.day.localeCompare(b.day) ||
      a.start_time.localeCompare(b.start_time) ||
      a.sort_order - b.sort_order,
  );
  const byDay = new Map<string, TimelineEvent[]>();
  for (const row of rows) {
    const event = await eventOut(row);
    const day = event.day;
    byDay.set(day, [...(byDay.get(day) ?? []), event]);
  }
  const days: TimelineDay[] = [...byDay.entries()]
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([date, events], index) => ({ date, day_index: index + 1, events }));
  const photoCount = await localDb.photos.where("trip_id").equals(tripId).count();
  return {
    trip_id: tripId,
    start_date: trip.start_date,
    end_date: trip.end_date,
    days,
    event_count: rows.length,
    photo_count: photoCount,
  };
}

async function processImport(
  taskId: string,
  files: File[],
  options: { tripId?: string; placeId?: string },
): Promise<void> {
  const task = await localDb.imports.get(taskId);
  if (!task) return;
  let processed = 0;
  let failed = 0;
  let imported = 0;
  let skipped = 0;
  const photoIds: string[] = [];
  const errors: Array<{ file?: string; error?: string }> = [];
  await localDb.imports.update(taskId, {
    status: "running",
    started_at: now(),
    message: "正在读取照片…",
  });

  const trips = await localDb.trips.filter((trip) => !trip.deleted_at).toArray();
  const places = await localDb.places.toArray();

  for (const file of files) {
    const current = await localDb.imports.get(taskId);
    if (current?.cancelled) break;
    try {
      const hash = await sha256(file);
      const duplicate = await localDb.photos.where("hash").equals(hash).first();
      if (duplicate) {
        skipped += 1;
        processed += 1;
        await localDb.imports.update(taskId, { processed, progress: Math.round((processed / files.length) * 100) });
        continue;
      }
      const metadata = await readMetadata(file);
      const derivatives = await createDerivatives(file);
      const day = dayOf(metadata.taken_at);
      const trip =
        (options.tripId ? trips.find((item) => item.id === options.tripId) : undefined) ??
        (day
          ? trips.find(
              (item) =>
                (!item.start_date || item.start_date <= day) &&
                (!item.end_date || item.end_date >= day),
            )
          : undefined);
      let placeId = options.placeId ?? null;
      if (!placeId && metadata.latitude !== null && metadata.longitude !== null) {
        const nearby = places
          .filter((place) => place.latitude !== null && place.longitude !== null)
          .map((place) => ({
            place,
            distance: distanceKm(
              metadata.latitude as number,
              metadata.longitude as number,
              place.latitude as number,
              place.longitude as number,
            ),
          }))
          .filter((item) => item.distance <= 0.5)
          .sort((a, b) => a.distance - b.distance)[0];
        placeId = nearby?.place.id ?? null;
      }
      const row: PhotoRow = {
        id: uuid(),
        trip_id: trip?.id ?? null,
        place_id: placeId,
        original_filename: file.name,
        mime_type: file.type || "image/jpeg",
        file_size: file.size,
        width: derivatives.width,
        height: derivatives.height,
        taken_at: metadata.taken_at,
        taken_at_offset_minutes: null,
        latitude: metadata.latitude,
        longitude: metadata.longitude,
        has_gps: metadata.latitude !== null && metadata.longitude !== null,
        gps_source:
          metadata.latitude !== null && metadata.longitude !== null ? "exif" : "none",
        camera_make: metadata.camera_make,
        camera_model: metadata.camera_model,
        lens: metadata.lens,
        caption: null,
        is_favorite: false,
        status: "ready",
        created_at: now(),
        hash,
        original: file,
        thumb: derivatives.thumb,
        preview: derivatives.preview,
      };
      await localDb.photos.put(row);
      registerLocalPhoto(row.id, {
        thumb: row.thumb,
        preview: row.preview,
        original: row.original,
      });
      imported += 1;
      photoIds.push(row.id);
    } catch (error) {
      failed += 1;
      errors.push({ file: file.name, error: String(error) });
    }
    processed += 1;
    await localDb.imports.update(taskId, {
      processed,
      failed,
      progress: Math.round((processed / files.length) * 100),
      message: `已处理 ${processed} / ${files.length}`,
    });
  }

  const cancelled = (await localDb.imports.get(taskId))?.cancelled;
  const status = cancelled
    ? "cancelled"
    : failed > 0
      ? "partial"
      : "succeeded";
  await localDb.imports.update(taskId, {
    status,
    processed,
    failed,
    progress: 100,
    result: { imported, skipped, failed, photo_ids: photoIds, errors },
    message: cancelled ? "导入已取消" : `已导入 ${imported} 张照片`,
    finished_at: now(),
  });
}

export const localApi = {
  auth: {
    bootstrap: async (): Promise<Bootstrap> => ({
      has_users: true,
      registration_enabled: false,
      app_version: LOCAL_VERSION,
      app_name: "TravelTrace",
    }),
    register: async (): Promise<TokenResponse> => {
      const user = await localUser();
      return { access_token: LOCAL_TOKEN, token_type: "local", expires_in: 0, user };
    },
    login: async (): Promise<TokenResponse> => {
      const user = await localUser();
      return { access_token: LOCAL_TOKEN, token_type: "local", expires_in: 0, user };
    },
    me: async (): Promise<User> => localUser(),
    logout: async (): Promise<void> => undefined,
    updateProfile: async (payload: { display_name?: string }): Promise<User> => {
      const user = { ...(await localUser()), display_name: payload.display_name ?? null };
      await localDb.meta.put({ key: LOCAL_USER_META, value: user });
      return user;
    },
    changePassword: async (): Promise<{ message: string }> => ({
      message: "本地模式不需要密码",
    }),
  },
  trips: {
    list: async (filters: TripFilters = {}): Promise<Page<Trip>> => {
      const { trips, photos, visits } = await tripsWithData();
      let items = trips.map((trip) => buildTrip(trip, photos, visits));
      if (filters.q) {
        const query = filters.q.toLowerCase();
        items = items.filter((trip) => trip.title.toLowerCase().includes(query));
      }
      if (filters.year) {
        items = items.filter((trip) => (trip.start_date ?? "").startsWith(String(filters.year)));
      }
      if (filters.visibility) {
        items = items.filter((trip) => trip.visibility === filters.visibility);
      }
      items.sort((a, b) => {
        if (filters.sort === "start_date_asc") return (a.start_date ?? "").localeCompare(b.start_date ?? "");
        if (filters.sort === "title_asc") return a.title.localeCompare(b.title);
        if (filters.sort === "created_desc") return b.created_at.localeCompare(a.created_at);
        return (b.start_date ?? "").localeCompare(a.start_date ?? "");
      });
      return pageOf(items, filters.page, filters.size ?? 12);
    },
    create: async (payload: TripInput): Promise<TripDetail> => {
      const title = payload.title.trim();
      if (!title) throw new Error("旅行标题不能为空");
      if (payload.start_date && payload.end_date && payload.end_date < payload.start_date) {
        throw new Error("结束日期必须晚于开始日期");
      }
      const timestamp = now();
      const row: TripRow = {
        id: uuid(),
        title,
        description: payload.description?.trim() || null,
        start_date: payload.start_date || null,
        end_date: payload.end_date || null,
        visibility: payload.visibility ?? "private",
        cover_photo_id: null,
        created_at: timestamp,
        updated_at: timestamp,
        deleted_at: null,
      };
      await localDb.trips.put(row);
      return tripDetail(row);
    },
    get: async (tripId: string): Promise<TripDetail> => tripDetail(await getTripRow(tripId)),
    update: async (tripId: string, payload: Partial<TripInput>): Promise<TripDetail> => {
      const row = await getTripRow(tripId);
      if (payload.title !== undefined) {
        if (!payload.title.trim()) throw new Error("旅行标题不能为空");
        row.title = payload.title.trim();
      }
      if (payload.description !== undefined) row.description = payload.description?.trim() || null;
      if (payload.start_date !== undefined) row.start_date = payload.start_date || null;
      if (payload.end_date !== undefined) row.end_date = payload.end_date || null;
      if (payload.visibility !== undefined) row.visibility = payload.visibility;
      if (payload.cover_photo_id !== undefined) row.cover_photo_id = payload.cover_photo_id;
      row.updated_at = now();
      await localDb.trips.put(row);
      return tripDetail(row);
    },
    remove: async (tripId: string): Promise<void> => {
      const row = await getTripRow(tripId);
      row.deleted_at = now();
      await localDb.trips.put(row);
    },
    restore: async (tripId: string): Promise<Trip> => {
      const row = await localDb.trips.get(tripId);
      if (!row) throw new Error("旅行不存在");
      row.deleted_at = null;
      await localDb.trips.put(row);
      return buildTrip(row, await localDb.photos.toArray(), await localDb.visits.toArray());
    },
    places: async (tripId: string): Promise<TripPlace[]> => (await tripDetail(await getTripRow(tripId))).places,
    attachPlace: async (tripId: string, payload: { place_id: string; arrival_time?: string | null; departure_time?: string | null; sort_order?: number; notes?: string | null }): Promise<TripPlace> => {
      await getTripRow(tripId);
      const place = await localDb.places.get(payload.place_id);
      if (!place) throw new Error("地点不存在");
      const existing = await localDb.visits.where("trip_id").equals(tripId).toArray();
      const sort = payload.sort_order ?? existing.length;
      const row: VisitRow = {
        id: uuid(),
        trip_id: tripId,
        place_id: payload.place_id,
        arrival_time: payload.arrival_time ?? null,
        departure_time: payload.departure_time ?? null,
        day: dayOf(payload.arrival_time),
        sort_order: sort,
        notes: payload.notes ?? null,
      };
      await localDb.visits.put(row);
      return {
        id: row.id,
        place: placeSummary(place),
        arrival_time: row.arrival_time,
        departure_time: row.departure_time,
        day: row.day,
        sort_order: row.sort_order,
        notes: row.notes,
      };
    },
    updatePlace: async (tripId: string, visitId: string, payload: { arrival_time?: string | null; departure_time?: string | null; sort_order?: number; notes?: string | null }): Promise<TripPlace> => {
      const visit = await localDb.visits.get(visitId);
      if (!visit || visit.trip_id !== tripId) throw new Error("到访不存在");
      if (payload.arrival_time !== undefined) visit.arrival_time = payload.arrival_time;
      if (payload.departure_time !== undefined) visit.departure_time = payload.departure_time;
      if (payload.sort_order !== undefined) visit.sort_order = payload.sort_order;
      if (payload.notes !== undefined) visit.notes = payload.notes;
      visit.day = dayOf(visit.arrival_time);
      await localDb.visits.put(visit);
      const place = await localDb.places.get(visit.place_id);
      if (!place) throw new Error("地点不存在");
      return {
        id: visit.id,
        place: placeSummary(place),
        arrival_time: visit.arrival_time,
        departure_time: visit.departure_time,
        day: visit.day,
        sort_order: visit.sort_order,
        notes: visit.notes,
      };
    },
    detachPlace: async (tripId: string, visitId: string): Promise<void> => {
      const visit = await localDb.visits.get(visitId);
      if (visit && visit.trip_id === tripId) await localDb.visits.delete(visitId);
    },
  },
  places: {
    list: async (filters: PlaceFilters = {}): Promise<Page<Place>> => {
      const [places, photos, visits] = await Promise.all([
        localDb.places.toArray(),
        localDb.photos.toArray(),
        localDb.visits.toArray(),
      ]);
      let rows = places;
      if (filters.q) {
        const query = filters.q.toLowerCase();
        rows = rows.filter(
          (place) =>
            place.name.toLowerCase().includes(query) ||
            (place.city ?? "").toLowerCase().includes(query) ||
            (place.country ?? "").toLowerCase().includes(query),
        );
      }
      if (filters.category) rows = rows.filter((place) => place.category === filters.category);
      if (filters.trip_id) {
        const ids = new Set(visits.filter((visit) => visit.trip_id === filters.trip_id).map((visit) => visit.place_id));
        rows = rows.filter((place) => ids.has(place.id));
      }
      const items = rows.map((place) => ({
        id: place.id,
        name: place.name,
        category: place.category,
        address: place.address,
        city: place.city,
        region: place.region,
        country: place.country,
        country_code: place.country_code,
        latitude: place.latitude,
        longitude: place.longitude,
        notes: place.notes,
        source: place.source,
        photo_count: photos.filter((photo) => photo.place_id === place.id).length,
        visit_count: visits.filter((visit) => visit.place_id === place.id).length,
        created_at: place.created_at,
      }));
      return pageOf(items, filters.page, filters.size ?? 100);
    },
    create: async (payload: PlaceInput): Promise<Place> => {
      if (!payload.name.trim()) throw new Error("地点名称不能为空");
      const row: PlaceRow = {
        id: uuid(),
        name: payload.name.trim(),
        category: payload.category,
        address: payload.address?.trim() || null,
        city: payload.city?.trim() || null,
        region: payload.region?.trim() || null,
        country: payload.country?.trim() || null,
        country_code: payload.country_code?.trim().toUpperCase() || null,
        latitude: payload.latitude ?? null,
        longitude: payload.longitude ?? null,
        notes: payload.notes?.trim() || null,
        source: "local",
        created_at: now(),
      };
      await localDb.places.put(row);
      return {
        ...row,
        photo_count: 0,
        visit_count: 0,
      };
    },
    get: async (placeId: string): Promise<Place> => {
      const page = await localApi.places.list({ size: 1000 });
      const place = page.items.find((item) => item.id === placeId);
      if (!place) throw new Error("地点不存在");
      return place;
    },
    update: async (placeId: string, payload: Partial<PlaceInput>): Promise<Place> => {
      const row = await localDb.places.get(placeId);
      if (!row) throw new Error("地点不存在");
      if (payload.name !== undefined) {
        if (!payload.name.trim()) throw new Error("地点名称不能为空");
        row.name = payload.name.trim();
      }
      for (const key of ["category", "address", "city", "region", "country", "country_code", "notes", "latitude", "longitude"] as const) {
        if (payload[key] !== undefined) (row as unknown as Record<string, unknown>)[key] = payload[key];
      }
      await localDb.places.put(row);
      return localApi.places.get(placeId);
    },
    remove: async (placeId: string): Promise<void> => {
      await localDb.places.delete(placeId);
      await localDb.visits.where("place_id").equals(placeId).delete();
      await localDb.photos.where("place_id").equals(placeId).modify({ place_id: null });
    },
    categories: async (): Promise<string[]> => [
      "attraction",
      "food",
      "lodging",
      "transport",
      "nature",
      "shopping",
      "other",
    ],
    geocode: async (): Promise<GeocodeResult> => ({
      provider: "local",
      display_name: null,
      name: null,
      address: null,
      city: null,
      region: null,
      country: null,
      country_code: null,
      latitude: null,
      longitude: null,
    }),
  },
  photos: {
    list: async (filters: PhotoFilters = {}): Promise<Page<Photo>> => {
      const [rows, places] = await Promise.all([localDb.photos.toArray(), localDb.places.toArray()]);
      const placeMap = new Map(places.map((place) => [place.id, place]));
      let items = rows;
      if (filters.trip_id) items = items.filter((photo) => photo.trip_id === filters.trip_id);
      if (filters.place_id) items = items.filter((photo) => photo.place_id === filters.place_id);
      if (filters.unsorted) items = items.filter((photo) => !photo.trip_id);
      if (filters.has_gps !== undefined) items = items.filter((photo) => photo.has_gps === filters.has_gps);
      if (filters.favorite !== undefined) items = items.filter((photo) => photo.is_favorite === filters.favorite);
      if (filters.date_from) items = items.filter((photo) => (photo.taken_at ?? "").slice(0, 10) >= filters.date_from!);
      if (filters.date_to) items = items.filter((photo) => (photo.taken_at ?? "").slice(0, 10) <= filters.date_to!);
      if (filters.q) {
        const query = filters.q.toLowerCase();
        items = items.filter(
          (photo) =>
            (photo.caption ?? "").toLowerCase().includes(query) ||
            photo.original_filename.toLowerCase().includes(query) ||
            [photo.camera_make, photo.camera_model].filter(Boolean).join(" ").toLowerCase().includes(query),
        );
      }
      if (filters.camera) {
        const query = filters.camera.toLowerCase();
        items = items.filter((photo) => [photo.camera_make, photo.camera_model].filter(Boolean).join(" ").toLowerCase().includes(query));
      }
      items.sort((a, b) => {
        if (filters.sort === "taken_at_asc") return (a.taken_at ?? "").localeCompare(b.taken_at ?? "");
        if (filters.sort === "created_desc") return b.created_at.localeCompare(a.created_at);
        if (filters.sort === "created_asc") return a.created_at.localeCompare(b.created_at);
        return (b.taken_at ?? "").localeCompare(a.taken_at ?? "");
      });
      const page = pageOf(items, filters.page, filters.size ?? 36);
      return {
        ...page,
        items: page.items.map((row) => {
          registerLocalPhoto(row.id, { thumb: row.thumb, preview: row.preview, original: row.original });
          return photoOut(row, row.place_id ? placeMap.get(row.place_id) : undefined);
        }),
      };
    },
    get: async (photoId: string): Promise<Photo> => {
      const row = await localDb.photos.get(photoId);
      if (!row) throw new Error("照片不存在");
      return photoOutById(row);
    },
    update: async (photoId: string, payload: PhotoUpdateInput): Promise<Photo> => {
      const row = await localDb.photos.get(photoId);
      if (!row) throw new Error("照片不存在");
      if (payload.trip_id !== undefined) row.trip_id = payload.trip_id;
      if (payload.place_id !== undefined) row.place_id = payload.place_id;
      if (payload.caption !== undefined) row.caption = payload.caption?.trim() || null;
      if (payload.taken_at !== undefined) row.taken_at = payload.taken_at;
      if (payload.latitude !== undefined) row.latitude = payload.latitude;
      if (payload.longitude !== undefined) row.longitude = payload.longitude;
      if (payload.latitude !== undefined || payload.longitude !== undefined) {
        row.has_gps = row.latitude !== null && row.longitude !== null;
        row.gps_source = row.has_gps ? "manual" : "none";
      }
      if (payload.is_favorite !== undefined) row.is_favorite = payload.is_favorite;
      await localDb.photos.put(row);
      return photoOutById(row);
    },
    remove: async (photoId: string): Promise<void> => {
      await localDb.photos.delete(photoId);
      await localDb.eventPhotos.where("photo_id").equals(photoId).delete();
      forgetLocalPhoto(photoId);
    },
    bulk: async (payload: { photo_ids: string[]; trip_id?: string | null; place_id?: string | null; is_favorite?: boolean }): Promise<{ updated: number }> => {
      await localDb.transaction("rw", localDb.photos, async () => {
        for (const id of payload.photo_ids) {
          const row = await localDb.photos.get(id);
          if (!row) continue;
          if (payload.trip_id !== undefined) row.trip_id = payload.trip_id;
          if (payload.place_id !== undefined) row.place_id = payload.place_id;
          if (payload.is_favorite !== undefined) row.is_favorite = payload.is_favorite;
          await localDb.photos.put(row);
        }
      });
      return { updated: payload.photo_ids.length };
    },
    upload: async (files: File[], options: { tripId?: string; placeId?: string } = {}): Promise<{ task_id: string; uploaded_files: number }> => {
      const taskId = uuid();
      await localDb.imports.put({
        id: taskId,
        trip_id: options.tripId ?? null,
        task_type: "photo_import",
        status: "queued",
        progress: 0,
        total: files.length,
        processed: 0,
        failed: 0,
        message: "等待导入",
        error: null,
        result: {},
        created_at: now(),
        started_at: null,
        finished_at: null,
        cancelled: false,
      });
      window.setTimeout(() => {
        void processImport(taskId, files, options).catch(async (error) => {
          await localDb.imports.update(taskId, {
            status: "failed",
            error: String(error),
            message: "导入失败",
            finished_at: now(),
          });
        });
      }, 0);
      return { task_id: taskId, uploaded_files: files.length };
    },
  },
  imports: {
    get: async (taskId: string): Promise<ImportTask> => {
      const row = await localDb.imports.get(taskId);
      if (!row) throw new Error("导入任务不存在");
      return {
        id: row.id,
        trip_id: row.trip_id,
        task_type: row.task_type,
        status: row.status,
        progress: row.progress,
        total: row.total,
        processed: row.processed,
        failed: row.failed,
        message: row.message,
        error: row.error,
        result: row.result,
        created_at: row.created_at,
        started_at: row.started_at,
        finished_at: row.finished_at,
      };
    },
    list: async (params: { page?: number; size?: number; trip_id?: string } = {}): Promise<Page<ImportTask>> => {
      let rows = await localDb.imports.toArray();
      if (params.trip_id) rows = rows.filter((row) => row.trip_id === params.trip_id);
      rows.sort((a, b) => b.created_at.localeCompare(a.created_at));
      const page = pageOf(rows, params.page, params.size ?? 20);
      return {
        ...page,
        items: page.items.map((row) => ({
          id: row.id,
          trip_id: row.trip_id,
          task_type: row.task_type,
          status: row.status,
          progress: row.progress,
          total: row.total,
          processed: row.processed,
          failed: row.failed,
          message: row.message,
          error: row.error,
          result: row.result,
          created_at: row.created_at,
          started_at: row.started_at,
          finished_at: row.finished_at,
        })),
      };
    },
    cancel: async (taskId: string): Promise<ImportTask> => {
      await localDb.imports.update(taskId, { cancelled: true, status: "cancelled", finished_at: now() });
      return localApi.imports.get(taskId);
    },
  },
  timeline: {
    get: async (tripId: string): Promise<Timeline> => buildTimeline(tripId),
    generate: async (tripId: string, payload: { max_gap_minutes?: number; max_distance_km?: number; replace_auto?: boolean } = {}): Promise<TimelineGenerateResult> => {
      const photos = (await localDb.photos.where("trip_id").equals(tripId).toArray())
        .filter((photo) => photo.taken_at)
        .sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""));
      const gap = (payload.max_gap_minutes ?? 180) * 60_000;
      const maxDistance = payload.max_distance_km ?? 3;
      if (payload.replace_auto !== false) {
        const old = await localDb.events
          .where("trip_id")
          .equals(tripId)
          .filter((event) => event.source === "auto" && event.status === "draft")
          .toArray();
        for (const event of old) {
          await localDb.eventPhotos.where("event_id").equals(event.id).delete();
          await localDb.events.delete(event.id);
        }
      }
      const groups: PhotoRow[][] = [];
      let current: PhotoRow[] = [];
      for (const photo of photos) {
        const previous = current[current.length - 1];
        if (!previous) {
          current.push(photo);
          continue;
        }
        const prevTime = new Date(previous.taken_at as string).getTime();
        const nextTime = new Date(photo.taken_at as string).getTime();
        const moved =
          previous.latitude !== null &&
          previous.longitude !== null &&
          photo.latitude !== null &&
          photo.longitude !== null
            ? distanceKm(previous.latitude, previous.longitude, photo.latitude, photo.longitude)
            : 0;
        const sameDay = previous.taken_at!.slice(0, 10) === photo.taken_at!.slice(0, 10);
        if (!sameDay || nextTime - prevTime > gap || moved > maxDistance) {
          groups.push(current);
          current = [photo];
        } else {
          current.push(photo);
        }
      }
      if (current.length) groups.push(current);
      let created = 0;
      let assigned = 0;
      let order = 0;
      for (const group of groups) {
        const first = group[0];
        const last = group[group.length - 1];
        const place = first.place_id ? await localDb.places.get(first.place_id) : null;
        const eventId = uuid();
        const title = place?.name ?? "旅行的瞬间";
        await localDb.events.put({
          id: eventId,
          trip_id: tripId,
          title,
          description: null,
          event_type: "sightseeing",
          start_time: first.taken_at as string,
          end_time: last.taken_at,
          day: (first.taken_at as string).slice(0, 10),
          sort_order: order++,
          source: "auto",
          status: "draft",
          place_id: first.place_id,
        });
        for (const photo of group) {
          await localDb.eventPhotos.put({ event_id: eventId, photo_id: photo.id });
        }
        created += 1;
        assigned += group.length;
      }
      const timeline = await buildTimeline(tripId);
      return {
        created_events: created,
        assigned_photos: assigned,
        kept_manual_events: timeline.event_count - created,
        timeline,
      };
    },
    createEvent: async (tripId: string, payload: EventInput): Promise<TimelineEvent> => {
      await getTripRow(tripId);
      const eventId = uuid();
      const sort = (await localDb.events.where("trip_id").equals(tripId).count()) || 0;
      const row: EventRow = {
        id: eventId,
        trip_id: tripId,
        title: payload.title.trim(),
        description: payload.description?.trim() || null,
        event_type: payload.event_type as EventType,
        start_time: payload.start_time,
        end_time: payload.end_time ?? null,
        day: payload.start_time.slice(0, 10),
        sort_order: sort,
        source: "manual",
        status: "confirmed",
        place_id: payload.place_id ?? null,
      };
      await localDb.events.put(row);
      for (const photoId of payload.photo_ids ?? []) {
        await localDb.eventPhotos.put({ event_id: eventId, photo_id: photoId });
      }
      return eventOut(row);
    },
    updateEvent: async (tripId: string, eventId: string, payload: Partial<EventInput> & { status?: string }): Promise<TimelineEvent> => {
      const row = await localDb.events.get(eventId);
      if (!row || row.trip_id !== tripId) throw new Error("事件不存在");
      if (payload.title !== undefined) row.title = payload.title.trim();
      if (payload.description !== undefined) row.description = payload.description?.trim() || null;
      if (payload.event_type !== undefined) row.event_type = payload.event_type;
      if (payload.start_time !== undefined) {
        row.start_time = payload.start_time;
        row.day = payload.start_time.slice(0, 10);
      }
      if (payload.end_time !== undefined) row.end_time = payload.end_time;
      if (payload.place_id !== undefined) row.place_id = payload.place_id;
      if (payload.status !== undefined) row.status = payload.status as EventRow["status"];
      await localDb.events.put(row);
      if (payload.photo_ids !== undefined) {
        await localDb.eventPhotos.where("event_id").equals(eventId).delete();
        for (const photoId of payload.photo_ids) {
          await localDb.eventPhotos.put({ event_id: eventId, photo_id: photoId });
        }
      }
      return eventOut(row);
    },
    deleteEvent: async (tripId: string, eventId: string): Promise<void> => {
      const row = await localDb.events.get(eventId);
      if (row?.trip_id === tripId) {
        await localDb.eventPhotos.where("event_id").equals(eventId).delete();
        await localDb.events.delete(eventId);
      }
    },
    attachPhotos: async (tripId: string, eventId: string, photoIds: string[]): Promise<TimelineEvent> => {
      const row = await localDb.events.get(eventId);
      if (!row || row.trip_id !== tripId) throw new Error("事件不存在");
      for (const photoId of photoIds) await localDb.eventPhotos.put({ event_id: eventId, photo_id: photoId });
      return eventOut(row);
    },
    detachPhoto: async (tripId: string, eventId: string, photoId: string): Promise<TimelineEvent> => {
      const row = await localDb.events.get(eventId);
      if (!row || row.trip_id !== tripId) throw new Error("事件不存在");
      await localDb.eventPhotos.delete([eventId, photoId]);
      return eventOut(row);
    },
  },
  map: {
    markers: async (params: { trip_ids?: string[]; bbox?: string; date_from?: string; date_to?: string; categories?: PlaceCategory[]; limit?: number } = {}): Promise<MapMarkersResponse> => {
      const [photos, places, trips] = await Promise.all([
        localDb.photos.toArray(),
        localDb.places.toArray(),
        localDb.trips.toArray(),
      ]);
      const tripMap = new Map(trips.map((trip) => [trip.id, trip]));
      const items: MapMarker[] = [];
      for (const photo of photos) {
        if (photo.latitude === null || photo.longitude === null) continue;
        if (params.trip_ids?.length && (!photo.trip_id || !params.trip_ids.includes(photo.trip_id))) continue;
        if (params.date_from && (photo.taken_at ?? "").slice(0, 10) < params.date_from) continue;
        if (params.date_to && (photo.taken_at ?? "").slice(0, 10) > params.date_to) continue;
        items.push({
          id: `photo-${photo.id}`,
          kind: "photo",
          latitude: photo.latitude,
          longitude: photo.longitude,
          title: photo.caption ?? photo.original_filename,
          subtitle: photo.taken_at?.slice(0, 10) ?? null,
          category: null,
          trip_id: photo.trip_id,
          trip_title: photo.trip_id ? tripMap.get(photo.trip_id)?.title ?? null : null,
          place_id: photo.place_id,
          photo_id: photo.id,
          taken_at: photo.taken_at,
        });
      }
      for (const place of places) {
        if (place.latitude === null || place.longitude === null) continue;
        if (params.categories?.length && !params.categories.includes(place.category)) continue;
        items.push({
          id: `place-${place.id}`,
          kind: "place",
          latitude: place.latitude,
          longitude: place.longitude,
          title: place.name,
          subtitle: [place.city, place.country].filter(Boolean).join(", ") || null,
          category: place.category,
          trip_id: null,
          trip_title: null,
          place_id: place.id,
          photo_id: null,
          taken_at: null,
        });
      }
      const limit = params.limit ?? 2000;
      return {
        items: items.slice(0, limit),
        total: items.length,
        truncated: items.length > limit,
      };
    },
    routes: async (tripId?: string): Promise<MapRoutes> => {
      const [trips, visits, places, photos] = await Promise.all([
        localDb.trips.filter((trip) => !trip.deleted_at).toArray(),
        localDb.visits.toArray(),
        localDb.places.toArray(),
        localDb.photos.toArray(),
      ]);
      const placeMap = new Map(places.map((place) => [place.id, place]));
      const selected = tripId ? trips.filter((trip) => trip.id === tripId) : trips;
      const features = selected.flatMap((trip) => {
        const stops = visits
          .filter((visit) => visit.trip_id === trip.id)
          .sort((a, b) => a.sort_order - b.sort_order)
          .map((visit) => placeMap.get(visit.place_id))
          .filter((place): place is PlaceRow => Boolean(place?.latitude !== null && place?.longitude !== null))
          .map((place) => [place.longitude as number, place.latitude as number] as [number, number]);
        if (stops.length < 2) {
          const coordinates = photos
            .filter((photo) => photo.trip_id === trip.id && photo.latitude !== null && photo.longitude !== null)
            .sort((a, b) => (a.taken_at ?? "").localeCompare(b.taken_at ?? ""))
            .map((photo) => [photo.longitude as number, photo.latitude as number] as [number, number]);
          if (coordinates.length >= 2) stops.push(...coordinates);
        }
        if (stops.length < 2) return [];
        return [{
          type: "Feature" as const,
          geometry: { type: "LineString" as const, coordinates: stops },
          properties: { trip_id: trip.id, title: trip.title, kind: "places" as const, stop_count: stops.length },
        }];
      });
      return { type: "FeatureCollection", features };
    },
  },
  stats: {
    overview: async (): Promise<StatsOverview> => {
      const [trips, photos, visits, places] = await Promise.all([
        localDb.trips.filter((trip) => !trip.deleted_at).toArray(),
        localDb.photos.toArray(),
        localDb.visits.toArray(),
        localDb.places.toArray(),
      ]);
      const cities = new Set(places.map((place) => place.city).filter(Boolean));
      const countries = new Set(places.map((place) => place.country).filter(Boolean));
      const yearMap = new Map<number, YearStat>();
      for (const trip of trips) {
        const year = Number((trip.start_date ?? "").slice(0, 4)) || new Date(trip.created_at).getFullYear();
        const entry = yearMap.get(year) ?? { year, trips: 0, photos: 0 };
        entry.trips += 1;
        yearMap.set(year, entry);
      }
      for (const photo of photos) {
        const year = Number((photo.taken_at ?? "").slice(0, 4));
        if (!year) continue;
        const entry = yearMap.get(year) ?? { year, trips: 0, photos: 0 };
        entry.photos += 1;
        yearMap.set(year, entry);
      }
      const countryMap = new Map<string, CountryStat>();
      for (const place of places) {
        if (!place.country) continue;
        const entry = countryMap.get(place.country) ?? {
          country: place.country,
          country_code: place.country_code,
          place_count: 0,
          photo_count: 0,
        };
        entry.place_count += 1;
        entry.photo_count += photos.filter((photo) => photo.place_id === place.id).length;
        countryMap.set(place.country, entry);
      }
      const recentTrips = trips
        .sort((a, b) => b.updated_at.localeCompare(a.updated_at))
        .slice(0, 4)
        .map((trip) => buildTrip(trip, photos, visits));
      return {
        trips: trips.length,
        countries: countries.size,
        cities: cities.size,
        places: places.length,
        photos: photos.length,
        days: trips.reduce((total, trip) => total + dayCount(trip.start_date, trip.end_date), 0),
        favorite_photos: photos.filter((photo) => photo.is_favorite).length,
        gps_photos: photos.filter((photo) => photo.has_gps).length,
        storage_bytes: photos.reduce((total, photo) => total + photo.file_size, 0),
        years: [...yearMap.values()].sort((a, b) => b.year - a.year),
        countries_detail: [...countryMap.values()].sort((a, b) => b.photo_count - a.photo_count),
        recent_trips: recentTrips,
        recent_photos: photos
          .sort((a, b) => b.created_at.localeCompare(a.created_at))
          .slice(0, 8)
          .map((photo) => {
            registerLocalPhoto(photo.id, {
              thumb: photo.thumb,
              preview: photo.preview,
              original: photo.original,
            });
            return photoMini(photo);
          }),
      };
    },
  },
  settings: {
    get: async (): Promise<InstanceSettings> => {
      const [photos, trips] = await Promise.all([localDb.photos.toArray(), localDb.trips.count()]);
      return {
        app_name: "TravelTrace",
        app_version: LOCAL_VERSION,
        environment: "local",
        registration_enabled: false,
        geocoding_enabled: false,
        geocoding_provider: "none",
        max_upload_mb: 100,
        max_upload_files: 200,
        storage_used_bytes: photos.reduce((total, photo) => total + photo.file_size, 0),
        photo_count: photos.length,
        trip_count: trips,
      };
    },
  },
};
