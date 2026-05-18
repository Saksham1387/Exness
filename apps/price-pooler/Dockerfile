FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./

COPY backend/shared ./backend/shared
COPY backend/price-pooler ./backend/price-pooler

RUN bun install --frozen-lockfile

# price-pooler has no inbound ports; it connects outbound to Binance
CMD ["bun", "run", "backend/price-pooler/index.ts"]
