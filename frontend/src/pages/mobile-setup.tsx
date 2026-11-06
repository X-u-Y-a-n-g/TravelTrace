import { ArrowRight, Loader2, Server } from "lucide-react";
import { useState } from "react";

import { LanguageSwitcher } from "@/components/common/language-switcher";
import { LogoMark } from "@/components/common/logo";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { useI18n } from "@/i18n";
import { normalizeApiBase, saveApiBase } from "@/lib/mobile";

const DOCS_URL = "https://github.com/X-u-Y-a-N-g/TravelTrace/blob/main/docs/deployment.md";

export function MobileSetupPage() {
  const { t } = useI18n();
  const [server, setServer] = useState("");
  const [error, setError] = useState<string | null>(null);
  const [connecting, setConnecting] = useState(false);

  const connect = async (event: React.FormEvent) => {
    event.preventDefault();
    if (connecting) return;

    const base = normalizeApiBase(server);
    if (!base) {
      setError(t("mobile.invalidUrl"));
      return;
    }

    setError(null);
    setConnecting(true);
    const controller = new AbortController();
    const timeout = window.setTimeout(() => controller.abort(), 10_000);

    try {
      const response = await fetch(`${base}/health`, {
        headers: { Accept: "application/json" },
        cache: "no-store",
        signal: controller.signal,
      });
      if (!response.ok) {
        setError(t("mobile.unreachable"));
        return;
      }
      const payload = (await response.json()) as { status?: string };
      if (payload.status !== "ok") {
        setError(t("mobile.notTravelTrace"));
        return;
      }
      saveApiBase(base);
      window.location.reload();
    } catch {
      setError(t("mobile.unreachable"));
    } finally {
      window.clearTimeout(timeout);
      setConnecting(false);
    }
  };

  return (
    <div className="relative flex min-h-screen items-center justify-center bg-[#f7f2e8] px-5 py-12">
      <div className="absolute inset-0 bg-[radial-gradient(800px_500px_at_15%_0%,rgba(188,145,87,0.18),transparent_60%),radial-gradient(700px_400px_at_100%_100%,rgba(73,122,100,0.18),transparent_55%)]" />
      <LanguageSwitcher className="absolute right-5 top-5 z-10" />

      <div className="relative w-full max-w-[430px] animate-fade-in">
        <div className="mb-8 flex flex-col items-center text-center">
          <LogoMark className="size-14 rounded-2xl shadow-soft" />
          <p className="eyebrow mt-5">{t("mobile.setupEyebrow")}</p>
          <h1 className="mt-2 text-balance text-3xl">{t("mobile.setupTitle")}</h1>
          <p className="mt-3 max-w-sm text-sm leading-relaxed text-muted-foreground">
            {t("mobile.setupDescription")}
          </p>
        </div>

        <form
          onSubmit={connect}
          className="rounded-3xl border border-border/80 bg-card/90 p-6 shadow-soft backdrop-blur"
        >
          <div className="space-y-2">
            <Label htmlFor="mobile-server">{t("mobile.serverLabel")}</Label>
            <div className="relative">
              <Server className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
              <Input
                id="mobile-server"
                value={server}
                onChange={(event) => setServer(event.target.value)}
                placeholder={t("mobile.serverPlaceholder")}
                inputMode="url"
                autoCapitalize="none"
                autoCorrect="off"
                spellCheck={false}
                className="pl-10"
                disabled={connecting}
                autoFocus
              />
            </div>
            <p className="text-[11px] leading-relaxed text-muted-foreground">
              {t("mobile.serverHint")}
            </p>
          </div>

          {error && (
            <div className="mt-4 rounded-xl border border-red-200 bg-red-50 px-3.5 py-2.5 text-xs leading-relaxed text-red-700">
              {error}
            </div>
          )}

          <Button type="submit" size="lg" className="mt-5 w-full" disabled={connecting}>
            {connecting ? <Loader2 className="size-4 animate-spin" /> : <ArrowRight className="size-4" />}
            {connecting ? t("mobile.connecting") : t("mobile.connect")}
          </Button>
        </form>

        <div className="mt-6 flex flex-col items-center gap-2 text-center text-[11px] text-muted-foreground">
          <p>{t("mobile.privacy")}</p>
          <a
            href={DOCS_URL}
            target="_blank"
            rel="noreferrer"
            className="font-medium text-primary hover:underline"
          >
            {t("mobile.docs")}
          </a>
        </div>
      </div>
    </div>
  );
}
