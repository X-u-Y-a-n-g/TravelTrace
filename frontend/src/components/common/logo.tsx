import { cn } from "@/lib/utils";

export function LogoMark({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 40 40"
      role="img"
      aria-label="TravelTrace"
      className={cn("size-9", className)}
    >
      <rect width="40" height="40" rx="11" fill="#1f3d33" />
      <path
        d="M11 29c5.2 0 5.2-7.7 10.4-7.7S26.6 29 32 29"
        fill="none"
        stroke="#f4eee1"
        strokeWidth="2.6"
        strokeLinecap="round"
        strokeDasharray="0.5 5.5"
      />
      <circle cx="11" cy="29" r="3.1" fill="#f4eee1" />
      <circle cx="32" cy="21.3" r="3.1" fill="#d4722a" />
      <path
        d="M17.7 15.6c0-2.6 2-4.6 4.5-4.6s4.5 2 4.5 4.6-4.5 6.9-4.5 6.9-4.5-4.3-4.5-6.9z"
        fill="#f4eee1"
      />
      <circle cx="22.2" cy="15.3" r="1.7" fill="#1f3d33" />
    </svg>
  );
}

export function Logo({ className, markClassName }: { className?: string; markClassName?: string }) {
  return (
    <span className={cn("inline-flex items-center gap-2.5", className)}>
      <LogoMark className={markClassName} />
      <span className="flex flex-col leading-none">
        <span className="font-display text-[1.15rem] font-semibold tracking-tight text-foreground">
          TravelTrace
        </span>
        <span className="mt-0.5 text-[9px] uppercase tracking-[0.24em] text-muted-foreground">
          Travel journal
        </span>
      </span>
    </span>
  );
}
