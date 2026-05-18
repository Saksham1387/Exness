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
  const [side, setSide] = useState<"BUY" | "SELL">("BUY");
  const [loading, setLoading] = useState(false);
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

  const executeTrade = async () => {
    if (!symbol) return;
    setLoading(true);
    try {
      const marginCents = Math.round(parseFloat(volume) * 100);

      const tpValue = takeProfit ? Math.round(parseFloat(takeProfit) * scale) : undefined;
      const slValue = stopLoss ? Math.round(parseFloat(stopLoss) * scale) : undefined;

      await api.openTrade(symbol, side, marginCents, leverage, tpValue, slValue);
      await fetchBalance();
      onTradeExecuted();

      setTakeProfit("");
      setStopLoss("");

      toast.success(`${side} order placed`, {
        description: `${displayName} — $${formatNumber(parseFloat(volume), 2)} margin at ${leverage}x leverage`,
      });
    } catch (err) {
      toast.error("Trade failed", {
        description: err instanceof Error ? err.message : "Could not execute trade",
      });
    } finally {
      setLoading(false);
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
          className="flex items-center gap-2.5 w-full rounded-md px-2 py-1.5 -mx-2 hover:bg-surface-2 transition-colors"
        >
          {selectedAsset?.imageUrl ? (
            <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-6 h-6 rounded-full shrink-0" />
          ) : (
            <div className="w-6 h-6 rounded-full bg-surface-2 shrink-0" />
          )}
          <span className="text-sm font-semibold text-white flex-1 text-left">
            {displayName || "Select market"}
          </span>
          <ChevronDown className={`size-4 text-muted transition-transform duration-200 ${dropdownOpen ? "rotate-180" : ""}`} />
        </button>

        {dropdownOpen && (
          <div className="absolute left-2 right-2 top-full z-50 bg-surface-2 border border-border rounded-md shadow-2xl max-h-64 overflow-y-auto">
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
                    isSelected ? "bg-accent/10" : "hover:bg-surface-1"
                  }`}
                >
                  {asset.imageUrl ? (
                    <img src={asset.imageUrl} alt={asset.name} className="w-5 h-5 rounded-full shrink-0" />
                  ) : (
                    <div className="w-5 h-5 rounded-full bg-border shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-medium text-white">
                      {asset.symbol.replace("USDT", "/USDT")}
                    </div>
                    <div className="text-xs text-muted truncate">
                      {asset.name}
                    </div>
                  </div>
                  {mid !== null && (
                    <span className="text-xs text-muted tabular-nums">
                      ${formatNumber(mid, asset.decimals)}
                    </span>
                  )}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Side selector */}
      <div className="flex border-b border-border">
        <button
          onClick={() => setSide("SELL")}
          className={`flex-1 py-4 px-4 border-r border-border transition-colors ${
            side === "SELL" ? "bg-red/10" : "hover:bg-red/5"
          }`}
        >
          <div className="w-full">
            <div className={`text-xs uppercase tracking-wider mb-1 ${side === "SELL" ? "text-red" : "text-muted"}`}>Sell</div>
            <div className={`text-lg font-semibold tabular-nums ${side === "SELL" ? "text-red" : "text-muted"}`}>
              ${formatPrice(sellPrice)}
            </div>
          </div>
        </button>
        <button
          onClick={() => setSide("BUY")}
          className={`flex-1 py-4 px-4 transition-colors ${
            side === "BUY" ? "bg-green/10" : "hover:bg-green/5"
          }`}
        >
          <div className="w-full">
            <div className={`text-xs uppercase tracking-wider text-right mb-1 ${side === "BUY" ? "text-green" : "text-muted"}`}>Buy</div>
            <div className={`text-lg font-semibold tabular-nums text-right ${side === "BUY" ? "text-green" : "text-muted"}`}>
              ${formatPrice(buyPrice)}
            </div>
          </div>
        </button>
      </div>

      {/* Controls */}
      <div className="px-4 py-5 space-y-5 flex-1 overflow-y-auto">
        {/* Volume */}
        <div className="space-y-2">
          <Label className="text-xs text-muted">Volume (USD)</Label>
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustVolume(-1)}
              className="bg-surface-2 border-border text-muted hover:text-white hover:bg-surface-2/80"
            >
              <Minus className="size-4" />
            </Button>
            <Input
              type="text"
              value={volume}
              onChange={(e) => setVolume(e.target.value)}
              className="flex-1 h-9 bg-surface-2 border-border text-center text-white tabular-nums"
            />
            <Button
              variant="outline"
              size="icon"
              onClick={() => adjustVolume(1)}
              className="bg-surface-2 border-border text-muted hover:text-white hover:bg-surface-2/80"
            >
              <Plus className="size-4" />
            </Button>
          </div>
        </div>

        {/* Leverage */}
        <div className="space-y-2">
          <Label className="text-xs text-muted">Leverage</Label>
          <div className="flex gap-1.5">
            {[1, 5, 10, 20, 100].map((lev) => (
              <Button
                key={lev}
                variant={leverage === lev ? "default" : "outline"}
                size="sm"
                onClick={() => setLeverage(lev)}
                className={`flex-1 h-9 text-xs font-medium ${
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

        {/* Take Profit / Stop Loss */}
        <div className="grid grid-cols-2 gap-3">
          <div className="space-y-2">
            <Label className="text-xs text-muted">Take Profit</Label>
            <Input
              type="text"
              value={takeProfit}
              onChange={(e) => setTakeProfit(e.target.value)}
              placeholder="None"
              className="h-9 bg-surface-2 border-border text-white tabular-nums"
            />
          </div>
          <div className="space-y-2">
            <Label className="text-xs text-muted">Stop Loss</Label>
            <Input
              type="text"
              value={stopLoss}
              onChange={(e) => setStopLoss(e.target.value)}
              placeholder="None"
              className="h-9 bg-surface-2 border-border text-white tabular-nums"
            />
          </div>
        </div>

        <Separator className="bg-border" />

        {/* Summary */}
        <div className="bg-surface-2 rounded-md p-4 space-y-3 text-sm">
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

        {/* Execute button */}
        <Button
          onClick={executeTrade}
          disabled={loading || !currentPrice || !symbol}
          className={`w-full h-11 text-sm font-semibold transition-colors disabled:opacity-40 ${
            side === "BUY"
              ? "bg-green hover:bg-green/90 text-surface"
              : "bg-red hover:bg-red/90 text-white"
          }`}
        >
          {loading ? (
            <Loader2 className="size-4 animate-spin" />
          ) : (
            `${side === "BUY" ? "Buy" : "Sell"} ${displayName || "—"}`
          )}
        </Button>
      </div>
    </div>
  );
}
