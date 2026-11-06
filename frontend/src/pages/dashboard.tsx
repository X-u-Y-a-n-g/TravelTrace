import {
  ArrowRight,
  Camera,
  CalendarDays,
  Globe2,
  Images,
  Luggage,
  MapPin,
  Plus,
  Sparkles,
  Upload,
} from "lucide-react";
import { useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { CountryFlag } from "@/components/common/country-flag";
import { ErrorState } from "@/components/common/error-state";
import { MapView } from "@/components/map/map-view";
import { UploadDialog } from "@/components/photo/upload-dialog";
import { PhotoThumb } from "@/components/photo/photo-thumb";
import { TripCard } from "@/components/trip/trip-card";
import { TripFormDialog } from "@/components/trip/trip-form-dialog";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { PageHeader } from "@/components/ui/page-header";
import { Skeleton } from "@/components/ui/skeleton";
import { StatCard } from "@/components/ui/stat-card";
import { formatBytes, formatDate, formatNumber } from "@/lib/format";
import { useMarkers, useStats } from "@/lib/queries";
import type { MapMarker } from "@/lib/types";
import { useAuthStore } from "@/stores/auth";

export function DashboardPage() {
  const user = useAuthStore((state) => state.user);
  const navigate = useNavigate();
  const stats = useStats();
  const markers = useMarkers({ limit: 600 });
  const [uploadOpen, setUploadOpen] = useState(false);
  const [tripOpen, setTripOpen] = useState(false);

  const displayName = user?.display_name || user?.username || "traveller";
  const greeting = (() => {
    const hour = new Date().getHours();
    if (hour < 5) return "Still up";
    if (hour < 12) return "Good morning";
    if (hour < 18) return "Good afternoon";
    return "Good evening";
  })();

  const data = stats.data;
  const mapMarkers = markers.data?.items ?? [];

  const handleMarker = (marker: MapMarker) => {
    if (marker.photo_id) {
      navigate(`/photos?photo=${marker.photo_id}`);
    } else if (marker.trip_id) {
      navigate(`/trips/${marker.trip_id}`);
    }
  };

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={formatDate(new Date().toISOString(), "EEEE, MMMM d")}
        title={`${greeting}, ${displayName}.`}
        description="Every photo is a coordinate. Every date is a chapter. Here is the journey so far."
        actions={
          <>
            <Button variant="outline" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Import photos
            </Button>
            <Button variant="accent" onClick={() => setTripOpen(true)}>
              <Plus className="size-4" />
              New trip
            </Button>
          </>
        }
      />

      {stats.isPending ? (
        <DashboardSkeleton />
      ) : stats.isError ? (
        <ErrorState
          title="We couldn't read your journal"
          message="The dashboard statistics are unavailable right now."
          onRetry={() => stats.refetch()}
        />
      ) : data ? (
        data.trips === 0 ? (
          <WelcomePanel onCreateTrip={() => setTripOpen(true)} onUpload={() => setUploadOpen(true)} />
        ) : (
          <div className="space-y-8">
            <div className="grid grid-cols-2 gap-3 xl:grid-cols-4">
              <StatCard
                icon={Luggage}
                label="Journeys"
                value={formatNumber(data.trips)}
                hint={`${formatNumber(data.days)} days on the road`}
              />
              <StatCard
                icon={Globe2}
                label="Countries"
                value={formatNumber(data.countries)}
                hint={`${formatNumber(data.cities)} cities visited`}
                tone="sand"
              />
              <StatCard
                icon={MapPin}
                label="Places"
                value={formatNumber(data.places)}
                hint={`${formatNumber(data.gps_photos)} geotagged photos`}
                tone="ember"
              />
              <StatCard
                icon={Camera}
                label="Photos"
                value={formatNumber(data.photos)}
                hint={`${formatBytes(data.storage_bytes)} stored`}
              />
            </div>

            <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
              <section className="surface overflow-hidden">
                <div className="flex items-start justify-between gap-4 px-5 pb-4 pt-5">
                  <div>
                    <p className="eyebrow">Footprint</p>
                    <h2 className="mt-1 font-display text-2xl">The world so far</h2>
                  </div>
                  <Link
                    to="/map"
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    Open the map
                    <ArrowRight className="size-3.5" />
                  </Link>
                </div>
                <MapView
                  markers={mapMarkers}
                  className="h-[380px]"
                  onMarkerClick={handleMarker}
                  fitKey="dashboard"
                />
                <div className="flex flex-wrap items-center gap-2 border-t border-border/70 px-5 py-3.5">
                  {data.countries_detail.length ? (
                    data.countries_detail.slice(0, 6).map((country) => (
                      <Badge key={country.country} variant="sand" className="gap-1.5">
                        <CountryFlag code={country.country_code} />
                        {country.country}
                        <span className="text-[10px] text-sand-700/70">{country.place_count}</span>
                      </Badge>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">
                      Add places to your trips to fill in the map.
                    </p>
                  )}
                  {markers.data?.truncated && (
                    <span className="ml-auto text-[11px] text-muted-foreground">
                      Showing a subset of markers
                    </span>
                  )}
                </div>
              </section>

              <div className="space-y-5">
                <section className="surface p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="eyebrow">Rhythm</p>
                      <h2 className="mt-1 font-display text-2xl">Journeys by year</h2>
                    </div>
                    <CalendarDays className="size-4 text-muted-foreground" />
                  </div>
                  <div className="mt-5 space-y-3.5">
                    {data.years.length ? (
                      data.years.slice(0, 6).map((year) => {
                        const max = Math.max(...data.years.map((item) => item.photos), 1);
                        return (
                          <div key={year.year} className="space-y-1.5">
                            <div className="flex items-baseline justify-between text-xs">
                              <span className="font-medium">{year.year}</span>
                              <span className="text-muted-foreground">
                                {year.trips} trip{year.trips === 1 ? "" : "s"} · {year.photos} photos
                              </span>
                            </div>
                            <div className="h-1.5 overflow-hidden rounded-full bg-sand-200/80">
                              <div
                                className="h-full rounded-full bg-pine-600"
                                style={{ width: `${Math.max((year.photos / max) * 100, 4)}%` }}
                              />
                            </div>
                          </div>
                        );
                      })
                    ) : (
                      <p className="text-sm text-muted-foreground">
                        Your yearly rhythm will appear once photos have dates.
                      </p>
                    )}
                  </div>
                </section>

                <section className="surface p-5">
                  <div className="flex items-center justify-between">
                    <div>
                      <p className="eyebrow">Latest frames</p>
                      <h2 className="mt-1 font-display text-2xl">Recently added</h2>
                    </div>
                    <Link
                      to="/photos"
                      className="text-xs font-medium text-primary hover:underline"
                    >
                      View gallery
                    </Link>
                  </div>
                  {data.recent_photos.length ? (
                    <div className="mt-4 grid grid-cols-4 gap-1.5">
                      {data.recent_photos.slice(0, 8).map((photo) => (
                        <PhotoThumb
                          key={photo.id}
                          photo={photo}
                          className="aspect-square rounded-lg"
                          onClick={() => navigate(`/photos?photo=${photo.id}`)}
                        />
                      ))}
                    </div>
                  ) : (
                    <div className="mt-4 flex flex-col items-center gap-2 rounded-2xl border border-dashed border-border px-4 py-6 text-center">
                      <Images className="size-5 text-muted-foreground" />
                      <p className="text-xs text-muted-foreground">
                        No photos yet. Import your first batch to light up the map.
                      </p>
                      <Button variant="outline" size="sm" onClick={() => setUploadOpen(true)}>
                        <Upload className="size-3.5" />
                        Import photos
                      </Button>
                    </div>
                  )}
                </section>
              </div>
            </div>

            <section>
              <div className="mb-4 flex items-end justify-between">
                <div>
                  <p className="eyebrow">Chapters</p>
                  <h2 className="mt-1 font-display text-2xl">Recent journeys</h2>
                </div>
                <Link to="/trips" className="text-xs font-medium text-primary hover:underline">
                  All trips
                </Link>
              </div>
              <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-4">
                {data.recent_trips.map((trip) => (
                  <TripCard key={trip.id} trip={trip} />
                ))}
                <Link
                  to="/trips?new=1"
                  className="group flex min-h-[240px] flex-col items-center justify-center gap-2 rounded-3xl border border-dashed border-border bg-card/40 p-6 text-center transition-colors hover:border-pine-300 hover:bg-card/70"
                >
                  <span className="flex size-11 items-center justify-center rounded-2xl bg-pine-100 text-pine-700 transition-transform group-hover:scale-105">
                    <Plus className="size-5" />
                  </span>
                  <span className="font-display text-lg font-semibold">Plan another journey</span>
                  <span className="text-xs text-muted-foreground">
                    A weekend, a month, a single afternoon.
                  </span>
                </Link>
              </div>
            </section>
          </div>
        )
      ) : null}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <TripFormDialog
        open={tripOpen}
        onOpenChange={setTripOpen}
        onSaved={(trip) => navigate(`/trips/${trip.id}`)}
      />
    </div>
  );
}

function WelcomePanel({
  onCreateTrip,
  onUpload,
}: {
  onCreateTrip: () => void;
  onUpload: () => void;
}) {
  const steps = [
    {
      number: "01",
      title: "Create your first trip",
      description: "Name it, pick the dates, and set how private it should be.",
    },
    {
      number: "02",
      title: "Import the photos",
      description: "TravelTrace reads EXIF time and GPS and builds thumbnails automatically.",
    },
    {
      number: "03",
      title: "Watch it reconstruct",
      description: "Photos land on the map and a draft timeline appears, ready for your edits.",
    },
  ];

  return (
    <section className="overflow-hidden rounded-[2rem] border border-border/80 bg-card/70 shadow-soft">
      <div className="relative overflow-hidden bg-[#1b352c] px-7 py-12 text-sand-50 sm:px-12">
        <div className="absolute inset-0 bg-[radial-gradient(700px_400px_at_85%_10%,rgba(212,114,42,0.28),transparent_60%),radial-gradient(600px_400px_at_0%_100%,rgba(73,122,100,0.4),transparent_55%)]" />
        <svg
          viewBox="0 0 700 300"
          className="absolute inset-y-0 right-0 h-full w-2/3 opacity-25"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <path
            d="M-40 250C100 250 130 80 280 80s180 150 330 150 120-50 160-50"
            fill="none"
            stroke="#f4eee1"
            strokeWidth="2"
            strokeDasharray="2 10"
          />
          <circle cx="90" cy="222" r="6" fill="#f4eee1" />
          <circle cx="430" cy="148" r="6" fill="#d4722a" />
        </svg>
        <div className="relative max-w-xl">
          <Badge variant="outline" className="border-white/20 bg-white/5 text-sand-100">
            <Sparkles className="size-3" />
            A fresh journal
          </Badge>
          <h2 className="mt-4 text-balance font-display text-4xl font-semibold leading-[1.02] text-sand-50 sm:text-5xl">
            Turn a camera roll into a journey you can walk through.
          </h2>
          <p className="mt-4 max-w-md text-sm leading-relaxed text-sand-100/70">
            TravelTrace reconstructs the map, the timeline and the story from the metadata already
            inside your photos. Nothing to tag by hand.
          </p>
          <div className="mt-7 flex flex-wrap gap-2.5">
            <Button variant="accent" onClick={onCreateTrip}>
              <Plus className="size-4" />
              Create your first trip
            </Button>
            <Button
              variant="outline"
              className="border-white/20 bg-white/5 text-sand-50 hover:bg-white/10 hover:text-white"
              onClick={onUpload}
            >
              <Upload className="size-4" />
              Import photos instead
            </Button>
          </div>
        </div>
      </div>

      <div className="grid gap-0 sm:grid-cols-3">
        {steps.map((step, index) => (
          <div
            key={step.number}
            className={`p-6 ${index > 0 ? "border-t sm:border-l sm:border-t-0" : ""} border-border/70`}
          >
            <p className="font-display text-2xl text-sand-500">{step.number}</p>
            <h3 className="mt-2 text-base font-semibold">{step.title}</h3>
            <p className="mt-1 text-xs leading-relaxed text-muted-foreground">{step.description}</p>
          </div>
        ))}
      </div>
    </section>
  );
}

function DashboardSkeleton() {
  return (
    <div className="space-y-6">
      <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-4">
        {[0, 1, 2, 3].map((index) => (
          <Skeleton key={index} className="h-[104px] rounded-3xl" />
        ))}
      </div>
      <div className="grid gap-5 xl:grid-cols-[1.6fr_1fr]">
        <Skeleton className="h-[460px] rounded-3xl" />
        <div className="space-y-5">
          <Skeleton className="h-[220px] rounded-3xl" />
          <Skeleton className="h-[220px] rounded-3xl" />
        </div>
      </div>
    </div>
  );
}
