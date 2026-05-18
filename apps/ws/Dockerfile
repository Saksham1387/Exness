FROM oven/bun:1 AS base
WORKDIR /app

COPY package.json bun.lock ./

COPY backend/shared ./backend/shared
COPY backend/ws ./backend/ws

RUN bun install --frozen-lockfile

RUN cd backend/db && bunx prisma generate

EXPOSE 3001

CMD ["bun", "run", "backend/ws/index.ts"]
