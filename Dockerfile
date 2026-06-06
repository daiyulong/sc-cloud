# 单细胞云平台 Docker 镜像（npm + Next.js standalone）

FROM node:20-alpine AS builder
WORKDIR /app

# 安装 OpenSSL，让 Prisma 正确检测引擎版本
RUN apk add --no-cache openssl

COPY package.json package-lock.json ./
COPY prisma ./prisma/
RUN npm ci

COPY . .
ENV NODE_ENV=production
ENV PRISMA_CLI_BINARY_TARGETS=linux-musl-openssl-3.0.x

ARG GIT_COMMIT_SHA=unknown
ENV GIT_COMMIT_SHA=$GIT_COMMIT_SHA

# 重新生成 Prisma Client 并构建
RUN npx prisma generate && npm run build

# 预编译 seed 脚本为 JS（运行时无需 TypeScript）
RUN npx esbuild prisma/seed.ts --bundle --platform=node --outfile=prisma/seed.js \
    --external:@prisma/client --external:bcryptjs

# 验证引擎文件存在
RUN ls -la node_modules/.prisma/client/*.node

# 生产阶段
FROM node:20-alpine
WORKDIR /app

RUN apk add --no-cache curl openssl && \
    addgroup -g 1001 -S nodejs && \
    adduser -S nextjs -u 1001

ENV NODE_ENV=production
ENV PORT=3000
ENV HOSTNAME=0.0.0.0

# standalone 构建产物
COPY --from=builder --chown=nextjs:nodejs /app/public ./public
COPY --from=builder --chown=nextjs:nodejs /app/.next/standalone ./
COPY --from=builder --chown=nextjs:nodejs /app/.next/static ./.next/static

# Prisma Client（standalone 不会自动包含）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/.prisma ./node_modules/.prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/client ./node_modules/@prisma/client

# Prisma schema 与预编译 seed
COPY --from=builder --chown=nextjs:nodejs /app/prisma ./prisma

# Prisma CLI 及其依赖（用于 db push 与 seed）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/prisma ./node_modules/prisma
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/engines ./node_modules/@prisma/engines
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/engines-version ./node_modules/@prisma/engines-version
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/fetch-engine ./node_modules/@prisma/fetch-engine
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/get-platform ./node_modules/@prisma/get-platform
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/@prisma/debug ./node_modules/@prisma/debug

# seed 运行时依赖（预编译 JS 仅需 bcryptjs）
COPY --from=builder --chown=nextjs:nodejs /app/node_modules/bcryptjs ./node_modules/bcryptjs

# 让 npx 能找到 prisma 命令
RUN mkdir -p node_modules/.bin && \
    ln -s ../prisma/build/index.js node_modules/.bin/prisma

COPY --from=builder --chown=nextjs:nodejs /app/scripts/docker-entrypoint.sh ./
RUN chmod +x docker-entrypoint.sh

USER nextjs
EXPOSE 3000

HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3 \
    CMD curl -f http://localhost:3000/api/health || exit 1

CMD ["./docker-entrypoint.sh"]
