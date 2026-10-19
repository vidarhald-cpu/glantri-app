FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.6.0 --activate

FROM base AS builder
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.package.build.json eslint.config.mjs ./
COPY packages/ ./packages/
COPY apps/web/ ./apps/web/
RUN pnpm install --frozen-lockfile
ARG NEXT_PUBLIC_API_BASE_URL
ENV NEXT_PUBLIC_API_BASE_URL=$NEXT_PUBLIC_API_BASE_URL
RUN pnpm --filter @glantri/web... run build

FROM node:22-alpine AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0
COPY --from=builder /build/apps/web/.next/standalone ./
COPY --from=builder /build/apps/web/.next/static ./apps/web/.next/static
# Next standalone-output inkluderer ikke public/, og serveren serverer statiske filer fra
# <dir>/public der dir = __dirname = /app/apps/web (apps/web/server.js). Den må derfor kopieres
# eksplisitt, på samme måte som .next/static over.
COPY --from=builder /build/apps/web/public ./apps/web/public
# Rules Docs leses fra filsystemet i runtime; getRulesDocsDirectory() i
# apps/web/src/lib/rulesDocs.ts resolver til <cwd>/docs/rules, altså /app/docs/rules her.
# Next standalone-tracing kan ikke følge en sti som bygges i runtime, så den må kopieres
# eksplisitt. Den autoritative kilden er docs/rules/ i repoet; ingen andre kopier.
COPY docs/rules ./docs/rules
EXPOSE 3000
CMD ["node", "apps/web/server.js"]
