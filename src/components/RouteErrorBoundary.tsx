import { Component, type ErrorInfo, type ReactNode } from "react";
import { Link, useLocation } from "react-router";
import { Button } from "@/components/ui/button";
import { AlertTriangle, Home, LogIn, RotateCw } from "lucide-react";

interface BoundaryState {
  error: Error | null;
}

class Boundary extends Component<{ children: ReactNode }, BoundaryState> {
  state: BoundaryState = { error: null };

  static getDerivedStateFromError(error: Error): BoundaryState {
    return { error };
  }

  componentDidCatch(error: Error, info: ErrorInfo) {
    console.error("[Route] render error:", error, info.componentStack);
  }

  render() {
    const { error } = this.state;
    if (!error) return this.props.children;

    const message = error.message || "This page failed to load.";
    // Ownership/auth rejections are the common case — surface the fix rather
    // than a bare stack trace.
    const needsAuth = /not authenticated|identity is required|unauthori/i.test(
      message,
    );

    return (
      <div className="jaal-grid flex min-h-[60vh] items-center justify-center bg-background p-6">
        <div className="w-full max-w-md rounded-lg border border-border/70 bg-card p-6 text-center">
          <div className="mx-auto mb-4 flex size-12 items-center justify-center rounded-full bg-destructive/10">
            <AlertTriangle className="size-5 text-destructive" />
          </div>
          <h2 className="font-mono text-sm font-semibold text-jtext">
            This page could not load
          </h2>
          <p className="mt-2 break-words font-mono text-[11px] leading-relaxed text-jmuted">
            {message}
          </p>
          {needsAuth && (
            <p className="mt-2 text-xs text-jmuted/70">
              Your session is missing or expired. Signing in again will reload
              this page with your data.
            </p>
          )}
          <div className="mt-5 flex flex-col gap-2">
            <Button
              onClick={() => this.setState({ error: null })}
              className="w-full gap-2"
            >
              <RotateCw className="size-4" /> Try again
            </Button>
            {needsAuth && (
              <Button asChild variant="outline" className="w-full gap-2">
                <Link to="/auth">
                  <LogIn className="size-4" /> Sign in
                </Link>
              </Button>
            )}
            <Button asChild variant="ghost" className="w-full gap-2">
              <Link to="/">
                <Home className="size-4" /> Back to home
              </Link>
            </Button>
          </div>
        </div>
      </div>
    );
  }
}

/**
 * Route-scoped error boundary.
 *
 * Convex surfaces query failures (expired session, rejected ownership check,
 * unreachable backend) as errors thrown during render. Without a boundary
 * below the root one, a single failed query replaces the entire app with a
 * stack trace. This keeps the failure inside the route: the toolbar and shell
 * survive, the user gets a plain-language message plus a way out.
 *
 * Remounts on navigation so one broken route doesn't pin every other route
 * into the same error state.
 */
export function RouteErrorBoundary({ children }: { children: ReactNode }) {
  const location = useLocation();
  return <Boundary key={location.pathname}>{children}</Boundary>;
}
