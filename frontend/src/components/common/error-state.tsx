import { AlertCircle, RotateCcw } from "lucide-react";

import { Button } from "@/components/ui/button";
import { useI18n } from "@/i18n";
import { cn } from "@/lib/utils";

export function ErrorState({
  title,
  message,
  onRetry,
  className,
}: {
  title?: string;
  message?: string;
  onRetry?: () => void;
  className?: string;
}) {
  const { t } = useI18n();
  const resolvedTitle = title ?? t("error.title");
  const resolvedMessage = message ?? t("error.description");
  return (
    <div
      className={cn(
        "flex flex-col items-center justify-center gap-3 rounded-3xl border border-dashed border-border bg-card/40 px-6 py-12 text-center",
        className,
      )}
    >
      <div className="flex size-11 items-center justify-center rounded-2xl bg-red-50 text-destructive ring-1 ring-red-100">
        <AlertCircle className="size-5" />
      </div>
      <div className="space-y-1">
        <h3 className="font-display text-lg font-semibold">{resolvedTitle}</h3>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">{resolvedMessage}</p>
      </div>
      {onRetry && (
        <Button variant="outline" size="sm" onClick={onRetry}>
          <RotateCcw className="size-3.5" />
          {t("common.retry")}
        </Button>
      )}
    </div>
  );
}
