import { Languages } from "lucide-react";

import { cn } from "@/lib/utils";

import { useI18n, type Language } from "@/i18n";

const OPTIONS: Array<{ value: Language; short: string; labelKey: "nav.languageZh" | "nav.languageEn" }> = [
  { value: "zh", short: "中", labelKey: "nav.languageZh" },
  { value: "en", short: "EN", labelKey: "nav.languageEn" },
];

export function LanguageSwitcher({
  className,
  variant = "compact",
}: {
  className?: string;
  variant?: "compact" | "full";
}) {
  const { language, setLanguage, t } = useI18n();

  if (variant === "full") {
    return (
      <div className={cn("grid gap-2 sm:grid-cols-2", className)}>
        {OPTIONS.map((option) => {
          const active = language === option.value;
          return (
            <button
              key={option.value}
              type="button"
              onClick={() => setLanguage(option.value)}
              aria-pressed={active}
              className={cn(
                "flex items-start justify-between gap-3 rounded-2xl border px-4 py-3 text-left transition-colors",
                active
                  ? "border-pine-400 bg-pine-50"
                  : "border-border/80 bg-card/50 hover:border-pine-200 hover:bg-card",
              )}
            >
              <span>
                <span className="block text-sm font-semibold">{t(option.labelKey)}</span>
                <span className="mt-0.5 block text-[11px] text-muted-foreground">
                  {option.value === "zh" ? t("settings.languageZhHint") : t("settings.languageEnHint")}
                </span>
              </span>
              <span
                className={cn(
                  "mt-0.5 flex size-4 items-center justify-center rounded-full border",
                  active ? "border-primary bg-primary" : "border-border bg-card",
                )}
              >
                {active && <span className="size-1.5 rounded-full bg-primary-foreground" />}
              </span>
            </button>
          );
        })}
      </div>
    );
  }

  return (
    <div
      role="group"
      aria-label={t("app.language")}
      className={cn(
        "inline-flex items-center gap-1 rounded-full border border-border/80 bg-card/70 p-1",
        className,
      )}
    >
      <Languages className="ml-1.5 size-3.5 text-muted-foreground" aria-hidden />
      {OPTIONS.map((option) => (
        <button
          key={option.value}
          type="button"
          onClick={() => setLanguage(option.value)}
          aria-pressed={language === option.value}
          title={t(option.labelKey)}
          className={cn(
            "rounded-full px-2.5 py-1 text-[11px] font-medium transition-colors",
            language === option.value
              ? "bg-primary text-primary-foreground shadow-sm"
              : "text-muted-foreground hover:text-foreground",
          )}
        >
          {option.short}
        </button>
      ))}
    </div>
  );
}
