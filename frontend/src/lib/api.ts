const API_BASE = "http://localhost:3000";

async function request<T>(
  path: string,
  options: RequestInit = {}
): Promise<T> {
  const token = localStorage.getItem("token");
  const headers: Record<string, string> = {
    "Content-Type": "application/json",
    ...((options.headers as Record<string, string>) ?? {}),
  };
  if (token) headers["Authorization"] = `Bearer ${token}`;

  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const data = await res.json();
  if (!res.ok) throw new Error(data.error ?? "Request failed");
  return data as T;
}

export interface AuthResponse {
  token: string;
  user: { id: string; email: string; usdBalance: number; createdAt: string };
}

export interface TradeOpen {
  orderId: string;
  symbol: string;
  decimals: number;
  imageUrl: string | null;
  type: string;
  margin: number;
  leverage: number;
  exposure: number;
  openPrice: number;
  openedAt: string;
}

export interface TradeHistory {
  orderId: string;
  symbol: string;
  decimals: number;
  imageUrl: string | null;
  type: string;
  margin: number;
  leverage: number;
  openPrice: number;
  closePrice: number;
  pnl: number;
}

export interface CloseTradeResponse {
  orderId: string;
  closePrice: number;
  pnl: number;
  newBalance: number;
}

export interface AssetInfo {
  name: string;
  symbol: string;
  buyPrice: number | null;
  sellPrice: number | null;
  decimals: number;
  imageUrl: string | null;
}

export interface CandleData {
  timestamp: number;
  open: number;
  close: number;
  high: number;
  low: number;
  decimals: number;
}

export interface UserProfile {
  id: string;
  email: string;
  firstName: string | null;
  lastName: string | null;
  username: string | null;
  usdBalance: number;
  createdAt: string;
}

export const api = {
  signup: (email: string, password: string) =>
    request<AuthResponse>("/auth/signup", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  signin: (email: string, password: string) =>
    request<AuthResponse>("/auth/signin", {
      method: "POST",
      body: JSON.stringify({ email, password }),
    }),

  getUser: () => request<{ user: UserProfile }>("/api/v1/user"),

  updateSettings: (data: {
    firstName?: string | null;
    lastName?: string | null;
    username?: string | null;
  }) =>
    request<{ message: string }>("/api/v1/user/setting", {
      method: "PATCH",
      body: JSON.stringify(data),
    }),

  getBalance: () => request<{ usd_balance: number }>("/api/v1/user/balance"),

  getAssets: () => request<{ assets: AssetInfo[] }>("/api/v1/assets"),

  getCandles: (asset: string, startTime: string, endTime: string, ts: string) =>
    request<{ candles: CandleData[] }>(
      `/api/v1/candles?asset=${asset}&startTime=${startTime}&endTime=${endTime}&ts=${ts}`
    ),

  openTrade: (
    asset: string,
    type: string,
    margin: number,
    leverage: number,
    takeProfit?: number,
    stopLoss?: number
  ) =>
    request<{ orderId: string }>("/api/v1/trade", {
      method: "POST",
      body: JSON.stringify({ asset, type, margin, leverage, takeProfit, stopLoss }),
    }),

  closeTrade: (orderId: string) =>
    request<CloseTradeResponse>("/api/v1/trade/close", {
      method: "POST",
      body: JSON.stringify({ orderId }),
    }),

  getOpenTrades: () => request<{ trades: TradeOpen[] }>("/api/v1/trades/open"),

  getTradeHistory: () =>
    request<{ trades: TradeHistory[] }>("/api/v1/trades"),
};
