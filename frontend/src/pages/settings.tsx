import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  Database,
  Download,
  HardDrive,
  KeyRound,
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
import { Badge } from "@/components/ui/badge";
import { Button, buttonVariants } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { ApiError, api, tripExportUrl } from "@/lib/api";
import { formatBytes, formatDate } from "@/lib/format";
import { useInstanceSettings, useTrips } from "@/lib/queries";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

export function SettingsPage() {
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

  useEffect(() => {
    setDisplayName(user?.display_name ?? user?.username ?? "");
  }, [user]);

  const updateProfile = useMutation({
    mutationFn: () => api.auth.updateProfile({ display_name: displayName.trim() }),
    onSuccess: (updated) => {
      setUser(updated);
      queryClient.setQueryData(["me"], updated);
      toast.success("Profile updated");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not update your profile");
    },
  });

  const changePassword = useMutation({
    mutationFn: () =>
      api.auth.changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      }),
    onSuccess: () => {
      toast.success("Password changed", { description: "Use it next time you sign in." });
      setCurrentPassword("");
      setNewPassword("");
    },
    onError: (error) => {
      toast.error(error instanceof ApiError ? error.message : "Could not change the password");
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
        eyebrow="Account & instance"
        title="Settings"
        description="Your profile, privacy choices, and the details of this self-hosted instance."
      />

      <div className="grid gap-5 xl:grid-cols-[1.25fr_1fr]">
        <div className="space-y-5">
          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <Avatar name={displayName || user?.username} size="lg" />
              <div className="min-w-0 flex-1">
                <CardTitle>Profile</CardTitle>
                <CardDescription>
                  {user?.username} · {user?.email}
                </CardDescription>
              </div>
              <Badge variant="sand">Signed in</Badge>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="space-y-1.5">
                <Label htmlFor="display-name">Display name</Label>
                <Input
                  id="display-name"
                  value={displayName}
                  onChange={(event) => setDisplayName(event.target.value)}
                  maxLength={100}
                />
              </div>
              <dl className="grid gap-3 rounded-2xl bg-secondary/50 p-4 text-sm sm:grid-cols-2">
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Username</dt>
                  <dd className="mt-0.5 font-medium">{user?.username}</dd>
                </div>
                <div>
                  <dt className="text-[10px] uppercase tracking-[0.14em] text-muted-foreground">Member since</dt>
                  <dd className="mt-0.5 font-medium">{formatDate(user?.created_at)}</dd>
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
                  Save profile
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-ember-100 text-ember-700">
                <KeyRound className="size-4" />
              </span>
              <div>
                <CardTitle>Password</CardTitle>
                <CardDescription>Change the password used to open this journal.</CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="grid gap-4 sm:grid-cols-2">
                <div className="space-y-1.5">
                  <Label htmlFor="current-password">Current password</Label>
                  <Input
                    id="current-password"
                    type="password"
                    value={currentPassword}
                    onChange={(event) => setCurrentPassword(event.target.value)}
                    autoComplete="current-password"
                  />
                </div>
                <div className="space-y-1.5">
                  <Label htmlFor="new-password">New password</Label>
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
                  Update password
                </Button>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader className="flex-row items-center gap-3 space-y-0">
              <span className="flex size-10 items-center justify-center rounded-xl bg-pine-100 text-pine-700">
                <Download className="size-4" />
              </span>
              <div>
                <CardTitle>Export your data</CardTitle>
                <CardDescription>
                  Download a trip as an open ZIP: metadata, GeoJSON, timeline and originals.
                </CardDescription>
              </div>
            </CardHeader>
            <CardContent className="space-y-4">
              <div className="flex flex-col gap-2 sm:flex-row sm:items-end">
                <div className="flex-1 space-y-1.5">
                  <Label htmlFor="export-trip">Trip</Label>
                  <Select
                    id="export-trip"
                    value={exportTripId}
                    onChange={(event) => setExportTripId(event.target.value)}
                  >
                    <option value="">Choose a trip…</option>
                    {trips.data?.items.map((trip) => (
                      <option key={trip.id} value={trip.id}>
                        {trip.title}
                      </option>
                    ))}
                  </Select>
                </div>
                {exportTripId ? (
                  <a
                    href={tripExportUrl(exportTripId)}
                    className={cn(buttonVariants({ variant: "default" }), "h-10")}
                    download
                  >
                    <Download className="size-4" />
                    Download ZIP
                  </a>
                ) : (
                  <Button disabled>
                    <Download className="size-4" />
                    Download ZIP
                  </Button>
                )}
              </div>
              <p className="text-xs leading-relaxed text-muted-foreground">
                The archive includes <code className="rounded bg-secondary px-1">manifest.json</code>,{" "}
                <code className="rounded bg-secondary px-1">trip.json</code>,{" "}
                <code className="rounded bg-secondary px-1">places.geojson</code>,{" "}
                <code className="rounded bg-secondary px-1">timeline.json</code> and the original
                photo files. No lock-in.
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
                <CardTitle>This instance</CardTitle>
                <CardDescription>TravelTrace {instance?.app_version ?? "0.1.0"}</CardDescription>
              </div>
            </CardHeader>
            <CardContent>
              <dl className="space-y-3 text-sm">
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Environment</dt>
                  <dd className="font-medium capitalize">{instance?.environment ?? "—"}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Photos</dt>
                  <dd className="font-medium">{instance?.photo_count ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Trips</dt>
                  <dd className="font-medium">{instance?.trip_count ?? 0}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Storage used</dt>
                  <dd className="font-medium">{formatBytes(instance?.storage_used_bytes ?? 0)}</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Upload limit</dt>
                  <dd className="font-medium">{instance?.max_upload_mb ?? 25} MB / photo</dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Registration</dt>
                  <dd>
                    <Badge variant={instance?.registration_enabled ? "default" : "muted"}>
                      {instance?.registration_enabled ? "Open" : "Closed"}
                    </Badge>
                  </dd>
                </div>
                <div className="flex items-center justify-between gap-3">
                  <dt className="text-muted-foreground">Reverse geocoding</dt>
                  <dd>
                    <Badge variant={instance?.geocoding_enabled ? "ember" : "muted"}>
                      {instance?.geocoding_enabled
                        ? instance.geocoding_provider
                        : "Disabled"}
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
              <CardTitle>Privacy principles</CardTitle>
              <CardDescription>How TravelTrace treats your travel memories.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-xs leading-relaxed text-muted-foreground">
              <p className="flex gap-2">
                <ShieldCheck className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                Trips are private by default. Nothing is shared publicly unless you change its
                visibility.
              </p>
              <p className="flex gap-2">
                <HardDrive className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                Originals stay in this instance's storage. Thumbnails are generated without EXIF
                metadata.
              </p>
              <p className="flex gap-2">
                <MapPinned className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                Coordinates are only sent to a geocoding provider when you enable it and ask for a
                lookup.
              </p>
              <p className="flex gap-2">
                <Sparkles className="mt-0.5 size-3.5 shrink-0 text-pine-700" />
                Automatic suggestions (timeline drafts, place matching) never alter your manual
                edits.
              </p>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
              <CardTitle>About</CardTitle>
              <CardDescription>Your journey, reconstructed.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-3 text-sm text-muted-foreground">
              <p className="leading-relaxed">
                TravelTrace is an open-source, self-hosted travel memory journal. Photos become a
                map, a timeline and a story you actually keep.
              </p>
              <div className="flex flex-wrap items-center gap-2">
                <a
                  href="https://github.com/X-u-Y-a-n-g/TravelTrace"
                  target="_blank"
                  rel="noreferrer"
                  className="text-xs font-medium text-primary hover:underline"
                >
                  GitHub repository
                </a>
                <span className="text-border">·</span>
                <span className="text-xs">MIT licensed</span>
                <span className="text-border">·</span>
                <span className="text-xs">v{instance?.app_version ?? "0.1.0"}</span>
              </div>
              <Button
                variant="outline"
                className="mt-2 w-full text-destructive hover:bg-red-50 hover:text-destructive"
                onClick={() => logout.mutate()}
              >
                <LogOut className="size-4" />
                Sign out
              </Button>
            </CardContent>
          </Card>
        </div>
      </div>
    </div>
  );
}
