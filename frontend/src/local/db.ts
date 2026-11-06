import Dexie, { type Table } from "dexie";

import type {
  EventSource,
  EventStatus,
  EventType,
  GpsSource,
  ImportStatus,
  PlaceCategory,
  Visibility,
} from "@/lib/types";

export interface TripRow {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  visibility: Visibility;
  cover_photo_id: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface PlaceRow {
  id: string;
  name: string;
  category: PlaceCategory;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
  notes: string | null;
  source: string;
  created_at: string;
}

export interface VisitRow {
  id: string;
  trip_id: string;
  place_id: string;
  arrival_time: string | null;
  departure_time: string | null;
  day: string | null;
  sort_order: number;
  notes: string | null;
}

export interface PhotoRow {
  id: string;
  trip_id: string | null;
  place_id: string | null;
  original_filename: string;
  mime_type: string;
  file_size: number;
  width: number | null;
  height: number | null;
  taken_at: string | null;
  taken_at_offset_minutes: number | null;
  latitude: number | null;
  longitude: number | null;
  has_gps: boolean;
  gps_source: GpsSource;
  camera_make: string | null;
  camera_model: string | null;
  lens: string | null;
  caption: string | null;
  is_favorite: boolean;
  status: "ready" | "failed";
  created_at: string;
  hash: string;
  original: Blob;
  thumb: Blob;
  preview: Blob;
}

export interface EventRow {
  id: string;
  trip_id: string;
  title: string;
  description: string | null;
  event_type: EventType;
  start_time: string;
  end_time: string | null;
  day: string;
  sort_order: number;
  source: EventSource;
  status: EventStatus;
  place_id: string | null;
}

export interface EventPhotoRow {
  event_id: string;
  photo_id: string;
}

export interface ImportRow {
  id: string;
  trip_id: string | null;
  task_type: string;
  status: ImportStatus;
  progress: number;
  total: number;
  processed: number;
  failed: number;
  message: string | null;
  error: string | null;
  result: {
    imported?: number;
    skipped?: number;
    failed?: number;
    photo_ids?: string[];
    errors?: Array<{ file?: string; error?: string }>;
  };
  created_at: string;
  started_at: string | null;
  finished_at: string | null;
  cancelled: boolean;
}

export interface MetaRow {
  key: string;
  value: unknown;
}

export class TravelTraceLocalDB extends Dexie {
  trips!: Table<TripRow, string>;
  places!: Table<PlaceRow, string>;
  visits!: Table<VisitRow, string>;
  photos!: Table<PhotoRow, string>;
  events!: Table<EventRow, string>;
  eventPhotos!: Table<EventPhotoRow, [string, string]>;
  imports!: Table<ImportRow, string>;
  meta!: Table<MetaRow, string>;

  constructor() {
    super("traveltrace-local");
    this.version(1).stores({
      trips: "id, start_date, end_date, visibility, updated_at, deleted_at",
      places: "id, name, category, city, country",
      visits: "id, trip_id, place_id, day, sort_order",
      photos: "id, trip_id, place_id, taken_at, created_at, is_favorite, hash",
      events: "id, trip_id, day, status, source",
      eventPhotos: "[event_id+photo_id], event_id, photo_id",
      imports: "id, status, created_at",
      meta: "key",
    });
  }
}

export const localDb = new TravelTraceLocalDB();

export const LOCAL_USER_META = "local_user";
