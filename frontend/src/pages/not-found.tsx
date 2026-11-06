import { Compass } from "lucide-react";
import { Link } from "react-router-dom";

import { LogoMark } from "@/components/common/logo";
import { buttonVariants } from "@/components/ui/button";
import { useI18n } from "@/i18n";

export function NotFoundPage() {
  const { t } = useI18n();
  return (
    <div className="flex min-h-screen flex-col items-center justify-center gap-6 px-6 text-center">
      <LogoMark className="size-14 rounded-2xl shadow-soft" />
      <div className="space-y-2">
        <p className="eyebrow">{t("notFound.eyebrow")}</p>
        <h1 className="text-balance text-4xl">{t("notFound.title")}</h1>
        <p className="mx-auto max-w-sm text-sm text-muted-foreground">
          {t("notFound.description")}
        </p>
      </div>
      <Link to="/" className={buttonVariants({ variant: "default" })}>
        <Compass className="size-4" />
        {t("notFound.back")}
      </Link>
    </div>
  );
}
