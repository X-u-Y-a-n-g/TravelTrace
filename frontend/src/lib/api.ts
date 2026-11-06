import { useAuthStore } from "@/stores/auth";

import { getStoredApiBase, isNativeApp } from "./mobile";
import type {
  Bootstrap,
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
  PhotoSize,
  Place,
  PlaceCategory,
  PlaceFilters,
  StatsOverview,
  Timeline,
  TimelineEvent,
  TimelineGenerateResult,
  TokenResponse,
  Trip,
  TripDetail,
  TripFilters,
  TripPlace,
  User,
  Visibility,
} from "./types";
import { qs } from "./utils";

export const DEFAULT_API_BASE = import.meta.env.VITE_API_BASE ?? "/api/v1";

/** The API base currently in use. Native builds may point at a self-hosted server. */
export function getApiBase(): string {
  return getStoredApiBase() ?? DEFAULT_API_BASE;
}

export class ApiError extends Error {
  status: number;
  code: string;
  details?: unknown;

  constructor(status: number, code: string, message: string, details?: unknown) {
    super(message);
    this.name = "ApiError";
    this.status = status;
    this.code = code;
    this.details = details;
  }
}

type RequestOptions = Omit<RequestInit, "body"> & {
  json?: unknown;
  form?: FormData;
  body?: BodyInit | null;
};

async function request<T>(path: string, options: RequestOptions = {}): Promise<T> {
  const { json, form, headers: rawHeaders, ...init } = options;
  const headers = new Headers(rawHeaders);
  let body = init.body ?? null;

  if (json !== undefined) {
    headers.set("Content-Type", "application/json");
    body = JSON.stringify(json);
  } else if (form) {
    body = form;
  }

  const token = useAuthStore.getState().token;
  if (token) headers.set("Authorization", `Bearer ${token}`);

  let response: Response;
  try {
    response = await fetch(`${getApiBase()}${path}`, {
      ...init,
      headers,
      body,
      credentials: "same-origin",
    });
  } catch {
    throw new ApiError(0, "network_error", "Cannot reach the TravelTrace server");
  }

  if (!response.ok) {
    let payload: { error?: { code?: string; message?: string; details?: unknown } } | null = null;
    try {
      payload = await response.json();
    } catch {
      payload = null;
    }
    throw new ApiError(
      response.status,
      payload?.error?.code ?? `http_${response.status}`,
      payload?.error?.message ?? response.statusText ?? "Request failed",
      payload?.error?.details,
    );
  }

  if (response.status === 204) return undefined as T;
  const text = await response.text();
  return (text ? JSON.parse(text) : undefined) as T;
}

export interface TripInput {
  title: string;
  description?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  visibility?: Visibility;
  cover_photo_id?: string | null;
}

export interface PlaceInput {
  name: string;
  category: PlaceCategory;
  address?: string | null;
  city?: string | null;
  region?: string | null;
  country?: string | null;
  country_code?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  notes?: string | null;
}

export interface EventInput {
  title: string;
  description?: string | null;
  event_type: EventType;
  start_time: string;
  end_time?: string | null;
  place_id?: string | null;
  photo_ids?: string[];
}

export interface PhotoUpdateInput {
  trip_id?: string | null;
  place_id?: string | null;
  caption?: string | null;
  taken_at?: string | null;
  latitude?: number | null;
  longitude?: number | null;
  is_favorite?: boolean;
}

export function photoUrl(photoId: string, size: PhotoSize = "thumb"): string {
  const params = new URLSearchParams({ size });
  const token = useAuthStore.getState().token;
  if (isNativeApp() && token) params.set("access_token", token);
  return `${getApiBase()}/photos/${photoId}/file?${params.toString()}`;
}

export function tripExportUrl(tripId: string, includeOriginals = true): string {
  const params = new URLSearchParams({ include_originals: String(includeOriginals) });
  const token = useAuthStore.getState().token;
  if (isNativeApp() && token) params.set("access_token", token);
  return `${getApiBase()}/trips/${tripId}/export?${params.toString()}`;
}

