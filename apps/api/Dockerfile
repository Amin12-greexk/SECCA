FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY .npmrc package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/api/.npmrc apps/api/package.json apps/api/

RUN pnpm install --filter api... --frozen-lockfile

FROM base AS build

ARG DATABASE_URL=postgresql://postgres:postgres@localhost:5432/secca_local?schema=public
ENV DATABASE_URL=${DATABASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/api/node_modules ./apps/api/node_modules
COPY . .

RUN pnpm --filter api exec prisma generate
RUN pnpm --filter api build

FROM base AS runner

ENV NODE_ENV=production
ENV APP_PORT=3001

WORKDIR /app/apps/api

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/api /app/apps/api

EXPOSE 3001

CMD ["sh", "-c", "pnpm exec prisma migrate deploy && node dist/src/main.js"]
