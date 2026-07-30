# syntax=docker/dockerfile:1

# -------------------------------------------------------
# Base
# -------------------------------------------------------
    FROM node:22-bookworm-slim AS base

    WORKDIR /app
    
    ENV NEXT_TELEMETRY_DISABLED=1
    ENV CI=true
    
    
    # -------------------------------------------------------
    # Dependencies
    # -------------------------------------------------------
    FROM base AS dependencies
    
    COPY package.json package-lock.json ./
    
    COPY apps/api/package.json ./apps/api/package.json
    COPY apps/frontend/package.json ./apps/frontend/package.json
    COPY packages/shared/package.json ./packages/shared/package.json
    
    RUN npm ci \
        --no-audit \
        --no-fund \
        --prefer-offline
    
    
    # -------------------------------------------------------
    # Build
    # -------------------------------------------------------
    FROM base AS build
    
    COPY --from=dependencies /app/node_modules ./node_modules
    COPY . .
    
    ARG NEXT_PUBLIC_BASE_URL
    ARG NEXT_PUBLIC_STOREFRONT_API_KEY
    ARG DATABASE_URL
    
    ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
    ENV NEXT_PUBLIC_STOREFRONT_API_KEY=${NEXT_PUBLIC_STOREFRONT_API_KEY}
    ENV DATABASE_URL=${DATABASE_URL}
    
    RUN npm run build
    
    
    # -------------------------------------------------------
    # Runtime
    # -------------------------------------------------------
    FROM node:22-bookworm-slim AS runner
    
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1
    ENV HOSTNAME=0.0.0.0
    ENV PORT=3000
    
    USER node
    
    EXPOSE 3000
    
    
    # -------------------------------------------------------
    # API target
    # -------------------------------------------------------
    FROM runner AS api
    
    COPY --from=build --chown=node:node \
        /app/apps/api/.next/standalone ./
    
    COPY --from=build --chown=node:node \
        /app/apps/api/.next/static ./apps/api/.next/static
    
    CMD ["node", "apps/api/server.js"]
    
    
    # -------------------------------------------------------
    # Frontend target
    # -------------------------------------------------------
    FROM runner AS frontend
    
    COPY --from=build --chown=node:node \
        /app/apps/frontend/.next/standalone ./
    
    COPY --from=build --chown=node:node \
        /app/apps/frontend/.next/static ./apps/frontend/.next/static
    
    COPY --from=build --chown=node:node \
        /app/apps/frontend/public ./apps/frontend/public
    
    CMD ["node", "apps/frontend/server.js"]