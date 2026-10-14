-- 004_personal_invites — личная одноразовая ссылка для каждого студента (#5)
-- Применять после 003. Затем: NOTIFY pgrst, 'reload schema';
--
-- Решение (Светлана, Эльвира, 14.10.2026, docs/decisions.md): личные данные студента вносит
-- куратор, а не сам студент — иначе можно ввести ФИО однокурсника или чужой год рождения.
--
--   1. Куратор один раз вносит группу (лучше списком колледжа): users без telegram_user_id
--      (ФИО с full_name_source = 'roster', год рождения) + group_members.
--   2. На каждого студента — личная одноразовая ссылка: invites.user_id = этот студент.
--      Общей ссылки группы для реальных студентов нет.
--   3. Студент открывает t.me/tutornvl_bot?startapp=<token>: api/ в одной транзакции
--      записывает его Telegram в users.telegram_user_id и помечает ссылку использованной.
--      Свои ФИО и год студент не вводит и не меняет.
--   4. Ссылка утекла или потерялась — куратор отзывает её (revoked_at) и выдаёт новую.
--   Преподавателя так же приглашает администратор колледжа — личной ссылкой со сроком.
--
-- Токен = start_param из ссылки целиком: Telegram пропускает только A-Z a-z 0-9 _ -
-- и не длиннее 64 символов; короче 16 — легко подобрать.

alter table invites
  add column user_id    uuid references users(id) on delete cascade,  -- чья это ссылка
  add column revoked_at timestamptz,
  add column created_by uuid references users(id) on delete set null; -- куратор / админ

-- До 004 приглашений не выдавали (таблица пустая) — ссылка без студента не бывает
alter table invites alter column user_id set not null;

alter table invites
  add constraint invites_token_format check (token ~ '^[A-Za-z0-9_-]{16,64}$');

-- У студента одна действующая ссылка: новую выдаём только после отзыва старой
create unique index invites_one_active on invites (user_id)
  where used_at is null and revoked_at is null;
create index invites_group on invites (group_id, created_at desc);

-- По какой ссылке студент вошёл — для кабинета («кто уже вошёл») и проверки утечек
alter table group_members
  add column invite_token text references invites(token) on delete set null;
