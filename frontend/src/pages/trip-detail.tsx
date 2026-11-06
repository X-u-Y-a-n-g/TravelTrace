import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ArrowLeft,
  ArrowRight,
  CalendarDays,
  Camera,
  Download,
  Images,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Star,
  Trash2,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Link, Navigate, useNavigate, useParams, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { MapView } from "@/components/map/map-view";
import { PhotoDetailSheet } from "@/components/photo/photo-detail-sheet";
import { PhotoThumb } from "@/components/photo/photo-thumb";
import { UploadDialog } from "@/components/photo/upload-dialog";
import { PlaceDialog } from "@/components/place/place-dialog";
import { EventDialog } from "@/components/timeline/event-dialog";
import { TimelineList } from "@/components/timeline/timeline-list";
import { TripCover } from "@/components/trip/trip-card";
import { TripFormDialog } from "@/components/trip/trip-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EmptyState } from "@/components/ui/empty-state";
import { Skeleton } from "@/components/ui/skeleton";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ApiError, api, tripExportUrl } from "@/lib/api";
import { EVENT_TYPE_ICONS, PLACE_CATEGORY_COLORS, PLACE_CATEGORY_ICONS } from "@/lib/constants";
import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatTime,
} from "@/lib/format";
import { useMarkers, usePhotos, useRoutes, useTimeline, useTrip } from "@/lib/queries";
import type { MapMarker, TimelineEvent, TripPlace } from "@/lib/types";
import { cn } from "@/lib/utils";

type TabValue = "overview" | "timeline" | "places" | "photos";

