# ─── Stage 1: Builder ─────────────────────────────────────────────────────────
FROM node:20-alpine AS builder

WORKDIR /app

# Copy workspace manifests
COPY package.json package-lock.json ./
COPY packages/tsconfig/package.json ./packages/tsconfig/
COPY packages/config/package.json ./packages/config/
COPY packages/types/package.json ./packages/types/
COPY packages/auth/package.json ./packages/auth/
COPY packages/ai/package.json ./packages/ai/
COPY packages/workflows/package.json ./packages/workflows/
COPY packages/ui/package.json ./packages/ui/
COPY packages/eslint-config/package.json ./packages/eslint-config/
COPY apps/api/package.json ./apps/api/

# Install all dependencies
RUN npm ci --workspace=apps/api --include-workspace-root

# Copy source files
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/

# Build internal workspace packages so their dist/ exists at runtime
RUN npm run build -w packages/types

# Generate Prisma client
RUN cd apps/api && npx prisma generate

# ─── Stage: Dev (hot-reload via nest --watch) ─────────────────────────────────
# Used by docker-compose.dev.yml. Source is bind-mounted over /app/apps/api at
# runtime, so this image only needs deps + the generated Prisma client; the
# NestJS build is skipped (the watcher compiles on the fly).
FROM builder AS dev

ENV NODE_ENV=development
WORKDIR /app/apps/api
EXPOSE 3001
CMD ["npm", "run", "dev"]

# ─── Stage: Build (production NestJS compile) ─────────────────────────────────
FROM builder AS build

RUN cd apps/api && npm run build

# ─── Stage 2: Runner ──────────────────────────────────────────────────────────
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production

# Copy only production dependencies and built output
COPY --from=build /app/apps/api/dist ./dist
COPY --from=build /app/apps/api/prisma ./prisma
COPY --from=build /app/apps/api/prisma.config.ts ./prisma.config.ts
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/apps/api/node_modules ./apps/api/node_modules
COPY --from=build /app/apps/api/package.json ./package.json
# tsconfig is needed at runtime so ts-node can load prisma/seed.ts via
# `npm run seed`. Without it ts-node bails with TS5083.
COPY --from=build /app/apps/api/tsconfig.json ./tsconfig.json
# Copy built internal packages so node_modules workspace symlinks resolve
COPY --from=build /app/packages/types ./packages/types

EXPOSE 3001

CMD ["node", "dist/main"]
