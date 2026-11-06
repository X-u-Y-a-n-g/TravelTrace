import type { ReactNode } from "react";

import { cn } from "@/lib/utils";

export function PageHeader({
  eyebrow,
  title,
  description,
  actions,
  back,
  className,
}: {
  eyebrow?: string;
  title: string;
  description?: ReactNode;
  actions?: ReactNode;
  back?: ReactNode;
  className?: string;
}) {
  return (
    <header className={cn("mb-8", className)}>
      {back && <div className="mb-4">{back}</div>}
      <div className="flex flex-col gap-5 sm:flex-row sm:items-end sm:justify-between">
        <div className="max-w-2xl space-y-2">
          {eyebrow && <p className="eyebrow">{eyebrow}</p>}
          <h1 className="text-balance text-3xl leading-[1.05] sm:text-[2.6rem]">{title}</h1>
          {description && (
            <div className="text-sm leading-relaxed text-muted-foreground">{description}</div>
          )}
        </div>
        {actions && <div className="flex flex-wrap items-center gap-2">{actions}</div>}
      </div>
    </header>
  );
}