export function TripDetailPage() {
  const { tripId } = useParams<{ tripId: string }>();
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const [searchParams, setSearchParams] = useSearchParams();

  const tripQuery = useTrip(tripId);
  const timelineQuery = useTimeline(tripId);
  const photosQuery = usePhotos({
    trip_id: tripId,
    size: 60,
    sort: "taken_at_asc",
  });
  const markersQuery = useMarkers({ trip_ids: tripId ? [tripId] : [], limit: 2000 });
  const routesQuery = useRoutes(tripId);

  const tab = (searchParams.get("tab") as TabValue | null) ?? "overview";
  const setTab = (value: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("tab", value);
    setSearchParams(next, { replace: true });
  };

  const [uploadOpen, setUploadOpen] = useState(false);
  const [editTripOpen, setEditTripOpen] = useState(false);
  const [placeDialogOpen, setPlaceDialogOpen] = useState(false);
  const [eventDialogOpen, setEventDialogOpen] = useState(false);
  const [editingEvent, setEditingEvent] = useState<TimelineEvent | null>(null);
  const [defaultEventDate, setDefaultEventDate] = useState<string | null>(null);
  const [pendingEvent, setPendingEvent] = useState<TimelineEvent | null>(null);
  const [pendingVisit, setPendingVisit] = useState<TripPlace | null>(null);
  const [deleteTripOpen, setDeleteTripOpen] = useState(false);
  const [selectedPhotoId, setSelectedPhotoId] = useState<string | null>(null);

  const trip = tripQuery.data;

  const generateTimeline = useMutation({
    mutationFn: () =>
      api.timeline.generate(tripId as string, {
        max_gap_minutes: 180,
        max_distance_km: 3,
      }),
    onSuccess: (result) => {
      queryClient.invalidateQueries({ queryKey: ["trips", tripId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
      if (result.created_events) {
        toast.success(
          `${result.created_events} draft event${result.created_events === 1 ? "" : "s"} created`,
          {
            description: `${result.assigned_photos} photo${result.assigned_photos === 1 ? "" : "s"} organised into moments you can edit.`,
          },
        );
        setTab("timeline");
      } else {
        toast.info("No photos to organise yet", {
          description: "Photos need a capture date. Import originals with EXIF, or add an event by hand.",
        });
      }
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not generate the timeline");
    },
  });

  const confirmEvent = useMutation({
    mutationFn: (event: TimelineEvent) =>
      api.timeline.updateEvent(tripId as string, event.id, { status: "confirmed" }),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips", tripId, "timeline"] });
      toast.success("Event confirmed");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not confirm the event");
    },
  });

  const deleteEvent = useMutation({
    mutationFn: (event: TimelineEvent) =>
      api.timeline.deleteEvent(tripId as string, event.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips", tripId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
      toast.success("Event removed");
      setPendingEvent(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete the event");
    },
  });

  const deleteVisit = useMutation({
    mutationFn: (visit: TripPlace) =>
      api.trips.detachPlace(tripId as string, visit.id),
    onSuccess: () => {
      queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["map"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      toast.success("Place removed from the trip");
      setPendingVisit(null);
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not remove the place");
    },
  });

  const deleteTrip = useMutation({
    mutationFn: () => api.trips.remove(tripId as string),
    onSuccess: () => {
      toast.success("Trip moved to the archive");
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["map"] });
      navigate("/trips", { replace: true });
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not delete the trip");
    },
  });

  if (!tripId) return <Navigate to="/trips" replace />;

  if (tripQuery.isPending) {
    return <TripDetailSkeleton />;
  }

  if (tripQuery.isError || !trip) {
    return (
      <div className="page-shell">
        <ErrorState
          title="This journey could not be opened"
          message="It may have been deleted, or the link is no longer valid."
          onRetry={() => tripQuery.refetch()}
        />
      </div>
    );
  }

  const stats = trip.stats;
  const cities = Array.from(
    new Set(trip.places.map((visit) => visit.place.city).filter(Boolean)),
  ) as string[];
  const countries = Array.from(
    new Set(trip.places.map((visit) => visit.place.country).filter(Boolean)),
  ) as string[];
  const tripPhotos = photosQuery.data?.items ?? [];
  const timeline = timelineQuery.data;
  const markers = markersQuery.data?.items ?? [];

  const openNewEvent = (date?: string | null) => {
    setEditingEvent(null);
    setDefaultEventDate(date ?? trip.start_date ?? null);
    setEventDialogOpen(true);
  };

  const handleMarker = (marker: MapMarker) => {
    if (marker.photo_id) setSelectedPhotoId(marker.photo_id);
    else if (marker.place_id) setTab("places");
  };

  return (
    <div className="page-shell">
      <Link
        to="/trips"
        className="mb-4 inline-flex items-center gap-1.5 text-xs font-medium text-muted-foreground transition-colors hover:text-foreground"
      >
        <ArrowLeft className="size-3.5" />
        All trips
      </Link>

      <div className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/70 shadow-soft">
        <TripCover trip={trip} className="relative aspect-[16/11] sm:aspect-[21/8]">
          <div className="absolute inset-x-0 top-0 flex items-start justify-between gap-3 p-4 sm:p-6">
            <Badge
              variant="outline"
              className="border-white/25 bg-pine-950/45 text-white backdrop-blur"
            >
              {trip.visibility === "private"
                ? "Private journey"
                : trip.visibility === "unlisted"
                  ? "Unlisted journey"
                  : "Public journey"}
            </Badge>
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  className="rounded-full border border-white/20 bg-white/10 p-2 text-white backdrop-blur transition-colors hover:bg-white/20"
                  aria-label="Trip actions"
                >
                  <MoreHorizontal className="size-4" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end">
                <DropdownMenuItem onSelect={() => setEditTripOpen(true)}>
                  <Pencil className="size-4" />
                  Edit trip details
                </DropdownMenuItem>
                <DropdownMenuItem asChild>
                  <a href={tripExportUrl(trip.id)} download>
                    <Download className="size-4" />
                    Export as ZIP
                  </a>
                </DropdownMenuItem>
                <DropdownMenuSeparator />
                <DropdownMenuItem destructive onSelect={() => setDeleteTripOpen(true)}>
                  <Trash2 className="size-4" />
                  Delete trip
                </DropdownMenuItem>
              </DropdownMenuContent>
            </DropdownMenu>
          </div>

          <div className="absolute inset-x-0 bottom-0 p-5 sm:p-8">
            <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
              <div className="max-w-2xl">
                <p className="text-[10px] font-medium uppercase tracking-[0.22em] text-sand-100/75">
                  {formatDateRange(trip.start_date, trip.end_date)}
                  {countries.length ? ` · ${countries.join(" · ")}` : ""}
                </p>
                <h1 className="mt-2 text-balance font-display text-3xl font-semibold leading-[1.02] text-white sm:text-5xl">
                  {trip.title}
                </h1>
                {trip.description && (
                  <p className="mt-3 line-clamp-2 max-w-xl text-sm leading-relaxed text-sand-100/75">
                    {trip.description}
                  </p>
                )}
              </div>
              <div className="flex shrink-0 flex-wrap gap-2">
                <Button
                  className="bg-white/95 text-pine-900 hover:bg-white"
                  onClick={() => setUploadOpen(true)}
                >
                  <Upload className="size-4" />
                  Add photos
                </Button>
                <Button
                  variant="outline"
                  className="border-white/25 bg-white/5 text-white hover:bg-white/15 hover:text-white"
                  onClick={() => setEditTripOpen(true)}
                >
                  <Pencil className="size-4" />
                  Edit
                </Button>
              </div>
            </div>
          </div>
        </TripCover>

        <div className="grid grid-cols-2 divide-x divide-y divide-border/70 border-t border-border/70 sm:grid-cols-4 sm:divide-y-0">
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Photos</p>
            <p className="mt-1 font-display text-2xl font-semibold">{stats.photo_count}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Places</p>
            <p className="mt-1 font-display text-2xl font-semibold">{stats.place_count}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Days</p>
            <p className="mt-1 font-display text-2xl font-semibold">{trip.day_count}</p>
          </div>
          <div className="px-5 py-4">
            <p className="text-[10px] uppercase tracking-[0.16em] text-muted-foreground">Geotagged</p>
            <p className="mt-1 font-display text-2xl font-semibold">
              {stats.gps_photo_count}
              <span className="ml-1 text-xs font-normal text-muted-foreground">
                / {stats.photo_count}
              </span>
            </p>
          </div>
        </div>
      </div>

      <Tabs value={tab} onValueChange={setTab} className="mt-8">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <TabsList>
            <TabsTrigger value="overview">Overview</TabsTrigger>
            <TabsTrigger value="timeline">
              Timeline
              {timeline?.event_count ? (
                <span className="ml-1 rounded-full bg-black/10 px-1.5 text-[10px]">
                  {timeline.event_count}
                </span>
              ) : null}
            </TabsTrigger>
            <TabsTrigger value="places">Places</TabsTrigger>
            <TabsTrigger value="photos">Photos</TabsTrigger>
          </TabsList>

          {tab === "timeline" && (
            <div className="flex flex-wrap gap-2">
              <Button
                variant="outline"
                onClick={() => generateTimeline.mutate()}
                disabled={generateTimeline.isPending || stats.photo_count === 0}
              >
                <Sparkles className="size-4" />
                {generateTimeline.isPending ? "Reconstructing…" : "Generate drafts"}
              </Button>
              <Button onClick={() => openNewEvent()}>
                <Plus className="size-4" />
                Add event
              </Button>
            </div>
          )}
          {tab === "places" && (
            <Button onClick={() => setPlaceDialogOpen(true)}>
              <Plus className="size-4" />
              Add place
            </Button>
          )}
          {tab === "photos" && (
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Upload photos
            </Button>
          )}
        </div>

        <TabsContent value="overview">
          <div className="grid gap-5 xl:grid-cols-[1.55fr_1fr]">
            <section className="surface overflow-hidden">
              <div className="flex items-center justify-between gap-3 px-5 py-4">
                <div>
                  <p className="eyebrow">Route</p>
                  <h2 className="font-display text-2xl">The journey on the map</h2>
                </div>
                <Link to="/map" className={buttonVariants({ variant: "outline", size: "sm" })}>
                  Open map
                  <ArrowRight className="size-3.5" />
                </Link>
              </div>
              <MapView
                markers={markers}
                routes={routesQuery.data}
                className="h-[360px]"
                onMarkerClick={handleMarker}
                fitKey={`trip-${trip.id}`}
              />
              <div className="flex flex-wrap items-center gap-x-4 gap-y-1 border-t border-border/70 px-5 py-3 text-[11px] text-muted-foreground">
                <span>{stats.photo_days} days with photos</span>
                <span>·</span>
                <span>{stats.place_count} places visited</span>
                <span>·</span>
                <span>{stats.favorite_count} favourites</span>
              </div>
            </section>

            <div className="space-y-4">
              <section className="surface p-5">
                <p className="eyebrow">Field notes</p>
                <h2 className="mt-1 font-display text-2xl">About this journey</h2>
                <p className="mt-3 text-sm leading-relaxed text-foreground/80">
                  {trip.description || "No description yet. Add a few words about the journey."}
                </p>
                <dl className="mt-5 space-y-3 text-sm">
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Dates</dt>
                    <dd className="text-right font-medium">{formatDateRange(trip.start_date, trip.end_date)}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Cities</dt>
                    <dd className="text-right font-medium">{cities.length ? cities.join(", ") : "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">Countries</dt>
                    <dd className="text-right font-medium">{countries.length ? countries.join(", ") : "—"}</dd>
                  </div>
                  <div className="flex items-start justify-between gap-3">
                    <dt className="text-muted-foreground">First photo</dt>
                    <dd className="text-right font-medium">{formatDateTime(stats.first_photo_at)}</dd>
                  </div>
                </dl>
              </section>

              <section className="surface p-5">
                <div className="flex items-center justify-between">
                  <div>
                    <p className="eyebrow">Timeline</p>
                    <h2 className="mt-1 font-display text-2xl">Moments</h2>
                  </div>
                  <Button variant="ghost" size="sm" onClick={() => setTab("timeline")}>
                    Open
                    <ArrowRight className="size-3.5" />
                  </Button>
                </div>
                {timeline?.days.length ? (
                  <ul className="mt-4 space-y-3">
                    {timeline.days
                      .flatMap((day) => day.events)
                      .slice(0, 4)
                      .map((event) => (
                        <li key={event.id} className="flex items-start gap-3">
                          <span className="mt-0.5 flex size-8 shrink-0 items-center justify-center rounded-lg bg-sand-100 text-sand-800">
                            {(() => {
                              const Icon = EVENT_TYPE_ICONS[event.event_type];
                              return <Icon className="size-3.5" />;
                            })()}
                          </span>
                          <div className="min-w-0">
                            <p className="truncate text-sm font-medium">{event.title}</p>
                            <p className="text-[11px] text-muted-foreground">
                              {formatDate(event.day, "MMM d")} · {formatTime(event.start_time)}
                            </p>
                          </div>
                        </li>
                      ))}
                  </ul>
                ) : (
                  <div className="mt-4 rounded-2xl border border-dashed border-border px-4 py-5 text-center">
                    <p className="text-xs text-muted-foreground">
                      No events yet. Generate a draft timeline from your photo metadata.
                    </p>
                    <Button
                      variant="outline"
                      size="sm"
                      className="mt-3"
                      disabled={stats.photo_count === 0}
                      onClick={() => generateTimeline.mutate()}
                    >
                      <Sparkles className="size-3.5" />
                      Generate drafts
                    </Button>
                  </div>
                )}
              </section>
            </div>
          </div>

          <section className="mt-6 surface p-5">
            <div className="flex items-center justify-between">
              <div>
                <p className="eyebrow">Frames</p>
                <h2 className="mt-1 font-display text-2xl">Photos from this trip</h2>
              </div>
              <Button variant="ghost" size="sm" onClick={() => setTab("photos")}>
                View all
                <ArrowRight className="size-3.5" />
              </Button>
            </div>
            {tripPhotos.length ? (
              <div className="mt-4 grid grid-cols-3 gap-2 sm:grid-cols-4 lg:grid-cols-8">
                {tripPhotos.slice(0, 8).map((photo) => (
                  <PhotoThumb
                    key={photo.id}
                    photo={photo}
                    className="aspect-square rounded-xl"
                    onClick={() => setSelectedPhotoId(photo.id)}
                  />
                ))}
              </div>
            ) : (
              <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border py-8 text-center">
                <Images className="size-5 text-muted-foreground" />
                <p className="text-xs text-muted-foreground">
                  Add photos to bring this journey to life.
                </p>
                <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                  <Upload className="size-3.5" />
                  Upload photos
                </Button>
              </div>
            )}
          </section>
        </TabsContent>

        <TabsContent value="timeline">
          {timelineQuery.isPending ? (
            <div className="space-y-3">
              {[0, 1, 2].map((index) => (
                <Skeleton key={index} className="h-28 rounded-2xl" />
              ))}
            </div>
          ) : timelineQuery.isError ? (
            <ErrorState onRetry={() => timelineQuery.refetch()} />
          ) : timeline && timeline.days.length > 0 ? (
            <>
              <TimelineList
                timeline={timeline}
                onEdit={(event) => {
                  setEditingEvent(event);
                  setEventDialogOpen(true);
                }}
                onDelete={(event) => setPendingEvent(event)}
                onConfirm={(event) => confirmEvent.mutate(event)}
                onPhotoClick={(photoId) => setSelectedPhotoId(photoId)}
                onAddEvent={(date) => openNewEvent(date)}
                confirmingId={
                  confirmEvent.isPending ? (confirmEvent.variables?.id ?? null) : null
                }
              />
              <div className="mt-8 flex justify-center">
                <Button variant="outline" onClick={() => openNewEvent()}>
                  <Plus className="size-4" />
                  Add another moment
                </Button>
              </div>
            </>
          ) : (
            <EmptyState
              icon={Sparkles}
              title="No timeline yet"
              description="Generate a draft from the time and place in your photos, then keep, confirm or rewrite each suggestion."
              action={
                <div className="flex flex-wrap justify-center gap-2">
                  <Button
                    disabled={stats.photo_count === 0 || generateTimeline.isPending}
                    onClick={() => generateTimeline.mutate()}
                  >
                    <Sparkles className="size-4" />
                    Generate draft timeline
                  </Button>
                  <Button variant="outline" onClick={() => openNewEvent()}>
                    <Plus className="size-4" />
                    Add an event
                  </Button>
                </div>
              }
            />
          )}
        </TabsContent>

        <TabsContent value="places">
          {trip.places.length === 0 ? (
            <EmptyState
              icon={MapPin}
              title="No places yet"
              description="Add the places you visited to complete the map and give your photos a home."
              action={
                <Button onClick={() => setPlaceDialogOpen(true)}>
                  <Plus className="size-4" />
                  Add your first place
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3 sm:grid-cols-2">
              {trip.places.map((visit) => {
                const Icon = PLACE_CATEGORY_ICONS[visit.place.category];
                return (
                  <article
                    key={visit.id}
                    className="group flex items-start gap-3.5 rounded-2xl border border-border/80 bg-card/85 p-4 shadow-soft"
                  >
                    <span
                      className={cn(
                        "flex size-10 shrink-0 items-center justify-center rounded-xl ring-1 ring-inset",
                        PLACE_CATEGORY_COLORS[visit.place.category],
                      )}
                    >
                      <Icon className="size-4" />
                    </span>
                    <div className="min-w-0 flex-1">
                      <div className="flex items-start justify-between gap-2">
                        <div>
                          <h3 className="truncate font-medium">{visit.place.name}</h3>
                          <p className="text-[11px] text-muted-foreground">
                            {[visit.place.city, visit.place.country].filter(Boolean).join(", ") ||
                              "No location details"}
                          </p>
                        </div>
                        <button
                          onClick={() => setPendingVisit(visit)}
                          className="rounded-full p-1.5 text-muted-foreground opacity-0 transition-all hover:bg-red-50 hover:text-destructive group-hover:opacity-100"
                          aria-label={`Remove ${visit.place.name}`}
                        >
                          <Trash2 className="size-3.5" />
                        </button>
                      </div>
                      <div className="mt-2 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                        {visit.arrival_time && (
                          <span className="inline-flex items-center gap-1">
                            <CalendarDays className="size-3" />
                            {formatDateTime(visit.arrival_time)}
                          </span>
                        )}
                        {visit.place.latitude !== null && visit.place.longitude !== null && (
                          <span className="inline-flex items-center gap-1 tabular-nums">
                            <MapPin className="size-3" />
                            {visit.place.latitude.toFixed(3)}, {visit.place.longitude.toFixed(3)}
                          </span>
                        )}
                      </div>
                      {visit.notes && (
                        <p className="mt-2 text-xs leading-relaxed text-foreground/70">
                          {visit.notes}
                        </p>
                      )}
                    </div>
                  </article>
                );
              })}
            </div>
          )}
        </TabsContent>

        <TabsContent value="photos">
          {photosQuery.isPending ? (
            <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
              {[0, 1, 2, 3, 4, 5].map((index) => (
                <Skeleton key={index} className="aspect-square rounded-2xl" />
              ))}
            </div>
          ) : photosQuery.isError ? (
            <ErrorState onRetry={() => photosQuery.refetch()} />
          ) : tripPhotos.length === 0 ? (
            <EmptyState
              icon={Camera}
              title="No photos in this trip"
              description="Import the photos you took. TravelTrace reads EXIF time and GPS to place them on the map."
              action={
                <Button onClick={() => setUploadOpen(true)}>
                  <Upload className="size-4" />
                  Upload photos
                </Button>
              }
            />
          ) : (
            <>
              <div className="grid grid-cols-2 gap-2 sm:grid-cols-3 lg:grid-cols-4">
                {tripPhotos.map((photo) => (
                  <div
                    key={photo.id}
                    className="group relative overflow-hidden rounded-2xl bg-sand-200"
                    style={{ aspectRatio: photo.width && photo.height ? photo.width / photo.height : 1 }}
                  >
                    <PhotoThumb
                      photo={photo}
                      className="absolute inset-0 size-full"
                      onClick={() => setSelectedPhotoId(photo.id)}
                    />
                    <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-center justify-between gap-2 bg-gradient-to-t from-pine-950/70 to-transparent p-3 opacity-0 transition-opacity group-hover:opacity-100">
                      <span className="truncate text-[10px] text-white/85">
                        {formatDate(photo.taken_at, "MMM d, yyyy")}
                        {photo.place ? ` · ${photo.place.name}` : ""}
                      </span>
                      {photo.is_favorite && (
                        <Star className="size-3 text-amber-300" fill="currentColor" />
                      )}
                    </div>
                  </div>
                ))}
              </div>
              {photosQuery.data && photosQuery.data.total > tripPhotos.length && (
                <p className="mt-5 text-center text-xs text-muted-foreground">
                  Showing the first {tripPhotos.length} of {photosQuery.data.total} photos.{" "}
                  <Link to={`/photos?trip_id=${trip.id}`} className="text-primary hover:underline">
                    Open the full gallery
                  </Link>
                </p>
              )}
            </>
          )}
        </TabsContent>
      </Tabs>

      <UploadDialog
        open={uploadOpen}
        onOpenChange={setUploadOpen}
        tripId={trip.id}
        onUploaded={() => {
          queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
          queryClient.invalidateQueries({ queryKey: ["trips", trip.id, "timeline"] });
        }}
      />

      <TripFormDialog
        open={editTripOpen}
        onOpenChange={setEditTripOpen}
        trip={trip}
        onSaved={() => {
          queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
          queryClient.invalidateQueries({ queryKey: ["trips"] });
        }}
      />

      <PlaceDialog
        open={placeDialogOpen}
        onOpenChange={setPlaceDialogOpen}
        tripId={trip.id}
        attachedPlaceIds={trip.places.map((visit) => visit.place.id)}
        onDone={() => undefined}
      />

      <EventDialog
        open={eventDialogOpen}
        onOpenChange={setEventDialogOpen}
        tripId={trip.id}
        event={editingEvent}
        tripPhotos={tripPhotos}
        places={trip.places}
        defaultDate={defaultEventDate}
      />

      <PhotoDetailSheet
        photoId={selectedPhotoId}
        open={Boolean(selectedPhotoId)}
        onOpenChange={(open) => {
          if (!open) setSelectedPhotoId(null);
        }}
        onChanged={() => {
          queryClient.invalidateQueries({ queryKey: ["trips", trip.id] });
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingEvent)}
        onOpenChange={(open) => {
          if (!open) setPendingEvent(null);
        }}
        title="Delete this event?"
        description="The photos stay in your library. Only the timeline entry is removed."
        confirmLabel="Delete event"
        loading={deleteEvent.isPending}
        onConfirm={() => {
          if (pendingEvent) deleteEvent.mutate(pendingEvent);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingVisit)}
        onOpenChange={(open) => {
          if (!open) setPendingVisit(null);
        }}
        title="Remove this place?"
        description="It will be removed from this trip and its route. The place remains in your saved places."
        confirmLabel="Remove place"
        loading={deleteVisit.isPending}
        onConfirm={() => {
          if (pendingVisit) deleteVisit.mutate(pendingVisit);
        }}
      />

      <ConfirmDialog
        open={deleteTripOpen}
        onOpenChange={setDeleteTripOpen}
        title="Delete this trip?"
        description={`“${trip.title}” will be archived along with its timeline. Photos stay in your library but leave the map.`}
        confirmLabel="Delete trip"
        loading={deleteTrip.isPending}
        onConfirm={() => deleteTrip.mutate()}
      />
    </div>
  );
}

function TripDetailSkeleton() {
  return (
    <div className="page-shell">
      <Skeleton className="mb-4 h-4 w-24" />
      <Skeleton className="h-[320px] w-full rounded-[2rem]" />
      <div className="mt-8 flex gap-2">
        <Skeleton className="h-10 w-32 rounded-full" />
        <Skeleton className="h-10 w-32 rounded-full" />
      </div>
      <div className="mt-6 grid gap-5 xl:grid-cols-[1.55fr_1fr]">
        <Skeleton className="h-[420px] rounded-3xl" />
        <Skeleton className="h-[420px] rounded-3xl" />
      </div>
    </div>
  );
}
