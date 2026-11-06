import { useEffect } from "react";
import {
  BrowserRouter,
  Navigate,
  Outlet,
  Route,
  Routes,
  useLocation,
} from "react-router-dom";

import { ErrorBoundary } from "@/components/common/error-boundary";
import { Splash } from "@/components/common/splash";
import { AppShell } from "@/components/layout/app-shell";
import { ApiError } from "@/lib/api";
import { useMe } from "@/lib/queries";
import { useAuthStore } from "@/stores/auth";

import { DashboardPage } from "@/pages/dashboard";
import { LoginPage } from "@/pages/login";
import { MapPage } from "@/pages/map";
import { NotFoundPage } from "@/pages/not-found";
import { PhotosPage } from "@/pages/photos";
import { SettingsPage } from "@/pages/settings";
import { TripDetailPage } from "@/pages/trip-detail";
import { TripsPage } from "@/pages/trips";

function SessionGate() {
  const user = useAuthStore((state) => state.user);
  const setUser = useAuthStore((state) => state.setUser);
  const clear = useAuthStore((state) => state.clear);
  const me = useMe(true);

  useEffect(() => {
    if (me.data) setUser(me.data);
    else if (me.error instanceof ApiError && me.error.status === 401) clear();
  }, [me.data, me.error, setUser, clear]);

  if (me.isLoading || (me.data && !user)) return <Splash />;

  return (
    <Routes>
      <Route path="/login" element={<LoginPage />} />
      <Route element={<RequireAuth />}>
        <Route element={<AppShell />}>
          <Route index element={<DashboardPage />} />
          <Route path="/map" element={<MapPage />} />
          <Route path="/trips" element={<TripsPage />} />
          <Route path="/trips/:tripId" element={<TripDetailPage />} />
          <Route path="/photos" element={<PhotosPage />} />
          <Route path="/settings" element={<SettingsPage />} />
        </Route>
      </Route>
      <Route path="*" element={<NotFoundPage />} />
    </Routes>
  );
}

function RequireAuth() {
  const user = useAuthStore((state) => state.user);
  const location = useLocation();
  if (!user) {
    return <Navigate to="/login" replace state={{ from: location.pathname }} />;
  }
  return <Outlet />;
}

export function App() {
  return (
    <ErrorBoundary>
      <BrowserRouter>
        <SessionGate />
      </BrowserRouter>
    </ErrorBoundary>
  );
}
