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

import type { EventType, PlaceCategory, Visibility } from "./types";

export const APP_TAGLINE = "Your journey, reconstructed.";

export const PLACE_CATEGORIES: Array<{ value: PlaceCategory; label: string }> = [
  { value: "attraction", label: "Attraction" },
  { value: "food", label: "Food & drink" },
  { value: "lodging", label: "Stay" },
  { value: "transport", label: "Transport" },
  { value: "nature", label: "Nature" },
  { value: "shopping", label: "Shopping" },
  { value: "other", label: "Other" },
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

export const EVENT_TYPES: Array<{ value: EventType; label: string }> = [
  { value: "sightseeing", label: "Sightseeing" },
  { value: "food", label: "Food" },
  { value: "transport", label: "Transport" },
  { value: "lodging", label: "Stay" },
  { value: "activity", label: "Activity" },
  { value: "other", label: "Other" },
];

export const EVENT_TYPE_ICONS: Record<EventType, LucideIcon> = {
  sightseeing: Camera,
  food: UtensilsCrossed,
  transport: Bus,
  lodging: BedDouble,
  activity: Compass,
  other: Compass,
};

export const VISIBILITY_OPTIONS: Array<{ value: Visibility; label: string; hint: string }> = [
  { value: "private", label: "Private", hint: "Only you can see this trip" },
  { value: "unlisted", label: "Unlisted", hint: "Hidden from listings, shareable" },
  { value: "public", label: "Public", hint: "Visible on a public profile" },
];

export const MAP_STYLE_URL =
  import.meta.env.VITE_MAP_STYLE_URL ?? "https://tiles.openfreemap.org/styles/positron";

export const DEFAULT_MAP_CENTER: [number, number] = [10, 30];
export const DEFAULT_MAP_ZOOM = 1.6;

export const PHOTO_SORT_OPTIONS = [
  { value: "taken_at_desc", label: "Newest first" },
  { value: "taken_at_asc", label: "Oldest first" },
  { value: "created_desc", label: "Recently added" },
  { value: "created_asc", label: "Earliest added" },
];

export const TRIP_SORT_OPTIONS = [
  { value: "start_date_desc", label: "Most recent trip" },
  { value: "start_date_asc", label: "Oldest trip" },
  { value: "created_desc", label: "Recently created" },
  { value: "title_asc", label: "Alphabetical" },
];
