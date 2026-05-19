import { useEffect, useRef, useCallback } from "react";
import {
  createChart,
  CandlestickSeries,
  type IChartApi,
  type ISeriesApi,
  type CandlestickData,
  ColorType,
  CrosshairMode,
  type CandlestickSeriesOptions,
  type DeepPartial,
} from "lightweight-charts";
import { api } from "@/lib/api";
import { useTradingStore } from "@/store/trading";

function toChartTime(tsMs: number): number {
  return Math.floor(tsMs / 1000);
}

export default function Chart({
  symbol,
  decimals,
}: {
  symbol: string | null;
  decimals: number;
}) {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<IChartApi | null>(null);
  const seriesRef = useRef<ISeriesApi<"Candlestick"> | null>(null);
  const lastCandleTimeRef = useRef<number>(0);
  const symbolRef = useRef(symbol);
  symbolRef.current = symbol;

  const loadCandles = useCallback(async () => {
    if (!symbol) return;
    try {
      const now = Date.now();
      const startTime = (now - 4 * 60 * 60 * 1000).toString();
      const endTime = now.toString();

      const { candles } = await api.getCandles(symbol, startTime, endTime, "1m");
      if (!seriesRef.current || candles.length === 0) return;

      const candleScale = Math.pow(10, candles[0].decimals);
      const mapped: CandlestickData[] = candles.map((c) => ({
        time: toChartTime(c.timestamp) as CandlestickData["time"],
        open: c.open / candleScale,
        high: c.high / candleScale,
        close: c.close / candleScale,
        low: c.low / candleScale,
      }));

      mapped.sort((a, b) => (a.time as number) - (b.time as number));
      seriesRef.current.setData(mapped);
      if (mapped.length > 0) {
        lastCandleTimeRef.current = mapped[mapped.length - 1].time as number;
      }
      chartRef.current?.timeScale().fitContent();
    } catch { /* ignore */ }
  }, [symbol]);

  useEffect(() => {
    if (!containerRef.current) return;

    const chart = createChart(containerRef.current, {
      layout: {
        background: { type: ColorType.Solid, color: "#10141c" },
        textColor: "#565e70",
        fontFamily: "'Geist Variable', sans-serif",
        fontSize: 11,
      },
      grid: {
        vertLines: { color: "#1e243310" },
        horzLines: { color: "#1e2433" },
      },
      crosshair: {
        mode: CrosshairMode.Normal,
        vertLine: { color: "#d4a84320", width: 1, style: 3 },
        horzLine: { color: "#d4a84320", width: 1, style: 3 },
      },
      rightPriceScale: {
        borderColor: "#1e2433",
        scaleMargins: { top: 0.1, bottom: 0.1 },
      },
      timeScale: {
        borderColor: "#1e2433",
        timeVisible: true,
        secondsVisible: false,
      },
      handleScale: { axisPressedMouseMove: true },
      handleScroll: { vertTouchDrag: false },
    });

    chartRef.current = chart;

    const candleOptions: DeepPartial<CandlestickSeriesOptions> = {
      upColor: "#22c55e",
      downColor: "#ef4444",
      borderUpColor: "#22c55e",
      borderDownColor: "#ef4444",
      wickUpColor: "#22c55e80",
      wickDownColor: "#ef444480",
      priceFormat: { type: "price", precision: 2, minMove: 0.01 },
    };

    const series = chart.addSeries(CandlestickSeries, candleOptions);
    seriesRef.current = series;
    chart.timeScale().fitContent();

    const resizeObserver = new ResizeObserver(() => {
      if (containerRef.current) {
        chart.applyOptions({
          width: containerRef.current.clientWidth,
          height: containerRef.current.clientHeight,
        });
      }
    });
    resizeObserver.observe(containerRef.current);

    return () => {
      resizeObserver.disconnect();
      chart.remove();
      chartRef.current = null;
      seriesRef.current = null;
    };
  }, []);

  useEffect(() => {
    if (!seriesRef.current) return;
    seriesRef.current.setData([]);
    lastCandleTimeRef.current = 0;
    loadCandles();
  }, [loadCandles]);

  useEffect(() => {
    const unsub = useTradingStore.subscribe((state) => {
      const sym = symbolRef.current;
      if (!sym) return;
      const price = state.prices[sym];
      if (!price || !seriesRef.current) return;

      const priceScale = Math.pow(10, price.decimals);
      const mid = (price.buyPrice + price.sellPrice) / 2;
      const priceVal = mid / priceScale;
      const now = Math.floor(Date.now() / 60000) * 60;

      if (now > lastCandleTimeRef.current) {
        lastCandleTimeRef.current = now;
        seriesRef.current.update({
          time: now as CandlestickData["time"],
          open: priceVal,
          high: priceVal,
          low: priceVal,
          close: priceVal,
        });
      } else {
        seriesRef.current.update({
          time: lastCandleTimeRef.current as CandlestickData["time"],
          open: undefined as unknown as number,
          high: priceVal,
          low: priceVal,
          close: priceVal,
        });
      }
    });
    return unsub;
  }, []);

  return <div ref={containerRef} className="w-full h-full min-h-0" />;
}
