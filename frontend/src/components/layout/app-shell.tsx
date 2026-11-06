import { useMutation, useQueryClient } from "@tanstack/react-query";
import {
  ChevronUp,
  Images,
  LayoutDashboard,
  LogOut,
  Luggage,
  Map as MapIcon,
  Plus,
  Settings,
} from "lucide-react";
import { Link, NavLink, Outlet, useNavigate } from "react-router-dom";

import { Avatar } from "@/components/common/avatar";
import { Logo, LogoMark } from "@/components/common/logo";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { api } from "@/lib/api";
import { cn } from "@/lib/utils";
import { useAuthStore } from "@/stores/auth";

const NAV_ITEMS = [
  { to: "/", label: "Dashboard", icon: LayoutDashboard, end: true },
  { to: "/map", label: "Map", icon: MapIcon },
  { to: "/trips", label: "Trips", icon: Luggage },
  { to: "/photos", label: "Photos", icon: Images },
];

const MOBILE_ITEMS = [...NAV_ITEMS, { to: "/settings", label: "Settings", icon: Settings, end: false }];

export function AppShell() {
  const user = useAuthStore((state) => state.user);
  const clear = useAuthStore((state) => state.clear);
  const navigate = useNavigate();
  const queryClient = useQueryClient();

  const logout = useMutation({
    mutationFn: api.auth.logout,
    onSettled: () => {
      clear();
      queryClient.clear();
      navigate("/login", { replace: true });
    },
  });

  const displayName = user?.display_name || user?.username || "Traveller";

  return (
    <div className="min-h-screen lg:grid lg:grid-cols-[252px_minmax(0,1fr)]">
      <aside className="sticky top-0 hidden h-screen flex-col border-r border-border/70 bg-[#f7f2e8]/80 px-4 py-6 backdrop-blur lg:flex">
        <Link to="/" className="px-2" aria-label="TravelTrace home">
          <Logo />
        </Link>

        <Link
          to="/trips?new=1"
          className={cn(
            "mt-7 flex h-10 items-center justify-center gap-2 rounded-full bg-primary px-4 text-sm font-medium text-primary-foreground shadow-sm transition-colors hover:bg-pine-800",
          )}
        >
          <Plus className="size-4" />
          New trip
        </Link>

        <nav className="mt-8 flex flex-1 flex-col gap-6">
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
              Journal
            </p>
            {NAV_ITEMS.map((item) => (
              <SidebarLink key={item.to} {...item} />
            ))}
          </div>
          <div className="space-y-1">
            <p className="px-3 pb-1 text-[10px] font-semibold uppercase tracking-[0.2em] text-muted-foreground/80">
              Account
            </p>
            <SidebarLink to="/settings" label="Settings" icon={Settings} />
          </div>
        </nav>

        <div className="mb-4 rounded-2xl border border-pine-200/60 bg-pine-50/60 p-3.5">
          <p className="font-display text-sm font-semibold text-pine-900">Local-first by design</p>
          <p className="mt-1 text-[11px] leading-relaxed text-pine-800/70">
            Your photos and tracks stay on your own server. Nothing leaves unless you enable it.
          </p>
        </div>

        <DropdownMenu>
          <DropdownMenuTrigger asChild>
            <button className="flex w-full items-center gap-3 rounded-2xl border border-transparent p-2 text-left transition-colors hover:border-border hover:bg-card/70 focus:outline-none focus-visible:ring-2 focus-visible:ring-ring">
              <Avatar name={displayName} size="md" />
              <span className="min-w-0 flex-1">
                <span className="block truncate text-sm font-medium">{displayName}</span>
                <span className="block truncate text-[11px] text-muted-foreground">
                  {user?.email}
                </span>
              </span>
              <ChevronUp className="size-4 text-muted-foreground" />
            </button>
          </DropdownMenuTrigger>
          <DropdownMenuContent align="end" side="top" className="w-56">
            <DropdownMenuLabel>{user?.username}</DropdownMenuLabel>
            <DropdownMenuSeparator />
            <DropdownMenuItem asChild>
              <Link to="/settings">
                <Settings className="size-4" />
                Settings
              </Link>
            </DropdownMenuItem>
            <DropdownMenuSeparator />
            <DropdownMenuItem
              destructive
              disabled={logout.isPending}
              onSelect={(event) => {
                event.preventDefault();
                logout.mutate();
              }}
            >
              <LogOut className="size-4" />
              Sign out
            </DropdownMenuItem>
          </DropdownMenuContent>
        </DropdownMenu>
      </aside>

      <div className="min-w-0 pb-24 lg:pb-0">
        <header className="sticky top-0 z-40 flex items-center justify-between border-b border-border/60 bg-background/85 px-5 py-3 backdrop-blur lg:hidden">
          <Link to="/" className="flex items-center gap-2">
            <LogoMark className="size-8" />
            <span className="font-display text-lg font-semibold">TravelTrace</span>
          </Link>
          <Link to="/settings" aria-label="Settings">
            <Avatar name={displayName} size="sm" />
          </Link>
        </header>
        <main>
          <Outlet />
        </main>
      </div>

      <nav className="fixed inset-x-0 bottom-0 z-40 border-t border-border/70 bg-background/95 pb-[env(safe-area-inset-bottom)] backdrop-blur lg:hidden">
        <div className="grid grid-cols-5">
          {MOBILE_ITEMS.map((item) => (
            <NavLink
              key={item.to}
              to={item.to}
              end={item.end}
              className={({ isActive }) =>
                cn(
                  "flex flex-col items-center gap-1 py-2.5 text-[10px] font-medium transition-colors",
                  isActive ? "text-primary" : "text-muted-foreground",
                )
              }
            >
              <item.icon className="size-5" />
              {item.label}
            </NavLink>
          ))}
        </div>
      </nav>
    </div>
  );
}

function SidebarLink({
  to,
  label,
  icon: Icon,
  end = false,
}: {
  to: string;
  label: string;
  icon: typeof LayoutDashboard;
  end?: boolean;
}) {
  return (
    <NavLink
      to={to}
      end={end}
      className={({ isActive }) =>
        cn(
          "flex items-center gap-3 rounded-xl px-3 py-2 text-sm font-medium transition-colors",
          isActive
            ? "bg-primary text-primary-foreground shadow-sm"
            : "text-foreground/75 hover:bg-card/80 hover:text-foreground",
        )
      }
    >
      <Icon className="size-5" />
      {label}
    </NavLink>
  );
}
