# syntax=docker/dockerfile:1.7
# LICENGO web (Next.js standalone). Build sur Debian, exécution distroless non-root (sans shell ni gestionnaire de paquets).
FROM node:22-bookworm AS base
RUN corepack enable
WORKDIR /app

FROM base AS deps
COPY pnpm-lock.yaml pnpm-workspace.yaml package.json .npmrc ./
COPY apps/web/package.json apps/web/package.json
COPY apps/web/prisma apps/web/prisma
COPY packages/core/package.json packages/core/package.json
# CA facultative (proxy d'entreprise) : docker build --secret id=ca,src=ca.pem — jamais copiée dans l'image
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm install --frozen-lockfile --filter @licengo/web... --filter @licengo/core

FROM deps AS builder
COPY packages/core packages/core
COPY apps/web apps/web
ENV NEXT_TELEMETRY_DISABLED=1
RUN --mount=type=secret,id=ca,required=false \
    if [ -f /run/secrets/ca ]; then export NODE_EXTRA_CA_CERTS=/run/secrets/ca; fi; \
    pnpm --filter @licengo/web exec prisma generate && pnpm --filter @licengo/web exec next build \
 && cp -r apps/web/.next/static apps/web/.next/standalone/apps/web/.next/static \
 && cp -r apps/web/public apps/web/.next/standalone/apps/web/public \
 && mkdir -p /data/storage

# Job de migration (CLI Prisma disponible)
FROM builder AS migrate
CMD ["pnpm", "--filter", "@licengo/web", "exec", "prisma", "migrate", "deploy"]

FROM gcr.io/distroless/nodejs22-debian12:nonroot AS runner
WORKDIR /app
ENV NODE_ENV=production NEXT_TELEMETRY_DISABLED=1 PORT=3000 HOSTNAME=0.0.0.0 STORAGE_DIR=/data/storage
COPY --from=builder --chown=nonroot:nonroot /app/apps/web/.next/standalone ./
COPY --from=builder --chown=nonroot:nonroot /data /data
USER nonroot
EXPOSE 3000
HEALTHCHECK --interval=30s --timeout=5s CMD ["/nodejs/bin/node", "-e", "fetch('http://127.0.0.1:3000/api/health').then(r=>process.exit(r.ok?0:1)).catch(()=>process.exit(1))"]
CMD ["apps/web/server.js"]
