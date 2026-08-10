# syntax=docker/dockerfile:1

# Production multi-stage image: builds Nest backend + Vite frontend,
# then runs a slim non-root Node runtime serving API + SPA.

FROM node:22-bookworm-slim AS base
WORKDIR /app

# Canvas / TLS system deps shared by build (native modules) and runtime.
RUN apt-get update \
  && apt-get install -y --no-install-recommends \
    ca-certificates \
    fontconfig \
    fonts-dejavu-core \
    libjpeg62-turbo \
    libpng16-16 \
  && rm -rf /var/lib/apt/lists/*

FROM base AS deps
COPY package.json package-lock.json ./
COPY apps/backend/package.json apps/backend/
COPY apps/frontend/package.json apps/frontend/
COPY packages/shared-types/package.json packages/shared-types/
COPY shared/package.json shared/
# Allow package postinstalls (native bindings) while skipping husky hooks.
ENV HUSKY=0
RUN npm ci

FROM deps AS build
COPY tsconfig.base.json ./
COPY packages/shared-types packages/shared-types
COPY shared shared
COPY apps/backend apps/backend
COPY apps/frontend apps/frontend

ARG VITE_API_BASE_URL=
ARG VITE_HITL_USE_MOCK_DATA=false
ENV VITE_API_BASE_URL=$VITE_API_BASE_URL \
    VITE_HITL_USE_MOCK_DATA=$VITE_HITL_USE_MOCK_DATA

RUN npm run build -w @policy-pilot/shared \
  && npm run build -w @policy-pilot/shared-types \
  && npm run prisma:generate -w @policy-pilot/backend \
  && npm run build -w @policy-pilot/backend \
  && npm run build -w @policy-pilot/frontend \
  && npm prune --omit=dev \
  && rm -rf \
    apps/backend/src \
    apps/frontend/src \
    apps/frontend/index.html \
    apps/frontend/vite.config.ts \
    apps/frontend/tailwind.config.js \
    apps/frontend/postcss.config.js \
    apps/frontend/tsconfig.json \
    apps/frontend/tsconfig.spec.json \
    packages/shared-types/src \
    shared/pii \
    shared/tsconfig.json \
    /root/.npm

FROM base AS runtime
ENV NODE_ENV=production \
    FRONTEND_DIST_PATH=/app/apps/frontend/dist \
    PORT=3000

COPY --from=build --chown=node:node /app /app

USER node
EXPOSE 3000
CMD ["node", "apps/backend/dist/main.js"]
