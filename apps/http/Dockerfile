FROM oven/bun:1 AS base
WORKDIR /app

# Copy workspace root manifest and lockfile
COPY package.json bun.lock ./

# Copy all packages this service depends on
COPY backend/shared ./backend/shared
COPY backend/db ./backend/db
COPY backend/http ./backend/http

# Install from workspace root so workspace symlinks resolve
RUN bun install --frozen-lockfile

# Generate Prisma client inside the db package
RUN cd backend/db && bunx --bun prisma generate

EXPOSE 3000

CMD ["bun", "run", "backend/http/index.ts"]
