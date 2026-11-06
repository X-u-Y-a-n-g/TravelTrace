export type Visibility = "private" | "unlisted" | "public";
export type PlaceCategory =
  | "attraction"
  | "food"
  | "lodging"
  | "transport"
  | "nature"
  | "shopping"
  | "other";
export type EventType =
  | "sightseeing"
  | "food"
  | "transport"
  | "lodging"
  | "activity"
  | "other";
export type EventSource = "manual" | "auto";
export type EventStatus = "draft" | "confirmed";
export type GpsSource = "exif" | "manual" | "track" | "inferred" | "none";
export type PhotoStatus = "pending" | "processing" | "ready" | "failed";
export type ImportStatus =
  | "queued"
  | "running"
  | "succeeded"
  | "partial"
  | "failed"
  | "cancelled";
export type PhotoSize = "thumb" | "preview" | "original";

export interface User {
  id: string;
  username: string;
  email: string;
  display_name: string | null;
  created_at: string;
  last_login_at: string | null;
}

export interface Bootstrap {
  has_users: boolean;
  registration_enabled: boolean;
  app_version: string;
  app_name: string;
}

export interface TokenResponse {
  access_token: string;
  token_type: string;
  expires_in: number;
  user: User;
}

export interface Page<T> {
  items: T[];
  total: number;
  page: number;
  size: number;
  pages: number;
}

export interface PhotoMini {
  id: string;
  taken_at: string | null;
  latitude: number | null;
  longitude: number | null;
  is_favorite: boolean;
  caption: string | null;
  width: number | null;
  height: number | null;
}

export interface PlaceSummary {
  id: string;
  name: string;
  category: PlaceCategory;
  city: string | null;
  country: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface Photo {
  id: string;
  trip_id: string | null;
  place_id: string | null;
  place: PlaceSummary | null;
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
  status: PhotoStatus;
  created_at: string;
}

export interface TripStats {
  photo_count: number;
  place_count: number;
  day_count: number;
  photo_days: number;
  gps_photo_count: number;
  favorite_count: number;
  first_photo_at: string | null;
  last_photo_at: string | null;
}

export interface Trip {
  id: string;
  title: string;
  description: string | null;
  start_date: string | null;
  end_date: string | null;
  visibility: Visibility;
  cover_photo_id: string | null;
  cover_photo: PhotoMini | null;
  day_count: number;
  photo_count: number;
  place_count: number;
  created_at: string;
  updated_at: string;
}

export interface TripPlace {
  id: string;
  place: PlaceSummary;
  arrival_time: string | null;
  departure_time: string | null;
  day: string | null;
  sort_order: number;
  notes: string | null;
}

export interface TripDetail extends Trip {
  places: TripPlace[];
  stats: TripStats;
  photos_preview: PhotoMini[];
}

export interface Place {
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
  photo_count: number;
  visit_count: number;
  created_at: string;
}

export interface TimelineEvent {
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
  place: PlaceSummary | null;
  photos: PhotoMini[];
}

export interface TimelineDay {
  date: string;
  day_index: number;
  events: TimelineEvent[];
}

export interface Timeline {
  trip_id: string;
  start_date: string | null;
  end_date: string | null;
  days: TimelineDay[];
  event_count: number;
  photo_count: number;
}

export interface TimelineGenerateResult {
  created_events: number;
  assigned_photos: number;
  kept_manual_events: number;
  timeline: Timeline;
}

export interface MapMarker {
  id: string;
  kind: "photo" | "place";
  latitude: number;
  longitude: number;
  title: string;
  subtitle: string | null;
  category: PlaceCategory | null;
  trip_id: string | null;
  trip_title: string | null;
  place_id: string | null;
  photo_id: string | null;
  taken_at: string | null;
}

export interface MapMarkersResponse {
  items: MapMarker[];
  total: number;
  truncated: boolean;
}

export interface MapRouteProperties {
  trip_id: string;
  title: string;
  kind: "places" | "photos";
  stop_count: number;
}

export interface MapRoutes {
  type: "FeatureCollection";
  features: Array<{
    type: "Feature";
    geometry: { type: "LineString"; coordinates: [number, number][] };
    properties: MapRouteProperties;
  }>;
}

export interface ImportTask {
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
}

export interface YearStat {
  year: number;
  trips: number;
  photos: number;
}

export interface CountryStat {
  country: string;
  country_code: string | null;
  place_count: number;
  photo_count: number;
}

export interface StatsOverview {
  trips: number;
  countries: number;
  cities: number;
  places: number;
  photos: number;
  days: number;
  favorite_photos: number;
  gps_photos: number;
  storage_bytes: number;
  years: YearStat[];
  countries_detail: CountryStat[];
  recent_trips: Trip[];
  recent_photos: PhotoMini[];
}

export interface InstanceSettings {
  app_name: string;
  app_version: string;
  environment: string;
  registration_enabled: boolean;
  geocoding_enabled: boolean;
  geocoding_provider: string;
  max_upload_mb: number;
  max_upload_files: number;
  storage_used_bytes: number;
  photo_count: number;
  trip_count: number;
}

export interface GeocodeResult {
  provider: string;
  display_name: string | null;
  name: string | null;
  address: string | null;
  city: string | null;
  region: string | null;
  country: string | null;
  country_code: string | null;
  latitude: number | null;
  longitude: number | null;
}

export interface PhotoFilters {
  page?: number;
  size?: number;
  trip_id?: string;
  place_id?: string;
  unsorted?: boolean;
  has_gps?: boolean;
  favorite?: boolean;
  date_from?: string;
  date_to?: string;
  q?: string;
  camera?: string;
  sort?: string;
}

export interface TripFilters {
  page?: number;
  size?: number;
  q?: string;
  year?: number;
  visibility?: Visibility;
  sort?: string;
}

export interface PlaceFilters {
  page?: number;
  size?: number;
  trip_id?: string;
  category?: PlaceCategory;
  q?: string;
  bbox?: string;
}

export interface MarkerFilters {
  trip_ids?: string[];
  bbox?: string;
  date_from?: string;
  date_to?: string;
  categories?: PlaceCategory[];
  limit?: number;
}

export interface ApiErrorPayload {
  error: {
    code: string;
    message: string;
    details?: unknown;
  };
}
