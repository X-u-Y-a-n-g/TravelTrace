import { useMutation, useQueryClient } from "@tanstack/react-query";
import { Compass, Plus, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { useNavigate, useSearchParams } from "react-router-dom";
import { toast } from "sonner";

import { ConfirmDialog } from "@/components/common/confirm-dialog";
import { ErrorState } from "@/components/common/error-state";
import { TripCard } from "@/components/trip/trip-card";
import { TripFormDialog } from "@/components/trip/trip-form-dialog";
import { Button } from "@/components/ui/button";
import { EmptyState } from "@/components/ui/empty-state";
import { Input } from "@/components/ui/input";
import { PageHeader } from "@/components/ui/page-header";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/skeleton";
import { useI18n } from "@/i18n";
import { api } from "@/lib/api";
import { TRIP_SORT_OPTIONS } from "@/lib/constants";
import { useDebouncedValue } from "@/lib/hooks";
import { useStats, useTrips } from "@/lib/queries";
import type { Trip } from "@/lib/types";

export function TripsPage() {
  const { t, errorText } = useI18n();
  const navigate = useNavigate();
  const [searchParams, setSearchParams] = useSearchParams();
  const queryClient = useQueryClient();
  const stats = useStats();

  const [search, setSearch] = useState("");
  const debouncedSearch = useDebouncedValue(search, 300);
  const [year, setYear] = useState("");
  const [sort, setSort] = useState("start_date_desc");
  const [page, setPage] = useState(1);
  const [dialogOpen, setDialogOpen] = useState(searchParams.get("new") === "1");
  const [editingTrip, setEditingTrip] = useState<Trip | null>(null);
  const [pendingDelete, setPendingDelete] = useState<Trip | null>(null);

  useEffect(() => {
    if (searchParams.get("new") === "1") {
      setEditingTrip(null);
      setDialogOpen(true);
    }
  }, [searchParams]);

  useEffect(() => {
    setPage(1);
  }, [debouncedSearch, year, sort]);

  const trips = useTrips({
    page,
    size: 12,
    q: debouncedSearch || undefined,
    year: year ? Number(year) : undefined,
    sort,
  });

  const years = useMemo(() => {
    if (stats.data?.years.length) return stats.data.years.map((item) => item.year);
    const current = new Date().getFullYear();
    return [current, current - 1, current - 2];
  }, [stats.data]);

  const remove = useMutation({
    mutationFn: (trip: Trip) => api.trips.remove(trip.id),
    onSuccess: () => {
      toast.success(t("trips.deleteToast"), {
        description: t("trips.deleteToastDescription"),
      });
      queryClient.invalidateQueries({ queryKey: ["trips"] });
      queryClient.invalidateQueries({ queryKey: ["stats"] });
      queryClient.invalidateQueries({ queryKey: ["photos"] });
      queryClient.invalidateQueries({ queryKey: ["map"] });
      setPendingDelete(null);
    },
    onError: (error) => {
      toast.error(errorText(error));
    },
  });

  const handleDialogChange = (open: boolean) => {
    setDialogOpen(open);
    if (!open) {
      setEditingTrip(null);
      if (searchParams.get("new") === "1") {
        const next = new URLSearchParams(searchParams);
        next.delete("new");
        setSearchParams(next, { replace: true });
      }
    }
  };

  const isFiltered = Boolean(debouncedSearch || year);

  return (
    <div className="page-shell">
      <PageHeader
        eyebrow={t("trips.eyebrow")}
        title={t("trips.title")}
        description={t("trips.description")}
        actions={
          <Button
            variant="accent"
            onClick={() => {
              setEditingTrip(null);
              setDialogOpen(true);
            }}
          >
            <Plus className="size-4" />
            {t("trips.newTrip")}
          </Button>
        }
      />

      <div className="mb-6 flex flex-col gap-3 sm:flex-row sm:items-center">
        <div className="relative flex-1">
          <Search className="absolute left-3.5 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" />
          <Input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder={t("trips.searchPlaceholder")}
            className="pl-10"
            aria-label={t("common.search")}
          />
        </div>
        <div className="flex items-center gap-2">
          <div className="flex items-center gap-1.5 text-xs text-muted-foreground">
            <SlidersHorizontal className="size-3.5" />
            <span className="hidden sm:inline">{t("trips.filter")}</span>
          </div>
          <Select
            value={year}
            onChange={(event) => setYear(event.target.value)}
            aria-label={t("trips.allYears")}
            className="w-[130px]"
          >
            <option value="">{t("trips.allYears")}</option>
            {years.map((value) => (
              <option key={value} value={value}>
                {value}
              </option>
            ))}
          </Select>
          <Select
            value={sort}
            onChange={(event) => setSort(event.target.value)}
            aria-label={t("trips.filter")}
            className="w-[175px]"
          >
            {TRIP_SORT_OPTIONS.map((option) => (
              <option key={option.value} value={option.value}>
                {t(option.labelKey)}
              </option>
            ))}
          </Select>
        </div>
      </div>

      {trips.isPending ? (
        <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
          {[0, 1, 2, 3, 4, 5].map((index) => (
            <Skeleton key={index} className="h-[300px] rounded-3xl" />
          ))}
        </div>
      ) : trips.isError ? (
        <ErrorState
          title={t("error.load")}
          message={t("error.description")}
          onRetry={() => trips.refetch()}
        />
      ) : trips.data && trips.data.items.length > 0 ? (
        <>
          <div className="grid gap-4 sm:grid-cols-2 xl:grid-cols-3">
            {trips.data.items.map((trip) => (
              <TripCard
                key={trip.id}
                trip={trip}
                onEdit={(item) => {
                  setEditingTrip(item);
                  setDialogOpen(true);
                }}
                onDelete={(item) => setPendingDelete(item)}
              />
            ))}
          </div>

          <button
            type="button"
            onClick={() => {
              setEditingTrip(null);
              setDialogOpen(true);
            }}
            className="group mt-4 flex w-full flex-wrap items-center justify-between gap-4 rounded-3xl border border-dashed border-border bg-card/40 px-6 py-5 text-left transition-colors hover:border-pine-300 hover:bg-card/70"
          >
            <span className="flex items-center gap-3">
              <span className="flex size-11 items-center justify-center rounded-2xl bg-pine-100 text-pine-700 transition-transform group-hover:scale-105">
                <Plus className="size-5" />
              </span>
              <span>
                <span className="block font-display text-lg font-semibold">
                  {t("trips.planBannerTitle")}
                </span>
                <span className="block text-xs text-muted-foreground">
                  {t("trips.planBannerDescription")}
                </span>
              </span>
            </span>
            <span className="text-xs font-medium text-primary">{t("trips.planBannerCta")}</span>
          </button>

          {trips.data.pages > 1 && (
            <div className="mt-8 flex items-center justify-center gap-3">
              <Button
                variant="outline"
                size="sm"
                disabled={page <= 1}
                onClick={() => setPage((current) => Math.max(current - 1, 1))}
              >
                {t("common.previous")}
              </Button>
              <span className="text-xs text-muted-foreground">
                {t("common.pageOf", { page: trips.data.page, pages: trips.data.pages })}
              </span>
              <Button
                variant="outline"
                size="sm"
                disabled={page >= trips.data.pages}
                onClick={() => setPage((current) => current + 1)}
              >
                {t("common.next")}
              </Button>
            </div>
          )}
        </>
      ) : (
        <EmptyState
          icon={isFiltered ? Search : Compass}
          title={isFiltered ? t("trips.noMatchTitle") : t("trips.noTripsTitle")}
          description={
            isFiltered ? t("trips.noMatchDescription") : t("trips.noTripsDescription")
          }
          action={
            isFiltered ? (
              <Button
                variant="outline"
                onClick={() => {
                  setSearch("");
                  setYear("");
                }}
              >
                {t("common.clearFilters")}
              </Button>
            ) : (
              <Button variant="accent" onClick={() => setDialogOpen(true)}>
                <Plus className="size-4" />
                {t("trips.createFirst")}
              </Button>
            )
          }
        />
      )}

      <TripFormDialog
        open={dialogOpen}
        onOpenChange={handleDialogChange}
        trip={editingTrip}
        onSaved={(trip) => {
          if (!editingTrip) navigate(`/trips/${trip.id}`);
        }}
      />

      <ConfirmDialog
        open={Boolean(pendingDelete)}
        onOpenChange={(open) => {
          if (!open) setPendingDelete(null);
        }}
        title={t("trips.deleteTitle")}
        description={t("trips.deleteDescription", { title: pendingDelete?.title ?? "" })}
        confirmLabel={t("trips.deleteConfirm")}
        cancelLabel={t("common.cancel")}
        loading={remove.isPending}
        onConfirm={() => {
          if (pendingDelete) remove.mutate(pendingDelete);
        }}
      />
    </div>
  );
}
