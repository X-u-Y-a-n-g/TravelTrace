import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  HardDrive,
  KeyRound,
  Languages,
  Loader2,
  LogOut,
  MapPinned,
  ShieldCheck,
  Sparkles,
  UserRound,
} from "lucide-react";
import { useEffect, useState } from "react";
import { useNavigate } from "react-router-dom";
import { toast } from "sonner";

import { Avatar } from "@/components/common/avatar";
import { LanguageSwitcher } from "@/components/common/language-switcher";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { formatBytes } from "@/lib/format";
import { downloadTripZip } from "@/local/export";
import { isNativeApp } from "@/lib/mobile";import { useInstanceSettings, useTrips } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth";

export function SettingsPage() {
  const { t, f, errorText } = useI18n();
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();
  const settings = useInstanceSettings();
  const trips = useTrips({ size: 100, sort: "start_date_desc" });

  const [displayName, setDisplayName] = useState(user?.display_name ?? user?.username ?? "");
  const [currentPassword, setCurrentPassword] = useState("");
  const [newPassword, setNewPassword] = useState("");
  const [exportTripId, setExportTripId] = useState("");
  const [exporting, setExporting] = useState(false);
  const localMode = isNativeApp();

  useEffect(() => {
    setDisplayName(user?.display_name ?? user?.username ?? "");
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () => api.auth.updateProfile({ display_name: displayName.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.setQueryData(["me"], updated);
      toast.success(t("settings.profileUpdated"));
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      toast.success(t("settings.passwordChanged"), {
        description: t("settings.passwordChangedDescription"),
      });
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  const logout = useMutation({
    mutationFn: api.auth.logout,
    onSettled: () => {
      clear();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const instance = settings.data;

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={t("settings.eyebrow")}
        title={t("settings.title")}
        description={t("settings.description")}
      />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Avatar name={displayName || user?.username} size="lg" />
              <div className="min-w-0 flex-1">
                <CardTitle>{t("settings.profile")}</CardTitle>
                <CardDescription>
                  {user?.username} · {user?.email}
                </CardDescription>
              </div>
              <Badge variant="sand">{t("settings.signedIn")}</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">{t("settings.displayName")}</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={100}
                />
              </div>
              <dl className="grid gap-3 rounded-2xl bg-secondary/50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("settings.username")}</dt>
                  <dd className="mt-0.5 font-medium">{user?.username}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">{t("settings.memberSince")}</dt>
                  <dd className="mt-0.5 font-medium">{f.date(user?.created_at)}</dd>
                </div>
              </dl>
              <div className="flex justify-end">
                <Button
                  onClick={() => updateProfile.mutate()}
                  disabled={
                    updateProfile.isPending ||
                    !displayName.trim() ||
                    displayName.trim() === (user?.display_name ?? user?.username)
                  }
                >
                  {updateProfile.isPending ? <Loader2 className="size-4 animate-spin" /> : <UserRound className="size-4" />}
                  {t("settings.saveProfile")}
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-pine-100 text-pine-700">
                <Languages className="size-4" />
              </span>
              <div>
                <CardTitle>{t("settings.languageTitle")}</CardTitle>
                <CardDescription>{t("settings.languageDescription")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <LanguageSwitcher variant="full" />
            </CardContent>
          </Card>

          {localMode && (
            <Card>
              <CardHeader className="flex-row items-center gap-3 space-y-0">
                <span className="flex size-10 items-center justify-center rounded-xl bg-pine-100 text-pine-700">
                  <HardDrive className="size-4" />
                </span>
                <div>
                  <CardTitle>{t("local.storageTitle")}</CardTitle>
                  <CardDescription>{t("local.storageDescription")}</CardDescription>
                </div>
              </CardHeader>
              <CardContent className="space-y-3">
                <div className="grid grid-cols-2 gap-3 rounded-2xl bg-secondary/50 p-3.5 text-sm">
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("settings.photos")}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold">
                      {instance?.photo_count ?? 0}
                    </p>
                  </div>
                  <div>
                    <p className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">
                      {t("settings.trips")}
                    </p>
                    <p className="mt-1 font-display text-xl font-semibold">
                      {instance?.trip_count ?? 0}
                    </p>
                  </div>
                </div>
                <p className="text-xs leading-relaxed text-muted-foreground">
                  {t("local.storageNote")}
                </p>
              </CardContent>
            </Card>
          )}

          {!localMode && (
            <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-ember-100 text-ember-700">
                <KeyRound className="size-4" />
              </span>
              <div>
                <CardTitle>{t("settings.password")}</CardTitle>
                <CardDescription>{t("settings.passwordDescription")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">{t("settings.currentPassword")}</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">{t("settings.newPassword")}</Label>
                  <Input
                    id="new-password"
                    type="password"
                    value={newPassword}
                    onChange={(event) => setNewPassword(event.target.value)}
                    autoComplete="new-password"
                    minLength={8}
                  />
                </div>
              </div>
              <div className="flex justify-end">
                <Button
                  variant="outline"
                  onClick={() => changePassword.mutate()}
                  disabled={
                    changePassword.isPending || !currentPassword || newPassword.length < 8
                  }
                >
                  {changePassword.isPending && <Loader2 className="size-4 animate-spin" />}
                  {t("settings.updatePassword")}
                </Button>
              </div>
            </CardContent>
          </Card>
          )}

          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-pine-100 text-pine-700">
                <Download className="size-4" />
              </span>
              <div>
                <CardTitle>{t("settings.exportTitle")}</CardTitle>
                <CardDescription>{t("settings.exportDescription")}</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="export-trip">{t("settings.trip")}</Label>
                  <Select
                    id="export-trip"
                    value={exportTripId}
                    onChange={(event) => setExportTripId(event.target.value)}
                  >
                    <option value="">{t("settings.chooseTrip")}</option>
                    {trips.data?.items.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}
                      </option>
                    ))}
                  </Select>
                </div>
                {exportTripId ? (
                  <Button
                    className="h-10"
                    disabled={exporting}
                    onClick={async () => {
                      setExporting(true);
                      try {
                        await downloadTripZip(exportTripId);
                      } catch (error) {
                        toast.error(errorText(error));
                      } finally {
                        setExporting(false);
                      }
                    }}
                  >
                    {exporting ? <Loader2 className="size-4 animate-spin" /> : <Download className="size-4" />}
                    {t("settings.downloadZip")}
                  </Button>
                ) : (
                  <Button disabled>
                    <Download className="size-4" />
                    {t("settings.downloadZip")}
                  </Button>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                {t("settings.exportNote")}
              </p>
            </CardContent>
          </Card>
        </div>

        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-sand-100 text-sand-800">
                <Database className="size-4" />
              </span>
              <div>
                <CardTitle>{t("settings.instanceTitle")}</CardTitle>
                <CardDescription>TravelTrace {instance?.app_version ?? "0.1.1"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.environment")}</dt>
                  <dd className="font-medium">
                    {instance?.environment === "production"
                      ? t("settings.environmentProduction")
                      : instance?.environment === "test"
                        ? t("settings.environmentTest")
                        : instance?.environment === "development"
                          ? t("settings.environmentDevelopment")
                          : instance?.environment === "local"
                            ? t("settings.environmentLocal")
                            : (instance?.environment ?? "—")}
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.photos")}</dt>
                  <dd className="font-medium">{instance?.photo_count ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.trips")}</dt>
                  <dd className="font-medium">{instance?.trip_count ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.storageUsed")}</dt>
                  <dd className="font-medium">{formatBytes(instance?.storage_used_bytes ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.uploadLimit")}</dt>
                  <dd className="font-medium">{t("settings.storageLimit", { limit: instance?.max_upload_mb ?? 25 })}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.registration")}</dt>
                  <dd>
                    <Badge variant={instance?.registration_enabled ? "default" : "muted"}>
                      {instance?.registration_enabled ? t("settings.open") : t("settings.closed")}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">{t("settings.geocoding")}</dt>
                  <dd>
                    <Badge variant={instance?.geocoding_enabled ? "ember" : "muted"}>
                      {instance?.geocoding_enabled
                        ? instance.geocoding_provider
                        : t("settings.disabled")}
                    </Badge>
                  </dd>
                </div>
              </dl>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <span className="mb-1 flex size-10 items-center justify-center rounded-xl bg-pine-100 text-pine-700">
                <ShieldCheck className="size-4" />
              </span>
              <CardTitle>{t("settings.privacyTitle")}</CardTitle>
              <CardDescription>{t("settings.privacyDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                {t("settings.privacy1")}
              </p>
              <p className="flex gap-2">
                <HardDrive className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                {t("settings.privacy2")}
              </p>
              <p className="flex gap-2">
                <MapPinned className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                {t("settings.privacy3")}
              </p>
              <p className="flex gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                {t("settings.privacy4")}
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>{t("settings.aboutTitle")}</CardTitle>
              <CardDescription>{t("settings.aboutDescription")}</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                {t("settings.aboutBody")}
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://github.com/X-u-Y-a-n-g/TravelTrace"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  {t("settings.github")}
                </a>
                <span className="text-border">·</span>
                <span className="text-xs">{t("settings.mit")}</span>
                <span className="text-border">·</span>
                <span className="text-xs">v{instance?.app_version ?? "0.3.0"}</span>
              </div>
              {!localMode && (
                <Button
                  variant="outline"
                  className="mt-2 w-full text-destructive hover:bg-red-50 hover:text-destructive"
                  onClick={() => logout.mutate()}
                >
                  <LogOut className="size-4" />
                  {t("settings.signOut")}
                </Button>
              )}
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
