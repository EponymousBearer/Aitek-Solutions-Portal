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

# Build internal workspace packages so their dist/ exists before Next.js resolves them
RUN npm run build -w packages/types

# Stage: Dev (hot-reload via `next dev`)
# Used by docker-compose.dev.yml. Source is bind-mounted over /app/apps/web at
# runtime, so this image only needs deps; `next dev` handles HMR. NEXT_PUBLIC_*
# are read at runtime here (no need to bake them in like the production build).
FROM builder AS dev

ENV NODE_ENV=development
WORKDIR /app/apps/web
EXPOSE 3000
CMD ["npm", "run", "dev"]

# Stage: Build (production Next.js standalone compile)
FROM builder AS build

# Build-time public env vars (NEXT_PUBLIC_* must be baked in at next build time)
ARG NEXT_PUBLIC_API_URL
ARG NEXT_PUBLIC_APP_URL
ARG NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY
ENV NEXT_PUBLIC_API_URL=$NEXT_PUBLIC_API_URL
ENV NEXT_PUBLIC_APP_URL=$NEXT_PUBLIC_APP_URL
ENV NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY=$NEXT_PUBLIC_CLERK_PUBLISHABLE_KEY

# Build Next.js (standalone output)
RUN cd apps/web && npm run build

# Ensure public dir exists (may be empty if no static assets added yet)
RUN mkdir -p /app/apps/web/public

# Stage 2: Runner
FROM node:20-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1

# Copy standalone build
COPY --from=build /app/apps/web/.next/standalone ./
COPY --from=build /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=build /app/apps/web/public ./apps/web/public

EXPOSE 3000

ENV PORT=3000
ENV HOSTNAME=0.0.0.0

CMD ["node", "apps/web/server.js"]