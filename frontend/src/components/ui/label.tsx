import * as LabelPrimitive from "@radix-ui/react-label";
import { forwardRef } from "react";

import { cn } from "@/lib/utils";

export const Label = forwardRef<
  React.ElementRef<typeof LabelPrimitive.Root>,
  React.ComponentPropsWithoutRef<typeof LabelPrimitive.Root>
>(({ className, ...props }, ref) => (
  <LabelPrimitive.Root
    ref={ref}
    className={cn(
      "text-[12px] font-medium uppercase tracking-[0.12em] text-muted-foreground",
      className,
    )}
    {...props}
  />
));
Label.displayName = "Label";
