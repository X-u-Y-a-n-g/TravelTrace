import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Check, Loader2 } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { toast } from "sonner";

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
import { ApiError, api, photoUrl } from "@/lib/api";
import { EVENT_TYPES } from "@/lib/constants";
import { dateInputValue, timeInputValue } from "@/lib/format";
import type {
  EventType,
  PhotoMini,
  TimelineEvent,
  TripPlace,
} from "@/lib/types";
import { cn } from "@/lib/utils";

export function EventDialog({
  open,
  onOpenChange,
  tripId,
  event,
  tripPhotos,
  places,
  defaultDate,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId: string;
  event?: TimelineEvent | null;
  tripPhotos: PhotoMini[];
  places: TripPlace[];
  defaultDate?: string | null;
  onSaved?: () => void;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(event);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [eventType, setEventType] = useState<EventType>("sightseeing");
  const [date, setDate] = useState("");
  const [startTime, setStartTime] = useState("10:00");
  const [endTime, setEndTime] = useState("");
  const [placeId, setPlaceId] = useState("");
  const [photoIds, setPhotoIds] = useState<string[]>([]);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(event?.title ?? "");
    setDescription(event?.description ?? "");
    setEventType(event?.event_type ?? "sightseeing");
    setDate(dateInputValue(event?.day ?? defaultDate) || new Date().toISOString().slice(0, 10));
    setStartTime(timeInputValue(event?.start_time) || "10:00");
    setEndTime(timeInputValue(event?.end_time));
    setPlaceId(event?.place?.id ?? "");
    setPhotoIds(event?.photos.map((photo) => photo.id) ?? []);
    setError(null);
  }, [open, event, defaultDate]);

  const sortedPhotos = useMemo(() => tripPhotos, [tripPhotos]);

  const mutation = useMutation({
    mutationFn: async () => {
      const payload = {
        title: title.trim(),
        description: description.trim() || null,
        event_type: eventType,
        start_time: `${date}T${startTime}:00`,
        end_time: endTime ? `${date}T${endTime}:00` : null,
        place_id: placeId || null,
        photo_ids: photoIds,
      };
      if (event) return api.timeline.updateEvent(tripId, event.id, payload);
      return api.timeline.createEvent(tripId, payload);
    },
    onSuccess: () => {
      toast.success(editing ? "Event updated" : "Event added to the timeline");
      queryClient.invalidateQueries({ queryKey: ["trips", tripId, "timeline"] });
      queryClient.invalidateQueries({ queryKey: ["trips", tripId] });
      onSaved?.();
      onOpenChange(false);
    },
    onError: (mutationError) => {
      setError(mutationError instanceof ApiError ? mutationError.message : "Could not save the event");
    },
  });

  const canSubmit = title.trim().length > 0 && date.length > 0 && startTime.length > 0;

  const submit = (formEvent: React.FormEvent) => {
    formEvent.preventDefault();
    if (!canSubmit || mutation.isPending) return;
    setError(null);
    mutation.mutate();
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit timeline event" : "Add a timeline event"}</DialogTitle>
          <DialogDescription>
            Events group photos into moments. Auto-generated drafts are suggestions — confirm or
            rewrite them freely.
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={submit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="event-title">Title</Label>
            <Input
              id="event-title"
              value={title}
              onChange={(changeEvent) => setTitle(changeEvent.target.value)}
              placeholder="Sunrise at Kiyomizu-dera"
              autoFocus
              maxLength={200}
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-3">
            <div className="space-y-1.5">
              <Label htmlFor="event-date">Day</Label>
              <Input
                id="event-date"
                type="date"
                value={date}
                onChange={(changeEvent) => setDate(changeEvent.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-start">Start</Label>
              <Input
                id="event-start"
                type="time"
                value={startTime}
                onChange={(changeEvent) => setStartTime(changeEvent.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-end">End (optional)</Label>
              <Input
                id="event-end"
                type="time"
                value={endTime}
                onChange={(changeEvent) => setEndTime(changeEvent.target.value)}
              />
            </div>
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="event-type">Type</Label>
              <Select
                id="event-type"
                value={eventType}
                onChange={(changeEvent) => setEventType(changeEvent.target.value as EventType)}
              >
                {EVENT_TYPES.map((option) => (
                  <option key={option.value} value={option.value}>
                    {option.label}
                  </option>
                ))}
              </Select>
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="event-place">Place</Label>
              <Select
                id="event-place"
                value={placeId}
                onChange={(changeEvent) => setPlaceId(changeEvent.target.value)}
              >
                <option value="">No specific place</option>
                {places.map((visit) => (
                  <option key={visit.place.id} value={visit.place.id}>
                    {visit.place.name}
                  </option>
                ))}
              </Select>
            </div>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="event-description">Notes</Label>
            <Textarea
              id="event-description"
              value={description}
              onChange={(changeEvent) => setDescription(changeEvent.target.value)}
              placeholder="What happened here?"
              rows={2}
              maxLength={5000}
            />
          </div>

          {sortedPhotos.length > 0 && (
            <div className="space-y-2">
              <div className="flex items-center justify-between">
                <Label>Photos in this event</Label>
                <span className="text-[11px] text-muted-foreground">{photoIds.length} selected</span>
              </div>
              <div className="grid max-h-44 grid-cols-6 gap-1.5 overflow-y-auto rounded-xl bg-secondary/40 p-2 sm:grid-cols-8">
                {sortedPhotos.map((photo) => {
                  const selected = photoIds.includes(photo.id);
                  return (
                    <button
                      key={photo.id}
                      type="button"
                      onClick={() =>
                        setPhotoIds((current) =>
                          current.includes(photo.id)
                            ? current.filter((id) => id !== photo.id)
                            : [...current, photo.id],
                        )
                      }
                      className={cn(
                        "relative aspect-square overflow-hidden rounded-lg ring-2 transition-all",
                        selected ? "ring-primary" : "ring-transparent opacity-70 hover:opacity-100",
                      )}
                      aria-pressed={selected}
                    >
                      <img
                        src={photoUrl(photo.id, "thumb")}
                        alt=""
                        loading="lazy"
                        className="size-full object-cover"
                      />
                      {selected && (
                        <span className="absolute right-0.5 top-0.5 rounded-full bg-primary p-0.5 text-primary-foreground">
                          <Check className="size-2.5" />
                        </span>
                      )}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save event" : "Add event"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
