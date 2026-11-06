import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import * as TooltipPrimitive from "@radix-ui/react-tooltip";
import type { ReactNode } from "react";
import { Toaster } from "sonner";

import { ApiError } from "@/lib/api";

const queryClient = new QueryClient({
  defaultOptions: {
    queries: {
      staleTime: 30_000,
      refetchOnWindowFocus: false,
      retry: (failureCount, error) => {
        if (error instanceof ApiError && [400, 401, 403, 404, 409, 413, 415, 422].includes(error.status)) {
          return false;
        }
        return failureCount < 2;
      },
    },
  },
});

export function Providers({ children }: { children: ReactNode }) {
  return (
    <QueryClientProvider client={queryClient}>
      <TooltipPrimitive.Provider delayDuration={200}>
        {children}
        <Toaster
          position="bottom-right"
          richColors
          closeButton
          toastOptions={{
            style: {
              borderRadius: "14px",
              border: "1px solid rgba(30, 35, 31, 0.12)",
              fontFamily: "Inter Variable, Inter, sans-serif",
            },
          }}
        />
      </TooltipPrimitive.Provider>
    </QueryClientProvider>
  );
}
