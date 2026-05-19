import express, { type Request, type Response } from "express";
import bcrypt from "bcryptjs";
import jwt from "jsonwebtoken";
import { prisma } from "@exness/db";
import { TradeType, TradeStatus } from "@exness/db/generated/prisma/enums";
import { authMiddleware, type AuthPayload, type AuthRequest } from "./middleware.ts";
import { subscriber } from "@exness/shared";
import type { PriceUpdate } from "@exness/shared";
import cors from "cors";
import { checkTrade } from "./check-trade.ts";
import cookieParser from "cookie-parser";

const app = express();
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value
);

app.use(express.json());
app.use(cors({
  origin: process.env.FRONTEND_ORIGIN ?? "http://localhost:5173",
  credentials: true,
}));
app.use(cookieParser());

export const JWT_SECRET = process.env.JWT_SECRET!;
const PORT = process.env.PORT ?? 3000;

const COOKIE_MAX_AGE_MS = 7 * 24 * 60 * 60 * 1000;
const cookieOptions = {
  httpOnly: true,
  sameSite: "lax" as const,
  secure: process.env.NODE_ENV === "production",
  maxAge: COOKIE_MAX_AGE_MS,
};

const latestPrices = new Map<string, PriceUpdate>();

const assets = await prisma.asset.findMany({ select: { id: true, symbol: true } });
const assetIdBySymbol = new Map(assets.map((a) => [a.symbol, a.id]));

const channels = assets.map((a) => `${a.symbol}@prices`);

await subscriber.subscribe(channels, async (message) => {
  const update = JSON.parse(message) as PriceUpdate;
  latestPrices.set(update.symbol, update);

  const assetId = assetIdBySymbol.get(update.symbol);
  if (!assetId) {
    return;
  }

  const openTrades = await prisma.trade.findMany({
    where: {
      assetId,
      status: TradeStatus.OPEN,
    },
  });

  // Convert at the boundary: WS payload carries scaled-integer numbers (×10,000).
  // Inside checkTrade everything stays in BigInt so PnL math is exact.
  const buyPrice = BigInt(update.buyPrice);
  const sellPrice = BigInt(update.sellPrice);

  for (const trade of openTrades) {
    await checkTrade(trade, buyPrice, sellPrice);
  }
});

app.post("/auth/signup", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  if (password.length < 8) {
    res.status(400).json({ error: "Password must be at least 8 characters" });
    return;
  }

  const existing = await prisma.user.findUnique({ where: { email } });
  if (existing) {
    res.status(409).json({ error: "Email already in use" });
    return;
  }

  const hashed = await bcrypt.hash(password, 12);
  const user = await prisma.user.create({
    data: { email, password: hashed },
    select: { id: true, email: true, usdBalance: true, createdAt: true },
  });

  const token = jwt.sign(
    { userId: user.id, email: user.email } satisfies AuthPayload,
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("jwt", token, cookieOptions);

  res.status(201).json({ user });
});

app.post("/auth/signin", async (req: Request, res: Response): Promise<void> => {
  const { email, password } = req.body as { email?: string; password?: string };

  if (!email || !password) {
    res.status(400).json({ error: "email and password are required" });
    return;
  }

  const user = await prisma.user.findUnique({ where: { email } });
  if (!user) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const valid = await bcrypt.compare(password, user.password);
  if (!valid) {
    res.status(401).json({ error: "Invalid credentials" });
    return;
  }

  const token = jwt.sign(
    { userId: user.id, email: user.email } satisfies AuthPayload,
    JWT_SECRET,
    { expiresIn: "7d" }
  );

  res.cookie("jwt", token, cookieOptions);

  res.json({
    user: { id: user.id, email: user.email, usdBalance: Number(user.usdBalance), createdAt: user.createdAt },
  });
});

app.post("/auth/logout", (_req: Request, res: Response): void => {
  res.clearCookie("jwt", { ...cookieOptions, maxAge: undefined });
  res.json({ ok: true });
});

