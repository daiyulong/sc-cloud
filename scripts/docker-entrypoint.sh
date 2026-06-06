#!/bin/sh
set -e

# 第一期用 db push 同步 schema（schema 仍会频繁演进，暂不引入 migrations）。
# schema 稳定后改为 prisma migrate deploy。
echo "Syncing database schema (prisma db push)..."
npx prisma db push --skip-generate

# 幂等播种初始用户（已存在则跳过）
echo "Seeding initial data..."
node prisma/seed.js || echo "Seed skipped or already applied."

echo "Starting application..."
exec node server.js
