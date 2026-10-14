-- 005_parental_consent — согласие родителя отмечает куратор (решение 14.10.2026, docs/decisions.md)
-- Применять после 004. Затем: NOTIFY pgrst, 'reload schema';
--
-- Студенту младше 18 без согласия родителя прогресс не сохраняем (только демо).
-- Согласие родителя в сервис вносит только куратор — по документам колледжа:
--   paper        — родитель подписал бланк в колледже;
--   college_list — колледж собрал согласия раньше (например, при зачислении) и передал список.
-- В обоих случаях — consents (kind = 'parental', parent_name, document_ref, recorded_by = куратор).
-- Куратор может отметить согласие до первого входа студента — Telegram студента ещё неизвестен,
-- поэтому у согласия родителя telegram_user_id может быть пустым.
--
-- Сканы бланков не храним — бумага остаётся в колледже, у нас только ссылка, где она лежит
-- (document_ref: «личное дело № …», «список от 01.09.2026, приказ № …»).
-- Согласие родителя из Telegram студента не принимаем: проверить, что это родитель, нельзя.

alter table consents drop constraint consents_granted_via_check;
alter table consents
  add constraint consents_granted_via_check
    check (granted_via in ('telegram','paper','teacher','college_list')),
  add column document_ref text,
  alter column telegram_user_id drop not null;

alter table consents
  -- согласие самого студента — всегда с его Telegram
  add constraint consents_telegram_required
    check (kind = 'parental' or telegram_user_id is not null),
  -- согласие родителя — только от колледжа и всегда с указанием, где документ
  add constraint consents_parental_source
    check (kind <> 'parental' or (granted_via in ('paper','college_list') and document_ref is not null
                                    and recorded_by is not null)),
  -- из списка колледжа приходит только согласие родителя
  add constraint consents_college_list_parental
    check (granted_via <> 'college_list' or kind = 'parental');

-- Кто отметил согласие родителя — обязателен (проверка выше). Поэтому куратора, отметившего
-- согласия, не удаляем, а отключаем: удаление запрещено, а не «тихо обнуляет» recorded_by.
alter table consents drop constraint consents_recorded_by_fkey;
alter table consents
  add constraint consents_recorded_by_fkey
    foreign key (recorded_by) references users(id) on delete restrict;

-- Студента удалили (по сроку или по запросу) — отметки о согласии его родителя удаляем вместе с ним:
-- ФИО родителя и место бланка без студента не нужны. Бланк остаётся в колледже.
-- Согласие самого студента остаётся следом (user_id = null, telegram_user_id), как в 002.
create function consents_drop_parental() returns trigger
  language plpgsql set search_path = public as $$
begin
  delete from consents where user_id = old.id and kind = 'parental';
  return old;
end $$;

create trigger users_drop_parental_consents
  before delete on users
  for each row execute function consents_drop_parental();

-- Одно действующее согласие студента на одну версию текста: повторное нажатие
-- «Согласен» не создаёт дубль (api/ — insert … on conflict do nothing).
create unique index consents_one_active
  on consents (user_id, kind, doc_version)
  where revoked_at is null and kind = 'personal_data';
