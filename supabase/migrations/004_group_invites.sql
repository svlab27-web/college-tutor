-- 004_group_invites — ссылка на группу: одна на всех студентов группы, со сроком (#5)
-- Применять после 003. Затем: NOTIFY pgrst, 'reload schema';
--
-- Решение (Светлана, 13.10.2026): преподаватель раздаёт ОДНУ ссылку на группу
-- (в чат группы или QR на экране), ссылка действует ограниченное время.
-- Персональные одноразовые приглашения (преподавателю от колледжа, студенту по списку
-- с full_name) остаются: это та же таблица с max_uses = 1.
--
--   ссылка на группу:    max_uses = null или N,  expires_at обязателен
--   персональная:        max_uses = 1,           used_by / used_at — кто воспользовался
--
-- Токен = start_param из ссылки t.me/tutornvl_bot?startapp=<token> целиком
-- (например g_… — как в кабинете преподавателя). Telegram пропускает в start_param
-- только A-Z a-z 0-9 _ - и не длиннее 64 символов; короче 16 — легко подобрать.
--
-- Вступление (api/, PR 2) — в одной транзакции:
--   1. insert into group_members (…, invite_token) … on conflict do nothing returning …
--      ничего не вставилось → студент уже в группе, приглашение не расходуем;
--   2. update invites set uses = uses + 1 (+ used_by/used_at, если max_uses = 1)
--      where token = $1 and revoked_at is null
--        and (expires_at is null or expires_at > now())
--        and (max_uses is null or uses < max_uses)
--      returning group_id, role, full_name;
--      0 строк → rollback и понятная ошибка (истекла / отозвана / мест нет).

-- ── 1. Приглашения: многоразовые, с лимитом, отзыв ──────────
alter table invites
  add column max_uses   int check (max_uses is null or max_uses > 0),
  add column uses       int not null default 0 check (uses >= 0),
  add column revoked_at timestamptz,
  add column created_by uuid references users(id) on delete set null;

-- Всё, что было до 004, — персональные одноразовые приглашения
update invites set max_uses = 1, uses = case when used_by is not null then 1 else 0 end;
alter table invites alter column max_uses set default 1;

alter table invites
  add constraint invites_token_format check (token ~ '^[A-Za-z0-9_-]{16,64}$'),
  add constraint invites_uses_limit   check (max_uses is null or uses <= max_uses),
  -- многоразовая ссылка без срока не бывает (coalesce: при max_uses = null проверка иначе пропускает)
  add constraint invites_multi_expires check (coalesce(max_uses, 0) = 1 or expires_at is not null);

create index invites_group on invites (group_id, created_at desc);

-- ── 2. По какой ссылке студент вступил ────────────────────────
-- Для кабинета («кто пришёл по ссылке») и на случай отзыва утёкшей ссылки.
alter table group_members
  add column invite_token text references invites(token) on delete set null;
