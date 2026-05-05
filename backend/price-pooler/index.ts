import { WebSocket } from "ws";
import { processTicks } from "./candle-processor";
import { publisher } from "@exness/shared";
import type { PriceUpdate } from "@exness/shared";

const ws = new WebSocket("wss://stream.binance.com:9443/stream?streams=solusdt@trade/ethusdt@trade/btcusdt@trade");

ws.on("message", (data) =>{
    const parsed = JSON.parse(data.toString())
    const trade = parsed.data;
    const symbol = trade.s;
    const price = Math.round(parseFloat(trade.p) * 10_000);
    const timestamp = trade.T;
    const buyPrice  = Math.round(price * 1.005);
    const sellPrice = Math.round(price * 0.995);

    const update: PriceUpdate = { symbol, buyPrice, sellPrice, decimals: 4 };
    publisher.publish(`${symbol}@prices`, JSON.stringify(update));

    processTicks(symbol, trade.p, timestamp);
})
