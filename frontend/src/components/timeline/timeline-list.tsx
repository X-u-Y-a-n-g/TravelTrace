import {
  Check,
  Clock,
  MapPin,
  MoreHorizontal,
  Pencil,
  Plus,
  Sparkles,
  Trash2,
} from "lucide-react";

import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { EVENT_TYPE_ICONS } from "@/lib/constants";
import { formatDate, formatTime } from "@/lib/format";
import { photoUrl } from "@/lib/api";
import type { Timeline, TimelineEvent } from "@/lib/types";

export function TimelineList({
  timeline,
  onEdit,
  onDelete,
  onConfirm,
  onPhotoClick,
  onAddEvent,
  confirmingId,
}: {
  timeline: Timeline;
  onEdit: (event: TimelineEvent) => void;
  onDelete: (event: TimelineEvent) => void;
  onConfirm: (event: TimelineEvent) => void;
  onPhotoClick: (photoId: string) => void;
  onAddEvent: (date: string) => void;
  confirmingId?: string | null;
}) {
  return (
    <div className="space-y-10">
      {timeline.days.map((day) => (
        <section key={day.date}>
          <div className="mb-5 flex flex-wrap items-center gap-3">
            <div className="flex size-12 shrink-0 flex-col items-center justify-center rounded-2xl bg-primary text-primary-foreground shadow-sm">
              <span className="text-[8px] uppercase tracking-[0.16em] opacity-70">Day</span>
              <span className="font-display text-lg font-semibold leading-none">{day.day_index}</span>
            </div>
            <div>
              <p className="text-[10px] uppercase tracking-[0.2em] text-muted-foreground">
                {formatDate(day.date, "EEEE")}
              </p>
              <h3 className="font-display text-xl leading-tight">
                {formatDate(day.date, "MMMM d, yyyy")}
              </h3>
            </div>
            <div className="mx-2 hidden h-px flex-1 bg-border sm:block" />
            <span className="text-[11px] text-muted-foreground">
              {day.events.length} event{day.events.length === 1 ? "" : "s"}
            </span>
            <Button variant="ghost" size="sm" onClick={() => onAddEvent(day.date)}>
              <Plus className="size-3.5" />
              Add
            </Button>
          </div>

          <div className="space-y-3">
            {day.events.map((event, index) => {
              const Icon = EVENT_TYPE_ICONS[event.event_type];
              return (
                <article key={event.id} className="relative pl-7 sm:pl-9">
                  <span className="absolute left-[3px] top-6 size-3.5 rounded-full border-2 border-background bg-ember-500 ring-2 ring-ember-100 sm:left-[7px]" />
                  {index < day.events.length - 1 && (
                    <span className="absolute bottom-[-14px] left-[9px] top-10 w-px bg-border sm:left-[13px]" />
                  )}
                  <div className="rounded-2xl border border-border/80 bg-card/85 p-4 shadow-soft transition-shadow hover:shadow-lift sm:p-5">
                    <div className="flex flex-wrap items-start justify-between gap-3">
                      <div className="flex min-w-0 items-start gap-3">
                        <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl bg-sand-100 text-sand-800 ring-1 ring-sand-200">
                          <Icon className="size-4" />
                        </span>
                        <div className="min-w-0">
                          <div className="flex flex-wrap items-center gap-2">
                            <h4 className="text-base font-semibold leading-snug">{event.title}</h4>
                            {event.status === "draft" && (
                              <Badge variant="sand" className="gap-1">
                                <Sparkles className="size-2.5" />
                                Draft
                              </Badge>
                            )}
                            {event.source === "auto" && event.status !== "draft" && (
                              <Badge variant="outline">Auto</Badge>
                            )}
                          </div>
                          <div className="mt-1 flex flex-wrap items-center gap-x-3 gap-y-1 text-[11px] text-muted-foreground">
                            <span className="inline-flex items-center gap-1">
                              <Clock className="size-3" />
                              {formatTime(event.start_time)}
                              {event.end_time && event.end_time !== event.start_time
                                ? ` – ${formatTime(event.end_time)}`
                                : ""}
                            </span>
                            {event.place && (
                              <span className="inline-flex items-center gap-1">
                                <MapPin className="size-3" />
                                {event.place.name}
                              </span>
                            )}
                            <span className="capitalize">{event.event_type}</span>
                          </div>
                          {event.description && (
                            <p className="mt-2 text-sm leading-relaxed text-foreground/75">
                              {event.description}
                            </p>
                          )}
                        </div>
                      </div>

                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <button
                            className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                            aria-label={`Actions for ${event.title}`}
                          >
                            <MoreHorizontal className="size-4" />
                          </button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuItem onSelect={() => onEdit(event)}>
                            <Pencil className="size-4" />
                            Edit event
                          </DropdownMenuItem>
                          <DropdownMenuItem destructive onSelect={() => onDelete(event)}>
                            <Trash2 className="size-4" />
                            Delete event
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </div>

                    {event.photos.length > 0 && (
                      <div className="mt-3 flex flex-wrap gap-1.5">
                        {event.photos.slice(0, 6).map((photo) => (
                          <button
                            key={photo.id}
                            type="button"
                            onClick={() => onPhotoClick(photo.id)}
                            className="size-14 overflow-hidden rounded-xl bg-sand-200 ring-1 ring-black/5 transition-transform hover:scale-[1.03]"
                            aria-label="Open photo"
                          >
                            <img
                              src={photoUrl(photo.id, "thumb")}
                              alt=""
                              loading="lazy"
                              className="size-full object-cover"
                            />
                          </button>
                        ))}
                        {event.photos.length > 6 && (
                          <span className="flex size-14 items-center justify-center rounded-xl bg-secondary text-xs font-medium text-muted-foreground">
                            +{event.photos.length - 6}
                          </span>
                        )}
                      </div>
                    )}

                    {event.status === "draft" && (
                      <div className="mt-3 flex items-center justify-between gap-2 rounded-xl bg-sand-50 px-3 py-2">
                        <p className="text-[11px] text-sand-800/80">
                          TravelTrace grouped these photos automatically.
                        </p>
                        <Button
                          size="sm"
                          variant="outline"
                          className="h-7 bg-white/70 text-[11px]"
                          disabled={confirmingId === event.id}
                          onClick={() => onConfirm(event)}
                        >
                          <Check className="size-3" />
                          Looks right
                        </Button>
                      </div>
                    )}
                  </div>
                </article>
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}
