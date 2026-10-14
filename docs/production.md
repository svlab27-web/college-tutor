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

**Правило: реальные студенты — только на сервере в РК, с первого дня пилота.** Vercel + Supabase (Франкфурт) — только демо и тестовые аккаунты команды. Поэтому переносить с прототипа нечего (п. 5.2).

---

## 1. Целевая архитектура

```
Студент / преподаватель (Telegram)
        │  HTTPS
        ▼
┌──────────────── VPS в ЦОДе РК (Ubuntu 24.04) ────────────────┐
│  Caddy :443  — HTTPS (Let's Encrypt), заголовки безопасности │
│   ├─ /            → статика app/ (Mini App, кабинеты)        │
│   └─ /api/*       → api:3000 (Node.js 24, TypeScript)        │
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
| **VPS в Казахстане** | ЦОД в РК; провайдер подтверждает размещение в РК и IP с whois `KZ`. Сравнение и бюджет — в п. 2.1 | Света + колледж |
| Конфигурация (пилот, до ~300 студентов) | 2 vCPU · 4 ГБ RAM · 60–100 ГБ SSD · Ubuntu 24.04 LTS · публичный IPv4 · снапшоты. На рост (1 000+ студентов) — 4 vCPU · 8 ГБ · 100–200 ГБ | — |
| **Домен** | Проще всего — поддомен колледжа: `tutor.<колледж>.kz`. Или свой `.kz` у регистратора (nic.kz, ps.kz) | колледж |
| **Хранилище бэкапов** | Второй VPS или объектное хранилище у провайдера **в РК** | — |
| **Владелец** | На кого оформлены сервер, домен и договор обработки ПД: колледж (оператор данных) или Neurovia Labs (обработчик по договору) | юрист колледжа |
| **Боты** | Два бота: `@…_bot` для продакшена и `@tutornvl_bot` для тестов | — |
| **Администратор** | Кто отвечает за сервер: обновления, бэкапы, доступы | Эльвира |

### 2.1. Хостинг и бюджет (цены с сайтов провайдеров на 13.10.2026 — перед оплатой уточнить)

**Почему 2 vCPU / 4 ГБ хватит на пилот:** на сервере только Caddy, `api` и PostgreSQL; Python-код студента выполняется в браузере (Pyodide), AI — на стороне DeepSeek. 4 ГБ — запас для кэша базы.

| Провайдер | Конфигурация | Цена | Что известно |
|---|---|---|---|
| **Hoster.kz** | Cloud 2-4-100: 2 vCPU · 4 ГБ · 100 ГБ NVMe | **9 600 ₸/мес** (115 200 ₸/год) | Казахстанская компания (Караганда), поддержка 24/7. Город ЦОД, НДС и SLA на сайте не указаны |
| Hoster.kz | Cloud 2-4-50: 2 vCPU · 4 ГБ · 50 ГБ | 7 600 ₸/мес | то же |
| **Yandex Cloud, регион kz1** | 2 vCPU (100 %) · 4 ГБ | ~19 240 ₸/мес за CPU+RAM (8,70 ₸/vCPU·ч, 2,33 ₸/ГБ·ч, с НДС) + диск и IP → **~22–25 тыс. ₸**; с долей ядра 50 % — ~15–18 тыс. ₸ | ЦОД в **Караганде**, тенге, НДС включён, SLA 99,95 %; есть Managed PostgreSQL (бэкапы и обновления — на провайдере) и Object Storage |
| VPS24.kz | 2 vCPU · 4 ГБ | ~12 400 ₸/мес | Алматы / Астана, данные на сайте старые |
| Oblako.kz | 2 vCPU · 4 ГБ · 40 ГБ SSD | ~22 400 ₸/мес | ЦОД в Астане |
| Timeweb Cloud KZ | KZ-50: 2 vCPU · 4 ГБ · 50 ГБ | 5 620 ₽/мес | Tier III в Алматы, оплата в рублях |
| PS Cloud (ps.kz), QazCloud | — | по запросу | крупные местные провайдеры; QazCloud — если колледж закупает через госзакупки |

| Дополнительно | Где | Цена |
|---|---|---|
| Хранилище бэкапов (S3, 50 ГБ) в РК | Mnogoweb, Megahost; или Object Storage у того же провайдера | ~1 000–1 225 ₸/мес (наши дампы < 1 ГБ) |
| Домен `.kz` | Hoster.kz, Gohost и др. | 9 580 ₸/год с НДС (2026) |
| Поддомен колледжа | у колледжа | 0 ₸ |
| SSL | Let's Encrypt через Caddy | 0 ₸ |
| DeepSeek | оплата за использование | небольшие суммы; посчитаем на пилоте по `ai_messages` |

**Итог:**

| Вариант | В месяц | В год |
|---|---|---|
| Экономный: Hoster.kz 2-4-100 + S3 50 ГБ + домен `.kz` | ~11 600 ₸ | ~140 000 ₸ |
| Надёжный: Yandex Cloud kz1, ВМ с долей ядра 50 % + Object Storage + домен | ~16–19 тыс. ₸ | ~190–230 тыс. ₸ |
| + staging (1 vCPU · 2 ГБ) | + ~3 800 ₸ | + ~46 000 ₸ |
| На рост: 4 vCPU · 8 ГБ | ~20–35 тыс. ₸ | ~240–420 тыс. ₸ |

**Рекомендация:** на пилот — **Yandex Cloud kz1** (подтверждённый ЦОД в РК, SLA 99,95 %, НДС включён, можно взять Managed PostgreSQL — меньше ручной работы и проще защитить перед юристом колледжа). Если бюджет жёсткий — **Hoster.kz**, но после письменного подтверждения ЦОД в РК. Для сравнения запросить расчёт у PS Cloud.

> С Managed PostgreSQL контейнер `db` из п. 4.1 не нужен: `DATABASE_URL` указывает на базу провайдера, бэкапы п. 8 остаются как дополнительная копия.

**Запросить у провайдера письменно до оплаты:**
1. Город и ЦОД в Казахстане; IP-адреса с whois `country: KZ`.
2. Цена с НДС или без.
3. Снапшоты и их стоимость.
4. SLA (гарантия доступности).
5. Оплата от юрлица по договору (если платит колледж); для государственного колледжа — требования к закупке.

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
# в облачных образах Ubuntu 24.04 этот файл включает вход по паролю и перебивает sshd_config
rm -f /etc/ssh/sshd_config.d/50-cloud-init.conf
sshd -T | grep -Ei 'passwordauthentication|permitrootlogin'   # оба должны быть: no
# ⚠️ перед перезапуском — во ВТОРОМ окне проверить, что `ssh deploy@203.0.113.10` пускает по ключу; первое окно не закрывать
systemctl restart ssh
apt update && apt -y upgrade
apt -y install ufw fail2ban unattended-upgrades age
timedatectl set-timezone Asia/Almaty
```

