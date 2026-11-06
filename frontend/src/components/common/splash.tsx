import { Loader2 } from "lucide-react";

import { LogoMark } from "@/components/common/logo";

export function Splash({ message = "Reconstructing your journeys" }: { message?: string }) {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-5 bg-background">
      <div className="relative">
        <div className="absolute inset-0 animate-ping rounded-2xl bg-pine-200/50" />
        <LogoMark className="relative size-14 rounded-2xl shadow-soft" />
      </div>
      <div className="flex items-center gap-2 text-sm text-muted-foreground">
        <Loader2 className="size-4 animate-spin" />
        {message}…
      </div>
    </div>
  );
}
