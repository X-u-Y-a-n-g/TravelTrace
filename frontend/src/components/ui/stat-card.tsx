import type { LucideIcon } from "lucide-react";

import { cn } from "@/lib/utils";

export function StatCard({
  icon: Icon,
  label,
  value,
  hint,
  tone = "pine",
  className,
}: {
  icon: LucideIcon;
  label: string;
  value: string | number;
  hint?: string;
  tone?: "pine" | "ember" | "sand";
  className?: string;
}) {
  const tones = {
    pine: "bg-pine-100 text-pine-700 ring-pine-200",
    ember: "bg-ember-100 text-ember-700 ring-ember-200",
    sand: "bg-sand-100 text-sand-800 ring-sand-200",
  };
  return (
    <div className={cn("surface flex items-start justify-between gap-3 p-5", className)}>
      <div className="space-y-1.5">
        <p className="text-[11px] font-medium uppercase tracking-[0.16em] text-muted-foreground">
          {label}
        </p>
        <p className="font-display text-3xl font-semibold leading-none tracking-tight">{value}</p>
        {hint && <p className="text-xs text-muted-foreground">{hint}</p>}
      </div>
      <div className={cn("flex size-10 shrink-0 items-center justify-center rounded-xl ring-1", tones[tone])}>
        <Icon className="size-5" />
      </div>
    </div>
  );
}