export const api = {
  auth: {
    bootstrap: () => request<Bootstrap>("/auth/bootstrap"),
    register: (payload: {
      username: string;
      email: string;
      password: string;
      display_name?: string;
    }) => request<TokenResponse>("/auth/register", { method: "POST", json: payload }),
    login: (payload: { identifier: string; password: string }) =>
      request<TokenResponse>("/auth/login", { method: "POST", json: payload }),
    me: () => request<User>("/auth/me"),
    logout: () => request<void>("/auth/logout", { method: "POST" }),
    updateProfile: (payload: { display_name?: string }) =>
      request<User>("/auth/me", { method: "PATCH", json: payload }),
    changePassword: (payload: { current_password: string; new_password: string }) =>
      request<{ message: string }>("/auth/change-password", {
        method: "POST",
        json: payload,
      }),
  },
  trips: {
    list: (filters: TripFilters = {}) => request<Page<Trip>>(`/trips${qs(filters)}`),
    create: (payload: TripInput) =>
      request<TripDetail>("/trips", { method: "POST", json: payload }),
    get: (tripId: string) => request<TripDetail>(`/trips/${tripId}`),
    update: (tripId: string, payload: Partial<TripInput>) =>
      request<TripDetail>(`/trips/${tripId}`, { method: "PATCH", json: payload }),
    remove: (tripId: string) => request<void>(`/trips/${tripId}`, { method: "DELETE" }),
    restore: (tripId: string) =>
      request<Trip>(`/trips/${tripId}/restore`, { method: "POST" }),
    places: (tripId: string) => request<TripPlace[]>(`/trips/${tripId}/places`),
    attachPlace: (
      tripId: string,
      payload: {
        place_id: string;
        arrival_time?: string | null;
        departure_time?: string | null;
        sort_order?: number;
        notes?: string | null;
      },
    ) => request<TripPlace>(`/trips/${tripId}/places`, { method: "POST", json: payload }),
    updatePlace: (
      tripId: string,
      visitId: string,
      payload: {
        arrival_time?: string | null;
        departure_time?: string | null;
        sort_order?: number;
        notes?: string | null;
      },
    ) =>
      request<TripPlace>(`/trips/${tripId}/places/${visitId}`, {
        method: "PATCH",
        json: payload,
      }),
    detachPlace: (tripId: string, visitId: string) =>
      request<void>(`/trips/${tripId}/places/${visitId}`, { method: "DELETE" }),
  },
  places: {
    list: (filters: PlaceFilters = {}) => request<Page<Place>>(`/places${qs(filters)}`),
    create: (payload: PlaceInput) => request<Place>("/places", { method: "POST", json: payload }),
    get: (placeId: string) => request<Place>(`/places/${placeId}`),
    update: (placeId: string, payload: Partial<PlaceInput>) =>
      request<Place>(`/places/${placeId}`, { method: "PATCH", json: payload }),
    remove: (placeId: string) => request<void>(`/places/${placeId}`, { method: "DELETE" }),
    categories: () => request<string[]>("/places/categories"),
    geocode: (payload: { latitude: number; longitude: number }) =>
      request<GeocodeResult>("/places/geocode", { method: "POST", json: payload }),
  },
  photos: {
    list: (filters: PhotoFilters = {}) => request<Page<Photo>>(`/photos${qs(filters)}`),
    get: (photoId: string) => request<Photo>(`/photos/${photoId}`),
    update: (photoId: string, payload: PhotoUpdateInput) =>
      request<Photo>(`/photos/${photoId}`, { method: "PATCH", json: payload }),
    remove: (photoId: string) => request<void>(`/photos/${photoId}`, { method: "DELETE" }),
    bulk: (payload: {
      photo_ids: string[];
      trip_id?: string | null;
      place_id?: string | null;
      is_favorite?: boolean;
    }) => request<{ updated: number }>("/photos/bulk", { method: "POST", json: payload }),
    upload: async (
      files: File[],
      options: { tripId?: string; placeId?: string } = {},
    ): Promise<{ task_id: string; uploaded_files: number }> => {
      const form = new FormData();
      files.forEach((file) => form.append("files", file));
      if (options.tripId) form.append("trip_id", options.tripId);
      if (options.placeId) form.append("place_id", options.placeId);
      return request<{ task_id: string; uploaded_files: number }>("/photos/upload", {
        method: "POST",
        form,
      });
    },
  },
  imports: {
    get: (taskId: string) => request<ImportTask>(`/imports/${taskId}`),
    list: (params: { page?: number; size?: number; trip_id?: string } = {}) =>
      request<Page<ImportTask>>(`/imports${qs(params)}`),
    cancel: (taskId: string) =>
      request<ImportTask>(`/imports/${taskId}/cancel`, { method: "POST" }),
  },
  timeline: {
    get: (tripId: string) => request<Timeline>(`/trips/${tripId}/timeline`),
    generate: (tripId: string, payload: Record<string, unknown> = {}) =>
      request<TimelineGenerateResult>(`/trips/${tripId}/timeline/generate`, {
        method: "POST",
        json: payload,
      }),
    createEvent: (tripId: string, payload: EventInput) =>
      request<TimelineEvent>(`/trips/${tripId}/events`, { method: "POST", json: payload }),
    updateEvent: (tripId: string, eventId: string, payload: Partial<EventInput> & { status?: string }) =>
      request<TimelineEvent>(`/trips/${tripId}/events/${eventId}`, {
        method: "PATCH",
        json: payload,
      }),
    deleteEvent: (tripId: string, eventId: string) =>
      request<void>(`/trips/${tripId}/events/${eventId}`, { method: "DELETE" }),
    attachPhotos: (tripId: string, eventId: string, photoIds: string[]) =>
      request<TimelineEvent>(`/trips/${tripId}/events/${eventId}/photos`, {
        method: "POST",
        json: { photo_ids: photoIds },
      }),
    detachPhoto: (tripId: string, eventId: string, photoId: string) =>
      request<TimelineEvent>(`/trips/${tripId}/events/${eventId}/photos/${photoId}`, {
        method: "DELETE",
      }),
  },
  map: {
    markers: (params: {
      trip_ids?: string[];
      bbox?: string;
      date_from?: string;
      date_to?: string;
      categories?: PlaceCategory[];
      limit?: number;
    } = {}) => request<MapMarkersResponse>(`/map/markers${qs(params)}`),
    routes: (tripId?: string) =>
      request<MapRoutes>(`/map/routes${qs({ trip_id: tripId })}`),
  },
  stats: {
    overview: () => request<StatsOverview>("/stats/overview"),
  },
  settings: {
    get: () => request<InstanceSettings>("/settings"),
  },
};

export type { MapMarker };
