# Установка на VPS (Ubuntu 24.04)

Скрипт [`install.sh`](./install.sh) разворачивает маркетплейс на чистом
сервере одной командой: ставит все зависимости, создаёт базу данных,
собирает приложение, настраивает HTTPS и создаёт администратора.

Установка в Docker описана в [DOCKER_INSTALL.md](./DOCKER_INSTALL.md), в
Kubernetes — в [KUBERNETES_INSTALL.md](./KUBERNETES_INSTALL.md).

## Содержание

- [Что делает скрипт](#что-делает-скрипт)
- [Что нужно заранее](#что-нужно-заранее)
- [Установка](#установка)
- [Установка без вопросов](#установка-без-вопросов)
- [После установки](#после-установки)
- [Где что лежит](#где-что-лежит)
- [Управление](#управление)
- [Обновление](#обновление)
- [Резервные копии](#резервные-копии)
- [Решение проблем](#решение-проблем)

---

## Что делает скрипт

1. Создаёт swap на 2 ГБ, если памяти меньше 3 ГБ, — без него сборка
   Next.js на маленьком VPS падает из-за нехватки памяти.
2. Ставит пакеты: Node.js 22 (из NodeSource), PostgreSQL 16, nginx,
   certbot, ufw, git, rsync.
3. Создаёт системного пользователя `market`, от имени которого работает
   приложение, и копирует код в `/opt/market-yookassa`.
4. Создаёт базу `market_yookassa` и пользователя PostgreSQL со случайным
   паролем. База доступна только с самого сервера.
5. Настраивает nginx как обратный прокси, открывает в ufw порты SSH, 80
   и 443.
6. Выпускает сертификат Let's Encrypt и включает перенаправление на
   HTTPS. Сертификат продлевается автоматически.
7. Создаёт `.env` со сгенерированными секретами (`NEXTAUTH_SECRET`,
   `CRON_SECRET`, пароль БД) и ключами платёжных сервисов.
8. Ставит npm-зависимости, применяет схему БД, создаёт категории
   товаров и администратора, собирает приложение.
9. Регистрирует службы systemd:
   - `market-yookassa` — само приложение, перезапускается при сбое и
     после перезагрузки сервера;
   - `market-yookassa-cron.timer` — раз в 10 минут подтверждает сделки
     и снимает просроченные холды (см. [ESCROW.md](./ESCROW.md));
   - `market-yookassa-backup.timer` — каждую ночь сохраняет копию базы
     и загруженных файлов.

Запускать скрипт повторно безопасно: секреты, база и загруженные файлы
сохраняются. Так же выполняется [обновление](#обновление).

## Что нужно заранее

- **VPS с Ubuntu 24.04**: от 1 ГБ памяти (лучше 2 ГБ), от 10 ГБ диска
  плюс место под файлы товаров. Нужен доступ root или sudo.
- **Домен**, у которого A-запись указывает на IP сервера. Проверить
  можно командой `dig +short shop.example.ru`. Если хотите открывать
  сайт и по `www.`, нужна запись и для `www.shop.example.ru`. Без
  домена сайт можно поставить по IP, но тогда он будет работать только
  по HTTP — для приёма платежей это не годится.
- **Ключи хотя бы одного платёжного сервиса.** Без них приложение не
  запускается в режиме продакшена. Для проверки подойдёт тестовый
  магазин ЮKassa.

| Сервис | Что понадобится | Где взять |
|---|---|---|
| ЮKassa | `shopId` и секретный ключ | Личный кабинет ЮKassa → Интеграция → Ключи API |
| CloudPayments | Public ID и API Secret терминала оплат; для «Безопасной сделки» — ещё и терминала выплат | Личный кабинет CloudPayments → Сайты |
| BTCPay Server | Адрес сервера, Greenfield API-ключ, Store ID, секрет вебхука | Ваш BTCPay → Account → API Keys и Store → Settings |

## Установка

Подключитесь к серверу и обновите систему:

```bash
ssh root@IP_СЕРВЕРА
apt update && apt upgrade -y
```

Если обновилось ядро, перезагрузите сервер (`reboot`) и подключитесь
снова.

Скачайте проект и запустите скрипт:

```bash
git clone https://github.com/pachugonis/market_yookassa.git
cd market_yookassa
sudo bash install.sh
```

Скрипт задаст вопросы:

| Вопрос | Пример ответа |
|---|---|
| Домен сайта или IP сервера | `shop.example.ru` |
| Перенаправлять `www` на основной домен? | `y`, если есть DNS-запись для `www`, иначе `n` |
| Email администратора | `admin@example.ru` |
| Имя администратора | Enter — «Администратор» |
| Пароль администратора | Enter — сгенерировать случайный (не короче 8 символов) |
| Email для Let's Encrypt | Enter — тот же, что у администратора |
| Подключить ЮKassa / CloudPayments / BTCPay? | ответьте `y` хотя бы на один сервис и введите его ключи |

Секретные значения при вводе не отображаются. Установка занимает
5–15 минут, дольше всего идёт сборка. В конце скрипт выведет адрес сайта
и данные для входа.

> **Совет.** Данные для входа также сохраняются в файл
> `/root/market-yookassa-credentials.txt`. Перенесите их в менеджер
> паролей, а файл удалите: `rm /root/market-yookassa-credentials.txt`.

### Если репозиторий закрытый

Для приватного репозитория `git clone` на сервере попросит логин и
токен GitHub. Можно обойтись без этого: скопируйте проект со своего
компьютера и запустите скрипт из копии.

```bash
# на своём компьютере, из папки проекта
rsync -a --exclude node_modules --exclude .next --exclude .env \
  ./ root@IP_СЕРВЕРА:/root/market_yookassa/

# на сервере
cd /root/market_yookassa && sudo bash install.sh
```

Не копируйте на сервер свой локальный `.env`: скрипт создаёт свой, с
новыми секретами.

## Установка без вопросов

Любой ответ можно передать переменной окружения. Если заданы все
обязательные значения, а `NONINTERACTIVE=1`, скрипт ничего не
спрашивает. Так удобно ставить через cloud-init или Ansible.

```bash
sudo NONINTERACTIVE=1 \
  DOMAIN=shop.example.ru \
  ADMIN_EMAIL=admin@example.ru \
  LETSENCRYPT_EMAIL=admin@example.ru \
  YOOKASSA_SHOP_ID=123456 \
  YOOKASSA_SECRET_KEY=live_xxxxxxxxxxxxxxxx \
  bash install.sh
```

Если пароль администратора не задан, скрипт его сгенерирует и выведет в
конце.

Если на сервере ещё нет исходников, скрипт скачает их сам. Этот способ
работает только для публичного репозитория:

```bash
curl -fsSL https://raw.githubusercontent.com/pachugonis/market_yookassa/main/install.sh \
  | sudo DOMAIN=shop.example.ru ADMIN_EMAIL=admin@example.ru bash
```

Исходники скачиваются в `/usr/local/src/market-yookassa`.

### Все параметры

| Переменная | По умолчанию | Назначение |
|---|---|---|
| `DOMAIN` | — (спросит) | Домен или IP сайта |
| `WWW_ALIAS` | спросит | `yes` — перенаправлять `www.домен` на домен |
| `ADMIN_EMAIL` | — (спросит) | Email администратора |
| `ADMIN_NAME` | `Администратор` | Имя администратора |
| `ADMIN_PASSWORD` | генерируется | Пароль администратора, не короче 8 символов |
| `LETSENCRYPT_EMAIL` | email администратора | Email для уведомлений о сертификате |
| `ENABLE_SSL` | `yes` | `no` — не выпускать сертификат |
| `SETUP_FIREWALL` | `yes` | `no` — не трогать ufw |
| `ENABLE_BACKUPS` | `yes` | `no` — не включать ежедневные бэкапы |
| `BACKUP_DIR` | `/var/backups/market-yookassa` | Куда складывать бэкапы |
| `BACKUP_KEEP_DAYS` | `7` | Сколько дней хранить бэкапы |
| `APP_DIR` | `/opt/market-yookassa` | Каталог приложения |
| `APP_USER` | `market` | Системный пользователь приложения |
| `APP_PORT` | `3000` | Локальный порт Next.js (снаружи закрыт) |
| `DB_NAME` / `DB_USER` | `market_yookassa` / `marketuser` | База и пользователь PostgreSQL |
| `NODE_MAJOR` | `22` | Версия Node.js из NodeSource |
| `SWAP_SIZE_GB` | `2` | Размер swap, если памяти меньше 3 ГБ |
| `REPO_URL` / `BRANCH` | этот репозиторий / `main` | Откуда скачивать исходники, если скрипт запущен не из копии |
| `NONINTERACTIVE` | `0` | `1` — ничего не спрашивать |

Ключи платёжных сервисов задаются переменными с теми же именами, что в
`.env`: `YOOKASSA_SHOP_ID`, `YOOKASSA_SECRET_KEY`,
`CLOUDPAYMENTS_PUBLIC_ID`, `CLOUDPAYMENTS_API_SECRET`,
`CLOUDPAYMENTS_PAYOUT_PUBLIC_ID`, `CLOUDPAYMENTS_PAYOUT_API_SECRET`,
`BTCPAY_URL`, `BTCPAY_API_KEY`, `BTCPAY_STORE_ID`,
`BTCPAY_WEBHOOK_SECRET`, `PAYMENT_PROVIDER_DEFAULT`.

Параметры первой установки сохраняются в
`/etc/market-yookassa/install.conf`, и при повторном запуске скрипт
берёт их оттуда. Переменная окружения, заданная при запуске, важнее
сохранённого значения.

---

## После установки

### 1. Войдите в админку

Откройте `https://ваш-домен/admin-login` и войдите с email и паролем
администратора. Сразу после входа:

- включите двухфакторную аутентификацию: **Профиль → Безопасность**;
- в админке, в разделе **Настройки → Основные настройки**, задайте
  название и описание сайта, email поддержки и комиссию площадки.

### 2. Подключите почту (SMTP)

Без SMTP письма не отправляются: не работают подтверждение email и
уведомления. Настройки задаются в админке: **Настройки → Настройки
Email**. Примеры для Яндекса, Gmail и Mail.ru есть в
[README.md](./README.md#-настройка-email). Там же есть кнопка отправки
тестового письма.

### 3. Укажите адреса уведомлений в платёжных сервисах

Без уведомлений (вебхуков) оплата не подтверждается автоматически.

| Сервис | Адрес уведомлений |
|---|---|
| ЮKassa | `https://ваш-домен/api/payments/webhook` — в разделе Интеграция → HTTP-уведомления, события `payment.*` и `refund.succeeded` |
| CloudPayments | `https://ваш-домен/api/payments/cloudpayments/webhook?type=ТИП` — отдельно для каждого типа: `check`, `pay`, `fail`, `confirm`, `cancel`, `refund` |
| BTCPay Server | `https://ваш-домен/api/payments/btcpay/webhook` — Store → Settings → Webhooks, секрет совпадает с `BTCPAY_WEBHOOK_SECRET` |

Как работают двухэтапная оплата и сплитование, описано в
[ESCROW.md](./ESCROW.md).

### 4. Проверьте сайт

```bash
systemctl status market-yookassa         # служба активна (running)
curl -s https://ваш-домен/api/health     # {"status":"ok",...}
systemctl list-timers 'market-yookassa*' # таймеры обработки сделок и бэкапов
```

---

## Где что лежит

| Путь | Что там |
|---|---|
| `/opt/market-yookassa` | Приложение |
| `/opt/market-yookassa/.env` | Настройки и секреты (доступны только пользователю `market`) |
| `/opt/market-yookassa/uploads` | Файлы товаров и картинки баннеров |
| `/opt/market-yookassa/public/{avatars,covers,category-icons}` | Аватары, обложки и иконки категорий |
| `/etc/market-yookassa/install.conf` | Параметры установки |
| `/etc/nginx/sites-available/market-yookassa` | Конфигурация nginx |
| `/etc/systemd/system/market-yookassa*` | Службы и таймеры |
| `/usr/local/sbin/market-yookassa-{cron,backup}` | Скрипты обработки сделок и бэкапа |
| `/var/backups/market-yookassa` | Резервные копии |

## Управление

```bash
# Состояние, перезапуск, остановка
systemctl status market-yookassa
systemctl restart market-yookassa
systemctl stop market-yookassa

# Журнал приложения (Ctrl+C — выход)
journalctl -u market-yookassa -f
journalctl -u market-yookassa --since "1 hour ago"

# Обработка сделок: запустить вручную и посмотреть результат
systemctl start market-yookassa-cron
journalctl -u market-yookassa-cron -n 20
```

### Изменение настроек

Отредактируйте `.env` и перезапустите приложение:

```bash
nano /opt/market-yookassa/.env
systemctl restart market-yookassa
```

Переменные `NEXT_PUBLIC_*` подставляются в код при сборке. Если вы их
изменили, пересоберите приложение: `sudo bash install.sh`.

### Новый администратор или сброс пароля

```bash
cd /opt/market-yookassa
sudo -u market npm run admin:create -- admin@example.ru
```

Команда спросит пароль (он не отображается при вводе). Если пользователь
с таким email уже есть, он станет администратором, а его пароль
заменится новым. Двухфакторная аутентификация при этом не
сбрасывается.

### Смена домена

1. Добавьте DNS-запись для нового домена.
2. Замените домен в `NEXTAUTH_URL` и `NEXT_PUBLIC_BASE_URL` в
   `/opt/market-yookassa/.env`.
3. Запустите скрипт с новым доменом:
   `sudo DOMAIN=new.example.ru bash install.sh`. Скрипт перенастроит
   nginx, выпустит сертификат и пересоберёт приложение.
4. Обновите адреса уведомлений в платёжных сервисах.

---

## Обновление

Скачайте новую версию и запустите скрипт ещё раз из той же папки:

```bash
cd ~/market_yookassa        # папка, из которой ставили
git pull
sudo bash install.sh
```

Если ставили через `curl`, достаточно повторить ту же команду: скрипт
сам скачает изменения в `/usr/local/src/market-yookassa`.

При обновлении скрипт:

- копирует новый код в `/opt/market-yookassa`, не трогая `.env`,
  `uploads/` и загруженные картинки;
- ставит зависимости и применяет изменения схемы БД;
- пересобирает и перезапускает приложение.

Пока идёт сборка, сайт может отвечать ошибками несколько минут. Перед
крупными обновлениями включите в админке **Настройки → Режим
технических работ**.

Перед обновлением сделайте бэкап: `market-yookassa-backup`. Если
изменение схемы грозит потерей данных (например, удаляется колонка),
Prisma остановит обновление с предупреждением. Тогда разберитесь, что
именно удаляется, и примените схему вручную:

```bash
cd /opt/market-yookassa
sudo -u market npx prisma db push --accept-data-loss
```

---

## Резервные копии

Каждую ночь (около 03:30) в `/var/backups/market-yookassa` сохраняются:

- `db-ДАТА.dump` — дамп базы данных;
- `files-ДАТА.tar.gz` — `.env`, файлы товаров, аватары, обложки, иконки.

Копии старше 7 дней удаляются. Сделать копию вручную:
`market-yookassa-backup`.

> **Важно.** Копии хранятся на том же сервере и при его потере пропадут
> вместе с ним. Регулярно переносите их в другое место, например:
> `rsync -a root@IP_СЕРВЕРА:/var/backups/market-yookassa/ ./backups/`.

### Восстановление

```bash
systemctl stop market-yookassa

# База данных
sudo -u postgres pg_restore --clean --if-exists \
  -d market_yookassa /var/backups/market-yookassa/db-ДАТА.dump

# Файлы
tar -C /opt/market-yookassa -xzf /var/backups/market-yookassa/files-ДАТА.tar.gz
chown -R market:market /opt/market-yookassa

systemctl start market-yookassa
```

Чтобы перенести сайт на новый сервер, установите его там скриптом с тем
же доменом, а затем восстановите базу и файлы, как показано выше. После
этого пароль БД в восстановленном `.env` будет от старого сервера —
запустите `sudo bash install.sh` ещё раз, и скрипт выставит этот пароль
пользователю PostgreSQL.

---

## Решение проблем

### Приложение не запускается

```bash
journalctl -u market-yookassa -n 100 --no-pager
```

- **«Небезопасная конфигурация окружения»** — в `.env` не задан ни один
  платёжный сервис, или `NEXTAUTH_SECRET` слишком короткий. Исправьте
  `.env` и выполните `systemctl restart market-yookassa`.
- **`Can't reach database server`** — проверьте PostgreSQL:
  `systemctl status postgresql`.

### Не знаю пароль администратора

Пароль сохраняется в `/root/market-yookassa-credentials.txt` сразу
после создания администратора. Если файла нет, задайте новый пароль:

```bash
cd /opt/market-yookassa
sudo -u market npm run admin:create -- admin@example.ru
```

Если администратора в базе нет вовсе, скрипт при повторном запуске сам
спросит его данные и создаст его.

### Сертификат не выпустился

Скрипт в этом случае продолжает установку по HTTP. Проверьте, что
домен указывает на сервер (`dig +short ваш-домен`), а порт 80 открыт
(`ufw status`). Затем запустите `sudo bash install.sh` ещё раз: скрипт
выпустит сертификат и переведёт адреса в `.env` на HTTPS.

### Сборка падает с `JavaScript heap out of memory` или `Killed`

Не хватает памяти. Проверьте swap командой `swapon --show`. На
контейнерных VPS (OpenVZ, LXC) swap создать нельзя — выберите тариф с
2 ГБ памяти или больше.

### 502 Bad Gateway

nginx работает, а приложение нет. Проверьте, запущено ли оно:
`systemctl status market-yookassa`. Сразу после перезапуска приложению
нужно несколько секунд, чтобы стартовать.

### Не загружаются большие файлы

nginx принимает файлы до 520 МБ, приложение — до значения из админки
(**Настройки → Макс. размер файла**, по умолчанию 500 МБ). Лимит nginx задан в
`/etc/nginx/sites-available/market-yookassa` (`client_max_body_size`).
Имейте в виду, что при повторном запуске скрипт перезапишет этот файл.

### Платежи не подтверждаются

- Проверьте адреса уведомлений в личном кабинете сервиса (см.
  [После установки](#3-укажите-адреса-уведомлений-в-платёжных-сервисах)).
- Посмотрите журнал: `journalctl -u market-yookassa | grep -i webhook`.
- Уведомления ЮKassa и CloudPayments принимаются только с их IP-адресов.
  Если перед сервером стоит ещё один прокси или CDN, приложение увидит
  его адрес вместо адреса сервиса. Дополнительные сети можно разрешить
  через `YOOKASSA_ALLOWED_IPS` и `CLOUDPAYMENTS_ALLOWED_IPS` в `.env`.

### Сделки не подтверждаются автоматически

```bash
systemctl list-timers market-yookassa-cron.timer
journalctl -u market-yookassa-cron -n 20
```

Ответ `403` означает, что `CRON_SECRET` в `.env` пустой или изменился
без перезапуска приложения.
