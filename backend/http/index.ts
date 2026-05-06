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

const app = express();
app.set("json replacer", (_key: string, value: unknown) =>
  typeof value === "bigint" ? value.toString() : value
);
app.use(express.json());
app.use(cors());

export const JWT_SECRET = process.env.JWT_SECRET!;
const PORT = process.env.PORT ?? 3000;

const latestPrices = new Map<string, PriceUpdate>();

const assets = await prisma.asset.findMany({ select: { symbol: true } });
const channels = assets.map((a) => `${a.symbol}@prices`);

// This is very bad, should store this in-memory
await subscriber.subscribe(channels, async (message) => {
  const update = JSON.parse(message) as PriceUpdate;

  latestPrices.set(update.symbol, update);

  const openTrades = await prisma.trade.findMany({
    where: {
      asset: {
        symbol:{
          equals:update.symbol
        }
      } ,
      status: "OPEN"
    }
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

  res.status(201).json({ token, user });
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

  res.json({
    token,
    user: { id: user.id, email: user.email, usdBalance: Number(user.usdBalance), createdAt: user.createdAt },
  });
});

app.post("/api/v1/trade", authMiddleware, async (req: AuthRequest, res: Response): Promise<void> => {
  const { asset, type, margin, leverage, stopLoss, takeProfit } = req.body as {
    asset?: string;
    type?: string;
    margin?: number;
    leverage?: number;

    stopLoss?: number;
    takeProfit?: number
  };

  if (!asset || !type || margin == null || leverage == null) {
    res.status(400).json({ error: "asset, type, margin and leverage are required" });
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

  // Use buy price for BUY orders, sell price for SELL orders
  const openPrice = tradeType === TradeType.BUY ? priceUpdate.buyPrice : priceUpdate.sellPrice;
  const exposure = margin * leverage;

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

app.get("/api/v1/candles", authMiddleware, async (req: Request, res: Response): Promise<void> => {
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

app.get("/api/v1/assets", authMiddleware, async (_req: Request, res: Response): Promise<void> => {
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
