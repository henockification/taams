FROM node:22-alpine AS runner

WORKDIR /app

ENV NODE_ENV=production
ENV NEXT_TELEMETRY_DISABLED=1
ENV HOSTNAME=0.0.0.0
ENV PORT=3000

USER node

EXPOSE 3000


FROM runner AS api

COPY --from=build --chown=node:node \
    /app/apps/api/.next/standalone ./

COPY --from=build --chown=node:node \
    /app/apps/api/.next/static ./apps/api/.next/static

CMD ["node", "apps/api/server.js"]


FROM runner AS frontend

COPY --from=build --chown=node:node \
    /app/apps/frontend/.next/standalone ./

COPY --from=build --chown=node:node \
    /app/apps/frontend/.next/static ./apps/frontend/.next/static

COPY --from=build --chown=node:node \
    /app/apps/frontend/public ./apps/frontend/public

CMD ["node", "apps/frontend/server.js"]