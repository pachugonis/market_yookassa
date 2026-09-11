#!/usr/bin/env bash
#
# Установка маркетплейса на чистый VPS с Ubuntu 24.04.
#
#   sudo bash install.sh
#
# Ставит Node.js, PostgreSQL, nginx, certbot, собирает приложение,
# запускает его как службу systemd, выпускает сертификат Let's Encrypt,
# настраивает файрвол, фоновую обработку сделок, ежедневные бэкапы и
# создаёт администратора. Подробности — в INSTALL.md.
#
# Повторный запуск безопасен: секреты, база и загруженные файлы
# сохраняются, приложение пересобирается из текущих исходников —
# так же выполняется и обновление.

set -Eeuo pipefail

# ---------------------------------------------------------------------------
# Параметры. Любой можно задать переменной окружения, остальные скрипт
# спросит (или возьмёт из /etc/market-yookassa/install.conf при повторном
# запуске).
# ---------------------------------------------------------------------------

CONF_FILE=/etc/market-yookassa/install.conf
if [[ -f $CONF_FILE ]]; then
  # Значения из переменных окружения важнее сохранённых. Файл пишет
  # сам скрипт (root, 600) через printf %q, поэтому eval здесь безопасен.
  while IFS='=' read -r key value; do
    if [[ $key =~ ^[A-Z_]+$ && -z ${!key:-} ]]; then
      eval "$key=$value"
    fi
  done <"$CONF_FILE"
fi

