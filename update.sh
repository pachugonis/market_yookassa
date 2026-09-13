#!/usr/bin/env bash
#
# Быстрое обновление уже установленного маркетплейса.
#
#   sudo bash update.sh
#
# Забирает свежий код из репозитория, пересобирает приложение и
# перезапускает службу. В отличие от install.sh не трогает пакеты,
# nginx, SSL, файрвол, .env, службы systemd и администратора — только
# код, зависимости, схему базы и сборку.
#
# Если менялись шаблоны nginx или systemd в install.sh, запустите
# install.sh: этот скрипт их не переписывает.

set -Eeuo pipefail

CONF_FILE=/etc/market-yookassa/install.conf
[[ $EUID -eq 0 ]] || { echo "Запустите скрипт от root: sudo bash update.sh" >&2; exit 1; }
[[ -f $CONF_FILE ]] || { echo "Не найден $CONF_FILE — сначала установите площадку: sudo bash install.sh" >&2; exit 1; }

# Те же параметры, что сохранил install.sh. Файл пишет он сам
# (root, 600) через printf %q, поэтому eval здесь безопасен.
while IFS='=' read -r key value; do
  if [[ $key =~ ^[A-Z_]+$ && -z ${!key:-} ]]; then
    eval "$key=$value"
  fi
done <"$CONF_FILE"

BRANCH=${BRANCH:-main}
SRC_DIR=${SRC_DIR:-/usr/local/src/market-yookassa}
APP_NAME=${APP_NAME:-market-yookassa}
APP_DIR=${APP_DIR:-/opt/market-yookassa}
APP_USER=${APP_USER:-market}
APP_PORT=${APP_PORT:-3000}

SAFE_PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
APP_HOME=/home/$APP_USER

if [[ -t 1 ]]; then
  C_BLUE=$'\e[1;34m' C_GREEN=$'\e[1;32m' C_YELLOW=$'\e[1;33m' C_RED=$'\e[1;31m' C_RESET=$'\e[0m'
else
  C_BLUE='' C_GREEN='' C_YELLOW='' C_RED='' C_RESET=''
fi

