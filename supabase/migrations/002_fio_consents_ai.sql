-- 002_fio_consents_ai — ФИО студентов, согласия на обработку данных, журнал AI-тьютора
-- Применять после 001_init.sql. Затем: NOTIFY pgrst, 'reload schema';
-- Как и в 001: RLS включён, политик нет — доступ только через api/ (service_role).

-- ── 1. ФИО ────────────────────────────────────────────────────
-- Два способа получить ФИО:
--   'self'   — студент вводит при первом входе;
--   'roster' — преподаватель загрузил список группы, ФИО пришло из персонального приглашения.
alter table users
  add column full_name        text,
  add column full_name_source text check (full_name_source in ('self','roster')),
  add column birth_year       smallint check (birth_year between 1950 and 2020),
  add column delete_after     date;          -- срок хранения: после этой даты данные удаляются

-- Персональное приглашение из списка группы: ФИО известно заранее
alter table invites
  add column full_name text;

-- ── 2. Согласия ───────────────────────────────────────────────
-- Каждое согласие — отдельная строка (история не теряется).
-- Отзыв согласия = заполняем revoked_at, строку не удаляем.
create table consents (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references users(id) on delete cascade,
  kind         text not null check (kind in ('personal_data','parental')),
  doc_version  text not null,                -- версия текста согласия, напр. 'pd-2026-10'
  granted_via  text not null check (granted_via in ('telegram','paper','teacher')),
  parent_name  text,                         -- только для kind = 'parental'
  recorded_by  uuid references users(id),    -- кто внёс бумажное согласие (преподаватель / админ)
  granted_at   timestamptz not null default now(),
  revoked_at   timestamptz,
  check (kind <> 'parental' or parent_name is not null)
);
create index consents_user on consents (user_id) where revoked_at is null;

-- ── 3. Журнал AI-тьютора ──────────────────────────────────────
-- Каждое обращение к AI: что спросил студент, что ответил AI, на какой материал опирался,
-- сколько стоило, и оценка преподавателя (для порога «≥ 95 % ответов приняты»).
create table ai_messages (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references users(id) on delete cascade,
  lesson_id      uuid references lessons(id),
  step_id        text,
  mode           text not null check (mode in ('hint','explain','check','chat')),
  hint_level     int  check (hint_level between 1 and 3),
  question       text not null,              -- вопрос / ответ студента, отправленный AI
  answer         text,                       -- что AI ответил студенту
  material_ref   text,                       -- на какой утверждённый материал опирался
  status         text not null default 'ok'
                 check (status in ('ok','refused','fallback','error','limit')),
  provider       text,
  model          text,
  input_tokens   int,
  output_tokens  int,
  cost_usd       numeric(10,6),
  latency_ms     int,
  -- проверка преподавателем
  review_verdict text check (review_verdict in ('accepted','rejected','critical')),
  review_comment text,
  reviewed_by    uuid references users(id),
  reviewed_at    timestamptz,
  created_at     timestamptz not null default now()
);
create index ai_messages_user_day   on ai_messages (user_id, created_at);  -- дневной лимит на студента
create index ai_messages_unreviewed on ai_messages (created_at) where review_verdict is null;

-- ── RLS ───────────────────────────────────────────────────────
alter table consents    enable row level security;
alter table ai_messages enable row level security;