app.post("/api/v1/trade", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { asset, type, margin, price, quantity, stopLoss, takeProfit } = req.body as {
    asset?: string;
    type?: string;
    margin?: number;
    price?: number;
    quantity?: number;
    stopLoss?: number;
    takeProfit?: number;
  };

  if (!asset || !type || margin == null || price == null || quantity == null) {
    res.status(400).json({ error: "asset, type, margin, price and quantity are required" });
    return;
  }

  if (margin <= 0 || price <= 0 || quantity <= 0) {
    res.status(400).json({ error: "margin, price and quantity must be positive" });
    return;
  }

  const tradeType = type.toUpperCase() as TradeType;
  if (tradeType !== TradeType.BUY && tradeType !== TradeType.SELL) {
    res.status(400).json({ error: 'type must be "buy" or "sell"' });
    return;
  }

  const userId = req.user!.userId;

  const user = await prisma.user.findUnique({ where: { id: userId } });
  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  if (user.usdBalance < margin) {
    res.status(400).json({ error: "Insufficient funds" });
    return;
  }

  const dbAsset = await prisma.asset.findUnique({ where: { symbol: asset } });
  if (!dbAsset) {
    res.status(404).json({ error: `Asset "${asset}" not found` });
    return;
  }

  const priceUpdate = latestPrices.get(asset);
  if (!priceUpdate) {
    res.status(503).json({ error: "Price not available yet, try again shortly" });
    return;
  }

  // price arrives scaled by 10^asset.decimals; convert (price * quantity) to cents (×100).
  const priceScale = Math.pow(10, dbAsset.decimals);
  const exposure = Math.round((price * quantity * 100) / priceScale);
  if (exposure < margin) {
    res.status(400).json({ error: "Exposure must be at least equal to margin" });
    return;
  }
  const leverage = Math.round(exposure / margin);

  // Use buy price for BUY orders, sell price for SELL orders (server-side, not client-supplied)
  const openPrice = tradeType === TradeType.BUY ? priceUpdate.buyPrice : priceUpdate.sellPrice;

  const trade = await prisma.trade.create({
    data: {
      userId,
      assetId: dbAsset.id,
      type: tradeType,
      margin,
      leverage,
      exposure,
      openPrice,
      takeProfit,
      stopLoss
    },
  });

  // Deduct margin from balance
  await prisma.user.update({
    where: { id: userId },
    data: { usdBalance: { decrement: margin } },
  });

  res.status(201).json({ orderId: trade.id });
});

app.post("/api/v1/trade/close", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { orderId } = req.body as { orderId?: string };
  const userId = req.user!.userId;

  if (!orderId) {
    res.status(400).json({ error: "orderId is required" });
    return;
  }

  const trade = await prisma.trade.findUnique({
    where: { id: orderId },
    include: { asset: true },
  });

  if (!trade || trade.userId !== userId) {
    res.status(404).json({ error: "Trade not found" });
    return;
  }

  if (trade.status !== TradeStatus.OPEN) {
    res.status(400).json({ error: "Trade is not open" });
    return;
  }

  const priceUpdate = latestPrices.get(trade.asset.symbol);
  if (!priceUpdate) {
    res.status(503).json({ error: "Price not available yet, try again shortly" });
    return;
  }

  // closing a BUY → exit at sellPrice (worse for the buyer)
  // closing a SELL → exit at buyPrice (worse for the seller)
  const closePrice =
    trade.type === TradeType.BUY
      ? Math.round(priceUpdate.sellPrice)
      : Math.round(priceUpdate.buyPrice);

  const openPrice = Number(trade.openPrice);
  const exposure = Number(trade.exposure);
  const margin = Number(trade.margin);

  const pnl =
    trade.type === TradeType.BUY
      ? Math.round(((closePrice - openPrice) / openPrice) * exposure)
      : Math.round(((openPrice - closePrice) / openPrice) * exposure);

  const newBalance = await prisma.$transaction(async (tx) => {
    await tx.trade.update({
      where: { id: orderId },
      data: {
        status: TradeStatus.CLOSED,
        closePrice,
        pnl,
        closedAt: new Date(),
      },
    });

    const updated = await tx.user.update({
      where: { id: userId },
      data: { usdBalance: { increment: margin + pnl } },
      select: { usdBalance: true },
    });

    return updated.usdBalance;
  });

  res.json({ orderId, closePrice, pnl, newBalance: Number(newBalance) });
});

