-- 006_curator — под кабинет куратора (#9, PR #42)
-- Применять после 005. Затем: NOTIFY pgrst, 'reload schema';
--
-- 1. Одно действующее согласие родителя на студента.
--    Кабинет проверяет «уже отмечено» через select … for update, но при пустом результате
--    блокировать нечего — два быстрых нажатия «Отметить» записали бы две отметки.
--    Теперь вторая упирается в индекс: api/ отвечает 409 parental_exists (код 23505).
--    Снятая отметка (revoked_at) не мешает отметить заново.
--    Перед применением в рабочей базе — проверить, что дублей нет (запрос в docs/database.md, п. 6).
create unique index consents_one_parental
  on consents (user_id)
  where kind = 'parental' and revoked_at is null;

-- 2. Индексы под запросы кабинета
-- «студент моей группы?» и список групп студента — по user_id (первичный ключ начинается с group_id)
create index group_members_user on group_members (user_id);
-- открытые обращения студента в списке группы (name_errors, open_help)
create index help_requests_user_new on help_requests (user_id) where status = 'new';
-- обращения группы для куратора, новые сверху
create index help_requests_group on help_requests (group_id, status, created_at desc);
-- прогресс по уроку («кто застрял», часть 2 кабинета)
create index attempts_lesson on attempts (lesson_id, created_at);
