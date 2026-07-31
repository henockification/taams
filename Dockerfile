# syntax=docker/dockerfile:1

# =======================================================
# Base
# =======================================================
FROM node:20-bookworm-slim AS base

WORKDIR /app

ENV NEXT_TELEMETRY_DISABLED=1
ENV CI=true


# =======================================================
# Dependencies
# =======================================================
FROM base AS dependencies

COPY package.json package-lock.json ./

COPY apps/api/package.json ./apps/api/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm config set fetch-retries 5 \
    && npm config set fetch-retry-factor 2 \
    && npm config set fetch-retry-mintimeout 10000 \
    && npm config set fetch-retry-maxtimeout 120000 \
    && npm config set fetch-timeout 300000 \
    && npm ci \
        --no-audit \
        --no-fund \
        --foreground-scripts \
    || (echo "===== NPM DEBUG LOG =====" \
        && find /root/.npm/_logs -type f -name "*-debug-0.log" \
           -exec cat {} \; \
        && exit 1)


# =======================================================
# Shared source
# =======================================================
FROM base AS source

COPY --from=dependencies /app ./
COPY . .


# =======================================================
# API build
# =======================================================
FROM source AS api-build

ARG DATABASE_URL

ENV DATABASE_URL=${DATABASE_URL}

RUN npm run build --workspace=@taams/api


# =======================================================
# Frontend build
# =======================================================
FROM source AS frontend-build

ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_STOREFRONT_API_KEY

ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
ENV NEXT_PUBLIC_STOREFRONT_API_KEY=${NEXT_PUBLIC_STOREFRONT_API_KEY}

RUN npm run build --workspace=@taams/frontend

# =======================================================
# Database seed target
# =======================================================
FROM source AS db-seed

ARG DATABASE_URL
ARG SUPER_ADMIN_EMAIL
ARG SUPER_ADMIN_NAME
ARG SUPER_ADMIN_PASSWORD

ENV NODE_ENV=production
ENV DATABASE_URL=${DATABASE_URL}
ENV SUPER_ADMIN_EMAIL=${SUPER_ADMIN_EMAIL}
ENV SUPER_ADMIN_NAME=${SUPER_ADMIN_NAME}
ENV SUPER_ADMIN_PASSWORD=${SUPER_ADMIN_PASSWORD}

CMD ["npm", "run", "db:seed-super-admin", "--workspace=@taams/api"]

# =======================================================
# Database migration target
# =======================================================
FROM source AS db-migrate

ARG DATABASE_URL

ENV NODE_ENV=production
ENV DATABASE_URL=${DATABASE_URL}
ENV CI=true
ENV NO_COLOR=1

CMD ["sh", "-c", "cd /app/apps/api && npx drizzle-kit migrate --config=drizzle.config.ts 2>&1 | tee /tmp/migration.log; echo '=== migration finished ==='; sleep 3600"]


# =======================================================
# Shared runtime
# =======================================================
FROM node:20-bookworm-slim AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

USER node

EXPOSE 3000


# =======================================================
# API target
# =======================================================
FROM runner AS api

COPY --from=api-build --chown=node:node \
    /app/apps/api/.next/standalone ./

COPY --from=api-build --chown=node:node \
    /app/apps/api/.next/static ./apps/api/.next/static

# Uncomment only if apps/api/public exists.
# COPY --from=api-build --chown=node:node \
#     /app/apps/api/public ./apps/api/public

CMD ["node", "apps/api/server.js"]


# =======================================================
# Frontend target
# =======================================================
FROM runner AS frontend

COPY --from=frontend-build --chown=node:node \
    /app/apps/frontend/.next/standalone ./

COPY --from=frontend-build --chown=node:node \
    /app/apps/frontend/.next/static ./apps/frontend/.next/static

COPY --from=frontend-build --chown=node:node \
    /app/apps/frontend/public ./apps/frontend/public

CMD ["node", "apps/frontend/server.js"]