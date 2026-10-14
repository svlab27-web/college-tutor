-- 004_personal_invites — личная одноразовая ссылка для каждого студента (#5)
-- Применять после 003. Затем: NOTIFY pgrst, 'reload schema';
--
-- Решение (Светлана, Эльвира, 14.10.2026, docs/decisions.md): личные данные студента вносит
-- куратор, а не сам студент — иначе можно ввести ФИО однокурсника или чужой год рождения.
--
--   1. Куратор один раз вносит группу (лучше списком колледжа): users без telegram_user_id
--      (ФИО с full_name_source = 'roster', дата рождения или хотя бы год) + group_members.
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
  add constraint invites_token_format check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  -- ссылка преподавателя (от администратора колледжа) — всегда со сроком
  add constraint invites_teacher_expires check (role = 'student' or expires_at is not null);

-- У студента одна действующая ссылка: новую выдаём только после отзыва старой
create unique index invites_one_active on invites (user_id)
  where used_at is null and revoked_at is null;
create index invites_group on invites (group_id, created_at desc);

-- По какой ссылке студент вошёл — для кабинета («кто уже вошёл») и проверки утечек
alter table group_members
  add column invite_token text references invites(token) on delete set null;

-- Дата рождения (решение 14.10.2026): если колледж её даёт, 18 лет считаем по ней —
-- требование согласия родителя снимается в день рождения. Нет даты — считаем по году
-- (год, в котором исполняется 18, — ещё несовершеннолетний). Год и дата не расходятся.
alter table users
  add column birth_date date check (birth_date between date '1950-01-01' and date '2020-12-31'),
  add constraint users_birth_date_year
    check (birth_date is null or (birth_year is not null and birth_year = extract(year from birth_date)));

-- invites.full_name (002) больше не нужен: ФИО студента куратор вносит в users.full_name,
-- ссылка лишь указывает на студента (user_id). Таблица пуста — данных не теряем.
alter table invites drop column full_name;
