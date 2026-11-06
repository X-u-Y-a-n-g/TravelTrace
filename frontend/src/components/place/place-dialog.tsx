import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2, MapPin, Plus, Search, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { Textarea } from "@/components/ui/textarea";
import { ApiError, api } from "@/lib/api";
import { PLACE_CATEGORIES, PLACE_CATEGORY_COLORS } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { useInstanceSettings, usePlaces } from "@/lib/queries";
import type { Place, PlaceCategory } from "@/lib/types";
import { cn } from "@/lib/utils";

type Mode = "existing" | "new";

export function PlaceDialog({
  open,
  onOpenChange,
  tripId,
  attachedPlaceIds,
  onDone,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  attachedPlaceIds: string[];
  onDone?: () => void;
}) {
  const queryClient = useQueryClient();
  const settings = useInstanceSettings();
  const [mode, setMode] = useState<Mode>("existing");
  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 250);
  const [selectedPlaceId, setSelectedPlaceId] = useState("");
  const places = usePlaces({ size: 40, q: debouncedSearch || undefined });
  const [name, setName] = useState("");
  const [category, setCategory] = useState<PlaceCategory>("attraction");
  const [city, setCity] = useState("");
  const [country, setCountry] = useState("");
  const [countryCode, setCountryCode] = useState("");
  const [address, setAddress] = useState("");
  const [latitude, setLatitude] = useState("");
  const [longitude, setLongitude] = useState("");
  const [notes, setNotes] = useState("");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setMode("existing");
    setSearch("");
    setSelectedPlaceId("");
    setName("");
    setCategory("attraction");
    setCity("");
    setCountry("");
    setCountryCode("");
    setAddress("");
    setLatitude("");
    setLongitude("");
    setNotes("");
    setError(null);
  }, [open]);

  const geocode = useMutation({
    mutationFn: () =>
      api.places.geocode({ latitude: Number(latitude), longitude: Number(longitude) }),
    onSuccess: (result) => {
      if (!name.trim() && (result.name || result.display_name)) {
        setName(result.name ?? result.display_name?.split(",")[0] ?? "");
      }
      setCity(result.city ?? city);
      setCountry(result.country ?? country);
      setCountryCode(result.country_code ?? countryCode);
      setAddress(result.display_name ?? address);
      toast.success("Address found");
    },
    onError: (mutationError) => {
      toast.error(
        mutationError instanceof ApiError ? mutationError.message : "The address lookup failed",
      );
    },
  });

  const attach = useMutation({
    mutationFn: async () => {
      if (mode === "existing") {
        if (!selectedPlaceId) throw new Error("Choose a place first");
        return api.trips.attachPlace(tripId, { place_id: selectedPlaceId });
      }
      const hasCoordinates = latitude.trim() !== "" && longitude.trim() !== "";
      if (latitude.trim() !== "" || longitude.trim() !== "") {
        if (!hasCoordinates) throw new Error("Latitude and longitude must be filled together");
      }
      const place = await api.places.create({
        name: name.trim(),
        category,
        city: city.trim() || null,
        country: country.trim() || null,
        country_code: countryCode.trim() ? countryCode.trim().toUpperCase() : null,
        address: address.trim() || null,
        latitude: hasCoordinates ? Number(latitude) : null,
        longitude: hasCoordinates ? Number(longitude) : null,
        notes: notes.trim() || null,
      });
      return api.trips.attachPlace(tripId, { place_id: place.id });
    },
    onSuccess: () => {
      toast.success("Place added to the trip");
      queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["places"] });
      queryClient.invalidateQueries({ queryKey: ["map"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onDone?.();
      onOpenChange(false);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError ? mutationError.message : "Could not add the place",
      );
    },
  });

  const canSubmit =
    mode === "existing" ? Boolean(selectedPlaceId) : name.trim().length > 0;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>Add a place</DialogTitle>
          <DialogDescription>
            Places can be reused across trips. Add a visit to keep this journey's map complete.
          </DialogDescription>
        </DialogHeader>

        <div className="mb-4 grid grid-cols-2 gap-1 rounded-full border border-border/80 bg-card/60 p-1">
          {(["existing", "new"] as const).map((value) => (
            <button
              key={value}
              type="button"
              onClick={() => {
                setMode(value);
                setError(null);
              }}
              className={cn(
                "rounded-full py-1.5 text-sm font-medium transition-all",
                mode === value
                  ? "bg-primary text-primary-foreground shadow-sm"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              {value === "existing" ? "From my places" : "Create new"}
            </button>
          ))}
        </div>

        {mode === "existing" ? (
          <div className="space-y-3">
            <div className="relative">
              <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                value={search}
                onChange={(event) => setSearch(event.target.value)}
                placeholder="Search saved places…"
                className="pl-10"
              />
            </div>
            <div className="max-h-72 space-y-1.5 overflow-y-auto pr-1">
              {places.isPending ? (
                <p className="py-6 text-center text-sm text-muted-foreground">Loading places…</p>
              ) : places.data?.items.length ? (
                places.data.items.map((place) => (
                  <ExistingPlaceRow
                    key={place.id}
                    place={place}
                    selected={selectedPlaceId === place.id}
                    attached={attachedPlaceIds.includes(place.id)}
                    onSelect={() => setSelectedPlaceId(place.id)}
                  />
                ))
              ) : (
                <div className="py-8 text-center">
                  <p className="text-sm text-muted-foreground">No saved places yet.</p>
                  <Button variant="outline" size="sm" className="mt-3" onClick={() => setMode("new")}>
                    <Plus className="size-3.5" />
                    Create the first one
                  </Button>
                </div>
              )}
            </div>
          </div>
        ) : (
          <div className="space-y-4">
            <div className="space-y-1.5">
              <Label htmlFor="place-name">Name</Label>
              <Input
                id="place-name"
                value={name}
                onChange={(event) => setName(event.target.value)}
                placeholder="Kiyomizu-dera"
                autoFocus
                maxLength={255}
              />
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="place-category">Category</Label>
                <Select
                  id="place-category"
                  value={category}
                  onChange={(event) => setCategory(event.target.value as PlaceCategory)}
                >
                  {PLACE_CATEGORIES.map((option) => (
                    <option key={option.value} value={option.value}>
                      {option.label}
                    </option>
                  ))}
                </Select>
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place-city">City</Label>
                <Input
                  id="place-city"
                  value={city}
                  onChange={(event) => setCity(event.target.value)}
                  placeholder="Kyoto"
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="place-country">Country</Label>
                <Input
                  id="place-country"
                  value={country}
                  onChange={(event) => setCountry(event.target.value)}
                  placeholder="Japan"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place-country-code">Country code</Label>
                <Input
                  id="place-country-code"
                  value={countryCode}
                  onChange={(event) => setCountryCode(event.target.value)}
                  placeholder="JP"
                  maxLength={2}
                />
              </div>
            </div>
            <div className="grid gap-4 sm:grid-cols-2">
              <div className="space-y-1.5">
                <Label htmlFor="place-latitude">Latitude</Label>
                <Input
                  id="place-latitude"
                  value={latitude}
                  onChange={(event) => setLatitude(event.target.value)}
                  placeholder="34.994856"
                  inputMode="decimal"
                />
              </div>
              <div className="space-y-1.5">
                <Label htmlFor="place-longitude">Longitude</Label>
                <Input
                  id="place-longitude"
                  value={longitude}
                  onChange={(event) => setLongitude(event.target.value)}
                  placeholder="135.785046"
                  inputMode="decimal"
                />
              </div>
            </div>
            {settings.data?.geocoding_enabled && (
              <Button
                variant="outline"
                size="sm"
                disabled={!latitude || !longitude || geocode.isPending}
                onClick={() => geocode.mutate()}
              >
                {geocode.isPending ? <Loader2 className="size-3.5 animate-spin" /> : <Sparkles className="size-3.5" />}
                Look up the address
              </Button>
            )}
            <div className="space-y-1.5">
              <Label htmlFor="place-address">Address</Label>
              <Input
                id="place-address"
                value={address}
                onChange={(event) => setAddress(event.target.value)}
                placeholder="1-294 Kiyomizu, Higashiyama Ward, Kyoto"
                maxLength={500}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="place-notes">Notes</Label>
              <Textarea
                id="place-notes"
                value={notes}
                onChange={(event) => setNotes(event.target.value)}
                placeholder="Why this place matters…"
                rows={2}
                maxLength={2000}
              />
            </div>
          </div>
        )}

        {error && (
          <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
            {error}
          </div>
        )}

        <DialogFooter>
          <Button variant="outline" onClick={() => onOpenChange(false)} disabled={attach.isPending}>
            Cancel
          </Button>
          <Button onClick={() => attach.mutate()} disabled={!canSubmit || attach.isPending}>
            {attach.isPending ? <Loader2 className="size-4 animate-spin" /> : <MapPin className="size-4" />}
            Add to trip
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}

function ExistingPlaceRow({
  place,
  selected,
  attached,
  onSelect,
}: {
  place: Place;
  selected: boolean;
  attached: boolean;
  onSelect: () => void;
}) {
  return (
    <button
      type="button"
      onClick={attached ? undefined : onSelect}
      disabled={attached}
      className={cn(
        "flex w-full items-center gap-3 rounded-xl border px-3 py-2.5 text-left transition-colors",
        selected
          ? "border-pine-400 bg-pine-50"
          : "border-border/70 bg-card/50 hover:border-pine-200 hover:bg-card",
        attached && "cursor-not-allowed opacity-50",
      )}
    >
      <span className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-secondary text-xs font-semibold uppercase">
        {place.name.slice(0, 1)}
      </span>
      <span className="min-w-0 flex-1">
        <span className="block truncate text-sm font-medium">{place.name}</span>
        <span className="block truncate text-[11px] text-muted-foreground">
          {[place.city, place.country].filter(Boolean).join(", ") || "No location details"}
        </span>
      </span>
      <span className="flex shrink-0 items-center gap-1.5">
        <Badge className={cn("capitalize", PLACE_CATEGORY_COLORS[place.category])} variant="outline">
          {place.category}
        </Badge>
        {attached && <span className="text-[10px] text-muted-foreground">Added</span>}
      </span>
    </button>
  );
}
