FROM node:22-alpine AS base

ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"

RUN corepack enable

WORKDIR /app

FROM base AS builder

COPY . .

RUN pnpm install --frozen-lockfile
RUN pnpm prisma generate
RUN pnpm build:packages
RUN pnpm --filter @approva/api build

FROM base AS runner

ENV NODE_ENV=production

WORKDIR /app

COPY --from=builder /app /app

EXPOSE 4000

CMD ["pnpm", "--filter", "@approva/api", "start"]
