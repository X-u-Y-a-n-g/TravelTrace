import { AlertTriangle, RefreshCw } from "lucide-react";
import { Component, type ErrorInfo, type ReactNode } from "react";

import { LogoMark } from "@/components/common/logo";
import { Button } from "@/components/ui/button";

interface ErrorBoundaryState {
  hasError: boolean;
}

export class ErrorBoundary extends Component<{ children: ReactNode }, ErrorBoundaryState> {
  state: ErrorBoundaryState = { hasError: false };

  static getDerivedStateFromError(): ErrorBoundaryState {
    return { hasError: true };
  }

  componentDidCatch(error: Error, info: ErrorInfo): void {
    // Surfaced in the browser console; no telemetry leaves the instance.
    console.error("TravelTrace UI error", error, info);
  }

  render(): ReactNode {
    if (!this.state.hasError) return this.props.children;

    return (
      <div className="flex min-h-screen flex-col items-center justify-center gap-6 bg-background px-6 text-center">
        <LogoMark className="size-14 rounded-2xl shadow-soft" />
        <div className="space-y-2">
          <div className="mx-auto flex size-10 items-center justify-center rounded-xl bg-red-50 text-destructive">
            <AlertTriangle className="size-5" />
          </div>
          <h1 className="text-balance text-3xl">Something went off the trail.</h1>
          <p className="mx-auto max-w-sm text-sm text-muted-foreground">
            The interface hit an unexpected error. Your data is safe on the server. Reloading usually
            fixes it; if not, check the browser console for details.
          </p>
        </div>
        <Button onClick={() => window.location.reload()}>
          <RefreshCw className="size-4" />
          Reload TravelTrace
        </Button>
      </div>
    );
  }
}
