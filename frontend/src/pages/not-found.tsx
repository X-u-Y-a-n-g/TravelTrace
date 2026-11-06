import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { LogoMark } from "@/components/common/logo";
import { buttonVariants } from "@/components/ui/button";

export function NotFoundPage() {
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <LogoMark className="size-14 rounded-2xl shadow-soft" />
      <div className="space-y-2">
        <p className="eyebrow">Error 404</p>
        <h1 className="text-balance text-4xl">This trail doesn't exist.</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          The page you were looking for has wandered off the map. Let's head back to familiar
          ground.
        </p>
      </div>
      <Link to="/" className={buttonVariants({ variant: "default" })}>
        <Compass className="size-4" />
        Back to the dashboard
      </Link>
    </div>
  );
}
