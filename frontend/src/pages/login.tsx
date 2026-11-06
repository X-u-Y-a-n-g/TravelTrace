import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Eye, EyeOff, Loader2, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { LogoMark } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { ApiError, api } from "@/lib/api";
import { useBootstrap } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

const FEATURES = [
  {
    icon: MapPinned,
    title: "Map-centric",
    description: "Every photo placed back on the map, route and all.",
  },
  {
    icon: Sparkles,
    title: "Photo-first",
    description: "EXIF time and GPS become a timeline, not a folder.",
  },
  {
    icon: ShieldCheck,
    title: "Local-first",
    description: "Self-hosted and private by default. Your data stays yours.",
  },
];

type Mode = "login" | "register";

export function LoginPage() {
  const bootstrap = useBootstrap();
  const user = useAuthStore((state) => state.user);
  const setSession = useAuthStore((state) => state.setSession);
  const location = useLocation();
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const redirectTo = (location.state as { from?: string } | null)?.from ?? "/";
  const [mode, setMode] = useState<Mode>("login");
  const [identifier, setIdentifier] = useState("");
  const [username, setUsername] = useState("");
  const [email, setEmail] = useState("");
  const [displayName, setDisplayName] = useState("");
  const [password, setPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    if (bootstrap.data && !bootstrap.data.has_users) {
      setMode("register");
    }
  }, [bootstrap.data]);

  const mutation = useMutation({
    mutationFn: async () => {
      if (mode === "login") {
        return api.auth.login({ identifier: identifier.trim(), password });
      }
      return api.auth.register({
        username: username.trim(),
        email: email.trim(),
        password,
        display_name: displayName.trim() || undefined,
      });
    },
    onSuccess: (data) => {
      setSession(data.access_token, data.user);
      queryClient.invalidateQueries();
      toast.success(mode === "login" ? "Welcome back" : "Your journal is ready", {
        description:
          mode === "login" ? `Signed in as ${data.user.username}` : "Start by creating your first trip.",
      });
      navigate(redirectTo, { replace: true });
    },
    onError: (mutationError) => {
      if (mutationError instanceof ApiError) {
        const details = Array.isArray(mutationError.details)
          ? mutationError.details
              .map((item) => (item as { message?: string }).message)
              .filter(Boolean)
          : [];
        setError(details.length ? `${mutationError.message}: ${details.join(", ")}` : mutationError.message);
      } else {
        setError("Something went wrong. Please try again.");
      }
    },
  });

  if (user) return <Navigate to={redirectTo} replace />;

  const hasUsers = bootstrap.data?.has_users ?? false;
  const registrationAllowed =
    bootstrap.data?.registration_enabled !== false || !hasUsers;

  const canSubmit =
    mode === "login"
      ? identifier.trim().length > 0 && password.length > 0
      : username.trim().length >= 3 && email.includes("@") && password.length >= 8;

  const submit = (event: React.FormEvent) => {
    event.preventDefault();
    if (!canSubmit || mutation.isPending) return;
    setError(null);
    mutation.mutate();
  };

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[1.05fr_1fr]">
      <section className="relative hidden overflow-hidden bg-[#163027] p-12 text-sand-50 lg:flex lg:flex-col lg:justify-between">
        <div className="absolute inset-0 bg-[radial-gradient(900px_500px_at_20%_0%,rgba(188,145,87,0.22),transparent_60%),radial-gradient(700px_400px_at_100%_100%,rgba(73,122,100,0.35),transparent_55%)]" />
        <svg
          viewBox="0 0 800 900"
          className="pointer-events-none absolute inset-0 size-full opacity-[0.16]"
          preserveAspectRatio="xMidYMid slice"
          aria-hidden
        >
          <g fill="none" stroke="#f4eee1" strokeWidth="1.4">
            <path d="M-80 640C120 640 150 380 330 380s190 250 380 250 170-80 250-80" strokeDasharray="2 12" />
            <circle cx="120" cy="610" r="7" fill="#f4eee1" stroke="none" />
            <circle cx="520" cy="452" r="7" fill="#d4722a" stroke="none" />
            <path d="M60 120h190M60 155h120M540 760h210M540 795h120" opacity="0.6" />
            <circle cx="640" cy="180" r="110" opacity="0.35" />
            <circle cx="640" cy="180" r="160" opacity="0.2" />
            <circle cx="112" cy="800" r="80" opacity="0.3" />
          </g>
        </svg>

        <div className="relative flex items-center gap-3">
          <LogoMark className="size-10" />
          <div>
            <p className="font-display text-xl font-semibold tracking-tight">TravelTrace</p>
            <p className="text-[9px] uppercase tracking-[0.26em] text-sand-200/60">Travel journal</p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="eyebrow text-sand-200/70">Personal travel memory</p>
          <h1 className="mt-5 text-balance font-display text-[3.6rem] font-semibold leading-[0.98] tracking-tight text-sand-50">
            Your journey,
            <br />
            <span className="text-sand-300">reconstructed.</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-sand-100/70">
            Import the photos you took, let TravelTrace read their time and place, and watch your
            trip return as a map, a timeline and a story worth keeping.
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.title} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sand-200">
                  <feature.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-sand-50">{feature.title}</span>
                  <span className="block text-xs leading-relaxed text-sand-100/55">
                    {feature.description}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] tracking-wide text-sand-200/50">
          <span>Open source · MIT licensed</span>
          <span>v{bootstrap.data?.app_version ?? "0.1.0"}</span>
        </div>
      </section>

      <section className="flex min-h-screen items-center justify-center px-5 py-12">
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <LogoMark className="size-9" />
            <span className="font-display text-xl font-semibold">TravelTrace</span>
          </div>

          <div className="mb-7 space-y-2">
            <p className="eyebrow">{hasUsers ? "Welcome back" : "First run"}</p>
            <h2 className="text-3xl">
              {mode === "login" ? "Sign in to your journal" : "Create your account"}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "login"
                ? "Pick up where your last journey left off."
                : hasUsers
                  ? "Set up your own space on this TravelTrace instance."
                  : "This instance is brand new. Create the first account to begin."}
            </p>
          </div>

          {registrationAllowed && (
            <div className="mb-6 grid grid-cols-2 gap-1 rounded-full border border-border/80 bg-card/60 p-1">
              {(["login", "register"] as const).map((value) => (
                <button
                  key={value}
                  type="button"
                  onClick={() => {
                    setMode(value);
                    setError(null);
                  }}
                  className={cn(
                    "rounded-full py-2 text-sm font-medium transition-all",
                    mode === value
                      ? "bg-primary text-primary-foreground shadow-sm"
                      : "text-muted-foreground hover:text-foreground",
                  )}
                >
                  {value === "login" ? "Sign in" : "Create account"}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "login" ? (
              <div className="space-y-1.5">
                <Label htmlFor="identifier">Username or email</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder="you@example.com"
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="display-name">Name</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    placeholder="How should we call you?"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">Username</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder="wanderer"
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">Email</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder="you@example.com"
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">Password</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={mode === "login" ? "Your password" : "At least 8 characters"}
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={showPassword ? "Hide password" : "Show password"}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="text-[11px] text-muted-foreground">
                  8–72 characters. Store it safely; there is no recovery email.
                </p>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button type="submit" size="lg" className="w-full" disabled={!canSubmit || mutation.isPending}>
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? "Sign in" : "Begin your journal"}
              {mode === "register" && <Compass className="size-4" />}
            </Button>
          </form>

          {!registrationAllowed && (
            <p className="mt-5 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-xs text-muted-foreground">
              Registration is closed on this instance. Ask the owner to create an account for you.
            </p>
          )}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
            Private by default. Photos are never sent to a third party unless you enable geocoding.
          </p>
        </div>
      </section>
    </div>
  );
}
