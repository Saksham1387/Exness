import { useEffect } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useTradingStore } from "@/store/trading";
import { useAuthStore } from "@/store/auth";
import { useAssetsStore } from "@/store/assets";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, ChevronDown } from "lucide-react";
import { Button } from "@/components/ui/button";

export default function AppLayout() {
  const connect = useTradingStore((s) => s.connect);
  const disconnect = useTradingStore((s) => s.disconnect);
  const connected = useTradingStore((s) => s.connected);
  const subscribe = useTradingStore((s) => s.subscribe);

  const balance = useAuthStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);
  const isAuthenticated = useAuthStore((s) => s.isAuthenticated);
  const logout = useAuthStore((s) => s.logout);
  const fetchBalance = useAuthStore((s) => s.fetchBalance);

  const { assets, load } = useAssetsStore();
  const navigate = useNavigate();

  useEffect(() => {
    connect();
    fetchBalance();
    load();
    return () => disconnect();
  }, [connect, disconnect, fetchBalance, load]);

  useEffect(() => {
    if (assets.length > 0) {
      subscribe(assets.map((a) => a.symbol));
    }
  }, [assets, subscribe]);

  const handleLogout = () => {
    logout();
    toast.success("Signed out", { description: "You've been logged out successfully." });
    navigate("/auth");
  };

  const getInitials = () => {
    if (user?.username) return user.username.substring(0, 2).toUpperCase();
    if (user?.firstName) return (user.firstName[0] + (user.lastName?.[0] || "")).toUpperCase();
    return user?.email.substring(0, 2).toUpperCase();
  };

  return (
    <div className="h-screen flex flex-col bg-surface text-foreground overflow-hidden">
      <header className="flex items-center justify-between h-14 px-6 border-b border-border bg-surface-1 shrink-0">
        <div className="flex items-center gap-6">
          <Link
            to="/"
            className="text-accent font-bold text-base tracking-wide hover:opacity-80 transition-opacity"
          >
            Exness
          </Link>

          <nav className="hidden md:flex items-center gap-1">
            <Link
              to="/"
              className="px-3 py-1.5 rounded-md text-sm text-muted hover:text-white hover:bg-surface-2 transition-colors"
            >
              Markets
            </Link>
          </nav>
        </div>

        <div className="flex items-center gap-4">
          {!isAuthenticated ? (
            <Button
              onClick={() => navigate("/auth")}
              className="h-9 px-4 bg-accent text-surface hover:bg-accent/90 text-sm font-semibold"
            >
              Login
            </Button>
          ) : (
            <>
              <span className="tabular-nums font-medium text-sm text-white">
                ${balance.toLocaleString("en-US", {
                  minimumFractionDigits: 2,
                  maximumFractionDigits: 2,
                })}
              </span>

              <div className="h-5 w-px bg-border" />

              <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none group">
              <Avatar className="w-8 h-8 bg-accent">
                <AvatarFallback className="bg-accent text-surface text-xs font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="size-3.5 text-muted group-hover:text-white transition-colors group-data-[state=open]:rotate-180 duration-200" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-56 bg-surface-1 border-border">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-1">
                  <p className="text-sm font-medium text-white truncate">
                    {user?.username || user?.email}
                  </p>
                  <p className="text-xs text-muted truncate">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem asChild className="cursor-pointer text-muted hover:text-white text-sm">
                <Link to="/settings">
                  <Settings className="size-4 mr-2" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleLogout}
                variant="destructive"
                className="cursor-pointer text-red text-sm"
              >
                <LogOut className="size-4 mr-2" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
            </>
          )}
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
