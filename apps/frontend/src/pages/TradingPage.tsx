import { useState } from "react";
import { useParams, Navigate, Link } from "react-router-dom";
import Chart from "@/components/Chart";
import TradingPanel from "@/components/TradingPanel";
import Positions from "@/components/Positions";
import { useTradingStore } from "@/store/trading";
import { useAssetsStore } from "@/store/assets";
import { formatNumber } from "@/lib/utils";
import { ChevronLeft } from "lucide-react";

export default function TradingPage() {
  const { symbol: slugParam } = useParams<{ symbol: string }>();
  const [refreshKey, setRefreshKey] = useState(0);

  const { assets } = useAssetsStore();
  const prices = useTradingStore((s) => s.prices);

  const symbol = slugParam?.replace("_", "") ?? null;
  const selectedAsset = symbol ? assets.find((a) => a.symbol === symbol) ?? null : null;

  const assetsLoaded = useAssetsStore((s) => s.loaded);
  if (assetsLoaded && assets.length > 0 && !selectedAsset) {
    return <Navigate to="/" replace />;
  }

  const currentPrice = symbol ? (prices[symbol] ?? null) : null;
  const decimals = selectedAsset?.decimals ?? 4;
  const scale = Math.pow(10, decimals);

  const midPrice = currentPrice
    ? (currentPrice.buyPrice + currentPrice.sellPrice) / 2 / scale
    : null;

  const displayName = symbol ? symbol.replace("USDT", "/USDT") : "";

  return (
    <div className="h-full flex flex-col overflow-hidden">
      {/* Sub-header */}
      <div className="flex items-center gap-4 h-11 px-5 border-b border-border bg-surface-1 shrink-0">
        <Link
          to="/"
          className="text-sm text-muted hover:text-white transition-colors flex items-center gap-1"
        >
          <ChevronLeft className="size-4" />
          Markets
        </Link>
        <div className="h-4 w-px bg-border" />
        <div className="flex items-center gap-2.5">
          {selectedAsset?.imageUrl ? (
            <img src={selectedAsset.imageUrl} alt={selectedAsset.name} className="w-5 h-5 rounded-full shrink-0" />
          ) : (
            <div className="w-5 h-5 rounded-full bg-surface-2 shrink-0" />
          )}
          <span className="text-sm font-semibold text-white">{displayName}</span>
        </div>
        {midPrice !== null && (
          <span className="text-sm text-muted tabular-nums ml-1">
            ${formatNumber(midPrice)}
          </span>
        )}
      </div>

      {/* Main content */}
      <div className="flex flex-1 min-h-0">
        <div className="flex-1 flex flex-col min-w-0">
          <div className="flex-1 min-h-0">
            <Chart symbol={symbol} decimals={decimals} />
          </div>
          <div className="h-[240px] shrink-0">
            <Positions refreshKey={refreshKey} assets={assets} />
          </div>
        </div>

        <div className="w-[320px] shrink-0">
          <TradingPanel
            assets={assets}
            selectedAsset={selectedAsset}
            onTradeExecuted={() => setRefreshKey((k) => k + 1)}
          />
        </div>
      </div>
    </div>
  );
}
