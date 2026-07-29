FROM node:22-alpine AS base

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1


FROM base AS dependencies

COPY package.json package-lock.json ./
COPY apps/api/package.json ./apps/api/package.json
COPY apps/frontend/package.json ./apps/frontend/package.json
COPY packages/shared/package.json ./packages/shared/package.json

RUN npm ci


FROM base AS build

COPY --from=dependencies /app/node_modules ./node_modules
COPY . .

ARG NEXT_PUBLIC_BASE_URL
ARG NEXT_PUBLIC_STOREFRONT_API_KEY
ENV DATABASE_URL=postgresql://postgres:postgres@localhost:5432/taams
ENV NEXT_PUBLIC_BASE_URL=$NEXT_PUBLIC_BASE_URL
ENV NEXT_PUBLIC_STOREFRONT_API_KEY=$NEXT_PUBLIC_STOREFRONT_API_KEY

RUN npm run build


FROM base AS runner
ENV NODE_ENV=production
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

RUN apk add --no-cache curl
RUN addgroup --system --gid 1001 nodejs
RUN adduser --system --uid 1001 nextjs

USER nextjs

EXPOSE 3000


FROM runner AS api

COPY --from=build --chown=nextjs:nodejs /app/apps/api/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/api/.next/static ./apps/api/.next/static

CMD ["node", "apps/api/server.js"]


FROM runner AS frontend

COPY --from=build --chown=nextjs:nodejs /app/apps/frontend/.next/standalone ./
COPY --from=build --chown=nextjs:nodejs /app/apps/frontend/.next/static ./apps/frontend/.next/static
COPY --from=build --chown=nextjs:nodejs /app/apps/frontend/public ./apps/frontend/public

CMD ["node", "apps/frontend/server.js"]
