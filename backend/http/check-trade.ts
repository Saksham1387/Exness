import { prisma } from "@exness/db";
import { publisher } from "@exness/shared";

export async function checkTrade(trade: any, buyPrice: number, sellPrice:number ) {
const exitPrice = trade.type === "BUY" ? sellPrice : buyPrice;

    let pnl: number;
    if (trade.type === "BUY") {
        pnl = ((exitPrice - Number(trade.openPrice)) / Number(trade.openPrice)) * Number(trade.exposure);
    } else {
        pnl = ((Number(trade.openPrice) - exitPrice) / Number(trade.openPrice)) * Number(trade.exposure);
    }


    if (trade.stopLoss) {
        const stopHit =
        trade.type === "BUY"
            ? exitPrice <= trade.stopLoss   
            : exitPrice >= trade.stopLoss;  

        if (stopHit) {
        await closeTrade(trade, exitPrice, pnl, "CLOSED");
        return;
        }
    }

    if (trade.takeProfit) {
        const tpHit =
        trade.type === "BUY"
            ? exitPrice >= trade.takeProfit  
            : exitPrice <= trade.takeProfit; 

        if (tpHit) {
        await closeTrade(trade, exitPrice, pnl, "CLOSED");
        return;
        }
    }
}

// @ts-ignore
async function closeTrade(trade, exitPrice, pnl, status) {
    const pnlBigInt = BigInt(Math.round(pnl));
    await prisma.$transaction(async (tx) => {

        await tx.trade.update({
        where: { id: trade.id },
        data: {
            status:     status,        
            closePrice: exitPrice,
            pnl:        pnlBigInt,
            closedAt:   new Date()
        }
        });

        await tx.user.update({
            where: { id: trade.userId },
            data: {
                usdBalance: { increment: trade.margin + pnlBigInt }
            }
        });

    });

    const executedTrade = {
        closePrice : exitPrice,
        pnl: pnl
    }
    publisher.publish(`${trade.userId}@trades`,JSON.stringify(executedTrade));
}