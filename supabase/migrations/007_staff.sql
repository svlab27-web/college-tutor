-- 007_staff — вход сотрудников по личной ссылке, роли (#63) и основа этапа А
-- Применять после 006. Затем: NOTIFY pgrst, 'reload schema';
-- Как и в 001–006: RLS включён, политик нет — доступ только через api/ (service_role).
--
-- Миграция только добавляет и расширяет: ни одна колонка и ни одна строка из 001–006 не удаляется.
-- Права в api/ (тот же PR) берутся только из staff_assignments и staff_roles; нынешние
-- group_members.role = 'teacher' и users.role = 'admin' переносим туда ниже. Применять 007 —
-- до выкладки этого api/: прежний api/ с 007 работает как раньше (только добавления).
-- Строки group_members.role = 'teacher' уберём отдельной миграцией.
--
-- ── Часть 1. Сотрудники ──────────────────────────────────────
-- Решение 17.10.2026 (Света, Эльвира): сотрудники входят так же, как студенты, — по личной
-- одноразовой ссылке (004), без логина и пароля. Кабинет открывается только в Telegram,
-- на нескольких устройствах это один аккаунт — повторный вход не нужен; пароли не храним.
--   Сотрудник = строка users (role 'teacher' или 'admin'). Администратор колледжа выдаёт ему
--   ссылку invites.role = 'staff': одноразовая, не дольше 48 ч, лично. Группы у ссылки нет —
--   что он видит, решают staff_assignments и staff_roles.
--   Telegram студента к сотруднику не привязать: users.telegram_user_id уникален (001),
--   а вход по ссылке отказывает Telegram, уже привязанному к другому человеку (already_registered).
--   Сброс (сменил Telegram, ссылка утекла): отзываем ссылки, users.telegram_user_id = null, новая ссылка.
--   Увольнение: users.disabled_at. Запись не удаляем — на неё ссылаются согласия родителей (005, restrict).
-- Роли: педагог и куратор — в группе (staff_assignments), методист и администратор колледжа —
-- на весь колледж (staff_roles). У одного человека ролей может быть несколько.
-- Передача колледжу (решение Эльвиры 18.10.2026): сотрудников и группы заводит администратор
-- колледжа в кабинете, мы заводим только первых администраторов (scripts/staff-sql.ts).
-- Последнего действующего администратора нельзя ни отключить, ни лишить роли — иначе колледж
-- останется без доступа к кабинету (ниже, staff_keep_admin).

-- Уволенный сотрудник: кабинет закрыт, Telegram отвязан, история остаётся
alter table users
  add column disabled_at timestamptz;

-- Ссылка сотрудника: роль 'staff', без группы, со сроком не дольше 48 ч.
-- Ссылки 'teacher' (004) оставляем для совместимости; новых не выдаём.
-- Нынешний вход (api/_lib/invites.ts) соединяет ссылку с группой inner join — ссылку без группы
-- он отклонит как invalid, пока api/ не научится входу сотрудника.
alter table invites drop constraint invites_role_check;
alter table invites
  add constraint invites_role_check check (role in ('student','teacher','staff')),
  alter column group_id drop not null,
  add constraint invites_group_required check (role = 'staff' or group_id is not null),
  add constraint invites_staff_no_group check (role <> 'staff' or group_id is null),
  -- invites_teacher_expires (004) уже требует срок у всех ссылок, кроме студенческих
  add constraint invites_staff_48h check (role <> 'staff' or expires_at <= created_at + interval '48 hours');

-- Ссылку сотрудника нельзя выдать студенту
create function invites_staff_not_student() returns trigger
  language plpgsql set search_path = public as $$
begin
  if new.role = 'staff' and exists (select 1 from users where id = new.user_id and role = 'student') then
    raise exception 'staff invite for a student'
      using errcode = '23514', constraint = 'invites_staff_not_student';
  end if;
  return new;
end $$;

create trigger invites_staff_not_student
  before insert or update of role, user_id on invites
  for each row execute function invites_staff_not_student();

-- Роли на весь колледж:
--   methodist — методист / завуч: все группы на чтение, сводки методсовету;
--   admin     — администратор колледжа: заводит сотрудников и группы, выдаёт им ссылки,
--               отключает уволенных; группы — как куратор каждой.
create table staff_roles (
  user_id    uuid not null references users(id) on delete cascade,
  role       text not null constraint staff_roles_role check (role in ('methodist','admin')),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  primary key (user_id, role)
);

-- Назначения «сотрудник × группа × роль»: педагог — всегда с предметом, куратор — без.
create table staff_assignments (
  id         uuid primary key default gen_random_uuid(),
  user_id    uuid not null references users(id) on delete cascade,
  group_id   uuid not null references groups(id) on delete cascade,
  role       text not null constraint staff_assignments_role check (role in ('teacher','curator')),
  subject_id text references subjects(id),
  created_by uuid references users(id) on delete set null,
  created_at timestamptz not null default now(),
  constraint staff_assignments_subject check ((role = 'teacher') = (subject_id is not null)),
  -- nulls not distinct: второй «куратор этой группы» (subject_id = null) — тоже дубль
  constraint staff_assignments_unique unique nulls not distinct (user_id, group_id, role, subject_id)
);
-- «кто ведёт / курирует группу» (отчёт педагогу, обращения куратору)
create index staff_assignments_group on staff_assignments (group_id, role);

-- Нынешние преподаватели групп ведут кабинет куратора → переносим их как кураторов.
-- group_members не трогаем (см. шапку).
insert into staff_assignments (user_id, group_id, role)
select m.user_id, m.group_id, 'curator'
  from group_members m
 where m.role = 'teacher'
on conflict do nothing;

-- Нынешние администраторы (users.role = 'admin') → администраторы колледжа
insert into staff_roles (user_id, role)
select id, 'admin' from users where role = 'admin'
on conflict do nothing;

-- Последний действующий администратор колледжа остаётся: не снять роль, не отключить, не удалить.
-- Пока администраторов нет вовсе (новый колледж) — проверять нечего.
create function staff_keep_admin() returns trigger
  language plpgsql set search_path = public as $$
begin
  if tg_table_name = 'staff_roles' then
    if old.role <> 'admin' then return null; end if;
  elsif not (old.disabled_at is null and new.disabled_at is not null
             and exists (select 1 from staff_roles where user_id = new.id and role = 'admin')) then
    return null;
  end if;
  if not exists (select 1 from staff_roles r join users u on u.id = r.user_id
                  where r.role = 'admin' and u.disabled_at is null) then
    raise exception 'last college admin'
      using errcode = '23514', constraint = 'staff_keep_admin';
  end if;
  return null;
end $$;

create trigger staff_keep_admin
  after delete on staff_roles
  for each row execute function staff_keep_admin();

create trigger staff_keep_admin
  after update of disabled_at on users
  for each row execute function staff_keep_admin();

-- ── Часть 2. Основа этапа А ──────────────────────────────────
-- Тема от педагога: материал + термины + микрошаги + типичные ошибки → ИИ-черновик → правка →
-- «Утвердить». ИИ-диалог студента — только по утверждённой теме; журнал отмечает, на каком
-- термине студент споткнулся; педагог получает отчёт после занятия.
-- Таблицы закладываем сейчас, чтобы роли и назначения из части 1 не переделывать;
-- api/ к ним — отдельными задачами этапа А.

-- Тема. source: 'file' — из content/ через PR, как уроки; 'editor' — педагог собрал в кабинете.
-- content (jsonb): material, microsteps, common_mistakes — формат задаёт задача «тема от педагога».
create table topics (
  id          uuid primary key default gen_random_uuid(),
  subject_id  text not null references subjects(id),
  slug        text,                          -- только у source = 'file': имя файла, как у уроков
  title       text not null,
  language    text not null default 'ru' check (language in ('ru','kk')),
  source      text not null constraint topics_source check (source in ('file','editor')),
  status      text not null default 'draft' constraint topics_status check (status in ('draft','approved','archived')),
  version     int  not null default 1,
  content     jsonb not null default '{}'::jsonb,
  author_id   uuid references users(id) on delete restrict,   -- педагог; у 'file' может быть пусто
  approved_by uuid references users(id) on delete restrict,   -- утверждает педагог, не ИИ и не мы
  approved_at timestamptz,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint topics_approved check (status <> 'approved' or (approved_by is not null and approved_at is not null)),
  constraint topics_file_slug check ((source = 'file') = (slug is not null)),
  constraint topics_editor_author check (source <> 'editor' or author_id is not null)
);
create unique index topics_file_version on topics (subject_id, slug, version) where slug is not null;
create index topics_author on topics (author_id, status);

-- Термины темы — отдельными записями: на них ссылается журнал «споткнулся на термине».
create table topic_terms (
  id         uuid primary key default gen_random_uuid(),
  topic_id   uuid not null references topics(id) on delete cascade,
  term       text not null,
  definition text not null,
  position   int  not null default 0,
  created_at timestamptz not null default now()
);
-- один термин в теме — один раз, без учёта регистра
create unique index topic_terms_unique on topic_terms (topic_id, lower(term));

-- Журнал учебных событий для отчёта педагогу: что произошло, на каком термине, насколько уверенно.
--   term_stumble  — студент споткнулся на термине (ошибся / переспросил / ИИ заметил путаницу);
--   term_resolved — термин прояснён (ответил верно после объяснения);
--   step_stuck    — застрял на шаге без привязки к термину.
-- confidence — насколько ИИ / скрипт уверен в этой пометке (0–1); у source = 'teacher' пусто.
create table learning_events (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references users(id) on delete cascade,
  topic_id      uuid references topics(id),
  lesson_id     uuid references lessons(id),
  step_id       text,
  term_id       uuid references topic_terms(id) on delete set null,
  kind          text not null constraint learning_events_kind
                check (kind in ('term_stumble','term_resolved','step_stuck')),
  confidence    numeric(3,2) constraint learning_events_confidence check (confidence between 0 and 1),
  source        text not null constraint learning_events_source check (source in ('script','ai','teacher')),
  ai_message_id uuid references ai_messages(id) on delete set null,
  created_at    timestamptz not null default now(),
  constraint learning_events_target check (topic_id is not null or lesson_id is not null)
);
create index learning_events_user on learning_events (user_id, created_at);
create index learning_events_topic_term on learning_events (topic_id, term_id) where topic_id is not null;

-- ИИ-диалог по материалу темы: на какую тему опирался ответ
alter table ai_messages
  add column topic_id uuid references topics(id);

-- Задание группе со сроком: тема или урок — ровно одно.
create table group_tasks (
  id           uuid primary key default gen_random_uuid(),
  group_id     uuid not null references groups(id) on delete cascade,
  topic_id     uuid references topics(id),
  lesson_id    uuid references lessons(id),
  assigned_by  uuid not null references users(id) on delete restrict,
  due_at       timestamptz,
  cancelled_at timestamptz,
  created_at   timestamptz not null default now(),
  constraint group_tasks_target check (num_nonnulls(topic_id, lesson_id) = 1)
);
create index group_tasks_group on group_tasks (group_id, due_at) where cancelled_at is null;

-- ── RLS ───────────────────────────────────────────────────────
alter table staff_roles       enable row level security;
alter table staff_assignments enable row level security;
alter table topics            enable row level security;
alter table topic_terms       enable row level security;
alter table learning_events   enable row level security;
alter table group_tasks       enable row level security;
