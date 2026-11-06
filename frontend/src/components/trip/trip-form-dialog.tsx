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
import { useI18n } from "@/i18n";
import { api, type TripInput } from "@/lib/api";
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
  const { t, errorText } = useI18n();
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
      toast.success(
        editing ? t("tripForm.updatedToast") : t("tripForm.createdToast"),
        editing ? undefined : { description: t("tripForm.createdToastDescription") },
      );
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      onSaved?.(saved);
      onOpenChange(false);
    },
    onError: (mutationError) => {
      setError(errorText(mutationError) || t("tripForm.saveError"));
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
          <DialogTitle>
            {editing ? t("tripForm.editTitle") : t("tripForm.createTitle")}
          </DialogTitle>
          <DialogDescription>
            {editing ? t("tripForm.editDescription") : t("tripForm.createDescription")}
          </DialogDescription>
        </DialogHeader>

        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-1.5">
            <Label htmlFor="trip-title">{t("tripForm.title")}</Label>
            <Input
              id="trip-title"
              value={title}
              onChange={(event) => setTitle(event.target.value)}
              placeholder={t("tripForm.titlePlaceholder")}
              autoFocus
              maxLength={160}
              required
            />
          </div>

          <div className="grid gap-4 sm:grid-cols-2">
            <div className="space-y-1.5">
              <Label htmlFor="trip-start">{t("tripForm.startDate")}</Label>
              <Input
                id="trip-start"
                type="date"
                value={startDate}
                onChange={(event) => setStartDate(event.target.value)}
              />
            </div>
            <div className="space-y-1.5">
              <Label htmlFor="trip-end">{t("tripForm.endDate")}</Label>
              <Input
                id="trip-end"
                type="date"
                value={endDate}
                min={startDate || undefined}
                onChange={(event) => setEndDate(event.target.value)}
              />
            </div>
          </div>
          {datesInvalid && <p className="text-xs text-destructive">{t("tripForm.datesInvalid")}</p>}

          <div className="space-y-1.5">
            <Label htmlFor="trip-visibility">{t("tripForm.visibility")}</Label>
            <Select
              id="trip-visibility"
              value={visibility}
              onChange={(event) => setVisibility(event.target.value as Visibility)}
            >
              {VISIBILITY_OPTIONS.map((option) => (
                <option key={option.value} value={option.value}>
                  {t(option.labelKey)}
                </option>
              ))}
            </Select>
            <p className="text-xs text-muted-foreground">
              {t(
                VISIBILITY_OPTIONS.find((option) => option.value === visibility)?.hintKey ??
                  "visibility.privateHint",
              )}
            </p>
          </div>

          <div className="space-y-1.5">
            <Label htmlFor="trip-description">{t("tripForm.description")}</Label>
            <Textarea
              id="trip-description"
              value={description}
              onChange={(event) => setDescription(event.target.value)}
              placeholder={t("tripForm.descriptionPlaceholder")}
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
            <Button
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={mutation.isPending}
            >
              {t("tripForm.cancel")}
            </Button>
            <Button type="submit" disabled={!canSubmit}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {editing ? t("tripForm.save") : t("tripForm.create")}
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