REPO_URL=${REPO_URL:-https://github.com/pachugonis/market_yookassa.git}
BRANCH=${BRANCH:-main}
SRC_DIR=${SRC_DIR:-/usr/local/src/market-yookassa}
APP_NAME=${APP_NAME:-market-yookassa}
APP_DIR=${APP_DIR:-/opt/market-yookassa}
APP_USER=${APP_USER:-market}
APP_PORT=${APP_PORT:-3000}
DB_NAME=${DB_NAME:-market_yookassa}
DB_USER=${DB_USER:-marketuser}
NODE_MAJOR=${NODE_MAJOR:-22}
DOMAIN=${DOMAIN:-}
WWW_ALIAS=${WWW_ALIAS:-}
LETSENCRYPT_EMAIL=${LETSENCRYPT_EMAIL:-}
ENABLE_SSL=${ENABLE_SSL:-yes}
SETUP_FIREWALL=${SETUP_FIREWALL:-yes}
ENABLE_BACKUPS=${ENABLE_BACKUPS:-yes}
BACKUP_DIR=${BACKUP_DIR:-/var/backups/market-yookassa}
BACKUP_KEEP_DAYS=${BACKUP_KEEP_DAYS:-7}
SWAP_SIZE_GB=${SWAP_SIZE_GB:-2}
NONINTERACTIVE=${NONINTERACTIVE:-0}

ADMIN_EMAIL=${ADMIN_EMAIL:-}
ADMIN_NAME=${ADMIN_NAME:-}
ADMIN_PASSWORD=${ADMIN_PASSWORD:-}

SAFE_PATH=/usr/local/sbin:/usr/local/bin:/usr/sbin:/usr/bin:/sbin:/bin
APP_HOME=/home/$APP_USER
CREDENTIALS_FILE=/root/$APP_NAME-credentials.txt

export DEBIAN_FRONTEND=noninteractive
export NEEDRESTART_MODE=a
# needrestart после каждого apt-get сканирует процессы и печатает об
# этом в терминал; службы, которые ставит скрипт, он перезапускает сам
export NEEDRESTART_SUSPEND=1

# ---------------------------------------------------------------------------
# Вспомогательные функции
# ---------------------------------------------------------------------------

if [[ -t 1 ]]; then
  C_BLUE=$'\e[1;34m' C_GREEN=$'\e[1;32m' C_YELLOW=$'\e[1;33m' C_RED=$'\e[1;31m' C_RESET=$'\e[0m'
else
  C_BLUE='' C_GREEN='' C_YELLOW='' C_RED='' C_RESET=''
fi

step() { printf '\n%s==> %s%s\n' "$C_BLUE" "$*" "$C_RESET"; }
info() { printf '    %s\n' "$*"; }
ok()   { printf '%s  ✓ %s%s\n' "$C_GREEN" "$*" "$C_RESET"; }
warn() { printf '%s  ! %s%s\n' "$C_YELLOW" "$*" "$C_RESET" >&2; }
die()  { printf '%s  ✗ %s%s\n' "$C_RED" "$*" "$C_RESET" >&2; exit 1; }

trap 'die "Ошибка в строке $LINENO: $BASH_COMMAND"' ERR

# Спрашивать можно, только если есть терминал. При запуске через
# `curl | bash` stdin занят скриптом, поэтому читаем из /dev/tty.
can_prompt() {
  [[ $NONINTERACTIVE != 1 ]] && { : </dev/tty; } 2>/dev/null
}

# ask ПЕРЕМЕННАЯ "Вопрос" [значение по умолчанию] [secret]
# Уже заданная переменная не спрашивается.
ask() {
  local var=$1 question=$2 default=${3:-} secret=${4:-} answer=''
  [[ -n ${!var:-} ]] && return 0
  if ! can_prompt; then
    printf -v "$var" '%s' "$default"
    return 0
  fi
  local hint=''
  [[ -n $default ]] && hint=" [$default]"
  if [[ $secret == secret ]]; then
    read -rsp "  $question$hint: " answer </dev/tty
    echo >/dev/tty
  else
    read -rp "  $question$hint: " answer </dev/tty
  fi
  printf -v "$var" '%s' "${answer:-$default}"
}

# ask_yn "Вопрос" y|n — код возврата 0 означает «да»
ask_yn() {
  local question=$1 default=$2 answer=''
  if ! can_prompt; then
    [[ $default == y ]]
    return
  fi
  local hint='[y/N]'
  [[ $default == y ]] && hint='[Y/n]'
  read -rp "  $question $hint: " answer </dev/tty
  answer=${answer:-$default}
  [[ $answer =~ ^[YyДд] ]]
}

is_yes() { [[ ${1,,} =~ ^(y|yes|1|true|да)$ ]]; }

random_hex() { openssl rand -hex "$1"; }

random_password() { openssl rand -base64 32 | tr -dc 'A-Za-z0-9' | cut -c1-16; }

# Значения попадают в .env в двойных кавычках, а Next раскрывает в них
# $ПЕРЕМЕННЫЕ — поэтому кавычки, $, обратные слэши и пробелы не пускаем.
# В ключах платёжных сервисов таких символов не бывает.
check_env_value() {
  local name=$1 value=$2
  if [[ $value =~ [[:space:]\"\'\$\`\\] ]]; then
    die "$name содержит недопустимые символы (пробелы, кавычки, \$, \\)"
  fi
}

# Команда от имени пользователя приложения, в каталоге приложения и с
# чистым окружением (чтобы NODE_ENV=production из оболочки не отключил
# devDependencies при npm ci).
as_app() {
  runuser -u "$APP_USER" -- env -i --chdir="$APP_DIR" \
    HOME="$APP_HOME" PATH="$SAFE_PATH" LANG=C.UTF-8 \
    NEXT_TELEMETRY_DISABLED=1 "$@"
}

psql_admin() { runuser -u postgres -- env --chdir=/ psql -v ON_ERROR_STOP=1 -qtA "$@"; }

is_ip() { [[ $1 =~ ^[0-9]+\.[0-9]+\.[0-9]+\.[0-9]+$ || $1 == *:* ]]; }

# ---------------------------------------------------------------------------
# 0. Исходники. Если скрипт запущен не из копии репозитория (например,
# через curl), клонируем репозиторий и перезапускаем скрипт уже из него.
# ---------------------------------------------------------------------------

[[ $EUID -eq 0 ]] || die "Запустите скрипт от root: sudo bash install.sh"

SCRIPT_DIR=''
if [[ -n ${BASH_SOURCE[0]:-} && -f ${BASH_SOURCE[0]} ]]; then
  SCRIPT_DIR=$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)
fi

if [[ -z $SCRIPT_DIR || ! -f $SCRIPT_DIR/package.json || ! -f $SCRIPT_DIR/prisma/schema.prisma ]]; then
  step "Загрузка исходников из $REPO_URL ($BRANCH)"
  apt-get update -qq
  apt-get install -y -qq git ca-certificates >/dev/null
  if [[ -d $SRC_DIR/.git ]]; then
    git -C "$SRC_DIR" fetch --quiet origin "$BRANCH"
    git -C "$SRC_DIR" checkout --quiet "$BRANCH"
    git -C "$SRC_DIR" pull --quiet --ff-only origin "$BRANCH"
  else
    git clone --quiet --branch "$BRANCH" "$REPO_URL" "$SRC_DIR"
  fi
  exec bash "$SRC_DIR/install.sh" "$@"
fi

# ---------------------------------------------------------------------------
# 1. Проверки и вопросы
# ---------------------------------------------------------------------------

step "Проверка системы"

if [[ -r /etc/os-release ]]; then
  # shellcheck source=/dev/null
  source /etc/os-release
  if [[ ${ID:-} != ubuntu || ${VERSION_ID:-} != 24.04 ]]; then
    warn "Скрипт рассчитан на Ubuntu 24.04, а здесь ${PRETTY_NAME:-неизвестная ОС}"
    ask_yn "Продолжить всё равно?" n || exit 1
  fi
fi

[[ $APP_USER =~ ^[a-z_][a-z0-9_-]*$ ]] || die "Недопустимое имя пользователя: $APP_USER"
[[ $DB_NAME =~ ^[a-z_][a-z0-9_]*$ ]] || die "Недопустимое имя базы: $DB_NAME"
[[ $DB_USER =~ ^[a-z_][a-z0-9_]*$ ]] || die "Недопустимое имя пользователя БД: $DB_USER"
[[ $APP_PORT =~ ^[0-9]+$ ]] || die "Недопустимый порт: $APP_PORT"

FIRST_INSTALL=1
[[ -f $APP_DIR/.env ]] && FIRST_INSTALL=0

if [[ $FIRST_INSTALL == 1 ]]; then
  ok "Новая установка в $APP_DIR"
else
  ok "Найдена установка в $APP_DIR — обновление, настройки и данные сохраняются"
fi

step "Параметры установки"

ask DOMAIN "Домен сайта (например, shop.example.ru) или IP сервера"
DOMAIN=${DOMAIN,,}
DOMAIN=${DOMAIN#http://}
DOMAIN=${DOMAIN#https://}
DOMAIN=${DOMAIN%%/*}
[[ -n $DOMAIN ]] || die "Домен не указан. Задайте его: DOMAIN=shop.example.ru bash install.sh"
[[ $DOMAIN =~ ^[a-z0-9.:-]+$ ]] || die "Недопустимый домен: $DOMAIN"

if is_ip "$DOMAIN"; then
  ENABLE_SSL=no
  WWW_ALIAS=no
  warn "Указан IP-адрес: HTTPS не настраивается, сайт будет работать по HTTP"
elif [[ -z $WWW_ALIAS ]]; then
  WWW_ALIAS=no
  if [[ $DOMAIN != www.* ]] && ask_yn "Перенаправлять www.$DOMAIN на $DOMAIN? (у www должна быть своя DNS-запись)" n; then
    WWW_ALIAS=yes
  fi
fi

if [[ $FIRST_INSTALL == 1 || -n $ADMIN_EMAIL ]]; then
  ask ADMIN_EMAIL "Email администратора"
  ADMIN_EMAIL=${ADMIN_EMAIL,,}
  [[ $ADMIN_EMAIL =~ ^[^[:space:]@]+@[^[:space:]@]+\.[^[:space:]@]+$ ]] \
    || die "Некорректный email администратора: '$ADMIN_EMAIL'"
  ask ADMIN_NAME "Имя администратора" "Администратор"
  ask ADMIN_PASSWORD "Пароль администратора (Enter — сгенерировать)" "" secret
  ADMIN_PASSWORD_GENERATED=0
  if [[ -z $ADMIN_PASSWORD ]]; then
    ADMIN_PASSWORD=$(random_password)
    ADMIN_PASSWORD_GENERATED=1
  fi
  (( ${#ADMIN_PASSWORD} >= 8 )) || die "Пароль администратора должен быть не короче 8 символов"
fi

if is_yes "$ENABLE_SSL" && [[ $FIRST_INSTALL == 1 ]]; then
  ask LETSENCRYPT_EMAIL "Email для уведомлений Let's Encrypt" "${ADMIN_EMAIL:-}"
fi

# Платёжные сервисы нужны только для нового .env. Без хотя бы одного
# приложение в продакшене не запускается (см. src/lib/env.ts).
if [[ $FIRST_INSTALL == 1 ]]; then
  step "Платёжные сервисы (нужен хотя бы один; ключи можно поменять позже в $APP_DIR/.env)"

  if [[ -n ${YOOKASSA_SHOP_ID:-} ]] || ask_yn "Подключить ЮKassa?" y; then
    ask YOOKASSA_SHOP_ID "ЮKassa: shopId"
    ask YOOKASSA_SECRET_KEY "ЮKassa: секретный ключ" "" secret
  fi

  if [[ -n ${CLOUDPAYMENTS_PUBLIC_ID:-} ]] || ask_yn "Подключить CloudPayments?" n; then
    ask CLOUDPAYMENTS_PUBLIC_ID "CloudPayments: Public ID терминала оплат"
    ask CLOUDPAYMENTS_API_SECRET "CloudPayments: API Secret терминала оплат" "" secret
    if [[ -n ${CLOUDPAYMENTS_PAYOUT_PUBLIC_ID:-} ]] || ask_yn "Есть терминал выплат («Безопасная сделка»)?" n; then
      ask CLOUDPAYMENTS_PAYOUT_PUBLIC_ID "CloudPayments: Public ID терминала выплат"
      ask CLOUDPAYMENTS_PAYOUT_API_SECRET "CloudPayments: API Secret терминала выплат" "" secret
    fi
  fi

  if [[ -n ${BTCPAY_URL:-} ]] || ask_yn "Подключить BTCPay Server (биткоин)?" n; then
    ask BTCPAY_URL "BTCPay: адрес сервера (https://...)"
    ask BTCPAY_API_KEY "BTCPay: API-ключ (Greenfield)" "" secret
    ask BTCPAY_STORE_ID "BTCPay: Store ID"
    ask BTCPAY_WEBHOOK_SECRET "BTCPay: секрет вебхука" "" secret
  fi

  PROVIDERS=()
  [[ -n ${YOOKASSA_SHOP_ID:-} && -n ${YOOKASSA_SECRET_KEY:-} ]] && PROVIDERS+=(YOOKASSA)
  [[ -n ${CLOUDPAYMENTS_PUBLIC_ID:-} && -n ${CLOUDPAYMENTS_API_SECRET:-} ]] && PROVIDERS+=(CLOUDPAYMENTS)
  [[ -n ${BTCPAY_URL:-} && -n ${BTCPAY_API_KEY:-} && -n ${BTCPAY_STORE_ID:-} ]] && PROVIDERS+=(BTCPAY)

  (( ${#PROVIDERS[@]} > 0 )) || die "Не настроен ни один платёжный сервис — без него приложение не запустится. Для проверки подойдёт тестовый магазин ЮKassa."
  [[ " ${PROVIDERS[*]} " == *" BTCPAY "* && -z ${BTCPAY_WEBHOOK_SECRET:-} ]] \
    && die "Для BTCPay нужен секрет вебхука (BTCPAY_WEBHOOK_SECRET)"
  PAYMENT_PROVIDER_DEFAULT=${PAYMENT_PROVIDER_DEFAULT:-${PROVIDERS[0]}}

  for name in YOOKASSA_SHOP_ID YOOKASSA_SECRET_KEY CLOUDPAYMENTS_PUBLIC_ID \
    CLOUDPAYMENTS_API_SECRET CLOUDPAYMENTS_PAYOUT_PUBLIC_ID \
    CLOUDPAYMENTS_PAYOUT_API_SECRET BTCPAY_URL BTCPAY_API_KEY \
    BTCPAY_STORE_ID BTCPAY_WEBHOOK_SECRET PAYMENT_PROVIDER_DEFAULT; do
    check_env_value "$name" "${!name:-}"
  done
  ok "Платёжные сервисы: ${PROVIDERS[*]}"
fi

mkdir -p "$(dirname "$CONF_FILE")"
chmod 700 "$(dirname "$CONF_FILE")"
{
  echo "# Параметры install.sh — используются при повторном запуске и бэкапах"
  for name in REPO_URL BRANCH SRC_DIR APP_NAME APP_DIR APP_USER APP_PORT \
    DB_NAME DB_USER NODE_MAJOR DOMAIN WWW_ALIAS LETSENCRYPT_EMAIL ENABLE_SSL \
    SETUP_FIREWALL ENABLE_BACKUPS BACKUP_DIR BACKUP_KEEP_DAYS; do
    printf '%s=%q\n' "$name" "${!name}"
  done
} >"$CONF_FILE"
chmod 600 "$CONF_FILE"

# ---------------------------------------------------------------------------
# 2. Системные пакеты
# ---------------------------------------------------------------------------

step "Файл подкачки"
MEM_MB=$(awk '/MemTotal/ {print int($2 / 1024)}' /proc/meminfo)
if (( MEM_MB < 3000 )) && [[ -z $(swapon --noheadings --show) ]]; then
  # Сборке Next на 1–2 ГБ памяти без подкачки не хватает. В контейнерных
  # VPS (LXC, OpenVZ) swap создать нельзя — тогда просто предупреждаем.
  if { fallocate -l "${SWAP_SIZE_GB}G" /swapfile 2>/dev/null \
      || dd if=/dev/zero of=/swapfile bs=1M count=$((SWAP_SIZE_GB * 1024)) status=none; } \
    && chmod 600 /swapfile && mkswap /swapfile >/dev/null && swapon /swapfile 2>/dev/null; then
    grep -q '^/swapfile ' /etc/fstab || echo '/swapfile none swap sw 0 0' >>/etc/fstab
    ok "Создан swap ${SWAP_SIZE_GB} ГБ (памяти ${MEM_MB} МБ)"
  else
    rm -f /swapfile
    warn "Не удалось создать swap — при ${MEM_MB} МБ памяти сборка может упасть"
  fi
else
  ok "Не требуется (памяти ${MEM_MB} МБ)"
fi

step "Установка пакетов"
apt-get update -qq
apt-get install -y -qq \
  ca-certificates curl gnupg git openssl rsync \
  nginx postgresql postgresql-contrib \
  certbot python3-certbot-nginx ufw >/dev/null
ok "nginx, PostgreSQL, certbot, ufw"

node_ok() {
  command -v node >/dev/null || return 1
  local version
  version=$(node -p 'const [a, b] = process.versions.node.split("."); a * 100 + +b')
  (( version >= 2009 ))
}

if ! node_ok; then
  info "Установка Node.js $NODE_MAJOR из NodeSource"
  # То же, что делает setup_XX.x от NodeSource, но без его вывода:
  # ключ, источник пакетов и приоритет выше, чем у nodejs 18 из Ubuntu.
  mkdir -p /usr/share/keyrings
  rm -f /usr/share/keyrings/nodesource.gpg /etc/apt/sources.list.d/nodesource.list
  curl -fsSL https://deb.nodesource.com/gpgkey/nodesource-repo.gpg.key \
    | gpg --batch --dearmor -o /usr/share/keyrings/nodesource.gpg
  chmod 644 /usr/share/keyrings/nodesource.gpg
  cat >/etc/apt/sources.list.d/nodesource.sources <<SOURCES
Types: deb
URIs: https://deb.nodesource.com/node_$NODE_MAJOR.x
Suites: nodistro
Components: main
Architectures: $(dpkg --print-architecture)
Signed-By: /usr/share/keyrings/nodesource.gpg
SOURCES
  printf 'Package: nodejs\nPin: origin deb.nodesource.com\nPin-Priority: 600\n' \
    >/etc/apt/preferences.d/nodejs
  apt-get update -qq
  apt-get install -y -qq nodejs >/dev/null
  node_ok || die "Не удалось установить Node.js ≥ 20.9"
fi
NODE_BIN=$(command -v node)
ok "Node.js $(node -v), npm $(npm -v)"

# ---------------------------------------------------------------------------
# 3. Пользователь и код приложения
# ---------------------------------------------------------------------------

step "Пользователь и файлы приложения"

if ! id "$APP_USER" &>/dev/null; then
  useradd --system --create-home --home-dir "$APP_HOME" --shell /usr/sbin/nologin "$APP_USER"
  ok "Создан системный пользователь $APP_USER"
fi

mkdir -p "$APP_DIR"
if [[ $SCRIPT_DIR != "$APP_DIR" ]]; then
  # Данные и сборка живут только в APP_DIR; исключённые пути rsync
  # не удаляет даже с --delete.
  rsync -a --delete \
    --exclude='/.git' --exclude='/node_modules' --exclude='/.next' \
    --exclude='/.env' --exclude='/.env.*' --exclude='/uploads' \
    --exclude='/public/avatars' --exclude='/public/covers' \
    --exclude='/public/category-icons' --exclude='/nginx/ssl' \
    --exclude='/nginx/logs' --exclude='*.tsbuildinfo' \
    "$SCRIPT_DIR/" "$APP_DIR/"
  ok "Исходники скопированы из $SCRIPT_DIR"
fi

mkdir -p "$APP_DIR/uploads/banners" "$APP_DIR/public/avatars" \
  "$APP_DIR/public/covers" "$APP_DIR/public/category-icons"
chown -R "$APP_USER:$APP_USER" "$APP_DIR"
# nginx (www-data) раздаёт картинки из public/ напрямую, а uploads/ —
# файлы купленных товаров, их видит только приложение.
chmod 755 "$APP_DIR" "$APP_DIR/public" "$APP_DIR/public/avatars" \
  "$APP_DIR/public/covers" "$APP_DIR/public/category-icons"
chmod 750 "$APP_DIR/uploads"
ok "$APP_DIR принадлежит $APP_USER"

# ---------------------------------------------------------------------------
# 4. PostgreSQL
# ---------------------------------------------------------------------------

step "База данных PostgreSQL"
systemctl enable --now postgresql >/dev/null 2>&1

DB_PASSWORD=''
if [[ -f $APP_DIR/.env ]]; then
  DB_PASSWORD=$(sed -nE "s|^DATABASE_URL=\"?postgresql://$DB_USER:([^@]+)@.*|\1|p" "$APP_DIR/.env" | head -n1)
  [[ -n $DB_PASSWORD ]] || warn "В .env не найден DATABASE_URL для $DB_USER — базу не трогаю"
else
  DB_PASSWORD=$(random_hex 16)
fi

if [[ -n $DB_PASSWORD ]]; then
  # Пароль передаём через stdin, а не аргументом, чтобы он не попал
  # в список процессов. ALTER держит пароль в базе в согласии с .env.
  if [[ -z $(psql_admin -c "SELECT 1 FROM pg_roles WHERE rolname = '$DB_USER'") ]]; then
    psql_admin <<<"CREATE ROLE \"$DB_USER\" LOGIN PASSWORD '$DB_PASSWORD';"
  else
    psql_admin <<<"ALTER ROLE \"$DB_USER\" WITH LOGIN PASSWORD '$DB_PASSWORD';"
  fi
  if [[ -z $(psql_admin -c "SELECT 1 FROM pg_database WHERE datname = '$DB_NAME'") ]]; then
    psql_admin -c "CREATE DATABASE \"$DB_NAME\" OWNER \"$DB_USER\" ENCODING 'UTF8' TEMPLATE template0;"
    ok "Создана база $DB_NAME"
  else
    ok "База $DB_NAME уже есть"
  fi
fi

# ---------------------------------------------------------------------------
# 5. nginx, файрвол, HTTPS
# ---------------------------------------------------------------------------

step "nginx"

NGINX_SITE=/etc/nginx/sites-available/$APP_NAME
SERVER_NAME=$DOMAIN
LISTEN_OPTS=''
if is_ip "$DOMAIN"; then
  SERVER_NAME="$DOMAIN _"
  LISTEN_OPTS=' default_server'
fi

{
  cat <<NGINX
# Создано install.sh и перезаписывается при повторном запуске.
# Блоки HTTPS добавляет certbot.

map \$http_upgrade \$${APP_NAME//-/_}_connection {
    default upgrade;
    ''      '';
}

upstream ${APP_NAME//-/_}_app {
    server 127.0.0.1:$APP_PORT;
    keepalive 32;
}
NGINX

  if is_yes "$WWW_ALIAS"; then
    cat <<NGINX

server {
    listen 80;
    listen [::]:80;
    server_name www.$DOMAIN;
    return 301 \$scheme://$DOMAIN\$request_uri;
}
NGINX
  fi

  cat <<NGINX

server {
    listen 80$LISTEN_OPTS;
    listen [::]:80$LISTEN_OPTS;
    server_name $SERVER_NAME;

    server_tokens off;

    # Файлы товаров — до 500 МБ плюс накладные расходы multipart
    client_max_body_size 520m;
    client_body_timeout 300s;

    add_header X-Content-Type-Options "nosniff" always;
    add_header X-Frame-Options "SAMEORIGIN" always;
    add_header Referrer-Policy "strict-origin-when-cross-origin" always;

    # Аватары, обложки и иконки категорий отдаём с диска: next start
    # не видит файлы в public/, появившиеся после его запуска.
    location ~ ^/(avatars|covers|category-icons)/ {
        root $APP_DIR/public;
        try_files \$uri =404;
        expires 1d;
        add_header X-Content-Type-Options "nosniff" always;
    }

    location / {
        proxy_pass http://${APP_NAME//-/_}_app;
        proxy_http_version 1.1;
        proxy_set_header Upgrade \$http_upgrade;
        proxy_set_header Connection \$${APP_NAME//-/_}_connection;
        proxy_set_header Host \$host;
        # Приложение берёт IP клиента из X-Real-IP (лимиты входа,
        # проверка отправителя вебхуков) — значение выставляет только nginx.
        proxy_set_header X-Real-IP \$remote_addr;
        proxy_set_header X-Forwarded-For \$remote_addr;
        proxy_set_header X-Forwarded-Proto \$scheme;
        proxy_set_header X-Forwarded-Host \$host;
        proxy_read_timeout 300s;
        proxy_send_timeout 300s;
    }
}
NGINX
} >"$NGINX_SITE"

ln -sf "$NGINX_SITE" "/etc/nginx/sites-enabled/$APP_NAME"
rm -f /etc/nginx/sites-enabled/default
nginx -t 2>/dev/null || { nginx -t; die "Ошибка в конфигурации nginx"; }
systemctl enable nginx >/dev/null 2>&1
systemctl reload-or-restart nginx
ok "Сайт $DOMAIN проксируется на 127.0.0.1:$APP_PORT"

if is_yes "$SETUP_FIREWALL"; then
  step "Файрвол ufw"
  # Открываем все порты, на которых слушает SSH, и тот, через который
  # подключены сейчас, — иначе включение ufw отрежет доступ к серверу.
  SSH_PORTS=$(
    {
      sshd -T 2>/dev/null | awk '$1 == "port" {print $2}' || true
      [[ -n ${SSH_CONNECTION:-} ]] && echo "${SSH_CONNECTION##* }"
      echo 22
    } | sort -u
  )
  for port in $SSH_PORTS; do
    ufw allow "$port/tcp" comment 'SSH' >/dev/null
  done
  ufw allow 'Nginx Full' >/dev/null
  ufw --force enable >/dev/null
  ok "Открыты SSH ($(echo $SSH_PORTS | tr ' ' ',')), 80 и 443"
fi

SCHEME=http
if is_yes "$ENABLE_SSL"; then
  step "Сертификат Let's Encrypt"
  CERT_DOMAINS=(-d "$DOMAIN")
  is_yes "$WWW_ALIAS" && CERT_DOMAINS+=(-d "www.$DOMAIN")

  if [[ -z $(getent ahosts "$DOMAIN" || true) ]]; then
    warn "Домен $DOMAIN не резолвится — сертификат не выпущен, сайт работает по HTTP."
    warn "Добавьте A-запись на IP сервера и запустите скрипт ещё раз."
  else
    EMAIL_OPTS=(--register-unsafely-without-email)
    [[ -n $LETSENCRYPT_EMAIL ]] && EMAIL_OPTS=(-m "$LETSENCRYPT_EMAIL")
    # --keep-until-expiring: при повторном запуске существующий
    # сертификат не перевыпускается, а заново прописывается в конфиг.
    if certbot --nginx --non-interactive --agree-tos --redirect \
      --keep-until-expiring "${EMAIL_OPTS[@]}" "${CERT_DOMAINS[@]}"; then
      SCHEME=https
      systemctl enable --now certbot.timer >/dev/null 2>&1 || true
      ok "HTTPS включён, сертификат продлевается автоматически"
    else
      warn "certbot не смог выпустить сертификат — сайт работает по HTTP."
      warn "Проверьте DNS и доступность порта 80, затем запустите скрипт ещё раз."
    fi
  fi
fi
BASE_URL="$SCHEME://$DOMAIN"

# ---------------------------------------------------------------------------
# 6. .env
# ---------------------------------------------------------------------------

step "Настройки приложения (.env)"
ENV_FILE=$APP_DIR/.env

if [[ $FIRST_INSTALL == 1 ]]; then
  umask 077
  cat >"$ENV_FILE" <<ENV
# Создано install.sh $(date '+%Y-%m-%d %H:%M'). После правки:
#   systemctl restart $APP_NAME
# NEXT_PUBLIC_* подставляются при сборке — после их изменения нужна
# пересборка: sudo bash install.sh

# База данных
DATABASE_URL="postgresql://$DB_USER:$DB_PASSWORD@localhost:5432/$DB_NAME?schema=public"

# NextAuth
NEXTAUTH_URL="$BASE_URL"
NEXTAUTH_SECRET="$(random_hex 32)"

# Адрес сайта
NEXT_PUBLIC_BASE_URL="$BASE_URL"
UPLOAD_DIR="uploads"

# ЮKassa
YOOKASSA_SHOP_ID="${YOOKASSA_SHOP_ID:-}"
YOOKASSA_SECRET_KEY="${YOOKASSA_SECRET_KEY:-}"

# CloudPayments: терминал оплат
CLOUDPAYMENTS_PUBLIC_ID="${CLOUDPAYMENTS_PUBLIC_ID:-}"
CLOUDPAYMENTS_API_SECRET="${CLOUDPAYMENTS_API_SECRET:-}"
# Терминал выплат — нужен для сплитования («Безопасная сделка»)
CLOUDPAYMENTS_PAYOUT_PUBLIC_ID="${CLOUDPAYMENTS_PAYOUT_PUBLIC_ID:-}"
CLOUDPAYMENTS_PAYOUT_API_SECRET="${CLOUDPAYMENTS_PAYOUT_API_SECRET:-}"
# Сумма проверочной авторизации при привязке карты продавца, руб.
CLOUDPAYMENTS_CARD_BINDING_AMOUNT="1"

# BTCPay Server: оплата биткоином по рублёвой цене
BTCPAY_URL="${BTCPAY_URL:-}"
BTCPAY_API_KEY="${BTCPAY_API_KEY:-}"
BTCPAY_STORE_ID="${BTCPAY_STORE_ID:-}"
BTCPAY_WEBHOOK_SECRET="${BTCPAY_WEBHOOK_SECRET:-}"
BTCPAY_INVOICE_EXPIRATION_MINUTES="30"
BTCPAY_SPEED_POLICY="MediumSpeed"

# Какой сервис предлагать по умолчанию: YOOKASSA, CLOUDPAYMENTS или BTCPAY
PAYMENT_PROVIDER_DEFAULT="$PAYMENT_PROVIDER_DEFAULT"

# Эскроу: через сколько дней сделка подтверждается автоматически
ESCROW_AUTO_CONFIRM_DAYS="3"

# Секрет фоновой задачи /api/cron/settle-holds (её вызывает таймер
# systemd $APP_NAME-cron.timer)
CRON_SECRET="$(random_hex 32)"
ENV
  umask 022
  ok "Создан $ENV_FILE, секреты сгенерированы"
else
  # Сертификат мог появиться только сейчас — переводим адреса на https
  if [[ $SCHEME == https ]] && grep -q "=\"http://$DOMAIN\"" "$ENV_FILE"; then
    sed -i "s|=\"http://$DOMAIN\"|=\"https://$DOMAIN\"|g" "$ENV_FILE"
    ok "Адреса в .env переведены на https://$DOMAIN"
  else
    ok "Оставлен существующий $ENV_FILE"
  fi
fi
chown "$APP_USER:$APP_USER" "$ENV_FILE"
chmod 600 "$ENV_FILE"

# ---------------------------------------------------------------------------
# 7. Зависимости, схема БД, сборка
# ---------------------------------------------------------------------------

step "Установка npm-зависимостей"
as_app npm ci --no-audit --no-fund --loglevel=error
ok "node_modules установлены"

step "Схема базы данных"
as_app npx prisma generate >/dev/null
# Миграций в проекте нет — схема накатывается через db push. Если
# изменение грозит потерей данных, prisma остановится и скрипт тоже.
as_app npx prisma db push --skip-generate
as_app env SEED_SKIP_ADMIN=1 npm run --silent db:seed >/dev/null
ok "Схема применена, категории созданы"

if [[ -n $ADMIN_EMAIL ]]; then
  step "Администратор"
  printf '%s\n' "$ADMIN_PASSWORD" \
    | as_app env ADMIN_EMAIL="$ADMIN_EMAIL" ADMIN_NAME="$ADMIN_NAME" npm run --silent admin:create
fi

step "Сборка приложения (несколько минут)"
as_app npm run build
ok "Сборка готова"

# ---------------------------------------------------------------------------
# 8. Службы systemd
# ---------------------------------------------------------------------------

step "Службы systemd"

cat >"/etc/systemd/system/$APP_NAME.service" <<UNIT
[Unit]
Description=Market YooKassa (Next.js)
After=network-online.target postgresql.service
Wants=network-online.target postgresql.service

[Service]
Type=simple
User=$APP_USER
Group=$APP_USER
WorkingDirectory=$APP_DIR
Environment=NODE_ENV=production
Environment=NEXT_TELEMETRY_DISABLED=1
# .env Next читает сам из рабочего каталога
ExecStart=$NODE_BIN $APP_DIR/node_modules/next/dist/bin/next start --hostname 127.0.0.1 --port $APP_PORT
Restart=always
RestartSec=5
TimeoutStopSec=30
LimitNOFILE=65535
NoNewPrivileges=true
PrivateTmp=true
ProtectSystem=full

[Install]
WantedBy=multi-user.target
UNIT

# Автоподтверждение сделок и снятие просроченных холдов (ESCROW.md).
# Отдельным скриптом, а не строкой в ExecStart: там systemd по-своему
# разбирает кавычки, % и $.
cat >"/usr/local/sbin/$APP_NAME-cron" <<CRON
#!/bin/sh
# Вызывается таймером $APP_NAME-cron.timer. CRON_SECRET приходит из .env
# через EnvironmentFile и передаётся curl через stdin, а не аргументом,
# чтобы не светиться в списке процессов.
set -eu
printf 'header = "Authorization: Bearer %s"\n' "\$CRON_SECRET" \\
  | curl -fsS --max-time 300 -K - -X POST http://127.0.0.1:$APP_PORT/api/cron/settle-holds
echo
CRON
chmod 755 "/usr/local/sbin/$APP_NAME-cron"

cat >"/etc/systemd/system/$APP_NAME-cron.service" <<UNIT
[Unit]
Description=Market YooKassa: обработка холдов
After=$APP_NAME.service

[Service]
Type=oneshot
User=$APP_USER
EnvironmentFile=$APP_DIR/.env
ExecStart=/usr/local/sbin/$APP_NAME-cron
UNIT

cat >"/etc/systemd/system/$APP_NAME-cron.timer" <<UNIT
[Unit]
Description=Market YooKassa: обработка холдов каждые 10 минут

[Timer]
OnCalendar=*:0/10
RandomizedDelaySec=30

[Install]
WantedBy=timers.target
UNIT

if is_yes "$ENABLE_BACKUPS"; then
  cat >"/usr/local/sbin/$APP_NAME-backup" <<'BACKUP'
#!/usr/bin/env bash
# Резервная копия базы и загруженных файлов. Параметры — из install.conf.
set -euo pipefail
source /etc/market-yookassa/install.conf
stamp=$(date +%Y%m%d-%H%M%S)
mkdir -p "$BACKUP_DIR"
chmod 700 "$BACKUP_DIR"
runuser -u postgres -- env --chdir=/ pg_dump --format=custom "$DB_NAME" >"$BACKUP_DIR/db-$stamp.dump"
tar -C "$APP_DIR" -czf "$BACKUP_DIR/files-$stamp.tar.gz" \
  .env uploads public/avatars public/covers public/category-icons
find "$BACKUP_DIR" -type f \( -name 'db-*.dump' -o -name 'files-*.tar.gz' \) \
  -mtime +"$BACKUP_KEEP_DAYS" -delete
echo "Бэкап сохранён: $BACKUP_DIR/*-$stamp.*"
BACKUP
  chmod 750 "/usr/local/sbin/$APP_NAME-backup"

  cat >"/etc/systemd/system/$APP_NAME-backup.service" <<UNIT
[Unit]
Description=Market YooKassa: резервная копия

[Service]
Type=oneshot
ExecStart=/usr/local/sbin/$APP_NAME-backup
UNIT

  cat >"/etc/systemd/system/$APP_NAME-backup.timer" <<UNIT
[Unit]
Description=Market YooKassa: ежедневная резервная копия

[Timer]
OnCalendar=*-*-* 03:30:00
RandomizedDelaySec=15min
Persistent=true

[Install]
WantedBy=timers.target
UNIT
fi

systemctl daemon-reload
systemctl enable "$APP_NAME.service" "$APP_NAME-cron.timer" >/dev/null 2>&1
systemctl restart "$APP_NAME.service"
systemctl restart "$APP_NAME-cron.timer"
if is_yes "$ENABLE_BACKUPS"; then
  systemctl enable --now "$APP_NAME-backup.timer" >/dev/null 2>&1
fi

info "Ожидание запуска приложения..."
for _ in $(seq 1 60); do
  if curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health"; then
    break
  fi
  sleep 2
done
curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/api/health" \
  || die "Приложение не отвечает. Журнал: journalctl -u $APP_NAME -n 100"
# Главная страница проходит через проверку окружения (src/lib/env.ts)
curl -fsS -o /dev/null "http://127.0.0.1:$APP_PORT/" -H "Host: $DOMAIN" \
  || warn "Главная страница отвечает ошибкой. Журнал: journalctl -u $APP_NAME -n 100"
ok "Приложение запущено"

# ---------------------------------------------------------------------------
# 9. Итог
# ---------------------------------------------------------------------------

if [[ -n $ADMIN_EMAIL ]]; then
  umask 077
  cat >"$CREDENTIALS_FILE" <<CREDS
Market YooKassa — данные установки ($(date '+%Y-%m-%d %H:%M'))

Сайт:           $BASE_URL
Вход в админку: $BASE_URL/admin-login
Администратор:  $ADMIN_EMAIL
Пароль:         $ADMIN_PASSWORD

База данных:    $DB_NAME, пользователь $DB_USER (пароль — в $APP_DIR/.env)
CREDS
  umask 022
fi

printf '\n%s========================================================%s\n' "$C_GREEN" "$C_RESET"
printf '%s  Установка завершена%s\n' "$C_GREEN" "$C_RESET"
printf '%s========================================================%s\n\n' "$C_GREEN" "$C_RESET"
echo "  Сайт:             $BASE_URL"
echo "  Админка:          $BASE_URL/admin-login"
if [[ -n $ADMIN_EMAIL ]]; then
  echo "  Администратор:    $ADMIN_EMAIL"
  if [[ ${ADMIN_PASSWORD_GENERATED:-0} == 1 ]]; then
    echo "  Пароль:           $ADMIN_PASSWORD  (сгенерирован)"
  fi
  echo "  Данные для входа: $CREDENTIALS_FILE — удалите после сохранения"
fi
echo
echo "  Код приложения:   $APP_DIR (настройки — $APP_DIR/.env)"
echo "  Журнал:           journalctl -u $APP_NAME -f"
echo "  Перезапуск:       systemctl restart $APP_NAME"
is_yes "$ENABLE_BACKUPS" && echo "  Бэкапы:           $BACKUP_DIR (ежедневно, $BACKUP_KEEP_DAYS дн.)"
echo
if [[ $SCHEME == http ]] && is_yes "$ENABLE_SSL"; then
  warn "HTTPS не настроен — после исправления DNS запустите скрипт ещё раз."
fi
echo "  Дальше: адреса вебхуков платёжных сервисов и SMTP — см. INSTALL.md,"
echo "  раздел «После установки»."
echo
