FROM node:22-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable && corepack prepare pnpm@10.6.0 --activate

FROM base AS builder
WORKDIR /build
COPY package.json pnpm-lock.yaml pnpm-workspace.yaml .npmrc turbo.json tsconfig.base.json tsconfig.package.build.json ./
COPY packages/ ./packages/
COPY apps/api/ ./apps/api/
RUN pnpm install --frozen-lockfile
RUN pnpm --filter @glantri/database exec prisma generate
RUN pnpm --filter @glantri/api... run build
RUN pnpm --filter @glantri/api deploy --prod /deploy
RUN cp -r /build/apps/api/dist /deploy/dist && ls /deploy/dist/server.js
RUN find /build/node_modules -name ".prisma" -type d | while IFS= read -r src; do \
      rel="${src#/build/node_modules/}"; \
      dst="/deploy/node_modules/${rel}"; \
      mkdir -p "$(dirname "$dst")"; \
      cp -r "$src" "$(dirname "$dst")/"; \
    done

FROM node:22-alpine AS runner
WORKDIR /app
COPY --from=builder /deploy ./
ENV NODE_ENV=production
EXPOSE 4000
CMD ["node", "dist/server.js"]
