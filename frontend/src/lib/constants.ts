import {
  BedDouble,
  Bus,
  Camera,
  Compass,
  Landmark,
  Mountain,
  ShoppingBag,
  UtensilsCrossed,
  type LucideIcon,
} from "lucide-react";

import type { MessageKey } from "@/i18n";

import type { EventType, PlaceCategory, Visibility } from "./types";

export const APP_TAGLINE = "Your journey, reconstructed.";

export const PLACE_CATEGORIES: Array<{ value: PlaceCategory; labelKey: MessageKey }> = [
  { value: "attraction", labelKey: "category.attraction" },
  { value: "food", labelKey: "category.food" },
  { value: "lodging", labelKey: "category.lodging" },
  { value: "transport", labelKey: "category.transport" },
  { value: "nature", labelKey: "category.nature" },
  { value: "shopping", labelKey: "category.shopping" },
  { value: "other", labelKey: "category.other" },
];

export const PLACE_CATEGORY_ICONS: Record<PlaceCategory, LucideIcon> = {
  attraction: Landmark,
  food: UtensilsCrossed,
  lodging: BedDouble,
  transport: Bus,
  nature: Mountain,
  shopping: ShoppingBag,
  other: Compass,
};

export const PLACE_CATEGORY_COLORS: Record<PlaceCategory, string> = {
  attraction: "bg-ember-100 text-ember-700 ring-ember-200",
  food: "bg-amber-100 text-amber-800 ring-amber-200",
  lodging: "bg-sky-100 text-sky-800 ring-sky-200",
  transport: "bg-slate-100 text-slate-700 ring-slate-200",
  nature: "bg-pine-100 text-pine-700 ring-pine-200",
  shopping: "bg-rose-100 text-rose-700 ring-rose-200",
  other: "bg-sand-100 text-sand-800 ring-sand-200",
};

export const EVENT_TYPES: Array<{ value: EventType; labelKey: MessageKey }> = [
  { value: "sightseeing", labelKey: "eventType.sightseeing" },
  { value: "food", labelKey: "eventType.food" },
  { value: "transport", labelKey: "eventType.transport" },
  { value: "lodging", labelKey: "eventType.lodging" },
  { value: "activity", labelKey: "eventType.activity" },
  { value: "other", labelKey: "eventType.other" },
];

export const EVENT_TYPE_ICONS: Record<EventType, LucideIcon> = {
  sightseeing: Camera,
  food: UtensilsCrossed,
  transport: Bus,
  lodging: BedDouble,
  activity: Compass,
  other: Compass,
};

export const VISIBILITY_OPTIONS: Array<{
  value: Visibility;
  labelKey: MessageKey;
  hintKey: MessageKey;
}> = [
  { value: "private", labelKey: "visibility.private", hintKey: "visibility.privateHint" },
  { value: "unlisted", labelKey: "visibility.unlisted", hintKey: "visibility.unlistedHint" },
  { value: "public", labelKey: "visibility.public", hintKey: "visibility.publicHint" },
];

export const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";

export const DEFAULT_MAP_CENTER: [number, number] = [10, 30];
export const DEFAULT_MAP_ZOOM = 1.6;

export const PHOTO_SORT_OPTIONS: Array<{ value: string; labelKey: MessageKey }> = [
  { value: "taken_at_desc", labelKey: "photos.sortTakenDesc" },
  { value: "taken_at_asc", labelKey: "photos.sortTakenAsc" },
  { value: "created_desc", labelKey: "photos.sortCreatedDesc" },
  { value: "created_asc", labelKey: "photos.sortCreatedAsc" },
];

export const TRIP_SORT_OPTIONS: Array<{ value: string; labelKey: MessageKey }> = [
  { value: "start_date_desc", labelKey: "trips.sortStartDesc" },
  { value: "start_date_asc", labelKey: "trips.sortStartAsc" },
  { value: "created_desc", labelKey: "trips.sortCreatedDesc" },
  { value: "title_asc", labelKey: "trips.sortTitleAsc" },
];

/** Map of category values to translation keys (for dynamic lookups). */
export const CATEGORY_LABEL_KEYS: Record<PlaceCategory, MessageKey> = Object.fromEntries(
  PLACE_CATEGORIES.map((item) => [item.value, item.labelKey]),
) as Record<PlaceCategory, MessageKey>;

export const EVENT_TYPE_LABEL_KEYS: Record<EventType, MessageKey> = Object.fromEntries(
  EVENT_TYPES.map((item) => [item.value, item.labelKey]),
) as Record<EventType, MessageKey>;
