import { useEffect, useState, useCallback, useRef } from "react";
import { api, type TradeOpen, type TradeHistory, type AssetInfo } from "@/lib/api";
import { useTradingStore } from "@/store/trading";
import { useAuthStore } from "@/store/auth";
import { formatNumber } from "@/lib/utils";
import { toast } from "sonner";
import { Tabs, TabsList, TabsTrigger, TabsContent } from "@/components/ui/tabs";
import {
  Table,
  TableHeader,
  TableBody,
  TableRow,
  TableHead,
  TableCell,
} from "@/components/ui/table";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { X, Loader2 } from "lucide-react";

const MARGIN_SCALE = 100;

function calcPnl(trade: TradeOpen, currentPrice: number, decimals: number): number {
  const scale = Math.pow(10, decimals);
  const openPrice = trade.openPrice / scale;
  const exposureUSD = trade.exposure / MARGIN_SCALE;
  if (trade.type === "buy") {
    return ((currentPrice - openPrice) / openPrice) * exposureUSD;
  } else {
    return ((openPrice - currentPrice) / openPrice) * exposureUSD;
  }
}

function PnlCell({ trade }: { trade: TradeOpen }) {
  const price = useTradingStore((s) => (trade.symbol ? s.prices[trade.symbol] ?? null : null));
  const d = trade.decimals ?? 4;
  const scale = Math.pow(10, d);

  const closePrice = price
    ? trade.type === "buy" ? price.sellPrice / scale : price.buyPrice / scale
    : null;

  if (closePrice === null) return <span className="text-muted">—</span>;

  const pnl = calcPnl(trade, closePrice, d);
  const isProfit = pnl >= 0;

  return (
    <span className={`tabular-nums font-medium ${isProfit ? "text-green" : "text-red"}`}>
      {isProfit ? "+$" : "-$"}{formatNumber(Math.abs(pnl), 2)}
    </span>
  );
}

function CurrentPriceCell({ trade }: { trade: TradeOpen }) {
  const price = useTradingStore((s) => (trade.symbol ? s.prices[trade.symbol] ?? null : null));
  const d = trade.decimals ?? 4;
  const scale = Math.pow(10, d);

  const cp = price
    ? trade.type === "buy" ? price.sellPrice / scale : price.buyPrice / scale
    : null;

  return (
    <span className="tabular-nums text-white">
      {cp !== null ? formatNumber(cp, d) : "—"}
    </span>
  );
}

function formatPair(symbol: string | undefined) {
  if (!symbol) return "—";
  return symbol.replace("USDT", "/USDT");
}

function AssetIcon({
  symbol,
  imageUrl,
  assets,
  size = 16,
}: {
  symbol?: string;
  imageUrl?: string | null;
  assets: AssetInfo[];
  size?: number;
}) {
  const url = imageUrl ?? assets.find((a) => a.symbol === symbol)?.imageUrl;
  if (url) {
    return (
      <img
        src={url}
        alt={symbol ?? "asset"}
        className="rounded-full shrink-0"
        style={{ width: size, height: size }}
      />
    );
  }
  return (
    <div
      className="rounded-full bg-surface-2 shrink-0"
      style={{ width: size, height: size }}
    />
  );
}

