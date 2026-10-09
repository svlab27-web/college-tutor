-- 001_init — базовая схема «Мой колледж» (пилот: Python + математика)
-- Фронт в базу напрямую не ходит: все запросы идут через api/ с service_role.
-- RLS включён на всех таблицах и без политик = закрыто для anon/authenticated.

create extension if not exists pgcrypto;

-- ── Справочники ───────────────────────────────────────────────
create table subjects (
  id          text primary key,              -- 'python', 'math'
  title       text not null,
  position    int  not null default 0
);

create table lessons (
  id          uuid primary key default gen_random_uuid(),
  subject_id  text not null references subjects(id),
  slug        text not null,                 -- '01-skidka-v-kafe'
  title       text not null,
  version     int  not null default 1,
  content     jsonb not null,                -- урок целиком по content/lesson.schema.json (включая эталоны — только на сервере)
  is_published boolean not null default false,
  approved_by text,                          -- кто из преподавателей утвердил
  created_at  timestamptz not null default now(),
  unique (subject_id, slug, version)
);

-- ── Люди и группы ─────────────────────────────────────────────
create table groups (
  id          uuid primary key default gen_random_uuid(),
  title       text not null,                 -- 'ИС-21'
  language    text not null default 'ru',    -- 'ru' | 'kk'
  created_at  timestamptz not null default now()
);

create table users (
  id               uuid primary key default gen_random_uuid(),
  telegram_user_id bigint unique,            -- из проверенного initData
  display_name     text,
  role             text not null default 'student' check (role in ('student','teacher','admin')),
  reminders_on     boolean not null default false,
  reminder_time    time,
  created_at       timestamptz not null default now()
);

create table group_members (
  group_id   uuid not null references groups(id) on delete cascade,
  user_id    uuid not null references users(id)  on delete cascade,
  role       text not null default 'student' check (role in ('student','teacher')),
  joined_at  timestamptz not null default now(),
  primary key (group_id, user_id)
);

create table invites (
  token      text primary key,               -- одноразовый код приглашения
  group_id   uuid not null references groups(id) on delete cascade,
  role       text not null default 'student' check (role in ('student','teacher')),
  expires_at timestamptz,
  used_by    uuid references users(id),
  used_at    timestamptz,
  created_at timestamptz not null default now()
);

-- ── Учебные события ───────────────────────────────────────────
create table attempts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  lesson_id   uuid not null references lessons(id),
  step_id     text not null,                 -- id шага внутри урока
  answer      jsonb not null,                -- выбор / число / текст / код
  is_correct  boolean,
  hints_used  int  not null default 0,
  is_independent boolean not null default false, -- самостоятельная задача без подсказок
  request_id  text,                          -- защита от дублей при повторной отправке
  created_at  timestamptz not null default now(),
  unique (user_id, request_id)
);
create index attempts_user_lesson on attempts (user_id, lesson_id);

create table progress (
  user_id     uuid not null references users(id) on delete cascade,
  lesson_id   uuid not null references lessons(id),
  current_step text,
  completed_steps int not null default 0,
  completed_at timestamptz,
  updated_at  timestamptz not null default now(),
  primary key (user_id, lesson_id)
);

create table hint_events (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  lesson_id   uuid not null references lessons(id),
  step_id     text not null,
  level       int  not null check (level between 1 and 3), -- намёк / вопрос / пример
  source      text not null default 'script' check (source in ('script','ai')),
  created_at  timestamptz not null default now()
);

create table help_requests (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references users(id) on delete cascade,
  group_id    uuid references groups(id),
  lesson_id   uuid references lessons(id),
  text        text not null,
  status      text not null default 'new' check (status in ('new','resolved')),
  created_at  timestamptz not null default now(),
  resolved_at timestamptz
);

-- ── RLS: всё закрыто, доступ только через service_role в api/ ─
alter table subjects      enable row level security;
alter table lessons       enable row level security;
alter table groups        enable row level security;
alter table users         enable row level security;
alter table group_members enable row level security;
alter table invites       enable row level security;
alter table attempts      enable row level security;
alter table progress      enable row level security;
alter table hint_events   enable row level security;
alter table help_requests enable row level security;

-- ── Справочник предметов пилота ───────────────────────────────
insert into subjects (id, title, position) values
  ('python', 'Программирование (Python)', 1),
  ('math',   'Высшая математика',         2);
