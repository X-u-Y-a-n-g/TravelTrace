import { cva, type VariantProps } from "class-variance-authority";

import { cn } from "@/lib/utils";

const badgeVariants = cva(
  "inline-flex items-center gap-1 rounded-full px-2.5 py-0.5 text-[11px] font-medium ring-1 ring-inset",
  {
    variants: {
      variant: {
        default: "bg-pine-100 text-pine-800 ring-pine-200",
        sand: "bg-sand-100 text-sand-800 ring-sand-200",
        ember: "bg-ember-100 text-ember-700 ring-ember-200",
        outline: "bg-transparent text-muted-foreground ring-border",
        muted: "bg-muted text-muted-foreground ring-border",
      },
    },
    defaultVariants: { variant: "default" },
  },
);

export interface BadgeProps
  extends React.HTMLAttributes<HTMLSpanElement>,
    VariantProps<typeof badgeVariants> {}

export function Badge({ className, variant, ...props }: BadgeProps) {
  return <span className={cn(badgeVariants({ variant }), className)} {...props} />;
}
