import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Camera,
  CalendarDays,
  HardDrive,
  Loader2,
  MapPin,
  Save,
  Star,
  Trash2,
} from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { LocationPicker } from "@/components/map/location-picker";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Sheet, SheetBody, SheetContent, SheetFooter, SheetHeader, SheetTitle } from "@/components/ui/sheet";
import { Skeleton } from "@/components/ui/skeleton";
import { Textarea } from "@/components/ui/textarea";
import { useI18n } from "@/i18n";
import { api, photoUrl, type PhotoUpdateInput } from "@/lib/api";
import { dateInputValue, formatBytes, timeInputValue } from "@/lib/format";
import { usePhoto, usePlaces, useTrips } from "@/lib/queries";
import { cn } from "@/lib/utils";

export function PhotoDetailSheet({
  photoId,
  open,
  onOpenChange,
  onChanged,
}: {
  photoId: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  onChanged?: () => void;
}) {
  const { t, f, errorText } = useI18n();
  const queryClient = useQueryClient();
  const photoQuery = usePhoto(photoId);
  const trips = useTrips({ size: 100, sort: "start_date_desc" });
  const places = usePlaces({ size: 100 });
  const [caption, setCaption] = useState("");
  const [tripId, setTripId] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [date, setDate] = useState("");
  const [time, setTime] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [pickerOpen, setPickerOpen] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState(false);

  const photo = photoQuery.data;

  useEffect(() => {
    if (!photo) return;
    setCaption(photo.caption ?? "");
    setTripId(photo.trip_id ?? "");
    setPlaceId(photo.place_id ?? "");
    setDate(dateInputValue(photo.taken_at));
    setTime(timeInputValue(photo.taken_at));
    setLatitude(photo.latitude !== null ? String(photo.latitude) : "");
    setLongitude(photo.longitude !== null ? String(photo.longitude) : "");
    setPickerOpen(false);
    setError(null);
  }, [photo]);

  const tripPlaces = places.data?.items ?? [];

  const invalidate = () => {
    queryClient.invalidateQueries({ queryKey: ["photos"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["map"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
    onChanged?.();
  };

  const update = useMutation({
    mutationFn: (payload: PhotoUpdateInput) => api.photos.update(photoId as string, payload),
    onSuccess: (updated) => {
      queryClient.setQueryData(["photos", "detail", photoId], updated);
      toast.success(t("photo.updated"));
      invalidate();
    },
    onError: (mutationError) => {
      setError(errorText(mutationError) || t("photo.saveError"));
    },
  });

  const remove = useMutation({
    mutationFn: () => api.photos.remove(photoId as string),
    onSuccess: () => {
      toast.success(t("photo.removed"));
      invalidate();
      setConfirmDelete(false);
      onOpenChange(false);
    },
    onError: (mutationError) => {
      toast.error(errorText(mutationError) || t("photo.deleteError"));
    },
  });

  const save = () => {
    setError(null);
    const hasLatitude = latitude.trim() !== "";
    const hasLongitude = longitude.trim() !== "";
    if (hasLatitude !== hasLongitude) {
      setError(t("photo.coordinatesTogether"));
      return;
    }
    let coordinates: { latitude: number | null; longitude: number | null } = {
      latitude: null,
      longitude: null,
    };
    if (hasLatitude && hasLongitude) {
      const lat = Number(latitude);
      const lon = Number(longitude);
      if (Number.isNaN(lat) || Number.isNaN(lon) || Math.abs(lat) > 90 || Math.abs(lon) > 180) {
        setError(t("photo.coordinatesRange"));
        return;
      }
      coordinates = { latitude: lat, longitude: lon };
    }

    let takenAt: string | null = null;
    if (date) {
      takenAt = time ? `${date}T${time}:00` : `${date}T00:00:00`;
    }

    update.mutate({
      caption: caption.trim() || null,
      trip_id: tripId || null,
      place_id: placeId || null,
      taken_at: takenAt,
      latitude: coordinates.latitude,
      longitude: coordinates.longitude,
    });
  };

  const toggleFavorite = () => {
    if (!photo) return;
    update.mutate({ is_favorite: !photo.is_favorite });
  };

  return (
    <>
      <Sheet open={open} onOpenChange={onOpenChange}>
        <SheetContent className="max-w-2xl">
          {photoQuery.isPending || !photo ? (
            <div className="space-y-4 p-6">
              <Skeleton className="h-6 w-40" />
              <Skeleton className="h-72 w-full rounded-2xl" />
              <Skeleton className="h-40 w-full" />
            </div>
          ) : (
            <>
              <SheetHeader>
                <div className="flex items-start justify-between gap-4">
                  <div className="min-w-0">
                    <p className="eyebrow">{t("common.photo")}</p>
                    <SheetTitle className="truncate">{photo.original_filename}</SheetTitle>
                    <p className="mt-0.5 text-xs text-muted-foreground">
                      {f.dateTime(photo.taken_at)} · {photo.original_filename}
                    </p>
                  </div>
                  <button
                    type="button"
                    onClick={toggleFavorite}
                    className={cn(
                      "mt-1 rounded-full p-2 transition-colors",
                      photo.is_favorite
                        ? "bg-ember-100 text-ember-600"
                        : "text-muted-foreground hover:bg-secondary",
                    )}
                    aria-label={photo.is_favorite ? t("photo.favoriteRemove") : t("photo.favoriteAdd")}
                  >
                    <Star
                      className="size-5"
                      fill={photo.is_favorite ? "currentColor" : "none"}
                    />
                  </button>
                </div>
              </SheetHeader>

              <SheetBody className="space-y-5">
                <div className="overflow-hidden rounded-2xl bg-sand-200">
                  <img
                    src={photoUrl(photo.id, "preview")}
                    alt={photo.caption ?? photo.original_filename}
                    className="max-h-[46vh] w-full object-contain"
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="photo-trip">{t("photo.trip")}</Label>
                    <Select
                      id="photo-trip"
                      value={tripId}
                      onChange={(event) => setTripId(event.target.value)}
                    >
                      <option value="">{t("photo.noTrip")}</option>
                      {trips.data?.items.map((trip) => (
                        <option key={trip.id} value={trip.id}>
                          {trip.title}
                        </option>
                      ))}
                    </Select>
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="photo-place">{t("photo.place")}</Label>
                    <Select
                      id="photo-place"
                      value={placeId}
                      onChange={(event) => setPlaceId(event.target.value)}
                    >
                      <option value="">{t("photo.noPlace")}</option>
                      {tripPlaces.map((place) => (
                        <option key={place.id} value={place.id}>
                          {place.name}
                          {place.city ? ` · ${place.city}` : ""}
                        </option>
                      ))}
                    </Select>
                  </div>
                </div>

                <div className="space-y-1.5">
                  <Label htmlFor="photo-caption">{t("photo.caption")}</Label>
                  <Textarea
                    id="photo-caption"
                    value={caption}
                    onChange={(event) => setCaption(event.target.value)}
                    placeholder={t("photo.captionPlaceholder")}
                    rows={3}
                    maxLength={2000}
                  />
                </div>

                <div className="grid gap-4 sm:grid-cols-2">
                  <div className="space-y-1.5">
                    <Label htmlFor="photo-date">{t("photo.dateTaken")}</Label>
                    <Input
                      id="photo-date"
                      type="date"
                      value={date}
                      onChange={(event) => setDate(event.target.value)}
                    />
                  </div>
                  <div className="space-y-1.5">
                    <Label htmlFor="photo-time">{t("photo.timeTaken")}</Label>
                    <Input
                      id="photo-time"
                      type="time"
                      value={time}
                      onChange={(event) => setTime(event.target.value)}
                    />
                  </div>
                </div>

                <div className="space-y-2.5">
                  <div className="flex items-center justify-between">
                    <Label>{t("photo.location")}</Label>
                    <Button
                      variant="ghost"
                      size="sm"
                      onClick={() => setPickerOpen((current) => !current)}
                    >
                      <MapPin className="size-3.5" />
                      {pickerOpen ? t("photo.hideMap") : t("photo.pickOnMap")}
                    </Button>
                  </div>
                  <div className="grid gap-3 sm:grid-cols-2">
                    <Input
                      value={latitude}
                      onChange={(event) => setLatitude(event.target.value)}
                      placeholder={t("photo.latitude")}
                      inputMode="decimal"
                      aria-label={t("photo.latitude")}
                    />
                    <Input
                      value={longitude}
                      onChange={(event) => setLongitude(event.target.value)}
                      placeholder={t("photo.longitude")}
                      inputMode="decimal"
                      aria-label={t("photo.longitude")}
                    />
                  </div>
                  <div className="flex items-center gap-2 text-[11px] text-muted-foreground">
                    <Badge variant={photo.has_gps ? "default" : "muted"} className="text-[10px]">
                      {photo.gps_source === "exif"
                        ? t("photo.gpsFromCamera")
                        : photo.gps_source === "manual"
                          ? t("photo.gpsManual")
                          : t("photo.gpsNone")}
                    </Badge>
                    <span>{t("photo.gpsNote")}</span>
                  </div>
                  {pickerOpen && (
                    <LocationPicker
                      latitude={latitude.trim() ? Number(latitude) : null}
                      longitude={longitude.trim() ? Number(longitude) : null}
                      onChange={(lat, lon) => {
                        setLatitude(String(lat));
                        setLongitude(String(lon));
                      }}
                    />
                  )}
                </div>

                <div className="grid gap-3 rounded-2xl bg-secondary/50 p-4 text-xs sm:grid-cols-2">
                  <div className="flex items-center gap-2">
                    <Camera className="size-3.5 text-muted-foreground" />
                    <span>
                      {[photo.camera_make, photo.camera_model].filter(Boolean).join(" ") ||
                        t("photo.cameraUnknown")}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <HardDrive className="size-3.5 text-muted-foreground" />
                    <span>
                      {photo.width && photo.height ? `${photo.width} × ${photo.height}` : t("photo.dimensionsUnknown")}{" "}
                      · {formatBytes(photo.file_size)}
                    </span>
                  </div>
                  <div className="flex items-center gap-2">
                    <CalendarDays className="size-3.5 text-muted-foreground" />
                    <span>{t("photo.added", { date: f.dateTime(photo.created_at) })}</span>
                  </div>
                  <a
                    href={photoUrl(photo.id, "original")}
                    target="_blank"
                    rel="noreferrer"
                    className="flex items-center gap-2 text-primary hover:underline"
                  >
                    <MapPin className="size-3.5" />
                    {t("photo.openOriginal")}
                  </a>
                </div>

                {error && (
                  <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                    {error}
                  </div>
                )}
              </SheetBody>

              <SheetFooter>
                <Button
                  variant="ghost"
                  className="mr-auto text-destructive hover:bg-red-50"
                  onClick={() => setConfirmDelete(true)}
                >
                  <Trash2 className="size-4" />
                  {t("photo.delete")}
                </Button>
                <Button variant="outline" onClick={() => onOpenChange(false)}>
                  {t("photo.close")}
                </Button>
                <Button onClick={save} disabled={update.isPending}>
                  {update.isPending ? <Loader2 className="size-4 animate-spin" /> : <Save className="size-4" />}
                  {t("photo.save")}
                </Button>
              </SheetFooter>
            </>
          )}
        </SheetContent>
      </Sheet>

      <ConfirmDialog
        open={confirmDelete}
        onOpenChange={setConfirmDelete}
        title={t("photo.deleteTitle")}
        description={t("photo.deleteDescription")}
        confirmLabel={t("photo.deleteConfirm")}
        cancelLabel={t("common.cancel")}
        loading={remove.isPending}
        onConfirm={() => remove.mutate()}
      />
    </>
  );
}
