import { createClient } from "redis";

const redisUrl = process.env.REDIS_URL;

export const publisher  = createClient({ url: redisUrl });
export const subscriber = createClient({ url: redisUrl });

await publisher.connect();
await subscriber.connect();
