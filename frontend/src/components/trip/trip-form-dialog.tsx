import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Loader2 } from "lucide-react";
import { useEffect, useState } from "react";
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
import { ApiError, api, type TripInput } from "@/lib/api";
import { VISIBILITY_OPTIONS } from "@/lib/constants";
import { dateInputValue } from "@/lib/format";
import type { Trip, Visibility } from "@/lib/types";

export function TripFormDialog({
  open,
  onOpenChange,
  trip,
  onSaved,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  trip?: Trip | null;
  onSaved?: (trip: Trip) => void;
}) {
  const queryClient = useQueryClient();
  const editing = Boolean(trip);
  const [title, setTitle] = useState("");
  const [description, setDescription] = useState("");
  const [startDate, setStartDate] = useState("");
  const [endDate, setEndDate] = useState("");
  const [visibility, setVisibility] = useState<Visibility>("private");
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setTitle(trip?.title ?? "");
    setDescription(trip?.description ?? "");
    setStartDate(dateInputValue(trip?.start_date));
    setEndDate(dateInputValue(trip?.end_date));
    setVisibility(trip?.visibility ?? "private");
    setError(null);
  }, [open, trip]);

  const mutation = useMutation({
    mutationFn: (payload: TripInput) =>
      editing && trip ? api.trips.update(trip.id, payload) : api.trips.create(payload),
    onSuccess: (saved) => {
      toast.success(editing ? "Trip updated" : "Trip created", {
        description: editing ? undefined : "Add photos to start rebuilding this journey.",
      });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError ? mutationError.message : "Could not save the trip",
      );
    },
  });

  const datesInvalid = Boolean(startDate && endDate && endDate < startDate);
  const canSubmit = title.trim().length > 0 && !datesInvalid && !mutation.isPending;

  const handleSubmit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit) return;
    setError(null);
    mutation.mutate({
      title: title.trim(),
      description: description.trim() || null,
      start_date: startDate || null,
      end_date: endDate || null,
      visibility,
    });
  };

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-xl">
        <DialogHeader>
          <DialogTitle>{editing ? "Edit trip" : "Start a new journey"}</DialogTitle>
          <DialogDescription>
            {editing
              ? "Update the details of this journey. Photos and timeline stay untouched."
              : "Give this journey a name. You can add photos, places and a timeline next."}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="trip-title">Title</Label>
            <Input
              id="trip-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder="Japan in autumn"
              autoFocus
              maxLength={160}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="trip-start">Start date</Label>
              <Input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-end">End date</Label>
              <Input
                id="trip-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          {datesInvalid && (
            <p className="text-xs text-destructive">The end date must be after the start date.</p>
          )}

          <div className="space-y-1.5">
            <Label htmlFor="trip-visibility">Visibility</Label>
            <Select
              id="trip-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as Visibility)}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {option.label}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              {VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.hint}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-description">Description</Label>
            <Textarea
              id="trip-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder="A few words about this journey…"
              rows={3}
              maxLength={20000}
            />
          </div>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
              {error}
            </div>
          )}

          <DialogFooter>
            <Button variant="outline" onClick={() => onOpenChange(false)} disabled={mutation.isPending}>
              Cancel
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? "Save changes" : "Create trip"}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