### 3.3. Файрвол
```bash
ufw default deny incoming && ufw default allow outgoing
ufw allow OpenSSH && ufw allow 80/tcp && ufw allow 443/tcp
ufw enable
```
Порт базы (5432) **не открываем** — она доступна только контейнеру `api`.

> ⚠️ Docker обходит `ufw`: опубликованный порт контейнера открыт в интернет, что бы ни было в файрволе. Поэтому у `db` в `docker-compose.yml` **никогда не добавляем `ports:`**.

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
`.env` лежит в `/opt/college-tutor/`, а compose-файл — в `deploy/`. Подстановку `${DB_PASSWORD}` Compose берёт только из `.env` рядом с compose-файлом (`env_file:` на неё не влияет), поэтому **все команды `docker compose` — с `--env-file`** (п. 4.4, 5.1, 7, 8). Без него пароль пустой: `postgres` не стартует, у `api` неверный `DATABASE_URL`.
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
    # ports: НЕ добавлять никогда — Docker обходит ufw (п. 3.3)

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
cd deploy && docker compose --env-file ../.env up -d
docker compose --env-file ../.env ps        # все три контейнера Up
```

---

## 5. База данных

`api` подключается **тем же пользователем, который применял миграции** (`tutor`): RLS включён без политик, и такие таблицы видит только их владелец — под другим пользователем все запросы вернут пусто.

### 5.1. Применить миграции
```bash
cd /opt/college-tutor
for f in supabase/migrations/*.sql; do
  echo "== $f"; docker compose --env-file .env -f deploy/docker-compose.yml exec -T db psql -U tutor -d tutor -v ON_ERROR_STOP=1 < "$f"
done
```
Строку `NOTIFY pgrst …` из `docs/database.md` здесь **не нужно** — PostgREST на своём сервере нет. Журнал применения ведём как раньше (`docs/database.md`, раздел 6).

### 5.2. Данные с прототипа не переносим
По правилу из п. 0 реальных студентов на Supabase нет — там только демо и тестовые аккаунты, переносить нечего. Пилот с колледжем стартует сразу на сервере в РК.

Если всё же понадобится выгрузка (например, тестовые данные для staging): строку брать в Supabase → **Connect → Session pooler** — прямой адрес `db.….supabase.co:5432` работает только по IPv6 и с обычного компьютера часто не подключается.
```bash
pg_dump "<строка Session pooler>" --data-only --schema=public -Fc -f staging.dump
```

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
docker compose --env-file .env -f deploy/docker-compose.yml up -d --build
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
DIR=/opt/college-tutor/backups
TS=$(date +%F_%H%M)
docker compose --env-file ../.env exec -T db pg_dump -U tutor -d tutor -Fc > "$DIR/tutor_$TS.dump"
chmod 600 "$DIR/tutor_$TS.dump"
find "$DIR" -name 'tutor_*.dump' -mtime +14 -delete
# копия во второе хранилище в РК — только зашифрованная (в дампе данные студентов):
# age -r "$(cat /opt/college-tutor/deploy/backup.pub)" "$DIR/tutor_$TS.dump" > "$DIR/tutor_$TS.dump.age"
# rsync -a "$DIR"/*.age backup@backup-host:/srv/tutor-backups/ && rm "$DIR"/*.age
```
```bash
mkdir -p /opt/college-tutor/backups && chmod 700 /opt/college-tutor/backups
chmod +x deploy/backup.sh
( crontab -l 2>/dev/null; echo "15 3 * * * /opt/college-tutor/deploy/backup.sh" ) | crontab -
```
`backups/` — внутри проекта, системную `/var/backups` не трогаем. Ключ шифрования `age`: публичный (`backup.pub`) — на сервере, **секретный — только у ответственного, не на сервере**; без него копия бесполезна для того, кто её украдёт, и для нас тоже — хранить в менеджере паролей.
- Хранить **14 дней** локально + копия в другом месте **в РК**.
- **Раз в месяц — проверочное восстановление** в пустую базу: бэкап, который ни разу не восстанавливали, считается несуществующим.
- Плюс снапшоты VPS у провайдера.

---

## 9. Мониторинг

- `GET /api/health` → `200` + проверка базы. Внешний пинг раз в минуту (Uptime Kuma на втором сервере или сервис мониторинга), уведомления в Telegram администратору.
- Логи: `cd deploy && docker compose --env-file ../.env logs --since 1h api`. Ротация: `json-file` с `max-size: 10m`, `max-file: 5`.
- Диск, память, CPU — алерт при диске > 80 %.
- Ошибки студентов — понятный текст, подробности только в логах (чек-лист в `docs/api.md`).

---

## 10. Безопасность — чек-лист перед запуском

- [ ] Сервер и база **в РК**; в Supabase — только демо и тестовые аккаунты, реальных студентов нет
- [ ] SSH только по ключам, root-вход выключен, `ufw` + `fail2ban`, автообновления
- [ ] Порт PostgreSQL наружу закрыт: у `db` нет `ports:`, `sshd -T` показывает `passwordauthentication no`
- [ ] `.env` — `chmod 600`, секреты нигде больше (кроме менеджера паролей)
- [ ] HTTPS везде, HSTS
- [ ] Вебхук проверяет `X-Telegram-Bot-Api-Secret-Token`, Mini App — подпись `initData`
- [ ] Лимиты запросов на студента (ответы, подсказки, AI)
- [ ] В DeepSeek — без ФИО и Telegram ID
- [ ] Бэкапы работают, внешняя копия зашифрована, восстановление проверено
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
6. Реальных студентов на прототипе нет (п. 0) — переносить нечего; проект Supabase остаётся для демо.
7. Преподаватели получают приглашения, раздают студентам ссылки групп.
8. Прототип на Vercel остаётся для демо — **без** реальных данных.

---

## Открытые вопросы

- [ ] Провайдер VPS в РК и бюджет (сервер + хранилище бэкапов + домен)
- [ ] Домен: поддомен колледжа или свой `.kz`; на кого регистрируем
- [ ] Кто оператор персональных данных и есть ли договор поручения на обработку
- [ ] Нужно ли что-то ещё по требованиям колледжа к ИБ (из ТЗ, раздел А4)
- [ ] Кто администратор сервера и кто его заменяет
