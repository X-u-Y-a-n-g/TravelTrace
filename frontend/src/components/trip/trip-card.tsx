import { Link } from "react-router-dom";
import { MoreHorizontal, Pencil, Trash2 } from "lucide-react";

import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { useI18n } from "@/i18n";
import { photoUrl } from "@/lib/api";
import type { Trip, Visibility } from "@/lib/types";
import { cn } from "@/lib/utils";

const COVER_GRADIENTS = [
  ["#1f3d33", "#497a64", "#c9a873"],
  ["#6b4a2f", "#c9a873", "#f4eee1"],
  ["#233b4a", "#4f7d8c", "#d9c49e"],
  ["#4a2f3d", "#8c4f5e", "#e8dcc4"],
  ["#2f4020", "#6f8c4f", "#e8dcc4"],
] as const;

const VISIBILITY_KEYS: Record<Visibility, "visibility.private" | "visibility.unlisted" | "visibility.public"> = {
  private: "visibility.private",
  unlisted: "visibility.unlisted",
  public: "visibility.public",
};

function gradientFor(seed: string): readonly [string, string, string] {
  let hash = 0;
  for (let index = 0; index < seed.length; index += 1) {
    hash = (hash * 31 + seed.charCodeAt(index)) >>> 0;
  }
  return COVER_GRADIENTS[hash % COVER_GRADIENTS.length];
}

export function TripCover({
  trip,
  className,
  children,
}: {
  trip: Pick<Trip, "id" | "title" | "cover_photo">;
  className?: string;
  children?: React.ReactNode;
}) {
  const [from, to, accent] = gradientFor(trip.id);
  return (
    <div
      className={cn("relative overflow-hidden", className)}
      style={{ background: `linear-gradient(140deg, ${from} 0%, ${to} 62%, ${accent} 100%)` }}
    >
      {trip.cover_photo ? (
        <img
          src={photoUrl(trip.cover_photo.id, "preview")}
          alt=""
          loading="lazy"
          className="absolute inset-0 size-full object-cover"
        />
      ) : (
        <svg
          viewBox="0 0 400 250"
          className="absolute inset-0 size-full opacity-40"
          aria-hidden
          preserveAspectRatio="xMidYMid slice"
        >
          <path
            d="M-20 190C60 190 70 90 150 90s85 90 170 90 100-40 120-40"
            fill="none"
            stroke="rgba(244,238,225,0.75)"
            strokeWidth="2.5"
            strokeDasharray="2 10"
            strokeLinecap="round"
          />
          <circle cx="28" cy="182" r="5" fill="rgba(244,238,225,0.9)" />
          <circle cx="320" cy="132" r="5" fill="rgba(244,238,225,0.85)" />
          <circle cx="370" cy="120" r="5" fill="rgba(244,238,225,0.6)" />
          <g opacity="0.45" stroke="rgba(244,238,225,0.4)" strokeWidth="1">
            <path d="M40 40h120M40 60h80M260 200h100M260 180h60" />
          </g>
        </svg>
      )}
      <div className="absolute inset-0 bg-gradient-to-t from-pine-950/80 via-pine-950/15 to-transparent" />
      {children}
    </div>
  );
}

export function TripCard({
  trip,
  onEdit,
  onDelete,
  className,
}: {
  trip: Trip;
  onEdit?: (trip: Trip) => void;
  onDelete?: (trip: Trip) => void;
  className?: string;
}) {
  const { t, f } = useI18n();
  const hasActions = Boolean(onEdit || onDelete);
  return (
    <article
      className={cn(
        "group overflow-hidden rounded-3xl border border-border/80 bg-card/85 shadow-soft transition-all duration-300 hover:-translate-y-0.5 hover:shadow-lift",
        className,
      )}
    >
      <Link to={`/trips/${trip.id}`} className="block focus:outline-none">
        <TripCover trip={trip} className="aspect-[16/10]">
          <Badge
            variant={trip.visibility === "public" ? "ember" : "outline"}
            className="absolute left-4 top-4 border-white/25 bg-pine-950/45 text-white backdrop-blur"
          >
            {t(VISIBILITY_KEYS[trip.visibility])}
          </Badge>
          <div className="absolute inset-x-0 bottom-0 p-5">
            <p className="text-[10px] font-medium uppercase tracking-[0.2em] text-sand-100/80">
              {f.dateRange(trip.start_date, trip.end_date)}
            </p>
            <h3 className="mt-1 line-clamp-2 font-display text-2xl font-semibold leading-tight text-white">
              {trip.title}
            </h3>
          </div>
        </TripCover>
      </Link>
      <div className="flex items-center justify-between gap-2 px-4 py-3">
        <p className="text-xs text-muted-foreground">
          {t("common.photoCount", { count: trip.photo_count })} ·{" "}
          {t("common.placeCount", { count: trip.place_count })}
        </p>
        {hasActions && (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <button
                className="rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                aria-label={t("trip.actions")}
              >
                <MoreHorizontal className="size-4" />
              </button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              {onEdit && (
                <DropdownMenuItem onSelect={() => onEdit(trip)}>
                  <Pencil className="size-4" />
                  {t("tripForm.editTitle")}
                </DropdownMenuItem>
              )}
              {onDelete && (
                <DropdownMenuItem destructive onSelect={() => onDelete(trip)}>
                  <Trash2 className="size-4" />
                  {t("trip.deleteAction")}
                </DropdownMenuItem>
              )}
            </DropdownMenuContent>
          </DropdownMenu>
        )}
      </div>
    </article>
  );
}
