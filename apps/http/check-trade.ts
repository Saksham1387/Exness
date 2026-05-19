import { prisma } from "@exness/db";
import type { TradeModel } from "@exness/db/generated/prisma/models";
import { TradeStatus } from "@exness/db/generated/prisma/enums";
import { publisher } from "@exness/shared";

export async function checkTrade(trade: TradeModel, buyPrice: bigint, sellPrice: bigint) {
    const exitPrice = trade.type === "BUY" ? sellPrice : buyPrice;

    // Multiply before divide so integer division doesn't truncate the ratio to 0n.
    // Result lands in `exposure`'s scale (decimal 2 = cents), matching the `pnl` column.
    const priceDelta = trade.type === "BUY"
        ? exitPrice - trade.openPrice
        : trade.openPrice - exitPrice;
    const pnl = (priceDelta * trade.exposure) / trade.openPrice;

    if (pnl <= -trade.margin) {
        await closeTrade(trade, exitPrice, -trade.margin, "LIQUIDATED");
        return;
    }

    if (trade.stopLoss !== null) {
        const stopHit = trade.type === "BUY"
            ? exitPrice <= trade.stopLoss
            : exitPrice >= trade.stopLoss;

        if (stopHit) {
            await closeTrade(trade, exitPrice, pnl, "CLOSED");
            return;
        }
    }

    if (trade.takeProfit !== null) {
        const tpHit = trade.type === "BUY"
            ? exitPrice >= trade.takeProfit
            : exitPrice <= trade.takeProfit;

        if (tpHit) {
            await closeTrade(trade, exitPrice, pnl, "CLOSED");
            return;
        }
    }
}

async function closeTrade(trade: TradeModel, exitPrice: bigint, pnl: bigint, status: TradeStatus) {
    const closed = await prisma.$transaction(async (tx) => {
        const result = await tx.trade.updateMany({
            where: {
                id: trade.id,
                status: TradeStatus.OPEN,
            },
            data: {
                status,
                closePrice: exitPrice,
                pnl,
                closedAt: new Date(),
            },
        });

        if (result.count === 0) {
            return false;
        }

        await tx.user.update({
            where: { id: trade.userId },
            data: {
                usdBalance: { increment: trade.margin + pnl },
            },
        });

        return true;
    });

    if (!closed) {
        return;
    }

    // BigInt isn't JSON-serializable; values are well within 2^53 so Number() is safe here.
    const executedTrade = {
        closePrice: Number(exitPrice),
        pnl: Number(pnl),
    };
    publisher.publish(`${trade.userId}@trades`, JSON.stringify(executedTrade));
}
