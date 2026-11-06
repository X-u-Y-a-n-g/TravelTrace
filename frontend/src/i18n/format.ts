import { format, formatDistanceToNowStrict } from "date-fns";
import { enUS, zhCN } from "date-fns/locale";

import { parseDate, type Language } from "@/lib/format";

const INTL_LOCALES: Record<Language, string> = {
  zh: "zh-CN",
  en: "en-US",
};

const DATE_FNS_LOCALES = { zh: zhCN, en: enUS };

function intl(language: Language, options: Intl.DateTimeFormatOptions): Intl.DateTimeFormat {
  return new Intl.DateTimeFormat(INTL_LOCALES[language], options);
}

export function formatDate(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  return intl(language, { year: "numeric", month: "short", day: "numeric" }).format(date);
}

export function formatLongDate(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  return intl(language, { year: "numeric", month: "long", day: "numeric" }).format(date);
}

export function formatMonthDay(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  return intl(language, { month: "short", day: "numeric" }).format(date);
}

export function formatTime(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  return intl(language, { hour: "2-digit", minute: "2-digit", hour12: false }).format(date);
}

export function formatDateTime(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  return `${formatDate(value, language)} · ${formatTime(value, language)}`;
}

export function formatWeekday(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  return intl(language, { weekday: "long" }).format(date);
}

export function formatWeekdayDate(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  const weekday = intl(language, { weekday: "long" }).format(date);
  const longDate = formatLongDate(value, language);
  return language === "zh" ? `${longDate} ${weekday}` : `${weekday}, ${longDate}`;
}

export function formatHeaderDate(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "—";
  const weekday = intl(language, { weekday: "long" }).format(date);
  const monthDay = intl(language, { month: "long", day: "numeric" }).format(date);
  return language === "zh" ? `${monthDay} ${weekday}` : `${weekday}, ${monthDay}`;
}

export function formatDateRange(
  start: string | null | undefined,
  end: string | null | undefined,
  language: Language,
  labels: { empty: string; until: string },
): string {
  const from = parseDate(start);
  const to = parseDate(end);
  if (!from && !to) return labels.empty;
  if (from && !to) return formatDate(start, language);
  if (!from && to) return labels.until.replace("{date}", formatDate(end, language));
  if (!from || !to) return labels.empty;

  const fromYear = from.getFullYear();
  const toYear = to.getFullYear();
  const fromMonth = from.getMonth() + 1;
  const toMonth = to.getMonth() + 1;

  if (language === "zh") {
    if (fromYear === toYear && fromMonth === toMonth) {
      return `${fromYear}年${fromMonth}月${from.getDate()}日–${to.getDate()}日`;
    }
    if (fromYear === toYear) {
      return `${fromYear}年${fromMonth}月${from.getDate()}日 – ${toMonth}月${to.getDate()}日`;
    }
    return `${fromYear}年${fromMonth}月${from.getDate()}日 – ${toYear}年${toMonth}月${to.getDate()}日`;
  }

  const monthShort = (date: Date) => intl(language, { month: "short" }).format(date);
  if (fromYear === toYear && fromMonth === toMonth) {
    return `${monthShort(from)} ${from.getDate()}–${to.getDate()}, ${fromYear}`;
  }
  if (fromYear === toYear) {
    return `${monthShort(from)} ${from.getDate()} – ${monthShort(to)} ${to.getDate()}, ${fromYear}`;
  }
  return `${formatDate(start, language)} – ${formatDate(end, language)}`;
}

export function formatRelative(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "";
  return formatDistanceToNowStrict(date, {
    addSuffix: true,
    locale: DATE_FNS_LOCALES[language],
  });
}

export function formatIsoDate(value: string | null | undefined, language: Language): string {
  const date = parseDate(value);
  if (!date) return "";
  return format(date, "yyyy-MM-dd", { locale: DATE_FNS_LOCALES[language] });
}
