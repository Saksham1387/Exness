import type { Candle } from "@exness/shared";
import { priceToInt, publisher } from "@exness/shared";

const currentCandles = new Map<string, Candle>();

async function pushCandle(symbol: string, candle: Candle) {
    const newCandle = {
        symbol,
        candle
    }
    publisher.LPUSH("db",JSON.stringify(newCandle));
}

export function processTicks(symbol: string, priceStr: string, timestamp: number) {
    const price = priceToInt(priceStr);
    const timeframes = 60_00;
    const windowStart = Math.floor(timestamp / timeframes ) * timeframes;
    const key = `${symbol}_${timeframes}`;

    const existing = currentCandles.get(key);

    if (!existing) {
        currentCandles.set(key, { openTime: windowStart, open: price, high: price, low: price, close: price, decimals: 4 });
        return;
    }

    if (existing.openTime === windowStart) {
        existing.high  = Math.max(existing.high, price);
        existing.low   = Math.min(existing.low, price);
        existing.close = price;
    } else {
        currentCandles.set(key, { openTime: windowStart, open: price, high: price, low: price, close: price, decimals: 4 });
        pushCandle(symbol, existing);
    }
}
