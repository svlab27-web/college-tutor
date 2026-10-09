# college-tutor — «Мой колледж», AI-тьютор в Telegram

Учебный сервис для студентов колледжа: Telegram-бот + Mini App + кабинет преподавателя.
Пилот: **Python** и **высшая математика**.

## Стек

| Слой | Технология |
|---|---|
| Интерфейс | HTML/CSS/JS (из прототипа) как Telegram Mini App |
| Сервер | Vercel Functions (`api/`) |
| База | Supabase (Postgres + RLS) |
| Бот | Telegram Bot API, webhook |
| Python в уроке | Pyodide (в браузере) + проверка тестами на сервере |
| AI | _провайдер не выбран — см. `docs/decisions.md`_ |

## Структура

```
app/                  интерфейс Mini App (владелец — Светлана)
api/                  серверные функции: вход, уроки, ответы, прогресс, AI (Эльвира)
supabase/migrations/  схема БД, только миграциями (Эльвира)
supabase/seed.sql     тестовые данные
content/python/       уроки Python (JSON)
content/math/         уроки математики (JSON)
content/lesson.schema.json  формат урока
docs/                 решения и инструкции
```

## Как начать

1. Склонировать репозиторий.
2. Скопировать `.env.example` → `.env.local` и заполнить (значения — у владельца проекта, не в чате).
3. Supabase: выполнить миграции из `supabase/migrations/` по порядку, затем `NOTIFY pgrst, 'reload schema';`.
4. Работать по правилам из [CONTRIBUTING.md](CONTRIBUTING.md).

## Безопасность

- Секреты только в переменных окружения Vercel.
- Личность студента — только по проверенной подписи `initData` (не `initDataUnsafe`).
- Эталоны ответов и тесты не отдаются в браузер.
- Личные результаты не публикуются в канал.
