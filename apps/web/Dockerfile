# Stage 1: Builder
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
COPY apps/web/package.json ./apps/web/

# Install dependencies
RUN npm ci --workspace=apps/web --include-workspace-root

# Copy source
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/

# Build Next.js (standalone output)
RUN cd apps/web && npm run build

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build
COPY --from=builder /app/apps/web/.next/standalone ./
COPY --from=builder /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]