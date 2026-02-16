FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
ENV NEXT_TELEMETRY_DISABLED=1

RUN corepack enable

WORKDIR /app

FROM base AS deps

COPY package.json pnpm-lock.yaml pnpm-workspace.yaml ./
COPY apps/web/package.json apps/web/package.json

RUN pnpm install --filter web... --frozen-lockfile

FROM base AS build

ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=${NEXT_PUBLIC_API_BASE_URL}

COPY --from=deps /app/node_modules ./node_modules
COPY --from=deps /app/apps/web/node_modules ./apps/web/node_modules
COPY . .

RUN pnpm --filter web build

FROM base AS runner

ENV NODE_ENV=production
ENV PORT=3000

WORKDIR /app/apps/web

COPY --from=build /app/node_modules /app/node_modules
COPY --from=build /app/apps/web /app/apps/web

EXPOSE 3000

CMD ["sh", "-c", "pnpm start -H 0.0.0.0 -p 3000"]
