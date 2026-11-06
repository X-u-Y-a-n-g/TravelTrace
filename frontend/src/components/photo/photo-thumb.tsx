import { ImageOff } from "lucide-react";
import { useState } from "react";

import { photoUrl } from "@/lib/api";
import type { PhotoMini } from "@/lib/types";
import { cn } from "@/lib/utils";

export function PhotoThumb({
  photo,
  size = "thumb",
  className,
  onClick,
  selected,
  showSelection = false,
  alt,
}: {
  photo: Pick<PhotoMini, "id" | "caption"> | { id: string; caption?: string | null };
  size?: "thumb" | "preview";
  className?: string;
  onClick?: () => void;
  selected?: boolean;
  showSelection?: boolean;
  alt?: string;
}) {
  const [loaded, setLoaded] = useState(false);
  const [failed, setFailed] = useState(false);

  return (
    <button
      type="button"
      onClick={onClick}
      aria-label={alt ?? photo.caption ?? "Open photo"}
      className={cn(
        "group relative block overflow-hidden bg-sand-200/70 text-left outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2",
        onClick ? "cursor-pointer" : "cursor-default",
        className,
      )}
    >
      {!failed ? (
        <img
          src={photoUrl(photo.id, size)}
          alt={alt ?? photo.caption ?? "Travel photo"}
          loading="lazy"
          decoding="async"
          onLoad={() => setLoaded(true)}
          onError={() => setFailed(true)}
          className={cn(
            "size-full object-cover transition-all duration-500 group-hover:scale-[1.02]",
            loaded ? "opacity-100" : "opacity-0",
          )}
        />
      ) : (
        <span className="flex size-full items-center justify-center text-muted-foreground">
          <ImageOff className="size-5" />
        </span>
      )}
      {!loaded && !failed && (
        <span className="absolute inset-0 animate-pulse bg-gradient-to-br from-sand-200 to-sand-100" />
      )}
      {showSelection && (
        <span
          className={cn(
            "absolute left-2.5 top-2.5 flex size-5 items-center justify-center rounded-full border-2 transition-all",
            selected
              ? "border-primary bg-primary text-primary-foreground"
              : "border-white/80 bg-black/20 text-transparent",
          )}
        >
          <svg viewBox="0 0 12 12" className="size-3" fill="none" aria-hidden>
            <path
              d="M2.5 6.2 4.9 8.6 9.5 3.6"
              stroke="currentColor"
              strokeWidth="2"
              strokeLinecap="round"
              strokeLinejoin="round"
            />
          </svg>
        </span>
      )}
    </button>
  );
}
