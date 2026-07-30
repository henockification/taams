# syntax=docker/dockerfile:1

# -------------------------------------------------------
# Base image
# -------------------------------------------------------
    FROM node:22-alpine AS base

    WORKDIR /app
    
    ENV NEXT_TELEMETRY_DISABLED=1
    
    
    # -------------------------------------------------------
    # Install npm workspace dependencies
    # -------------------------------------------------------
    FROM base AS dependencies
    
    # Root npm workspace files
    COPY package.json package-lock.json ./
    
    # Workspace package manifests
    COPY apps/api/package.json ./apps/api/package.json
    COPY apps/frontend/package.json ./apps/frontend/package.json
    COPY packages/shared/package.json ./packages/shared/package.json
    
    RUN npm ci
    
    
    # -------------------------------------------------------
    # Build all Turborepo applications
    # -------------------------------------------------------
    FROM base AS build
    
    COPY --from=dependencies /app/node_modules ./node_modules
    
    # Copying the complete repository also copies the workspace
    # package manifests already created in the dependencies stage.
    COPY . .
    
    ARG NEXT_PUBLIC_BASE_URL
    ARG NEXT_PUBLIC_STOREFRONT_API_KEY
    
    ENV NEXT_PUBLIC_BASE_URL=${NEXT_PUBLIC_BASE_URL}
    ENV NEXT_PUBLIC_STOREFRONT_API_KEY=${NEXT_PUBLIC_STOREFRONT_API_KEY}
    
    # Only include DATABASE_URL during build when the Next.js
    # build process requires it.
    ARG DATABASE_URL
    ENV DATABASE_URL=${DATABASE_URL}
    
    RUN npm run build
    
    
    # -------------------------------------------------------
    # Shared production runtime
    # -------------------------------------------------------
    FROM node:22-alpine AS runner
    
    WORKDIR /app
    
    ENV NODE_ENV=production
    ENV NEXT_TELEMETRY_DISABLED=1
    ENV HOSTNAME=0.0.0.0
    ENV PORT=3000
    
    RUN apk add --no-cache curl \
        && addgroup --system --gid 1001 nodejs \
        && adduser --system --uid 1001 nextjs
    
    USER nextjs
    
    EXPOSE 3000
    
    
    # -------------------------------------------------------
    # API target
    # -------------------------------------------------------
    FROM runner AS api
    
    COPY --from=build --chown=nextjs:nodejs \
        /app/apps/api/.next/standalone ./
    
    COPY --from=build --chown=nextjs:nodejs \
        /app/apps/api/.next/static ./apps/api/.next/static
    
    # Uncomment this only if apps/api/public exists.
    # COPY --from=build --chown=nextjs:nodejs \
    #     /app/apps/api/public ./apps/api/public
    
    CMD ["node", "apps/api/server.js"]
    
    
    # -------------------------------------------------------
    # Frontend target
    # -------------------------------------------------------
    FROM runner AS frontend
    
    COPY --from=build --chown=nextjs:nodejs \
        /app/apps/frontend/.next/standalone ./
    
    COPY --from=build --chown=nextjs:nodejs \
        /app/apps/frontend/.next/static ./apps/frontend/.next/static
    
    COPY --from=build --chown=nextjs:nodejs \
        /app/apps/frontend/public ./apps/frontend/public
    
    CMD ["node", "apps/frontend/server.js"]