import { useState, useRef, useEffect } from "react";
import { useNavigate } from "react-router-dom";
import { api, type AssetInfo } from "@/lib/api";
import { useTradingStore } from "@/store/trading";
import { useAuthStore } from "@/store/auth";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Label } from "@/components/ui/label";
import { Badge } from "@/components/ui/badge";
import { Separator } from "@/components/ui/separator";
import { ChevronDown, Minus, Plus, Loader2 } from "lucide-react";

export default function TradingPanel({
  assets,
  selectedAsset,
  onTradeExecuted,
}: {
  assets: AssetInfo[];
  selectedAsset: AssetInfo | null;
  onTradeExecuted: () => void;
}) {
  const navigate = useNavigate();
  const [volume, setVolume] = useState("10.00");
  const [leverage, setLeverage] = useState(1);
  const [takeProfit, setTakeProfit] = useState("");
  const [stopLoss, setStopLoss] = useState("");
  const [loading, setLoading] = useState<"BUY" | "SELL" | null>(null);
  const [dropdownOpen, setDropdownOpen] = useState(false);
  const dropdownRef = useRef<HTMLDivElement>(null);

  const symbol = selectedAsset?.symbol ?? "";
  const decimals = selectedAsset?.decimals ?? 4;
  const scale = Math.pow(10, decimals);

  const prices = useTradingStore((s) => s.prices);
  const currentPrice = symbol ? (prices[symbol] ?? null) : null;
  const fetchBalance = useAuthStore((s) => s.fetchBalance);

  const sellPrice = currentPrice ? currentPrice.sellPrice / scale : null;
  const buyPrice = currentPrice ? currentPrice.buyPrice / scale : null;

  const formatPrice = (p: number | null) =>
    p !== null ? formatNumber(p, decimals) : "—";

  const spread =
    buyPrice && sellPrice
      ? (buyPrice - sellPrice).toFixed(decimals)
      : "—";

  const displayName = symbol ? symbol.replace("USDT", "/USDT") : "";
  const baseAssetName = symbol ? symbol.replace("USDT", "") : "";

  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (dropdownRef.current && !dropdownRef.current.contains(e.target as Node)) {
        setDropdownOpen(false);
      }
    };
    document.addEventListener("mousedown", handleClickOutside);
    return () => document.removeEventListener("mousedown", handleClickOutside);
  }, []);

  const executeTrade = async (type: "BUY" | "SELL") => {
    if (!symbol) return;
    setLoading(type);
    try {
      const marginCents = Math.round(parseFloat(volume) * 100);
      
      const tpValue = takeProfit ? Math.round(parseFloat(takeProfit) * scale) : undefined;
      const slValue = stopLoss ? Math.round(parseFloat(stopLoss) * scale) : undefined;

      await api.openTrade(symbol, type, marginCents, leverage, tpValue, slValue);
      await fetchBalance();
      onTradeExecuted();
      
      setTakeProfit("");
      setStopLoss("");
      
      toast.success(`${type} order placed`, {
        description: `${displayName} — $${formatNumber(parseFloat(volume), 2)} margin at ${leverage}x leverage`,
      });
    } catch (err) {
      toast.error("Trade failed", {
        description: err instanceof Error ? err.message : "Could not execute trade",
      });
    } finally {
      setLoading(null);
    }
  };

  const adjustVolume = (delta: number) => {
    const next = Math.max(1, parseFloat(volume) + delta);
    setVolume(next.toFixed(2));
  };

  const navigateToAsset = (assetSymbol: string) => {
    const slug = assetSymbol.replace("USDT", "_USDT");
    navigate(`/${slug}`);
    setDropdownOpen(false);
  };

  return (
    <div className="h-full flex flex-col bg-surface-1 border-l border-border">
      {/* Asset selector */}
      <div className="px-4 py-3 border-b border-border relative" ref={dropdownRef}>
        <button
          onClick={() => setDropdownOpen((o) => !o)}
          className="flex items-center gap-2.5 w-full rounded-lg px-2.5 py-2 -mx-2 hover:bg-surface-2 transition-colors"
        >
          {selectedAsset?.imageUrl ? (
            <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-6 h-6 rounded-full shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-surface-2 shrink-0" />
          )}
          <span className="text-sm font-medium text-white flex-1 text-left">
            {displayName || "Select market"}
          </span>
          <ChevronDown className={`size-4 text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute left-2 right-2 top-full z-50 bg-surface-2 border border-border rounded-lg shadow-2xl max-h-64 overflow-y-auto">
            {assets.map((asset) => {
              const isSelected = asset.symbol === symbol;
              const price = prices[asset.symbol];
              const assetScale = Math.pow(10, asset.decimals);
              const mid = price
                ? (price.buyPrice + price.sellPrice) / 2 / assetScale
                : null;

              return (
                <button
                  key={asset.symbol}
                  onClick={() => navigateToAsset(asset.symbol)}
                  className={`flex items-center gap-2.5 w-full px-3 py-2.5 text-left transition-colors ${
                    isSelected ? "bg-accent/8" : "hover:bg-surface-1"
                  }`}
                >
                  {asset.imageUrl ? (
                    <img src={asset.imageUrl} alt={asset.name} className="w-5 h-5 rounded-full shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-xs font-medium text-white">
                      {asset.symbol.replace("USDT", "/USDT")}
                    </div>
                    <div className="text-[10px] text-muted truncate">
                      {asset.name}
                    </div>
                  </div>
                  {mid !== null && (
                    <span className="text-[11px] text-muted tabular-nums">
                      ${formatNumber(mid, asset.decimals)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Sell / Buy */}
      <div className="flex border-b border-border">
        <Button
          variant="ghost"
          onClick={() => executeTrade("SELL")}
          disabled={loading !== null || !currentPrice}
          className="flex-1 h-auto py-3.5 px-4 rounded-none hover:bg-red/5 border-r border-border disabled:opacity-30"
        >
          <div className="w-full">
            <div className="text-[10px] text-muted uppercase tracking-wider mb-0.5">Sell</div>
            <div className="text-base font-semibold text-red tabular-nums">
              {loading === "SELL" ? <Loader2 className="size-4 animate-spin mx-auto" /> : `$${formatPrice(sellPrice)}`}
            </div>
          </div>
        </Button>
        <div className="flex items-center px-2.5 shrink-0">
          <Badge variant="outline" className="text-[10px] tabular-nums border-border text-muted px-1.5 h-5">
            {spread}
          </Badge>
        </div>
        <Button
          variant="ghost"
          onClick={() => executeTrade("BUY")}
          disabled={loading !== null || !currentPrice}
          className="flex-1 h-auto py-3.5 px-4 rounded-none hover:bg-green/5 disabled:opacity-30"
        >
          <div className="w-full">
            <div className="text-[10px] text-muted uppercase tracking-wider text-right mb-0.5">Buy</div>
            <div className="text-base font-semibold text-green tabular-nums text-right">
              {loading === "BUY" ? <Loader2 className="size-4 animate-spin ml-auto" /> : `$${formatPrice(buyPrice)}`}
            </div>
          </div>
        </Button>
      </div>

      {/* Controls */}
      <div className="px-4 py-4 space-y-4 flex-1 overflow-y-auto">
        <div className="space-y-2">
          <Label className="text-[10px] text-muted uppercase tracking-wider">
            Volume (USD)
          </Label>
          <div className="flex items-center gap-1.5">
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => adjustVolume(-1)}
              className="bg-surface-2 border-border text-muted hover:text-white hover:bg-surface-2/80"
            >
              <Minus className="size-3" />
            </Button>
            <Input
              type="text"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="flex-1 h-7 bg-surface-2 border-border text-center text-white text-xs tabular-nums focus-visible:border-accent focus-visible:ring-accent/20"
            />
            <Button
              variant="outline"
              size="icon-sm"
              onClick={() => adjustVolume(1)}
              className="bg-surface-2 border-border text-muted hover:text-white hover:bg-surface-2/80"
            >
              <Plus className="size-3" />
            </Button>
          </div>
        </div>

        <div className="space-y-2">
          <Label className="text-[10px] text-muted uppercase tracking-wider">
            Leverage
          </Label>
          <div className="flex gap-1">
            {[1, 2, 5, 10, 20, 50].map((lev) => (
              <Button
                key={lev}
                variant={leverage === lev ? "default" : "outline"}
                size="sm"
                onClick={() => setLeverage(lev)}
                className={`flex-1 text-[11px] font-medium ${
                  leverage === lev
                    ? "bg-accent text-surface hover:bg-accent/90"
                    : "bg-surface-2 border-border text-muted hover:text-white hover:bg-surface-2/80"
                }`}
              >
                {lev}x
              </Button>
            ))}
          </div>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-[10px] text-muted uppercase tracking-wider">
              Take Profit
            </Label>
            <Input
              type="text"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="None"
              className="h-7 bg-surface-2 border-border text-white text-xs tabular-nums focus-visible:border-green/50 focus-visible:ring-green/10"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-[10px] text-muted uppercase tracking-wider">
              Stop Loss
            </Label>
            <Input
              type="text"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="None"
              className="h-7 bg-surface-2 border-border text-white text-xs tabular-nums focus-visible:border-red/50 focus-visible:ring-red/10"
            />
          </div>
        </div>

        <Separator className="bg-border" />

        <div className="bg-surface-2 rounded-lg p-3.5 text-xs space-y-2">
          <div className="flex justify-between">
            <span className="text-muted">Margin</span>
            <span className="text-white tabular-nums font-medium">
              ${formatNumber(parseFloat(volume), 2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Exposure</span>
            <span className="text-white tabular-nums font-medium">
              ${formatNumber(parseFloat(volume) * leverage, 2)}
            </span>
          </div>
          <div className="flex justify-between">
            <span className="text-muted">Size</span>
            <span className="text-white tabular-nums font-medium">
              {buyPrice
                ? formatNumber((parseFloat(volume) * leverage) / buyPrice, 4)
                : "—"}{" "}
              {baseAssetName}
            </span>
          </div>
        </div>
      </div>
    </div>
  );
}
