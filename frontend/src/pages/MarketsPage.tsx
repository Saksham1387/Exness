import { useNavigate } from "react-router-dom";
import { useTradingStore } from "@/store/trading";
import { useAssetsStore } from "@/store/assets";
import type { AssetInfo } from "@/lib/api";
import { formatNumber } from "@/lib/utils";
import { Card } from "@/components/ui/card";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { ArrowRight, Loader2 } from "lucide-react";

function AssetRow({ asset }: { asset: AssetInfo }) {
  const navigate = useNavigate();
  const price = useTradingStore((s) => s.prices[asset.symbol] ?? null);
  const scale = Math.pow(10, asset.decimals);

  const mid = price ? (price.buyPrice + price.sellPrice) / 2 / scale : null;
  const buy = price ? price.buyPrice / scale : null;
  const sell = price ? price.sellPrice / scale : null;
  const spread = buy && sell ? ((buy - sell) * scale).toFixed(0) : null;

  const slug = asset.symbol.replace("USDT", "_USDT");
  const pair = asset.symbol.replace("USDT", "/USDT");

  return (
    <TableRow
      onClick={() => navigate(`/${slug}`)}
      className="border-border cursor-pointer group hover:bg-surface-2/50"
    >
      <TableCell className="px-5 py-4">
        <div className="flex items-center gap-3">
          {asset.imageUrl ? (
            <img src={asset.imageUrl} alt={asset.name} className="w-9 h-9 rounded-full shrink-0" />
          ) : (
            <div className="w-9 h-9 rounded-full bg-surface-2 shrink-0" />
          )}
          <div>
            <div className="text-sm font-semibold text-white">{pair}</div>
            <div className="text-xs text-muted mt-0.5">{asset.name}</div>
          </div>
        </div>
      </TableCell>

      <TableCell className="px-5 py-4 text-right">
        <span className="tabular-nums text-sm text-white font-medium">
          {mid !== null ? `$${formatNumber(mid, asset.decimals)}` : "—"}
        </span>
      </TableCell>

      <TableCell className="px-5 py-4 text-right">
        <span className="tabular-nums text-sm text-red">
          {sell !== null ? formatNumber(sell, asset.decimals) : "—"}
        </span>
      </TableCell>

      <TableCell className="px-5 py-4 text-right">
        <span className="tabular-nums text-sm text-green">
          {buy !== null ? formatNumber(buy, asset.decimals) : "—"}
        </span>
      </TableCell>

      <TableCell className="px-5 py-4 text-right">
        <span className="tabular-nums text-sm text-muted">
          {spread ?? "—"}
        </span>
      </TableCell>

      <TableCell className="px-5 py-4 text-right">
        <span className="flex items-center justify-end gap-1.5 text-sm text-accent font-medium opacity-0 group-hover:opacity-100 transition-opacity">
          Trade <ArrowRight className="size-4" />
        </span>
      </TableCell>
    </TableRow>
  );
}

export default function MarketsPage() {
  const { assets, loaded } = useAssetsStore();

  return (
    <div className="h-full overflow-auto">
      <div className="max-w-5xl mx-auto px-6 py-10">
        <div className="mb-8">
          <h1 className="text-2xl font-semibold text-white mb-1.5">Markets</h1>
          <p className="text-sm text-muted">
            Select an instrument to trade
          </p>
        </div>

        <Card className="bg-surface-1 border-border ring-0 py-0 overflow-hidden">
          {!loaded ? (
            <div className="flex items-center justify-center py-20">
              <Loader2 className="size-6 text-accent animate-spin" />
            </div>
          ) : assets.length === 0 ? (
            <div className="flex items-center justify-center py-20 text-muted text-sm">
              No markets available
            </div>
          ) : (
            <Table>
              <TableHeader>
                <TableRow className="border-border hover:bg-transparent">
                  <TableHead className="px-5 py-3.5 text-xs font-medium text-muted">Market</TableHead>
                  <TableHead className="px-5 py-3.5 text-xs font-medium text-muted text-right">Price</TableHead>
                  <TableHead className="px-5 py-3.5 text-xs font-medium text-muted text-right">Bid</TableHead>
                  <TableHead className="px-5 py-3.5 text-xs font-medium text-muted text-right">Ask</TableHead>
                  <TableHead className="px-5 py-3.5 text-xs font-medium text-muted text-right">Spread</TableHead>
                  <TableHead className="px-5 py-3.5" />
                </TableRow>
              </TableHeader>
              <TableBody>
                {assets.map((asset) => (
                  <AssetRow key={asset.symbol} asset={asset} />
                ))}
              </TableBody>
            </Table>
          )}
        </Card>
      </div>
    </div>
  );
}
