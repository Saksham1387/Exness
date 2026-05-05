import { WebSocketServer, type WebSocket } from 'ws';
import { subscriber } from "@exness/shared";
import { prisma } from "@exness/db";

const wss = new WebSocketServer({ port: 3001 });

const USER_SUBSCRIPTIONS = new Map<string, WebSocket[]>();

const assets = await prisma.asset.findMany({ select: { symbol: true } });
const channels = assets.map((a) => `${a.symbol}@prices`);

// TODO: Implement the liquidation
await subscriber.subscribe(channels, (message, channel) => {
  const subscribers = USER_SUBSCRIPTIONS.get(channel);
  if (!subscribers) return;
  for (const client of subscribers) {
    if (client.readyState === client.OPEN) {
      client.send(message);
    }
  }
});

wss.on('connection', function connection(ws) {
  ws.on('error', console.error);

  ws.on('message', function message(data) {

    const parsed = JSON.parse(data.toString());
    const method = parsed.method;

    if (method === "SUBSCRIBE") {
      (parsed.params as string[]).forEach(channel => {
        if (!USER_SUBSCRIPTIONS.has(channel)) {
          USER_SUBSCRIPTIONS.set(channel, []);
        }
        const subs = USER_SUBSCRIPTIONS.get(channel)!;
        if (!subs.includes(ws)) {
          subs.push(ws);
        }
      });
    } else if (method === "UNSUBSCRIBE") {
      (parsed.params as string[]).forEach(channel => {
        const subs = USER_SUBSCRIPTIONS.get(channel);
        if (subs) {
          const index = subs.indexOf(ws);
          if (index !== -1) subs.splice(index, 1);
        }
      });
    }
  });

  ws.on('close', () => {
    USER_SUBSCRIPTIONS.forEach((subs) => {
      const index = subs.indexOf(ws);
      if (index !== -1) subs.splice(index, 1);
    });
  });
});

