import {
  ArrowUpRight,
  Compass,
  Layers,
  Route as RouteIcon,
  SlidersHorizontal,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { Link, useNavigate } from "react-router-dom";

import { MapView } from "@/components/map/map-view";
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Label } from "@/components/ui/label";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Switch } from "@/components/ui/switch";
import { PLACE_CATEGORIES, PLACE_CATEGORY_ICONS } from "@/lib/constants";
import { formatDateTime } from "@/lib/format";
import { useMarkers, useRoutes, useTrips } from "@/lib/queries";
import { photoUrl } from "@/lib/api";
import type { MapMarker, PlaceCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

export function MapPage() {
  const navigate = useNavigate();
  const trips = useTrips({ size: 100, sort: "start_date_desc" });
  const [tripIds, setTripIds] = useState<string[]>([]);
  const [categories, setCategories] = useState<PlaceCategory[]>([]);
  const [showRoutes, setShowRoutes] = useState(true);
  const [selected, setSelected] = useState<MapMarker | null>(null);
  const [filtersOpen, setFiltersOpen] = useState(false);

  const markers = useMarkers({
    trip_ids: tripIds.length ? tripIds : undefined,
    categories: categories.length ? categories : undefined,
    limit: 2000,
  });
  const routes = useRoutes();

  const visibleRoutes = useMemo(() => {
    if (!routes.data) return null;
    const features = tripIds.length
      ? routes.data.features.filter((feature) => tripIds.includes(feature.properties.trip_id))
      : routes.data.features;
    return { ...routes.data, features };
  }, [routes.data, tripIds]);

  const fitKey = JSON.stringify({ tripIds: [...tripIds].sort(), categories: [...categories].sort() });

  const toggleTrip = (tripId: string) => {
    setTripIds((current) =>
      current.includes(tripId) ? current.filter((id) => id !== tripId) : [...current, tripId],
    );
  };

  const toggleCategory = (category: PlaceCategory) => {
    setCategories((current) =>
      current.includes(category)
        ? current.filter((item) => item !== category)
        : [...current, category],
    );
  };

  const resetFilters = () => {
    setTripIds([]);
    setCategories([]);
  };

  const activeFilterCount = tripIds.length + categories.length;

  return (
    <div className="relative h-[calc(100dvh-7.5rem)] min-h-[520px] w-full overflow-hidden bg-sand-100 lg:h-[100dvh]">
      <MapView
        markers={markers.data?.items ?? []}
        routes={showRoutes ? visibleRoutes : null}
        className="absolute inset-0 h-full"
        autoFit
        fitKey={fitKey}
        onMarkerClick={setSelected}
      />

      <div className="pointer-events-none absolute inset-0 z-10 p-3 sm:p-4">
        <div className="flex h-full flex-col justify-between">
          <div className="flex items-start justify-between gap-3">
            <div
              className={cn(
                "pointer-events-auto w-[300px] max-w-[calc(100vw-1.5rem)] overflow-hidden rounded-3xl border border-border/80 bg-card/95 shadow-lift backdrop-blur transition-all",
                filtersOpen ? "block" : "hidden lg:block",
              )}
            >
              <div className="flex items-start justify-between gap-2 border-b border-border/70 px-4 py-4">
                <div>
                  <p className="eyebrow">Atlas</p>
                  <h1 className="mt-0.5 font-display text-2xl font-semibold">Travel map</h1>
                  <p className="mt-1 text-[11px] text-muted-foreground">
                    {markers.data ? `${markers.data.total} mapped moments` : "Loading your footprint…"}
                  </p>
                </div>
                <button
                  className="rounded-full p-1.5 text-muted-foreground hover:bg-secondary lg:hidden"
                  onClick={() => setFiltersOpen(false)}
                  aria-label="Close filters"
                >
                  <X className="size-4" />
                </button>
              </div>

              <div className="max-h-[52vh] space-y-5 overflow-y-auto p-4">
                <section className="space-y-2">
                  <div className="flex items-center justify-between">
                    <Label>Trips</Label>
                    <div className="flex items-center gap-2 text-[10px]">
                      <button
                        className="text-primary hover:underline"
                        onClick={() => setTripIds(trips.data?.items.map((trip) => trip.id) ?? [])}
                      >
                        All
                      </button>
                      <span className="text-border">·</span>
                      <button className="text-muted-foreground hover:underline" onClick={() => setTripIds([])}>
                        None
                      </button>
                    </div>
                  </div>
                  <div className="space-y-1">
                    {trips.data?.items.length ? (
                      trips.data.items.map((trip) => {
                        const checked = tripIds.includes(trip.id);
                        return (
                          <button
                            key={trip.id}
                            type="button"
                            onClick={() => toggleTrip(trip.id)}
                            className={cn(
                              "flex w-full items-center gap-2.5 rounded-xl border px-2.5 py-2 text-left text-xs transition-colors",
                              checked
                                ? "border-pine-300 bg-pine-50 text-pine-900"
                                : "border-transparent hover:bg-secondary/70",
                            )}
                          >
                            <span
                              className={cn(
                                "flex size-4 shrink-0 items-center justify-center rounded border transition-colors",
                                checked ? "border-primary bg-primary text-primary-foreground" : "border-border bg-card",
                              )}
                            >
                              {checked && (
                                <svg viewBox="0 0 12 12" className="size-2.5" fill="none">
                                  <path
                                    d="M2.5 6.2 4.9 8.6 9.5 3.6"
                                    stroke="currentColor"
                                    strokeWidth="2"
                                    strokeLinecap="round"
                                  />
                                </svg>
                              )}
                            </span>
                            <span className="min-w-0 flex-1 truncate font-medium">{trip.title}</span>
                            <span className="text-[10px] text-muted-foreground">{trip.photo_count}</span>
                          </button>
                        );
                      })
                    ) : (
                      <p className="rounded-xl bg-secondary/50 px-3 py-2 text-[11px] text-muted-foreground">
                        No trips yet. Create one to start mapping.
                      </p>
                    )}
                  </div>
                </section>

                <section className="space-y-2">
                  <Label>Place type</Label>
                  <div className="flex flex-wrap gap-1.5">
                    {PLACE_CATEGORIES.map((category) => {
                      const Icon = PLACE_CATEGORY_ICONS[category.value];
                      const active = categories.includes(category.value);
                      return (
                        <button
                          key={category.value}
                          type="button"
                          onClick={() => toggleCategory(category.value)}
                          className={cn(
                            "inline-flex items-center gap-1.5 rounded-full border px-2.5 py-1 text-[11px] transition-colors",
                            active
                              ? "border-pine-600 bg-pine-700 text-sand-50"
                              : "border-border bg-card/60 text-muted-foreground hover:border-pine-300 hover:text-foreground",
                          )}
                        >
                          <Icon className="size-3" />
                          {category.label}
                        </button>
                      );
                    })}
                  </div>
                </section>

                <section className="flex items-center justify-between gap-3 rounded-xl bg-secondary/40 px-3 py-2.5">
                  <span className="flex items-center gap-2 text-xs">
                    <RouteIcon className="size-3.5 text-pine-700" />
                    Draw trip routes
                  </span>
                  <Switch checked={showRoutes} onCheckedChange={setShowRoutes} aria-label="Show routes" />
                </section>

                {activeFilterCount > 0 && (
                  <Button variant="ghost" size="sm" className="w-full" onClick={resetFilters}>
                    Clear {activeFilterCount} filter{activeFilterCount === 1 ? "" : "s"}
                  </Button>
                )}
              </div>
            </div>

            <div className="pointer-events-auto flex flex-col items-end gap-2">
              <Button
                variant="outline"
                size="sm"
                className="lg:hidden"
                onClick={() => setFiltersOpen(true)}
              >
                <SlidersHorizontal className="size-3.5" />
                Filters
                {activeFilterCount > 0 && (
                  <span className="ml-0.5 rounded-full bg-primary px-1.5 text-[10px] text-primary-foreground">
                    {activeFilterCount}
                  </span>
                )}
              </Button>
              <div className="hidden items-center gap-3 rounded-full border border-border/80 bg-card/95 px-3.5 py-2 text-[11px] shadow-soft backdrop-blur sm:flex">
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-ember-500" />
                  Photo
                </span>
                <span className="flex items-center gap-1.5">
                  <span className="size-2 rounded-full bg-pine-700" />
                  Place
                </span>
                {showRoutes && (
                  <span className="flex items-center gap-1.5">
                    <span className="h-px w-4 border-t-2 border-dashed border-pine-600" />
                    Route
                  </span>
                )}
              </div>
            </div>
          </div>

          <div className="flex items-end justify-between gap-3">
            <div className="pointer-events-auto hidden rounded-2xl border border-border/80 bg-card/95 px-3.5 py-2.5 text-[11px] text-muted-foreground shadow-soft backdrop-blur sm:block">
              Tap a marker to open it. Scroll to zoom; the map clusters dense photo spots.
            </div>
            {markers.data?.truncated && (
              <Badge variant="outline" className="pointer-events-auto bg-card/95">
                Showing first {markers.data.items.length} markers
              </Badge>
            )}
          </div>
        </div>
      </div>

      <Sheet open={Boolean(selected)} onOpenChange={(open) => !open && setSelected(null)}>
        <SheetContent className="max-w-md">
          {selected?.kind === "photo" ? (
            <>
              <SheetHeader>
                <p className="eyebrow">Photo</p>
                <SheetTitle>{selected.title}</SheetTitle>
                <p className="text-xs text-muted-foreground">{selected.subtitle}</p>
              </SheetHeader>
              <SheetBody className="space-y-4">
                {selected.photo_id && (
                  <img
                    src={photoUrl(selected.photo_id, "preview")}
                    alt={selected.title}
                    className="max-h-[52vh] w-full rounded-2xl object-cover"
                  />
                )}
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Coordinates</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Taken</dt>
                    <dd className="mt-0.5 font-medium">{formatDateTime(selected.taken_at)}</dd>
                  </div>
                  <div className="col-span-2">
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Journey</dt>
                    <dd className="mt-0.5 font-medium">{selected.trip_title ?? "Unsorted"}</dd>
                  </div>
                </dl>
              </SheetBody>
              <SheetFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
                <Button
                  onClick={() => {
                    if (selected.photo_id) navigate(`/photos?photo=${selected.photo_id}`);
                  }}
                >
                  Open in gallery
                  <ArrowUpRight className="size-4" />
                </Button>
              </SheetFooter>
            </>
          ) : selected?.kind === "place" ? (
            <>
              <SheetHeader>
                <p className="eyebrow">Place</p>
                <SheetTitle>{selected.title}</SheetTitle>
                <p className="text-xs text-muted-foreground">{selected.subtitle}</p>
              </SheetHeader>
              <SheetBody className="space-y-4">
                <div className="flex size-16 items-center justify-center rounded-2xl bg-pine-100 text-pine-700">
                  {selected.category && (() => {
                    const Icon = PLACE_CATEGORY_ICONS[selected.category];
                    return <Icon className="size-6" />;
                  })()}
                </div>
                <dl className="grid grid-cols-2 gap-3 text-sm">
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Coordinates</dt>
                    <dd className="mt-0.5 font-medium tabular-nums">
                      {selected.latitude.toFixed(4)}, {selected.longitude.toFixed(4)}
                    </dd>
                  </div>
                  <div>
                    <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Type</dt>
                    <dd className="mt-0.5 font-medium capitalize">{selected.category}</dd>
                  </div>
                </dl>
                {selected.trip_id && (
                  <Link
                    to={`/trips/${selected.trip_id}`}
                    className={buttonVariants({ variant: "outline", size: "sm" })}
                  >
                    <Compass className="size-3.5" />
                    Open the trip
                  </Link>
                )}
              </SheetBody>
              <SheetFooter>
                <Button variant="outline" onClick={() => setSelected(null)}>
                  Close
                </Button>
              </SheetFooter>
            </>
          ) : null}
        </SheetContent>
      </Sheet>

      {!markers.isPending && markers.data?.items.length === 0 && (
        <div className="pointer-events-none absolute inset-x-0 bottom-24 z-10 flex justify-center px-4">
          <div className="pointer-events-auto flex items-center gap-2 rounded-2xl border border-border bg-card/95 px-4 py-3 text-xs text-muted-foreground shadow-lift">
            <Layers className="size-4 text-pine-700" />
            No mapped photos or places yet. Import geotagged photos or add places to a trip.
          </div>
        </div>
      )}
    </div>
  );
}