export default function Positions({
  refreshKey,
  assets,
}: {
  refreshKey: number;
  assets: AssetInfo[];
}) {
  const [tab, setTab] = useState<string>("open");
  const [openTrades, setOpenTrades] = useState<TradeOpen[]>([]);
  const [closedTrades, setClosedTrades] = useState<TradeHistory[]>([]);
  const [closingId, setClosingId] = useState<string | null>(null);
  const tickRef = useRef<ReturnType<typeof setInterval> | null>(null);

  const fetchBalance = useAuthStore((s) => s.fetchBalance);
  const subscribe = useTradingStore((s) => s.subscribe);

  const loadOpen = useCallback(async () => {
    try {
      const { trades } = await api.getOpenTrades();
      setOpenTrades(trades);
    } catch { /* ignore */ }
  }, []);

  const loadClosed = useCallback(async () => {
    try {
      const { trades } = await api.getTradeHistory();
      setClosedTrades(trades);
    } catch { /* ignore */ }
  }, []);

  useEffect(() => {
    loadOpen();
    loadClosed();
  }, [refreshKey, loadOpen, loadClosed]);

  useEffect(() => {
    const symbols = [
      ...new Set(
        openTrades.map((t) => t.symbol).filter((s): s is string => Boolean(s))
      ),
    ];
    if (symbols.length > 0) subscribe(symbols);
  }, [openTrades, subscribe]);

  useEffect(() => {
    if (openTrades.length === 0) return;
    tickRef.current = setInterval(() => setOpenTrades((t) => [...t]), 1000);
    return () => {
      if (tickRef.current) clearInterval(tickRef.current);
    };
  }, [openTrades.length]);

  const handleClose = async (orderId: string) => {
    setClosingId(orderId);
    try {
      const result = await api.closeTrade(orderId);
      const pnl = result.pnl / MARGIN_SCALE;
      await Promise.all([loadOpen(), loadClosed(), fetchBalance()]);
      if (pnl >= 0) {
        toast.success("Position closed", {
          description: `Profit: +$${formatNumber(pnl, 2)}`,
        });
      } else {
        toast.error("Position closed", {
          description: `Loss: -$${formatNumber(Math.abs(pnl), 2)}`,
        });
      }
    } catch (err) {
      toast.error("Failed to close position", {
        description: err instanceof Error ? err.message : "Please try again",
      });
    } finally {
      setClosingId(null);
    }
  };

  return (
    <Tabs value={tab} onValueChange={setTab} className="flex flex-col h-full bg-surface-1 border-t border-border gap-0">
      <TabsList variant="line" className="px-4 shrink-0 border-b border-border h-9 rounded-none bg-transparent">
        <TabsTrigger value="open" className="text-[11px] font-medium h-full rounded-none px-3 text-muted data-[state=active]:text-white">
          Positions ({openTrades.length})
        </TabsTrigger>
        <TabsTrigger value="closed" className="text-[11px] font-medium h-full rounded-none px-3 text-muted data-[state=active]:text-white">
          History ({closedTrades.length})
        </TabsTrigger>
      </TabsList>

      <TabsContent value="open" className="flex-1 overflow-auto m-0">
        {openTrades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            No open positions
          </div>
        ) : (
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-8 px-4 text-[10px] font-normal text-muted uppercase tracking-wider">Symbol</TableHead>
                <TableHead className="h-8 px-4 text-[10px] font-normal text-muted uppercase tracking-wider">Side</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">Lots</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">Open</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">Current</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">P&L</TableHead>
                <TableHead className="h-8 px-3 w-8" />
              </TableRow>
            </TableHeader>
            <TableBody>
              {openTrades.map((trade) => {
                const d = trade.decimals ?? 4;
                const s = Math.pow(10, d);
                return (
                  <TableRow key={trade.orderId} className="border-border hover:bg-surface-2/30">
                    <TableCell className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <AssetIcon symbol={trade.symbol} imageUrl={trade.imageUrl} assets={assets} size={16} />
                        <span className="text-white font-medium">
                          {formatPair(trade.symbol)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 h-5 border-transparent ${
                          trade.type === "buy"
                            ? "bg-green/10 text-green"
                            : "bg-red/10 text-red"
                        }`}
                      >
                        {trade.type === "buy" ? "Buy" : "Sell"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums text-white">
                      {formatNumber((trade.exposure / MARGIN_SCALE) / (trade.openPrice / s), 4)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums text-white">
                      ${formatNumber(trade.openPrice / s, d)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      $<CurrentPriceCell trade={trade} />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <PnlCell trade={trade} />
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <Button
                        variant="ghost"
                        size="icon-xs"
                        onClick={() => handleClose(trade.orderId)}
                        disabled={closingId === trade.orderId}
                        className="text-muted hover:text-red hover:bg-red/10 disabled:opacity-30"
                      >
                        {closingId === trade.orderId ? (
                          <Loader2 className="size-3 animate-spin" />
                        ) : (
                          <X className="size-3" />
                        )}
                      </Button>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TabsContent>

      <TabsContent value="closed" className="flex-1 overflow-auto m-0">
        {closedTrades.length === 0 ? (
          <div className="flex items-center justify-center h-full text-muted text-xs">
            No trade history
          </div>
        ) : (
          <Table className="text-[11px]">
            <TableHeader>
              <TableRow className="border-border hover:bg-transparent">
                <TableHead className="h-8 px-4 text-[10px] font-normal text-muted uppercase tracking-wider">Symbol</TableHead>
                <TableHead className="h-8 px-4 text-[10px] font-normal text-muted uppercase tracking-wider">Side</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">Lots</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">Open</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">Close</TableHead>
                <TableHead className="h-8 px-3 text-[10px] font-normal text-muted uppercase tracking-wider text-right">P&L</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {closedTrades.map((trade) => {
                const d = trade.decimals ?? 4;
                const s = Math.pow(10, d);
                const pnl = trade.pnl / MARGIN_SCALE;
                const isProfit = pnl >= 0;
                return (
                  <TableRow key={trade.orderId} className="border-border hover:bg-surface-2/30">
                    <TableCell className="px-4 py-2">
                      <div className="flex items-center gap-2">
                        <AssetIcon symbol={trade.symbol} imageUrl={trade.imageUrl} assets={assets} size={16} />
                        <span className="text-white font-medium">
                          {formatPair(trade.symbol)}
                        </span>
                      </div>
                    </TableCell>
                    <TableCell className="px-4 py-2">
                      <Badge
                        variant="outline"
                        className={`text-[10px] px-1.5 h-5 border-transparent ${
                          trade.type === "buy"
                            ? "bg-green/10 text-green"
                            : "bg-red/10 text-red"
                        }`}
                      >
                        {trade.type === "buy" ? "Buy" : "Sell"}
                      </Badge>
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums text-white">
                      {formatNumber((trade.margin / MARGIN_SCALE * trade.leverage) / (trade.openPrice / s), 4)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums text-white">
                      ${formatNumber(trade.openPrice / s, d)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right tabular-nums text-white">
                      ${formatNumber(trade.closePrice / s, d)}
                    </TableCell>
                    <TableCell className="px-3 py-2 text-right">
                      <span className={`tabular-nums font-medium ${isProfit ? "text-green" : "text-red"}`}>
                        {isProfit ? "+$" : "-$"}{formatNumber(Math.abs(pnl), 2)}
                      </span>
                    </TableCell>
                  </TableRow>
                );
              })}
            </TableBody>
          </Table>
        )}
      </TabsContent>
    </Tabs>
  );
}
