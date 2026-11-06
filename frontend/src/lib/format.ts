import {
  differenceInCalendarDays,
  format,
  formatDistanceToNowStrict,
  isValid,
  parseISO,
} from "date-fns";

export function parseDate(value: string | null | undefined): Date | null {
  if (!value) return null;
  const parsed = parseISO(value);
  return isValid(parsed) ? parsed : null;
}

export function formatDate(value: string | null | undefined, pattern = "MMM d, yyyy"): string {
  const date = parseDate(value);
  return date ? format(date, pattern) : "—";
}

export function formatShortDate(value: string | null | undefined): string {
  return formatDate(value, "MMM d");
}

export function formatDateTime(value: string | null | undefined): string {
  return formatDate(value, "MMM d, yyyy · HH:mm");
}

export function formatTime(value: string | null | undefined): string {
  return formatDate(value, "HH:mm");
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
): string {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from && !to) return "Dates to be decided";
  if (from && !to) return format(from, "MMM d, yyyy");
  if (!from && to) return `Until ${format(to, "MMM d, yyyy")}`;
  if (from && to) {
    if (from.getFullYear() === to.getFullYear()) {
      if (from.getMonth() === to.getMonth()) {
        return `${format(from, "MMM d")}–${format(to, "d, yyyy")}`;
      }
      return `${format(from, "MMM d")} – ${format(to, "MMM d, yyyy")}`;
    }
    return `${format(from, "MMM d, yyyy")} – ${format(to, "MMM d, yyyy")}`;
  }
  return "";
}

export function formatRelative(value: string | null | undefined): string {
  const date = parseDate(value);
  if (!date) return "";
  return `${formatDistanceToNowStrict(date, { addSuffix: true })}`;
}

export function tripLengthDays(start: string | null, end: string | null): number {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from || !to) return 0;
  return Math.max(differenceInCalendarDays(to, from) + 1, 1);
}

export function formatBytes(bytes: number): string {
  if (!bytes) return "0 MB";
  const units = ["B", "KB", "MB", "GB", "TB"];
  const index = Math.min(Math.floor(Math.log(bytes) / Math.log(1024)), units.length - 1);
  const value = bytes / Math.pow(1024, index);
  return `${value.toFixed(value >= 10 || index === 0 ? 0 : 1)} ${units[index]}`;
}

export function formatNumber(value: number): string {
  return new Intl.NumberFormat("en-US").format(value);
}

export function formatOrdinal(day: number): string {
  const suffix =
    day % 100 >= 11 && day % 100 <= 13
      ? "th"
      : { 1: "st", 2: "nd", 3: "rd" }[day % 10] ?? "th";
  return `${day}${suffix}`;
}

export function dateInputValue(value: string | null | undefined): string {
  return value ? value.slice(0, 10) : "";
}

export function timeInputValue(value: string | null | undefined): string {
  const date = parseDate(value);
  return date ? format(date, "HH:mm") : "";
}

export function toApiDateTime(date: string, time: string): string {
  return `${date}T${time.length === 5 ? `${time}:00` : time}`;
}
