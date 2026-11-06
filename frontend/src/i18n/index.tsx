/* eslint-disable react-refresh/only-export-components */
import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useState,
  type ReactNode,
} from "react";

import { ApiError } from "@/lib/api";
import type { Language } from "@/lib/format";

import {
  formatDate,
  formatDateRange,
  formatDateTime,
  formatHeaderDate,
  formatLongDate,
  formatMonthDay,
  formatRelative,
  formatTime,
  formatWeekday,
  formatWeekdayDate,
} from "./format";
import { dictionaries, type TranslationKey } from "./translations";

export type { Language };
type PluralBase<T> = T extends `${infer Base}.one` ? Base : never;
export type MessageKey =
  | Exclude<TranslationKey, `${string}.one` | `${string}.many`>
  | PluralBase<TranslationKey>;

export type TranslateParams = Record<string, string | number | undefined>;

type Dictionary = Record<string, string>;

const STORAGE_KEY = "traveltrace-language";

function readStoredLanguage(): Language {
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    return stored === "en" ? "en" : "zh";
  } catch {
    return "zh";
  }
}

function interpolate(template: string, params?: TranslateParams): string {
  if (!params) return template;
  return template.replace(/\{(\w+)\}/g, (match, name: string) => {
    const value = params[name];
    return value === undefined ? match : String(value);
  });
}

export function translate(
  language: Language,
  key: string,
  params?: TranslateParams,
): string {
  const dictionary = dictionaries[language] as Dictionary;
  let template = dictionary[key];
  if (template === undefined && params && typeof params.count === "number") {
    template = dictionary[`${key}.${params.count === 1 ? "one" : "many"}`];
  }
  if (template === undefined) {
    template = dictionary[key] ?? key;
  }
  return interpolate(template, params);
}

function buildFormatters(language: Language) {
  return {
    date: (value: string | null | undefined) => formatDate(value, language),
    longDate: (value: string | null | undefined) => formatLongDate(value, language),
    monthDay: (value: string | null | undefined) => formatMonthDay(value, language),
    time: (value: string | null | undefined) => formatTime(value, language),
    dateTime: (value: string | null | undefined) => formatDateTime(value, language),
    weekdayDate: (value: string | null | undefined) => formatWeekdayDate(value, language),
    weekday: (value: string | null | undefined) => formatWeekday(value, language),
    headerDate: (value: string | null | undefined) => formatHeaderDate(value, language),
    dateRange: (start: string | null | undefined, end: string | null | undefined) =>
      formatDateRange(start, end, language, {
        empty: translate(language, "common.datesTbd"),
        until: translate(language, "common.until"),
      }),
    relative: (value: string | null | undefined) => formatRelative(value, language),
  };
}

export type Formatters = ReturnType<typeof buildFormatters>;

interface I18nContextValue {
  language: Language;
  setLanguage: (language: Language) => void;
  t: (key: MessageKey, params?: TranslateParams) => string;
  f: Formatters;
  errorText: (error: unknown) => string;
}

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({ children }: { children: ReactNode }) {
  const [language, setLanguageState] = useState<Language>(() => readStoredLanguage());

  const setLanguage = useCallback((next: Language) => {
    setLanguageState(next);
    try {
      window.localStorage.setItem(STORAGE_KEY, next);
    } catch {
      // Private browsing or a blocked storage API: keep the in-memory choice.
    }
  }, []);

  useEffect(() => {
    document.documentElement.lang = language === "zh" ? "zh-CN" : "en";
    document.title = translate(language, "app.title");
    const description = document.querySelector('meta[name="description"]');
    description?.setAttribute("content", translate(language, "app.description"));
  }, [language]);

  const t = useCallback(
    (key: MessageKey, params?: TranslateParams) => translate(language, key, params),
    [language],
  );

  const f = useMemo(() => buildFormatters(language), [language]);

  const errorText = useCallback(
    (error: unknown) => {
      if (error instanceof ApiError) {
        const key = `error.${error.code}`;
        if (key in (dictionaries[language] as Dictionary)) {
          return translate(language, key);
        }
        return error.message || translate(language, "error.generic");
      }
      return translate(language, "error.generic");
    },
    [language],
  );

  const value = useMemo<I18nContextValue>(
    () => ({ language, setLanguage, t, f, errorText }),
    [language, setLanguage, t, f, errorText],
  );

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n(): I18nContextValue {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error("useI18n must be used inside I18nProvider");
  }
  return context;
}
