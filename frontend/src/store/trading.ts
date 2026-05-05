import { create } from "zustand";

export interface PriceUpdate {
  symbol: string;
  buyPrice: number;
  sellPrice: number;
  decimals: number;
}

interface TradingState {
  prices: Record<string, PriceUpdate>;
  ws: WebSocket | null;
  connected: boolean;
  subscribedChannels: Set<string>;

  connect: () => void;
  disconnect: () => void;
  subscribe: (symbols: string[]) => void;
  unsubscribe: (symbols: string[]) => void;
  getPrice: (symbol: string) => PriceUpdate | null;
}

export const useTradingStore = create<TradingState>((set, get) => ({
  prices: {},
  ws: null,
  connected: false,
  subscribedChannels: new Set(),

  connect: () => {
    if (get().ws) return;
    const ws = new WebSocket("ws://localhost:3001");

    ws.onopen = () => {
      set({ connected: true });
      const channels = Array.from(get().subscribedChannels);
      if (channels.length > 0) {
        ws.send(JSON.stringify({ method: "SUBSCRIBE", params: channels }));
      }
    };

    ws.onmessage = (event) => {
      try {
        const update = JSON.parse(event.data) as PriceUpdate;
        set((s) => ({
          prices: { ...s.prices, [update.symbol]: update },
        }));
      } catch {
        /* ignore malformed messages */
      }
    };

    ws.onclose = () => {
      set({ connected: false, ws: null });
      setTimeout(() => get().connect(), 2000);
    };

    ws.onerror = () => ws.close();

    set({ ws });
  },

  disconnect: () => {
    const { ws } = get();
    if (ws) {
      ws.onclose = null;
      ws.close();
      set({ ws: null, connected: false });
    }
  },

  subscribe: (symbols: string[]) => {
    const { ws, subscribedChannels } = get();
    const channels = symbols.map((s) => `${s}@prices`);
    const newChannels = channels.filter((c) => !subscribedChannels.has(c));
    if (newChannels.length === 0) return;

    newChannels.forEach((c) => subscribedChannels.add(c));
    set({ subscribedChannels: new Set(subscribedChannels) });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: "SUBSCRIBE", params: newChannels }));
    }
  },

  unsubscribe: (symbols: string[]) => {
    const { ws, subscribedChannels } = get();
    const channels = symbols.map((s) => `${s}@prices`);
    const toRemove = channels.filter((c) => subscribedChannels.has(c));
    if (toRemove.length === 0) return;

    toRemove.forEach((c) => subscribedChannels.delete(c));
    set({ subscribedChannels: new Set(subscribedChannels) });

    if (ws && ws.readyState === WebSocket.OPEN) {
      ws.send(JSON.stringify({ method: "UNSUBSCRIBE", params: toRemove }));
    }
  },

  getPrice: (symbol: string) => get().prices[symbol] ?? null,
}));