step() { printf '\n%s==> %s%s\n' "$C_BLUE" "$*" "$C_RESET"; }
ok()   { printf '%s  ✓ %s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
warn() { printf '%s  ! %s%s\n' "$C_YELLOW" "$*" "$C_RESET" >&2; }
die()  { printf '%s  ✗ %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

trap 'die "Ошибка в строке $LINENO: $BASH_COMMAND"' ERR

# Как в install.sh: от имени пользователя приложения и с чистым
# окружением, чтобы NODE_ENV=production не отключил devDependencies.
as_app() {
  runuser -u "$APP_USER" -- env -i --chdir="$APP_DIR" \
    HOME="$APP_HOME" PATH="$SAFE_PATH" LANG=C.UTF-8 \
    NEXT_TELEMETRY_DISABLED=1 "$@"
}

[[ -f $APP_DIR/.env ]] || die "В $APP_DIR нет .env — площадка не установлена, запустите install.sh"

# ---------------------------------------------------------------------------
# 1. Код. Исходники — папка, из которой запущен скрипт, а если он запущен
# не из копии проекта — SRC_DIR из install.conf. Git-копия сначала
# обновляется; папка без .git (закрытый репозиторий, скопированный
# rsync'ом) берётся как есть.
# ---------------------------------------------------------------------------

is_project() { [[ -f $1/package.json && -f $1/prisma/schema.prisma ]]; }

SCRIPT_DIR=''
if [[ -n ${BASH_SOURCE[0]:-} && -f ${BASH_SOURCE[0]} ]]; then
  SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
fi
if [[ -z $SCRIPT_DIR ]] || ! is_project "$SCRIPT_DIR"; then
  SCRIPT_DIR=$SRC_DIR
fi
is_project "$SCRIPT_DIR" || die "Не найдены исходники проекта ($SCRIPT_DIR)"
[[ $SCRIPT_DIR != "$APP_DIR" ]] || die "Скрипт должен запускаться из копии проекта, а не из $APP_DIR"

if [[ -d $SCRIPT_DIR/.git && ${UPDATE_PULLED:-0} != 1 ]]; then
  step "Загрузка изменений ($BRANCH)"
  BEFORE=$(git -C "$SCRIPT_DIR" rev-parse HEAD)
  git -C "$SCRIPT_DIR" fetch --quiet origin "$BRANCH"
  git -C "$SCRIPT_DIR" checkout --quiet "$BRANCH"
  git -C "$SCRIPT_DIR" pull --quiet --ff-only origin "$BRANCH" \
    || die "Не удалось обновить $SCRIPT_DIR: в копии есть локальные изменения (git -C $SCRIPT_DIR status)"
  AFTER=$(git -C "$SCRIPT_DIR" rev-parse HEAD)

  if [[ $BEFORE == "$AFTER" ]]; then
    ok "Новых коммитов нет — пересобираю текущую версию"
  else
    git -C "$SCRIPT_DIR" --no-pager log --oneline "$BEFORE..$AFTER"
  fi

  # Сам скрипт мог измениться — дальше выполняем уже новую версию.
  UPDATE_PULLED=1 exec bash "$SCRIPT_DIR/update.sh" "$@"
fi

step "Копирование исходников в $APP_DIR"
# Исключения те же, что в install.sh: данные, настройки и сборка живут
# только в APP_DIR, и rsync --delete их не удаляет.
rsync -a --delete \
  --exclude='/.git' --exclude='/node_modules' --exclude='/.next' \
  --exclude='/.env' --exclude='/.env.*' --exclude='/uploads' \
  --exclude='/public/avatars' --exclude='/public/covers' \
  --exclude='/public/category-icons' --exclude='/nginx/ssl' \
  --exclude='/nginx/logs' --exclude='*.tsbuildinfo' \
  "$SCRIPT_DIR/" "$APP_DIR/"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
if [[ -d $SCRIPT_DIR/.git ]]; then
  ok "Версия: $(git -C "$SCRIPT_DIR" --no-pager log -1 --format='%h %s')"
else
  ok "Исходники скопированы из $SCRIPT_DIR"
fi

# ---------------------------------------------------------------------------
# 2. Зависимости, схема, сборка
# ---------------------------------------------------------------------------

# npm ci — самый долгий шаг, поэтому только когда поменялся lock-файл.
LOCK_STAMP=$APP_DIR/node_modules/.update-lock.sha256
LOCK_HASH=$(sha256sum "$APP_DIR/package-lock.json" | cut -d' ' -f1)
if [[ -d $APP_DIR/node_modules && -f $LOCK_STAMP && $(cat "$LOCK_STAMP") == "$LOCK_HASH" ]]; then
  ok "Зависимости не менялись"
else
  step "Установка npm-зависимостей"
  as_app npm ci --no-audit --no-fund --loglevel=error
  as_app sh -c "printf '%s\n' '$LOCK_HASH' > node_modules/.update-lock.sha256"
  ok "node_modules установлены"
fi

step "Схема базы данных"
as_app npx prisma generate >/dev/null
# Миграций нет — как и install.sh, накатываем db push. Если изменение
# грозит потерей данных, prisma остановится, и скрипт вместе с ней.
as_app npx prisma db push --skip-generate
ok "Схема актуальна"

step "Сборка приложения (несколько минут)"
as_app npm run build
ok "Сборка готова"

# ---------------------------------------------------------------------------
# 3. Перезапуск
# ---------------------------------------------------------------------------

step "Перезапуск"
systemctl restart "$APP_NAME.service"

for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health"; then
    break
  fi
  sleep 2
done
curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health" \
  || die "Приложение не отвечает. Журнал: journalctl -u $APP_NAME -n 100"
ok "Приложение запущено"

printf '\n%s  Обновление завершено%s\n\n' "$C_GREEN" "$C_RESET"
