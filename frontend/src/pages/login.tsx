import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Eye, EyeOff, Loader2, MapPinned, ShieldCheck, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { Navigate, useLocation, useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { LogoMark } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { ApiError, api } from "@/lib/api";
import {
  clearStoredApiBase,
  getStoredApiBase,
  isNativeApp,
  serverLabel,
} from "@/lib/mobile";
import { useBootstrap } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

const FEATURES = [
  {
    icon: MapPinned,
    titleKey: "login.featureMapTitle",
    bodyKey: "login.featureMapBody",
  },
  {
    icon: Sparkles,
    titleKey: "login.featurePhotoTitle",
    bodyKey: "login.featurePhotoBody",
  },
  {
    icon: ShieldCheck,
    titleKey: "login.featureLocalTitle",
    bodyKey: "login.featureLocalBody",
  },
] as const;

type Mode = "login" | "register";

export function LoginPage() {
  const { t, errorText } = useI18n();
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
      toast.success(
        mode === "login" ? t("login.welcomeToast") : t("login.journalReadyToast"),
        {
          description:
            mode === "login"
              ? t("login.signedInAs", { username: data.user.username })
              : t("login.startFirstTrip"),
        },
      );
      navigate(redirectTo, { replace: true });
    },
    onError: (mutationError) => {
      setError(
        mutationError instanceof ApiError ? errorText(mutationError) : t("login.genericError"),
      );
    },
  });

  if (user) return <Navigate to={redirectTo} replace />;

  const hasUsers = bootstrap.data?.has_users ?? false;
  const registrationAllowed = bootstrap.data?.registration_enabled !== false || !hasUsers;
  const nativeBase = isNativeApp() ? getStoredApiBase() : null;

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
            <path
              d="M-80 640C120 640 150 380 330 380s190 250 380 250 170-80 250-80"
              strokeDasharray="2 12"
            />
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
            <p className="text-[9px] uppercase tracking-[0.26em] text-sand-200/60">
              {t("app.travelJournal")}
            </p>
          </div>
        </div>

        <div className="relative max-w-xl">
          <p className="eyebrow text-sand-200/70">{t("login.heroEyebrow")}</p>
          <h1 className="mt-5 text-balance font-display text-[3.6rem] font-semibold leading-[0.98] tracking-tight text-sand-50">
            {t("login.heroLine1")}
            <br />
            <span className="text-sand-300">{t("login.heroLine2")}</span>
          </h1>
          <p className="mt-6 max-w-md text-[15px] leading-relaxed text-sand-100/70">
            {t("login.heroIntro")}
          </p>

          <ul className="mt-10 space-y-4">
            {FEATURES.map((feature) => (
              <li key={feature.titleKey} className="flex items-start gap-3.5">
                <span className="mt-0.5 flex size-9 shrink-0 items-center justify-center rounded-xl border border-white/10 bg-white/5 text-sand-200">
                  <feature.icon className="size-4" />
                </span>
                <span>
                  <span className="block text-sm font-medium text-sand-50">
                    {t(feature.titleKey)}
                  </span>
                  <span className="block text-xs leading-relaxed text-sand-100/55">
                    {t(feature.bodyKey)}
                  </span>
                </span>
              </li>
            ))}
          </ul>
        </div>

        <div className="relative flex items-center justify-between text-[11px] tracking-wide text-sand-200/50">
          <span>{t("app.openSource")}</span>
          <span>v{bootstrap.data?.app_version ?? "0.1.1"}</span>
        </div>
      </section>

      <section className="relative flex min-h-screen items-center justify-center px-5 py-12">
        <LanguageSwitcher className="absolute right-5 top-5" />
        <div className="w-full max-w-[400px] animate-fade-in">
          <div className="mb-10 flex items-center gap-2.5 lg:hidden">
            <LogoMark className="size-9" />
            <span className="font-display text-xl font-semibold">TravelTrace</span>
          </div>

          <div className="mb-7 space-y-2">
            <p className="eyebrow">
              {hasUsers ? t("login.eyebrowWelcome") : t("login.eyebrowFirstRun")}
            </p>
            <h2 className="text-3xl">
              {mode === "login" ? t("login.signInTitle") : t("login.registerTitle")}
            </h2>
            <p className="text-sm leading-relaxed text-muted-foreground">
              {mode === "login"
                ? t("login.signInSubtitle")
                : hasUsers
                  ? t("login.registerSubtitleExisting")
                  : t("login.registerSubtitleFirst")}
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
                  {value === "login" ? t("login.tabSignIn") : t("login.tabRegister")}
                </button>
              ))}
            </div>
          )}

          <form onSubmit={submit} className="space-y-4">
            {mode === "login" ? (
              <div className="space-y-1.5">
                <Label htmlFor="identifier">{t("login.identifier")}</Label>
                <Input
                  id="identifier"
                  value={identifier}
                  onChange={(event) => setIdentifier(event.target.value)}
                  autoComplete="username"
                  placeholder={t("login.emailPlaceholder")}
                  autoFocus
                />
              </div>
            ) : (
              <>
                <div className="space-y-1.5">
                  <Label htmlFor="display-name">{t("login.name")}</Label>
                  <Input
                    id="display-name"
                    value={displayName}
                    onChange={(event) => setDisplayName(event.target.value)}
                    autoComplete="name"
                    placeholder={t("login.namePlaceholder")}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="username">{t("login.username")}</Label>
                  <Input
                    id="username"
                    value={username}
                    onChange={(event) => setUsername(event.target.value)}
                    autoComplete="username"
                    placeholder={t("login.usernamePlaceholder")}
                    minLength={3}
                    maxLength={50}
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="email">{t("login.email")}</Label>
                  <Input
                    id="email"
                    type="email"
                    value={email}
                    onChange={(event) => setEmail(event.target.value)}
                    autoComplete="email"
                    placeholder={t("login.emailPlaceholder")}
                  />
                </div>
              </>
            )}

            <div className="space-y-1.5">
              <Label htmlFor="password">{t("login.password")}</Label>
              <div className="relative">
                <Input
                  id="password"
                  type={showPassword ? "text" : "password"}
                  value={password}
                  onChange={(event) => setPassword(event.target.value)}
                  autoComplete={mode === "login" ? "current-password" : "new-password"}
                  placeholder={
                    mode === "login"
                      ? t("login.passwordPlaceholderSignIn")
                      : t("login.passwordPlaceholderRegister")
                  }
                  className="pr-11"
                />
                <button
                  type="button"
                  onClick={() => setShowPassword((current) => !current)}
                  className="absolute right-2 top-1/2 -translate-y-1/2 rounded-full p-1.5 text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
                  aria-label={showPassword ? t("login.hidePassword") : t("login.showPassword")}
                >
                  {showPassword ? <EyeOff className="size-4" /> : <Eye className="size-4" />}
                </button>
              </div>
              {mode === "register" && (
                <p className="text-[11px] text-muted-foreground">{t("login.passwordHint")}</p>
              )}
            </div>

            {error && (
              <div className="rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-sm text-red-700">
                {error}
              </div>
            )}

            <Button
              type="submit"
              size="lg"
              className="w-full"
              disabled={!canSubmit || mutation.isPending}
            >
              {mutation.isPending && <Loader2 className="size-4 animate-spin" />}
              {mode === "login" ? t("login.submitSignIn") : t("login.submitRegister")}
              {mode === "register" && <Compass className="size-4" />}
            </Button>
          </form>

          {!registrationAllowed && (
            <p className="mt-5 rounded-xl bg-secondary/60 px-3.5 py-2.5 text-xs text-muted-foreground">
              {t("login.registrationClosed")}
            </p>
          )}

          <p className="mt-8 text-center text-[11px] leading-relaxed text-muted-foreground">
            {t("login.privacyNote")}
          </p>

          {nativeBase && (
            <button
              type="button"
              onClick={() => {
                clearStoredApiBase();
                window.location.reload();
              }}
              className="mx-auto mt-3 block max-w-full truncate rounded-full px-3 py-1 text-[11px] text-muted-foreground transition-colors hover:bg-secondary hover:text-foreground"
            >
              {t("mobile.currentServer")}: {serverLabel(nativeBase)} · {t("mobile.changeServer")}
            </button>
          )}
        </div>
      </section>
    </div>
  );
}
