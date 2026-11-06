import { keepPreviousData, useQuery } from "@tanstack/react-query";

import { api } from "@/lib/api";
import type {
  MarkerFilters,
  PhotoFilters,
  PlaceFilters,
  TripFilters,
} from "@/lib/types";

export const queryKeys = {
  me: ["me"] as const,
  bootstrap: ["bootstrap"] as const,
  trips: ["trips"] as const,
  trip: (tripId: string) => ["trips", tripId] as const,
  tripPhotos: (tripId: string) => ["photos", "trip", tripId] as const,
  photos: ["photos"] as const,
  places: ["places"] as const,
  timeline: (tripId: string) => ["trips", tripId, "timeline"] as const,
  stats: ["stats"] as const,
  markers: ["map", "markers"] as const,
  routes: ["map", "routes"] as const,
  settings: ["settings"] as const,
};

export function useBootstrap() {
  return useQuery({
    queryKey: queryKeys.bootstrap,
    queryFn: api.auth.bootstrap,
    staleTime: 1000 * 60,
  });
}

export function useMe(enabled = true) {
  return useQuery({
    queryKey: queryKeys.me,
    queryFn: api.auth.me,
    enabled,
    retry: false,
    staleTime: 1000 * 60 * 5,
  });
}

export function useTrips(filters: TripFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.trips, filters],
    queryFn: () => api.trips.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTrip(tripId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.trip(tripId ?? ""),
    queryFn: () => api.trips.get(tripId as string),
    enabled: Boolean(tripId),
  });
}

export function usePhotos(filters: PhotoFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.photos, filters],
    queryFn: () => api.photos.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function usePhoto(photoId: string | null) {
  return useQuery({
    queryKey: ["photos", "detail", photoId],
    queryFn: () => api.photos.get(photoId as string),
    enabled: Boolean(photoId),
  });
}

export function usePlaces(filters: PlaceFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.places, filters],
    queryFn: () => api.places.list(filters),
    placeholderData: keepPreviousData,
  });
}

export function useTimeline(tripId: string | undefined) {
  return useQuery({
    queryKey: queryKeys.timeline(tripId ?? ""),
    queryFn: () => api.timeline.get(tripId as string),
    enabled: Boolean(tripId),
  });
}

export function useStats() {
  return useQuery({
    queryKey: queryKeys.stats,
    queryFn: api.stats.overview,
    staleTime: 1000 * 30,
  });
}

export function useMarkers(filters: MarkerFilters = {}) {
  return useQuery({
    queryKey: [...queryKeys.markers, filters],
    queryFn: () => api.map.markers(filters),
    placeholderData: keepPreviousData,
  });
}

export function useRoutes(tripId?: string) {
  return useQuery({
    queryKey: [...queryKeys.routes, tripId ?? "all"],
    queryFn: () => api.map.routes(tripId),
  });
}

export function useInstanceSettings() {
  return useQuery({
    queryKey: queryKeys.settings,
    queryFn: api.settings.get,
    staleTime: 1000 * 60,
  });
}

export function useImportTask(taskId: string | null) {
  return useQuery({
    queryKey: ["imports", taskId],
    queryFn: () => api.imports.get(taskId as string),
    enabled: Boolean(taskId),
    refetchInterval: (query) => {
      const status = query.state.data?.status;
      return status === "queued" || status === "running" ? 800 : false;
    },
  });
}
