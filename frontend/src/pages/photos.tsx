import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  CheckSquare,
  Images,
  Search,
  Star,
  Upload,
  X,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ErrorState } from "@/components/common/error-state";
import { PhotoDetailSheet } from "@/components/photo/photo-detail-sheet";
import { PhotoThumb } from "@/components/photo/photo-thumb";
import { UploadDialog } from "@/components/photo/upload-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { ApiError, api } from "@/lib/api";
import { PHOTO_SORT_OPTIONS } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { usePhotos, useStats, useTrips } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function PhotosPage() {
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stats = useStats();
  const trips = useTrips({ size: 100, sort: "start_date_desc" });

  const photoParam = searchParams.get("photo");
  const [detailOpen, setDetailOpen] = useState(Boolean(photoParam));
  const [uploadOpen, setUploadOpen] = useState(false);

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [tripFilter, setTripFilter] = useState("");
  const [gpsFilter, setGpsFilter] = useState("all");
  const [favoritesOnly, setFavoritesOnly] = useState(false);
  const [sort, setSort] = useState("taken_at_desc");
  const [page, setPage] = useState(1);

  const [selecting, setSelecting] = useState(false);
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkTrip, setBulkTrip] = useState("");

  useEffect(() => {
    if (photoParam) setDetailOpen(true);
  }, [photoParam]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, tripFilter, gpsFilter, favoritesOnly, sort]);

  const openPhoto = (photoId: string) => {
    const next = new URLSearchParams(searchParams);
    next.set("photo", photoId);
    setSearchParams(next, { replace: true });
    setDetailOpen(true);
  };

  const closeDetail = (open: boolean) => {
    setDetailOpen(open);
    if (!open) {
      const next = new URLSearchParams(searchParams);
      next.delete("photo");
      setSearchParams(next, { replace: true });
    }
  };

  const photos = usePhotos({
    page,
    size: 36,
    q: debouncedSearch || undefined,
    trip_id: tripFilter && tripFilter !== "unsorted" ? tripFilter : undefined,
    unsorted: tripFilter === "unsorted",
    has_gps: gpsFilter === "gps" ? true : gpsFilter === "nogps" ? false : undefined,
    favorite: favoritesOnly || undefined,
    sort,
  });

  const bulkAssign = useMutation({
    mutationFn: () =>
      api.photos.bulk({
        photo_ids: Array.from(selectedIds),
        trip_id: bulkTrip,
      }),
    onSuccess: (result) => {
      toast.success(`${result.updated} photo${result.updated === 1 ? "" : "s"} assigned`, {
        description: "They now appear in the trip and its map.",
      });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["map"] });
      setSelectedIds(new Set());
      setSelecting(false);
      setBulkTrip("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not assign photos");
    },
  });

  const toggleSelection = (photoId: string) => {
    setSelectedIds((current) => {
      const next = new Set(current);
      if (next.has(photoId)) next.delete(photoId);
      else next.add(photoId);
      return next;
    });
  };

  const startSelecting = () => {
    setSelecting(true);
    setSelectedIds(new Set());
  };

  const stopSelecting = () => {
    setSelecting(false);
    setSelectedIds(new Set());
    setBulkTrip("");
  };

  const isFiltered = Boolean(
    debouncedSearch || tripFilter || gpsFilter !== "all" || favoritesOnly,
  );

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow="Library"
        title="Every frame, in one place"
        description="Browse the original library. Fix a location, add a caption, or move photos into the right journey."
        actions={
          <>
            {photos.data?.items.length ? (
              <Button
                variant="outline"
                onClick={selecting ? stopSelecting : startSelecting}
              >
                {selecting ? <X className="size-4" /> : <CheckSquare className="size-4" />}
                {selecting ? "Cancel selection" : "Select"}
              </Button>
            ) : null}
            <Button variant="accent" onClick={() => setUploadOpen(true)}>
              <Upload className="size-4" />
              Upload photos
            </Button>
          </>
        }
      />

      <div className="mb-5 flex flex-col gap-3">
        <div className="flex flex-col gap-2 sm:flex-row">
          <div className="relative flex-1">
            <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
            <Input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search captions, filenames or camera…"
              className="pl-10"
              aria-label="Search photos"
            />
          </div>
          <div className="grid grid-cols-2 gap-2 sm:flex">
            <Select
              value={tripFilter}
              onChange={(event) => setTripFilter(event.target.value)}
              aria-label="Filter by trip"
              className="sm:w-[190px]"
            >
              <option value="">All trips</option>
              <option value="unsorted">Unsorted only</option>
              {trips.data?.items.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </Select>
            <Select
              value={gpsFilter}
              onChange={(event) => setGpsFilter(event.target.value)}
              aria-label="Filter by GPS"
              className="sm:w-[150px]"
            >
              <option value="all">Any location</option>
              <option value="gps">With GPS</option>
              <option value="nogps">Without GPS</option>
            </Select>
            <Select
              value={sort}
              onChange={(event) => setSort(event.target.value)}
              aria-label="Sort photos"
              className="sm:w-[165px]"
            >
              {PHOTO_SORT_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <Button
              variant={favoritesOnly ? "default" : "outline"}
              onClick={() => setFavoritesOnly((current) => !current)}
              aria-pressed={favoritesOnly}
            >
              <Star className="size-4" fill={favoritesOnly ? "currentColor" : "none"} />
              Favourites
            </Button>
          </div>
        </div>
        <div className="flex flex-wrap items-center gap-2 text-xs text-muted-foreground">
          <span>
            {photos.data ? `${photos.data.total} photo${photos.data.total === 1 ? "" : "s"}` : "Loading…"}
          </span>
          <span>·</span>
          <span>{stats.data?.gps_photos ?? 0} geotagged</span>
          <span>·</span>
          <span>{stats.data?.favorite_photos ?? 0} favourites</span>
          {isFiltered && (
            <Button
              variant="ghost"
              size="sm"
              className="ml-auto h-7"
              onClick={() => {
                setSearch("");
                setTripFilter("");
                setGpsFilter("all");
                setFavoritesOnly(false);
              }}
            >
              Clear filters
            </Button>
          )}
        </div>
      </div>

      {photos.isPending ? (
        <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
          {[0, 1, 2, 3, 4, 5, 6, 7].map((index) => (
            <Skeleton
              key={index}
              className="mb-3 w-full break-inside-avoid rounded-2xl"
              style={{ height: 140 + ((index * 53) % 120) }}
            />
          ))}
        </div>
      ) : photos.isError ? (
        <ErrorState onRetry={() => photos.refetch()} />
      ) : photos.data && photos.data.items.length > 0 ? (
        <>
          <div className="columns-2 gap-3 sm:columns-3 xl:columns-4">
            {photos.data.items.map((photo) => {
              const ratio =
                photo.width && photo.height
                  ? Math.min(Math.max(photo.width / photo.height, 0.72), 1.65)
                  : 1;
              const isSelected = selectedIds.has(photo.id);
              return (
                <div
                  key={photo.id}
                  className="group relative mb-3 break-inside-avoid overflow-hidden rounded-2xl bg-sand-200"
                  style={{ aspectRatio: ratio }}
                >
                  <PhotoThumb
                    photo={photo}
                    showSelection={selecting}
                    selected={isSelected}
                    className={cn(
                      "absolute inset-0 size-full transition-transform duration-500",
                      isSelected && "ring-2 ring-inset ring-primary",
                    )}
                    onClick={() => {
                      if (selecting) toggleSelection(photo.id);
                      else openPhoto(photo.id);
                    }}
                  />
                  <div className="pointer-events-none absolute inset-x-0 bottom-0 flex items-end justify-between gap-2 bg-gradient-to-t from-pine-950/70 via-pine-950/10 to-transparent p-3 opacity-0 transition-opacity duration-300 group-hover:opacity-100">
                    <span className="truncate text-[10px] font-medium text-white/90">
                      {photo.taken_at ? photo.taken_at.slice(0, 10) : "No date"}
                      {photo.place ? ` · ${photo.place.name}` : ""}
                    </span>
                    {photo.is_favorite && <Star className="size-3.5 shrink-0 text-amber-300" fill="currentColor" />}
                  </div>
                  {!selecting && photo.is_favorite && (
                    <span className="pointer-events-none absolute right-2.5 top-2.5 rounded-full bg-black/30 p-1 text-amber-300 backdrop-blur group-hover:opacity-0">
                      <Star className="size-3" fill="currentColor" />
                    </span>
                  )}
                </div>
              );
            })}
          </div>

          {photos.data.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                Previous
              </Button>
              <span className="text-xs text-muted-foreground">
                Page {photos.data.page} of {photos.data.pages}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= photos.data.pages}
                onClick={() => setPage((current) => current + 1)}
              >
                Next
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={isFiltered ? Search : Images}
          title={isFiltered ? "No photos match this filter" : "Your library is waiting"}
          description={
            isFiltered
              ? "Try another trip, location or search term."
              : "Upload the photos from your trip. EXIF time and GPS will rebuild the map and timeline."
          }
          action={
            isFiltered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setTripFilter("");
                  setGpsFilter("all");
                  setFavoritesOnly(false);
                }}
              >
                Clear filters
              </Button>
            ) : (
              <Button variant="accent" onClick={() => setUploadOpen(true)}>
                <Upload className="size-4" />
                Import your first photos
              </Button>
            )
          }
        />
      )}

      {selecting && (
        <div className="fixed inset-x-0 bottom-20 z-30 flex justify-center px-3 lg:bottom-6">
          <div className="flex w-full max-w-2xl flex-col gap-2 rounded-2xl border border-border bg-card/95 p-2.5 shadow-lift backdrop-blur sm:flex-row sm:items-center">
            <Badge variant="default" className="w-fit">
              {selectedIds.size} selected
            </Badge>
            <span className="flex-1 text-xs text-muted-foreground">
              Move the selection into a journey.
            </span>
            <Select
              value={bulkTrip}
              onChange={(event) => setBulkTrip(event.target.value)}
              aria-label="Assign to trip"
              className="h-9 w-full sm:w-[190px]"
            >
              <option value="">Choose a trip…</option>
              {trips.data?.items.map((trip) => (
                <option key={trip.id} value={trip.id}>
                  {trip.title}
                </option>
              ))}
            </Select>
            <Button
              size="sm"
              disabled={!selectedIds.size || !bulkTrip || bulkAssign.isPending}
              onClick={() => bulkAssign.mutate()}
            >
              Assign
            </Button>
            <Button variant="ghost" size="sm" onClick={stopSelecting}>
              Cancel
            </Button>
          </div>
        </div>
      )}

      <UploadDialog open={uploadOpen} onOpenChange={setUploadOpen} />
      <PhotoDetailSheet
        photoId={photoParam}
        open={detailOpen}
        onOpenChange={closeDetail}
        onChanged={() => photos.refetch()}
      />
    </div>
  );
}
