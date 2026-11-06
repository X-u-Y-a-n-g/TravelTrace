import { useMutation, useQueryClient } from "@tanstack/react-query";
import { CloudUpload, CheckCircle2, ImagePlus, Loader2, X } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import { Label } from "@/components/ui/label";
import { Select } from "@/components/ui/select";
import { ApiError, api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { useImportTask, useInstanceSettings, useTrips } from "@/lib/queries";
import { cn } from "@/lib/utils";

const ACCEPTED = ["image/jpeg", "image/png", "image/webp"];
const TERMINAL = ["succeeded", "partial", "failed", "cancelled"];

interface SelectedFile {
  file: File;
  preview: string;
}

export function UploadDialog({
  open,
  onOpenChange,
  tripId,
  onUploaded,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tripId?: string;
  onUploaded?: () => void;
}) {
  const queryClient = useQueryClient();
  const settings = useInstanceSettings();
  const trips = useTrips({ size: 100, sort: "start_date_desc" });
  const [selected, setSelected] = useState<SelectedFile[]>([]);
  const [targetTrip, setTargetTrip] = useState(tripId ?? "");
  const [taskId, setTaskId] = useState<string | null>(null);
  const [dragging, setDragging] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const handledTask = useRef<string | null>(null);
  const selectedRef = useRef<SelectedFile[]>([]);
  const inputRef = useRef<HTMLInputElement>(null);
  const task = useImportTask(taskId);

  const maxBytes = (settings.data?.max_upload_mb ?? 25) * 1024 * 1024;

  useEffect(() => {
    if (open) {
      setTargetTrip(tripId ?? "");
      handledTask.current = null;
    }
  }, [open, tripId]);

  useEffect(() => {
    selectedRef.current = selected;
  }, [selected]);

  useEffect(() => {
    return () => {
      selectedRef.current.forEach((item) => URL.revokeObjectURL(item.preview));
    };
  }, []);

  const addFiles = useCallback(
    (files: FileList | File[]) => {
      setError(null);
      const incoming = Array.from(files);
      const accepted: SelectedFile[] = [];
      for (const file of incoming) {
        if (!ACCEPTED.includes(file.type)) {
          toast.error(`${file.name} is not a JPEG, PNG or WebP image`);
          continue;
        }
        if (file.size > maxBytes) {
          toast.error(`${file.name} is larger than ${formatBytes(maxBytes)}`);
          continue;
        }
        accepted.push({ file, preview: URL.createObjectURL(file) });
      }
      setSelected((current) => [...current, ...accepted]);
    },
    [maxBytes],
  );

  const removeFile = (index: number) => {
    setSelected((current) => {
      const item = current[index];
      if (item) URL.revokeObjectURL(item.preview);
      return current.filter((_, position) => position !== index);
    });
  };

  const upload = useMutation({
    mutationFn: () =>
      api.photos.upload(
        selected.map((item) => item.file),
        { tripId: targetTrip || undefined },
      ),
    onSuccess: (result) => {
      setTaskId(result.task_id);
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError ? mutationError.message : "The upload could not start",
      );
    },
  });

  const reset = useCallback(() => {
    selected.forEach((item) => URL.revokeObjectURL(item.preview));
    setSelected([]);
    setTaskId(null);
    setError(null);
    handledTask.current = null;
  }, [selected]);

  useEffect(() => {
    const current = task.data;
    if (!current || !taskId || !TERMINAL.includes(current.status)) return;
    if (handledTask.current === current.id) return;
    handledTask.current = current.id;

    if (current.status === "failed") {
      toast.error(current.message ?? "The import failed", {
        description: current.error ?? undefined,
      });
    } else if (current.status === "partial") {
      toast.warning(current.message ?? "Some photos could not be imported");
    } else {
      toast.success(current.message ?? "Photos imported", {
        description: "Your map and timeline have been updated.",
      });
    }

    queryClient.invalidateQueries({ queryKey: ["photos"] });
    queryClient.invalidateQueries({ queryKey: ["trips"] });
    queryClient.invalidateQueries({ queryKey: ["stats"] });
    queryClient.invalidateQueries({ queryKey: ["map"] });
    if (targetTrip) queryClient.invalidateQueries({ queryKey: ["trips", targetTrip] });

    onUploaded?.();
    const timeout = window.setTimeout(() => {
      reset();
      onOpenChange(false);
    }, 900);
    return () => window.clearTimeout(timeout);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [task.data?.status, taskId]);

  const processing = Boolean(
    task.data && (task.data.status === "queued" || task.data.status === "running"),
  );
  const progress = task.data?.progress ?? (upload.isPending ? 3 : 0);

  const handleClose = (nextOpen: boolean) => {
    if (processing) {
      onOpenChange(nextOpen);
      return;
    }
    if (!nextOpen) reset();
    onOpenChange(nextOpen);
  };

  return (
    <Dialog open={open} onOpenChange={handleClose}>
      <DialogContent className="max-w-2xl">
        <DialogHeader>
          <DialogTitle>Add photos to your journal</DialogTitle>
          <DialogDescription>
            We read the EXIF time and GPS, generate thumbnails and place the photos on your map.
            Originals stay untouched.
          </DialogDescription>
        </DialogHeader>

        {task.data ? (
          <div className="space-y-5 py-2">
            <div className="flex items-center gap-3">
              <div className="flex size-11 items-center justify-center rounded-2xl bg-pine-100 text-pine-700">
                {processing ? (
                  <Loader2 className="size-5 animate-spin" />
                ) : (
                  <CheckCircle2 className="size-5" />
                )}
              </div>
              <div className="min-w-0 flex-1">
                <p className="text-sm font-medium">
                  {processing ? "Importing photos…" : task.data.message ?? "Import finished"}
                </p>
                <p className="text-xs text-muted-foreground">
                  {task.data.processed} of {task.data.total} processed
                  {task.data.result.skipped ? ` · ${task.data.result.skipped} duplicates skipped` : ""}
                  {task.data.failed ? ` · ${task.data.failed} failed` : ""}
                </p>
              </div>
              <span className="font-display text-2xl font-semibold">{task.data.progress}%</span>
            </div>
            <div className="h-2 overflow-hidden rounded-full bg-sand-200">
              <div
                className="h-full rounded-full bg-primary transition-all duration-500"
                style={{ width: `${Math.max(progress, 3)}%` }}
              />
            </div>
            {task.data.result.errors?.length ? (
              <div className="max-h-32 space-y-1 overflow-y-auto rounded-xl bg-red-50 p-3 text-xs text-red-700">
                {task.data.result.errors.map((item, index) => (
                  <p key={`${item.file}-${index}`}>
                    {item.file}: {item.error}
                  </p>
                ))}
              </div>
            ) : (
              <p className="text-xs text-muted-foreground">
                Photos without GPS can be placed by hand later from the photo detail panel.
              </p>
            )}
            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)} disabled={processing}>
                {processing ? "Keep working in background" : "Done"}
              </Button>
            </DialogFooter>
          </div>
        ) : (
          <div className="space-y-4">
            <div
              onDragOver={(event) => {
                event.preventDefault();
                setDragging(true);
              }}
              onDragLeave={() => setDragging(false)}
              onDrop={(event) => {
                event.preventDefault();
                setDragging(false);
                if (event.dataTransfer.files.length) addFiles(event.dataTransfer.files);
              }}
              className={cn(
                "relative flex cursor-pointer flex-col items-center justify-center gap-2 rounded-2xl border-2 border-dashed px-6 py-10 text-center transition-colors",
                dragging
                  ? "border-pine-400 bg-pine-50"
                  : "border-border bg-card/40 hover:border-pine-300 hover:bg-card/70",
              )}
              onClick={() => inputRef.current?.click()}
              role="button"
              tabIndex={0}
              onKeyDown={(event) => {
                if (event.key === "Enter" || event.key === " ") inputRef.current?.click();
              }}
            >
              <span className="flex size-12 items-center justify-center rounded-2xl bg-pine-100 text-pine-700">
                <CloudUpload className="size-5" />
              </span>
              <p className="text-sm font-medium">Drop photos here, or click to browse</p>
              <p className="text-xs text-muted-foreground">
                JPEG, PNG or WebP · up to {settings.data?.max_upload_mb ?? 25} MB each ·{" "}
                {settings.data?.max_upload_files ?? 60} files at a time
              </p>
              <input
                ref={inputRef}
                type="file"
                multiple
                accept={ACCEPTED.join(",")}
                className="hidden"
                onChange={(event) => {
                  if (event.target.files?.length) addFiles(event.target.files);
                  event.target.value = "";
                }}
              />
            </div>

            {selected.length > 0 && (
              <div className="max-h-52 overflow-y-auto rounded-2xl border border-border/70 bg-card/50 p-3">
                <div className="grid grid-cols-3 gap-2 sm:grid-cols-4">
                  {selected.map((item, index) => (
                    <div
                      key={`${item.file.name}-${index}`}
                      className="group relative aspect-square overflow-hidden rounded-xl bg-sand-200"
                    >
                      <img src={item.preview} alt="" className="size-full object-cover" />
                      <button
                        type="button"
                        onClick={() => removeFile(index)}
                        className="absolute right-1.5 top-1.5 rounded-full bg-pine-950/60 p-1 text-white opacity-0 transition-opacity group-hover:opacity-100"
                        aria-label={`Remove ${item.file.name}`}
                      >
                        <X className="size-3" />
                      </button>
                      <span className="absolute inset-x-0 bottom-0 truncate bg-gradient-to-t from-pine-950/80 to-transparent px-1.5 pb-1 pt-3 text-[9px] text-white">
                        {item.file.name}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
            )}

            {!tripId && (
              <div className="space-y-1.5">
                <Label htmlFor="upload-trip">Add to trip</Label>
                <Select
                  id="upload-trip"
                  value={targetTrip}
                  onChange={(event) => setTargetTrip(event.target.value)}
                >
                  <option value="">Match automatically by date</option>
                  {trips.data?.items.map((trip) => (
                    <option key={trip.id} value={trip.id}>
                      {trip.title}
                    </option>
                  ))}
                </Select>
                <p className="text-xs text-muted-foreground">
                  Choose a trip, or let TravelTrace match each photo to a trip using its capture
                  date.
                </p>
              </div>
            )}

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <DialogFooter>
              <Button variant="outline" onClick={() => handleClose(false)}>
                Cancel
              </Button>
              <Button
                onClick={() => upload.mutate()}
                disabled={!selected.length || upload.isPending}
              >
                {upload.isPending ? (
                  <Loader2 className="size-4 animate-spin" />
                ) : (
                  <ImagePlus className="size-4" />
                )}
                Import {selected.length ? `${selected.length} photo${selected.length === 1 ? "" : "s"}` : "photos"}
              </Button>
            </DialogFooter>
          </div>
        )}
      </DialogContent>
    </Dialog>
  );
}
