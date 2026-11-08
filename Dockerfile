# syntax=docker/dockerfile:1.7
# LICENGO web (Next.js standalone) – image multi-étapes, utilisateur non-root
FROM node:22-alpine AS base
RUN corepack enable && apk add --no-cache openssl libc6-compat
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json ./
COPY apps/web/package.json apps/web/package.json
COPY packages/core/package.json packages/core/package.json
RUN pnpm install --frozen-lockfile --filter @licengo/web... --filter @licengo/core

FROM deps AS builder
COPY packages/core packages/core
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN pnpm --filter @licengo/web exec prisma generate && pnpm --filter @licengo/web exec next build

# Migration job image (prisma CLI available)
FROM builder AS migrate
CMD ["pnpm", "--filter", "@licengo/web", "exec", "prisma", "migrate", "deploy"]

FROM node:22-alpine AS runner
RUN apk add --no-cache openssl && addgroup -S licengo && adduser -S licengo -G licengo
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data/storage
COPY --from=builder --chown=licengo:licengo /app/apps/web/.next/standalone ./
COPY --from=builder --chown=licengo:licengo /app/apps/web/.next/static ./apps/web/.next/static
COPY --from=builder --chown=licengo:licengo /app/apps/web/public ./apps/web/public
RUN mkdir -p /data/storage && chown -R licengo:licengo /data
USER licengo
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD wget -qO- http://127.0.0.1:3000/api/health || exit 1
CMD ["node", "apps/web/server.js"]