app.get("/api/v1/trades/open", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const trades = await prisma.trade.findMany({
    where: { userId, status: "OPEN" },
    select: {
      id: true,
      type: true,
      margin: true,
      leverage: true,
      exposure: true,
      openPrice: true,
      openedAt: true,
      asset: { select: { symbol: true, decimals: true, imageUrl: true } },
    },
    orderBy: { openedAt: "desc" },
  });

  res.json({
    trades: trades.map((t) => ({
      orderId: t.id,
      symbol: t.asset.symbol,
      decimals: t.asset.decimals,
      imageUrl: t.asset.imageUrl,
      type: t.type.toLowerCase(),
      margin: Number(t.margin),
      leverage: Number(t.leverage),
      exposure: Number(t.exposure),
      openPrice: Number(t.openPrice),
      openedAt: t.openedAt,
    })),
  });
});

app.get("/api/v1/trades", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const userId = req.user!.userId;

  const trades = await prisma.trade.findMany({
    where: { userId, status: { in: [TradeStatus.CLOSED, TradeStatus.LIQUIDATED] } },
    select: {
      id: true,
      type: true,
      margin: true,
      leverage: true,
      exposure: true,
      openPrice: true,
      closePrice: true,
      pnl: true,
      asset: { select: { symbol: true, decimals: true, imageUrl: true } },
    },
    orderBy: { closedAt: "desc" },
  });

  res.json({
    trades: trades.map((t) => ({
      orderId: t.id,
      symbol: t.asset.symbol,
      decimals: t.asset.decimals,
      imageUrl: t.asset.imageUrl,
      type: t.type.toLowerCase(),
      margin: Number(t.margin),
      leverage: Number(t.leverage),
      exposure: Number(t.exposure),
      openPrice: Number(t.openPrice),
      closePrice: Number(t.closePrice),
      pnl: Number(t.pnl),
    })),
  });
});

app.get("/api/v1/user/balance", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId },
    select: { usdBalance: true },
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.json({ usd_balance: Number(user.usdBalance) });
});

app.get("/api/v1/candles", async (req: Request, res: Response): Promise<void> => {
  const { asset, startTime, endTime, ts } = req.query as {
    asset?: string;
    startTime?: string;
    endTime?: string;
    ts?: string;
  };

  if (!asset || !startTime || !endTime || !ts) {
    res.status(400).json({ error: "asset, startTime, endTime and ts are required" });
    return;
  }

  const dbAsset = await prisma.asset.findUnique({ where: { symbol: asset } });
  if (!dbAsset) {
    res.status(404).json({ error: `Asset "${asset}" not found` });
    return;
  }

  const candles = await prisma.candle.findMany({
    where: {
      assetId: dbAsset.id,
      timeframe: ts,
      openTime: { gte: BigInt(startTime), lte: BigInt(endTime) },
    },
    orderBy: { openTime: "asc" },
  });

  res.json({
    candles: candles.map((c) => ({
      timestamp: Number(c.openTime),
      open: Number(c.open),
      close: Number(c.close),
      high: Number(c.high),
      low: Number(c.low),
      decimals: c.decimals,
    })),
  });
});

app.get("/api/v1/user", authMiddleware, authMiddleware, async (req: AuthRequest, res: Response) => {
  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId }
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  res.status(200).json({
    user
  })
});

app.patch("/api/v1/user/setting",authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { firstName, lastName, username } = req.body;

  const user = await prisma.user.findUnique({
    where: { id: req.user!.userId }
  });

  if (!user) {
    res.status(404).json({ error: "User not found" });
    return;
  }

  try {
    await prisma.user.update({
      where:{
        id:user.id
      }, 
      data:{
        firstName,
        lastName,
        username
      }
    })
  } catch (e) {
    res.status(500).json({message: "Internal Server Error"})
  }

  res.status(200).json({
    message:"User Details updated"
  })
})

app.get("/api/v1/assets", async (_req: Request, res: Response): Promise<void> => {
  const assets = await prisma.asset.findMany({
    select: { name: true, symbol: true, decimals: true, imageUrl: true },
  });

  res.json({
    assets: assets.map((a) => {
      const price = latestPrices.get(a.symbol);
      return {
        name: a.name,
        symbol: a.symbol,
        buyPrice: price?.buyPrice ?? null,
        sellPrice: price?.sellPrice ?? null,
        decimals: a.decimals,
        imageUrl: a.imageUrl,
      };
    }),
  });
});

app.listen(PORT, () => {
  console.log(`HTTP server listening on port ${PORT}`);
});
