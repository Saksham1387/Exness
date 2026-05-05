import { PrismaClient } from "./generated/prisma/client";
import { PrismaPg } from "@prisma/adapter-pg";
import { publisher } from "@exness/shared";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

export const prisma = new PrismaClient({
  adapter,
});


export async function cleanupOldCandles() {
  const oneDayAgo = BigInt(Date.now() - 24 * 60 * 60 * 1000);
    try {
      const deleted = await prisma.candle.deleteMany({
    where: {
          openTime: {
            lt: oneDayAgo
        }
    }
    });

    if (deleted.count > 0) {
      console.log(`[Cleanup] Deleted ${deleted.count} old candles.`);
    }
   } catch (error) {
     console.error("[Cleanup] Failed to delete old candles:", error);
   }
 }


export async function processDBBatch(){
  const [items] = await publisher.multi().lRange("db",0,-1).del("db").exec();
  
  const assets = await prisma.asset.findMany({ select: { id: true, symbol: true } });
  const assetMap = new Map(assets.map(a => [a.symbol, a.id]));

  const updates = items as string[];
  if (!updates || updates.length === 0) return;
  const parsedUpdates = updates.map(u => JSON.parse(u));

  // There is no need to make this a transaction
  await prisma.$transaction(async(tx) => {
    for(const update of parsedUpdates) {
      const assetId = assetMap.get(update.symbol);
      await tx.candle.upsert({
        where: {
            assetId_timeframe_openTime: {
                assetId: assetId!,
                timeframe: "1m",
                openTime: BigInt(update.candle.openTime),
            },
        },
        update: {
            high: BigInt(update.candle.high),
            low: BigInt(update.candle.low),
            close: BigInt(update.candle.close),
        },
        create: {
            assetId: assetId!,
            timeframe: "1m",
            openTime: BigInt(update.candle.openTime),
            open: BigInt(update.candle.open),
            high: BigInt(update.candle.high),
            low: BigInt(update.candle.low),
            close: BigInt(update.candle.close),
            decimals: update.candle.decimals,
        },
    });
    }
  })

  await cleanupOldCandles();
}

setInterval(processDBBatch,1 * 60 * 1000);