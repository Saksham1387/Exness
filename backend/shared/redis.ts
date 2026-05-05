import { createClient } from "redis";

export const publisher  = createClient();
export const subscriber = createClient();

await publisher.connect();
await subscriber.connect();
