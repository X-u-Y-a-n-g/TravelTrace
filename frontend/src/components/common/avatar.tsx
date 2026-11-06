import { cn, initials } from "@/lib/utils";

export function Avatar({
  name,
  src,
  className,
  size = "md",
}: {
  name: string | null | undefined;
  src?: string | null;
  className?: string;
  size?: "sm" | "md" | "lg";
}) {
  const sizes = {
    sm: "size-8 text-[11px]",
    md: "size-9 text-xs",
    lg: "size-14 text-lg",
  };
  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden rounded-full bg-pine-700 font-semibold text-sand-50 ring-2 ring-white/70",
        sizes[size],
        className,
      )}
      aria-hidden={!name}
    >
      {src ? (
        <img src={src} alt="" className="size-full object-cover" />
      ) : (
        initials(name)
      )}
    </span>
  );
}
