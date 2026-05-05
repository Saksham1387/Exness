import { useEffect } from "react";
import { Outlet, Link, useNavigate } from "react-router-dom";
import { useTradingStore } from "@/store/trading";
import { useAuthStore } from "@/store/auth";
import { useAssetsStore } from "@/store/assets";
import { toast } from "sonner";
import { Avatar, AvatarFallback } from "@/components/ui/avatar";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import { Settings, LogOut, ChevronDown } from "lucide-react";

export default function AppLayout() {
  const connect = useTradingStore((s) => s.connect);
  const disconnect = useTradingStore((s) => s.disconnect);
  const connected = useTradingStore((s) => s.connected);
  const subscribe = useTradingStore((s) => s.subscribe);

  const balance = useAuthStore((s) => s.balance);
  const user = useAuthStore((s) => s.user);
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
      <header className="flex items-center justify-between h-12 px-5 border-b border-border bg-surface-1 shrink-0">
        <Link
          to="/"
          className="text-accent font-semibold text-[13px] tracking-widest uppercase hover:opacity-80 transition-opacity"
        >
          Exness
        </Link>

        <div className="flex items-center gap-5">
          <span className="tabular-nums font-medium text-sm text-white">
            ${balance.toLocaleString("en-US", {
              minimumFractionDigits: 2,
              maximumFractionDigits: 2,
            })}{" "}
            <span className="text-muted text-xs font-normal">USD</span>
          </span>

          <Separator orientation="vertical" className="h-5 bg-border" />

          <Badge
            variant="outline"
            className={`text-[10px] gap-1.5 border-border px-2 py-0.5 ${
              connected ? "text-green" : "text-red"
            }`}
          >
            <span className={`w-1.5 h-1.5 rounded-full ${connected ? "bg-green" : "bg-red"}`} />
            {connected ? "Live" : "Offline"}
          </Badge>

          <DropdownMenu>
            <DropdownMenuTrigger className="flex items-center gap-2 outline-none group">
              <Avatar size="sm" className="bg-accent">
                <AvatarFallback className="bg-accent text-surface text-[10px] font-bold">
                  {getInitials()}
                </AvatarFallback>
              </Avatar>
              <ChevronDown className="size-3 text-muted group-hover:text-white transition-colors group-data-[state=open]:rotate-180 duration-200" />
            </DropdownMenuTrigger>

            <DropdownMenuContent align="end" className="w-52 bg-surface-1 border-border">
              <DropdownMenuLabel className="font-normal">
                <div className="flex flex-col gap-0.5">
                  <p className="text-xs font-medium text-white truncate">
                    {user?.username || user?.email}
                  </p>
                  <p className="text-[10px] text-muted truncate">
                    {user?.email}
                  </p>
                </div>
              </DropdownMenuLabel>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem asChild className="cursor-pointer text-muted hover:text-white text-xs">
                <Link to="/settings">
                  <Settings className="size-3.5 mr-1.5" />
                  Settings
                </Link>
              </DropdownMenuItem>
              <DropdownMenuSeparator className="bg-border" />
              <DropdownMenuItem
                onClick={handleLogout}
                variant="destructive"
                className="cursor-pointer text-red text-xs"
              >
                <LogOut className="size-3.5 mr-1.5" />
                Logout
              </DropdownMenuItem>
            </DropdownMenuContent>
          </DropdownMenu>
        </div>
      </header>

      <div className="flex-1 min-h-0">
        <Outlet />
      </div>
    </div>
  );
}
