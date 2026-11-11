#!/bin/sh
set -e

# 以 root 启动：开箱即用（自动生成并持久化密钥），最后用 gosu 降权到 app 运行服务。

DATA_DIR="${DATA_DIR:-/data}"
mkdir -p "$DATA_DIR"

gen() {
  node -e "console.log(require('crypto').randomBytes(32).toString('base64url'))"
}

# 会话 / 定时任务密钥：首次自动生成并持久化，无需手动配置
if [ -z "$AUTH_SECRET" ]; then
  [ -f "$DATA_DIR/auth.secret" ] || gen > "$DATA_DIR/auth.secret"
  AUTH_SECRET="$(cat "$DATA_DIR/auth.secret")"
  export AUTH_SECRET
fi
if [ -z "$CRON_SECRET" ]; then
  [ -f "$DATA_DIR/cron.secret" ] || gen > "$DATA_DIR/cron.secret"
  CRON_SECRET="$(cat "$DATA_DIR/cron.secret")"
  export CRON_SECRET
fi

# 数据目录归属 app（容器以 root 启动，服务以 app 运行）
chown -R app:app "$DATA_DIR" 2>/dev/null || true

# 降权到 app 运行服务；instrumentation 启动时自动迁移数据库并拉起调度
exec gosu app node server.js
