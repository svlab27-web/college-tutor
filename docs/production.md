# Продакшен: развёртывание на своём сервере в Казахстане

Статус: план · 13.10.2026 · для обсуждения со всей командой
Связано: `docs/api.md` (план сервера, #26), `docs/database.md`, `docs/decisions.md`

Прототип живёт на **Vercel + Supabase (Франкфурт)** — для показа и тестов этого достаточно. Для работы с настоящими студентами переезжаем на **свой сервер в казахстанском дата-центре** с доменом колледжа.

---

## 0. Почему не оставляем прототипную схему

| Требование | Что это значит для нас |
|---|---|
| Закон РК «О персональных данных и их защите» № 94-V, **ст. 12**: база с персональными данными хранится **на территории РК** | ФИО, Telegram ID, ответы и прогресс студентов — только в базе в Казахстане. Supabase во Франкфурте для продакшена не подходит |
| Домен **.kz** — сайт должен размещаться на оборудовании в РК (правила nic.kz) | Сервер для `*.kz` — в казахстанском ЦОДе, IP с whois `country: KZ` |
| Несовершеннолетние студенты | Строже к доступу, журналам, удалению данных |
| Предсказуемость | Свой сервер: понятная цена, нет лимитов бесплатных планов, полный контроль |

> ⚠️ Формулировки закона и правил .kz сверены по открытым источникам. Перед запуском — подтвердить у юриста колледжа и регистратора домена.

AI (DeepSeek) остаётся внешним: туда уходят **только** текст вопроса и материал урока, без ФИО и Telegram ID (решение в `docs/decisions.md`).

---

## 1. Целевая архитектура

```
Студент / преподаватель (Telegram)
        │  HTTPS
        ▼
┌──────────────── VPS в ЦОДе РК (Ubuntu 24.04) ────────────────┐
│  Caddy :443  — HTTPS (Let's Encrypt), заголовки безопасности │
│   ├─ /            → статика app/ (Mini App, кабинеты)        │
│   └─ /api/*       → api:3000 (Node.js 20, TypeScript)        │
│  api   — тот же код, что в api/ (#5, #6), как обычный сервер │
│  db    — PostgreSQL 16, наружу не открыт                     │
│  backup — ночной pg_dump → второе хранилище в РК             │
└──────────────────────────────────────────────────────────────┘
        │ только вопрос + материал урока
        ▼
     DeepSeek API
```

Всё в **Docker Compose**: три контейнера (`caddy`, `api`, `db`) + задача бэкапа. Один сервер — достаточно для пилота и первых групп.

### Что поменяется в коде (зона @Ehai1911)

1. **API как обычный Node-сервер.** Сейчас `api/` планируется как Vercel Functions. Делаем обработчики независимыми от платформы и добавляем тонкую обёртку `server.ts` (Fastify или встроенный `http`) — один и тот же код работает и на Vercel (прототип), и на сервере (продакшен).
2. **База без Supabase-клиента.** На своём PostgreSQL нет `supabase-js` и PostgREST. Доступ к базе — через `postgres` (postgres.js) или `pg` в одном модуле `api/_lib/db.ts`. Миграции `001`–`003` — обычный SQL, переносятся без изменений (проверено: специфичных для Supabase ролей и схем нет).
   - Альтернатива — self-hosted Supabase в Docker: тот же API, но тяжелее (~10 контейнеров, от 4–8 ГБ RAM). Для нашего объёма не нужен.
3. **Конфиг из переменных окружения** — как сейчас: `DATABASE_URL` вместо `SUPABASE_URL` + `SUPABASE_SERVICE_ROLE_KEY`.

**Решение лучше принять сейчас**, до PR 1 из `docs/api.md`: писать слой базы через `DATABASE_URL` с самого начала — тогда переезд будет заменой адреса, а не переписыванием.

---

## 2. Что подготовить до установки

| Что | Рекомендация | Кто решает |
|---|---|---|
| **VPS в Казахстане** | ЦОД в Алматы или Астане; провайдер подтверждает размещение в РК и IP с whois `KZ`. Например: PS Cloud (ps.kz), Hoster.kz, QazCloud — сравнить цены и SLA | Света + колледж |
| Конфигурация (пилот, до ~300 студентов) | 2 vCPU · 4 ГБ RAM · 60–80 ГБ SSD · Ubuntu 24.04 LTS · публичный IPv4 · снапшоты | — |
| **Домен** | Проще всего — поддомен колледжа: `tutor.<колледж>.kz`. Или свой `.kz` у регистратора (nic.kz, ps.kz) | колледж |
| **Хранилище бэкапов** | Второй VPS или объектное хранилище у провайдера **в РК** | — |
| **Владелец** | На кого оформлены сервер, домен и договор обработки ПД: колледж (оператор данных) или Neurovia Labs (обработчик по договору) | юрист колледжа |
| **Боты** | Два бота: `@…_bot` для продакшена и `@tutornvl_bot` для тестов | — |
| **Администратор** | Кто отвечает за сервер: обновления, бэкапы, доступы | Эльвира |

---

## 3. Первичная настройка сервера

Выполняется один раз, по SSH. `deploy` — пользователь для работы, `203.0.113.10` — IP сервера, `tutor.example.kz` — домен (заменить на свои).

### 3.1. DNS
У регистратора домена: запись **A** `tutor.example.kz` → `203.0.113.10`. Проверка: `dig +short tutor.example.kz` возвращает IP сервера.

### 3.2. Пользователь, SSH-ключи, обновления
```bash
# под root
adduser deploy && usermod -aG sudo deploy
mkdir -p /home/deploy/.ssh && cp ~/.ssh/authorized_keys /home/deploy/.ssh/ && chown -R deploy:deploy /home/deploy/.ssh
# вход только по ключу, без root
sed -i 's/^#\?PasswordAuthentication .*/PasswordAuthentication no/; s/^#\?PermitRootLogin .*/PermitRootLogin no/' /etc/ssh/sshd_config
systemctl restart ssh
apt update && apt -y upgrade
apt -y install ufw fail2ban unattended-upgrades
timedatectl set-timezone Asia/Almaty
```

### 3.3. Файрвол
```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
```
Порт базы (5432) **не открываем** — она доступна только контейнеру `api`.

### 3.4. Docker
```bash
curl -fsSL https://get.docker.com | sh
usermod -aG docker deploy
```

---

## 4. Проект на сервере

```
/opt/college-tutor/
├── app/                 ← статика из репозитория (Mini App, кабинеты)
├── api/                 ← код сервера (#5, #6)
├── supabase/migrations/ ← SQL-миграции 001…
├── deploy/
│   ├── docker-compose.yml
│   ├── Caddyfile
│   └── backup.sh
└── .env                 ← секреты, chmod 600, НЕ в git
```

### 4.1. `deploy/docker-compose.yml` (образец)
```yaml
services:
  caddy:
    image: caddy:2
    restart: unless-stopped
    ports: ["80:80", "443:443"]
    volumes:
      - ./Caddyfile:/etc/caddy/Caddyfile:ro
      - ../app:/srv/app:ro
      - caddy_data:/data
    depends_on: [api]

  api:
    build: ../api
    restart: unless-stopped
    env_file: ../.env
    environment:
      DATABASE_URL: postgres://tutor:${DB_PASSWORD}@db:5432/tutor
    depends_on: [db]

  db:
    image: postgres:16
    restart: unless-stopped
    environment:
      POSTGRES_DB: tutor
      POSTGRES_USER: tutor
      POSTGRES_PASSWORD: ${DB_PASSWORD}
    volumes: [pgdata:/var/lib/postgresql/data]
    # портов наружу нет

volumes: { caddy_data: {}, pgdata: {} }
```

### 4.2. `deploy/Caddyfile` (образец)
```
tutor.example.kz {
    encode gzip
    header {
        Strict-Transport-Security "max-age=31536000; includeSubDomains"
        X-Content-Type-Options "nosniff"
        Referrer-Policy "strict-origin-when-cross-origin"
    }
    handle /api/* {
        reverse_proxy api:3000
    }
    handle {
        root * /srv/app
        file_server
    }
}
```
HTTPS-сертификат Caddy получит и продлит сам, когда DNS уже указывает на сервер.

### 4.3. `.env` (на сервере, `chmod 600`)
```
DB_PASSWORD=          # длинный случайный: openssl rand -hex 24
BOT_TOKEN=            # токен продакшен-бота
TG_WEBHOOK_SECRET=    # openssl rand -hex 32
AI_PROVIDER=deepseek
AI_API_KEY=
AI_MODEL=
APP_URL=https://tutor.example.kz
```
Значения — только на сервере (и копия в менеджере паролей ответственного). Не в git, не в чатах.

### 4.4. Первый запуск
```bash
sudo mkdir -p /opt/college-tutor && sudo chown deploy:deploy /opt/college-tutor
git clone https://github.com/svlab27-web/college-tutor.git /opt/college-tutor
cd /opt/college-tutor && nano .env && chmod 600 .env
cd deploy && docker compose up -d
docker compose ps        # все три контейнера Up
```

---

## 5. База данных

### 5.1. Применить миграции
```bash
cd /opt/college-tutor
for f in supabase/migrations/*.sql; do
  echo "== $f"; docker compose -f deploy/docker-compose.yml exec -T db psql -U tutor -d tutor -v ON_ERROR_STOP=1 < "$f"
done
```
Строку `NOTIFY pgrst …` из `docs/database.md` здесь **не нужно** — PostgREST на своём сервере нет. Журнал применения ведём как раньше (`docs/database.md`, раздел 6).

### 5.2. Перенос данных с Supabase (если пилот уже шёл на прототипе)
```bash
# на компьютере администратора; строку подключения взять в Supabase → Project Settings → Database
pg_dump "postgresql://…supabase.co:5432/postgres" --data-only --schema=public -Fc -f pilot.dump
scp pilot.dump deploy@203.0.113.10:/tmp/
# на сервере
docker compose -f deploy/docker-compose.yml exec -T db pg_restore -U tutor -d tutor --data-only < /tmp/pilot.dump && rm /tmp/pilot.dump
```
После проверки — удалить проект в Supabase (данные студентов не должны оставаться за рубежом).

### 5.3. Уроки
Скрипт синхронизации (`content/**/*.json` → `lessons`, `lesson_translations`) запускается так же, но с `DATABASE_URL` сервера.

---

## 6. Telegram

1. **@BotFather** → продакшен-бот → **Bot Settings → Configure Mini App** и **Menu Button** → `https://tutor.example.kz`.
2. Вебхук (с сервера или любого компьютера; токен и секрет подставить из `.env`, в чат не вставлять):
   ```bash
   curl -s "https://api.telegram.org/bot$BOT_TOKEN/setWebhook" \
     -d "url=https://tutor.example.kz/api/bot" \
     -d "secret_token=$TG_WEBHOOK_SECRET" \
     -d 'allowed_updates=["message","callback_query"]'
   curl -s "https://api.telegram.org/bot$BOT_TOKEN/getWebhookInfo"
   ```
3. Описание, About, аватар — как у тестового бота.
4. Тестовый бот `@tutornvl_bot` остаётся на прототипе / staging.

---

## 7. Обновления (деплой)

**Ручной:**
```bash
cd /opt/college-tutor && git pull
docker compose -f deploy/docker-compose.yml up -d --build
# новая миграция → применить по 5.1 только её
```

**Автоматический (GitHub Actions):** при теге `v*` (а не на каждый merge) — `ssh deploy@сервер` и те же команды. В секретах репозитория — SSH-ключ деплоя и адрес сервера. Перед продом — прогон на **staging** (второй, маленький сервер или второй compose-проект с тестовым ботом и отдельной базой).

---

## 8. Бэкапы — обязательно до первого студента

`deploy/backup.sh` (образец):
```bash
#!/usr/bin/env bash
set -euo pipefail
cd /opt/college-tutor/deploy
TS=$(date +%F_%H%M)
docker compose exec -T db pg_dump -U tutor -d tutor -Fc > /var/backups/tutor_$TS.dump
find /var/backups -name 'tutor_*.dump' -mtime +14 -delete
# копия во второе хранилище в РК, например:
# rsync -a /var/backups/ backup@backup-host:/srv/tutor-backups/
```
```bash
sudo mkdir -p /var/backups && sudo chown deploy:deploy /var/backups
chmod +x deploy/backup.sh
( crontab -l 2>/dev/null; echo "15 3 * * * /opt/college-tutor/deploy/backup.sh" ) | crontab -
```
- Хранить **14 дней** локально + копия в другом месте **в РК**.
- **Раз в месяц — проверочное восстановление** в пустую базу: бэкап, который ни разу не восстанавливали, считается несуществующим.
- Плюс снапшоты VPS у провайдера.

---

## 9. Мониторинг

- `GET /api/health` → `200` + проверка базы. Внешний пинг раз в минуту (Uptime Kuma на втором сервере или сервис мониторинга), уведомления в Telegram администратору.
- Логи: `docker compose logs --since 1h api`. Ротация: `json-file` с `max-size: 10m`, `max-file: 5`.
- Диск, память, CPU — алерт при диске > 80 %.
- Ошибки студентов — понятный текст, подробности только в логах (чек-лист в `docs/api.md`).

---

## 10. Безопасность — чек-лист перед запуском

- [ ] Сервер и база **в РК**, данные из Supabase перенесены и удалены
- [ ] SSH только по ключам, root-вход выключен, `ufw` + `fail2ban`, автообновления
- [ ] Порт PostgreSQL наружу закрыт
- [ ] `.env` — `chmod 600`, секреты нигде больше (кроме менеджера паролей)
- [ ] HTTPS везде, HSTS
- [ ] Вебхук проверяет `X-Telegram-Bot-Api-Secret-Token`, Mini App — подпись `initData`
- [ ] Лимиты запросов на студента (ответы, подсказки, AI)
- [ ] В DeepSeek — без ФИО и Telegram ID
- [ ] Бэкапы работают, восстановление проверено
- [ ] Список людей с доступом к серверу и базе; при уходе — отзыв ключей
- [ ] Порядок удаления данных по запросу и по сроку (`users.delete_after`)
- [ ] Согласия (`consents`) собираются до сохранения учебных данных

---

## 11. Переезд с прототипа — порядок

1. Колледж подтверждает: владелец, домен, провайдер, юрист по ПД.
2. Эльвира делает `api/` платформонезависимым и на `DATABASE_URL` (п. 1).
3. Покупаем VPS в РК, настраиваем (п. 3–4), применяем миграции (п. 5.1).
4. Staging: тестовый бот на сервере, прогоняем вход, уроки, кабинет, бэкап/восстановление.
5. Продакшен-бот: BotFather + вебхук (п. 6).
6. Если пилот шёл на прототипе — перенос данных (п. 5.2), удаление проекта Supabase.
7. Преподаватели получают приглашения, раздают студентам ссылки групп.
8. Прототип на Vercel остаётся для демо — **без** реальных данных.

---

## Открытые вопросы

- [ ] Провайдер VPS в РК и бюджет (сервер + хранилище бэкапов + домен)
- [ ] Домен: поддомен колледжа или свой `.kz`; на кого регистрируем
- [ ] Кто оператор персональных данных и есть ли договор поручения на обработку
- [ ] Нужно ли что-то ещё по требованиям колледжа к ИБ (из ТЗ, раздел А4)
- [ ] Кто администратор сервера и кто его заменяет
