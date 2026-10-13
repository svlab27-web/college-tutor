-- 005_parental_consent — согласие родителя: бумага в колледже + список колледжа (решение 13.10.2026)
-- Применять после 004. Затем: NOTIFY pgrst, 'reload schema';
--
-- Студенту младше 18 без согласия родителя прогресс не сохраняем (только демо).
-- Согласие родителя в сервис попадает двумя путями — оба от колледжа, не от студента:
--
--   А. paper        — родитель подписал бланк в колледже, преподаватель отмечает в кабинете (#9):
--                     consents (kind = 'parental', granted_via = 'paper', parent_name, document_ref, recorded_by)
--   В. college_list — колледж уже собрал согласия (например, при зачислении) и передал список:
--                     строки parental_consent_list; при первом входе студента api/ находит его
--                     в списке своей группы по ФИО (+ год рождения) и пишет consents
--                     (granted_via = 'college_list', document_ref из списка).
--
-- Сканы бланков не храним — бумага остаётся в колледже, у нас только ссылка, где она лежит
-- (document_ref: «личное дело № …», «список от 01.09.2026, приказ № …»).
-- Согласие родителя из Telegram студента не принимаем: проверить, что это родитель, нельзя.

-- ── 1. consents: новый способ и ссылка на документ ───────────
alter table consents drop constraint consents_granted_via_check;
alter table consents
  add constraint consents_granted_via_check
    check (granted_via in ('telegram','paper','teacher','college_list')),
  add column document_ref text;

alter table consents
  -- согласие родителя — только от колледжа и всегда с указанием, где документ
  add constraint consents_parental_source
    check (kind <> 'parental' or (granted_via in ('paper','college_list') and document_ref is not null)),
  -- из списка колледжа приходит только согласие родителя
  add constraint consents_college_list_parental
    check (granted_via <> 'college_list' or kind = 'parental');

-- ── 2. Список колледжа ────────────────────────────────────────
-- Загружает преподаватель или админ (кабинет, #9). Студентов в базе ещё нет — они появятся
-- при первом входе, поэтому сверяем по группе и ФИО. Одна строка списка — один студент.
create table parental_consent_list (
  id              uuid primary key default gen_random_uuid(),
  group_id        uuid not null references groups(id) on delete cascade,
  full_name       text not null,                -- ФИО студента, как в документах колледжа
  full_name_key   text generated always as (
                    replace(lower(regexp_replace(btrim(full_name), '\s+', ' ', 'g')), 'ё', 'е')
                  ) stored,                     -- для сверки: регистр, лишние пробелы, ё/е
  birth_year      smallint check (birth_year between 1950 and 2020),  -- если есть — сверяем и его
  parent_name     text not null,
  document_ref    text not null,
  uploaded_by     uuid references users(id) on delete set null,
  matched_user_id uuid references users(id) on delete set null,       -- кого нашли при входе
  matched_at      timestamptz,
  created_at      timestamptz not null default now(),
  unique (group_id, full_name_key)
);
-- одна строка списка не может подтвердить двух студентов
create unique index parental_consent_list_matched on parental_consent_list (matched_user_id)
  where matched_user_id is not null;

alter table parental_consent_list enable row level security;
