// Администратор колледжа → SQL для SQL Editor / psql (#63). Остальных сотрудников и группы
// администратор заводит сам в кабинете (/api/admin/*) — решение 18.10.2026: колледж не зависит от нас.
//
//   npm run --silent staff:sql -- --admin="Фамилия Имя" > admin.sql    — новый администратор колледжа
//   npm run --silent staff:sql -- --recover="Фамилия Имя" > admin.sql  — восстановить доступ администратору:
//        сменил телефон, уволились все администраторы, отключили по ошибке. Отвязывает прежний Telegram,
//        снимает «отключён», возвращает роль администратора, выдаёт новую ссылку.
//
// Ссылка (48 ч, одноразовая) печатается в терминал, в admin.sql — только сам код. Передать человеку лично;
// в чат, в репозиторий и в задачи — не класть. Файл admin.sql после запуска удалить.
// Бот для ссылки: --bot=имя_бота (по умолчанию tutornvl_bot).
// Копировать SQL в буфер — только как UTF-8 (см. scripts/lessons-sql.ts).

import { newInviteToken } from '../api/_lib/curator';
import { STAFF_INVITE_HOURS } from '../api/_lib/routes/admin';

const lit = (s: string) => `'${s.replace(/'/g, "''")}'`;
const NAME = /^[\p{L}][\p{L}\p{M}' .-]{1,118}[\p{L}.]$/u;

function cleanName(name: string): string {
  const n = name.trim().replace(/\s+/g, ' ');
  if (!NAME.test(n) || !n.includes(' ')) throw new Error('ФИО: фамилия и имя буквами, до 120 символов.');
  return n;
}

const invite = (token: string, who: string) =>
  `insert into invites (token, group_id, role, user_id, expires_at)
    values (${lit(token)}, null, 'staff', ${who}, now() + interval '${STAFF_INVITE_HOURS} hours');`;

export function adminSql(fullName: string, token: string): string {
  const name = cleanName(fullName);
  return `-- Новый администратор колледжа «Мой колледж»: ${name}. Собрано: npm run staff:sql
begin;
do $$
declare uid uuid;
begin
  insert into users (full_name, full_name_source, role) values (${lit(name)}, 'roster', 'teacher') returning id into uid;
  insert into staff_roles (user_id, role) values (uid, 'admin');
  ${invite(token, 'uid')}
end $$;
commit;

select u.full_name as администратор, i.expires_at as ссылка_действует_до
  from invites i join users u on u.id = i.user_id where i.token = ${lit(token)};
`;
}

export function recoverSql(fullName: string, token: string): string {
  const name = cleanName(fullName);
  return `-- Восстановить доступ администратору колледжа «Мой колледж»: ${name}. Собрано: npm run staff:sql
-- Прежний Telegram отвязывается, прежние ссылки отзываются. Если сотрудников с таким ФИО не один — ничего не меняется.
begin;
do $$
declare uid uuid; n int;
begin
  select count(*) into n from users where role in ('teacher','admin') and lower(full_name) = lower(${lit(name)});
  if n <> 1 then
    raise exception 'Сотрудников с ФИО «%»: % (нужен ровно один). Проверьте написание.', ${lit(name)}, n;
  end if;
  select id into uid from users where role in ('teacher','admin') and lower(full_name) = lower(${lit(name)});
  update users set disabled_at = null, telegram_user_id = null where id = uid;
  insert into staff_roles (user_id, role) values (uid, 'admin') on conflict do nothing;
  update invites set revoked_at = now() where user_id = uid and used_at is null and revoked_at is null;
  ${invite(token, 'uid')}
end $$;
commit;

select u.full_name as администратор, i.expires_at as ссылка_действует_до
  from invites i join users u on u.id = i.user_id where i.token = ${lit(token)};
`;
}

export const linkOf = (bot: string, token: string) => `https://t.me/${bot}?startapp=${token}`;

if (require.main === module) {
  const arg = (key: string) => process.argv.find((a) => a.startsWith(`--${key}=`))?.slice(key.length + 3);
  const bot = arg('bot') ?? 'tutornvl_bot';
  const admin = arg('admin');
  const recover = arg('recover');
  try {
    if (!admin === !recover) throw new Error('Укажите одно: --admin="Фамилия Имя" или --recover="Фамилия Имя".');
    if (!/^[A-Za-z0-9_]{5,32}$/.test(bot)) throw new Error('--bot: имя бота без @.');
    const token = newInviteToken();
    process.stdout.write(admin ? adminSql(admin, token) : recoverSql(recover!, token));
    // Ссылка — в терминал (stderr), не в файл с SQL
    console.error(`\nСсылка для входа (действует ${STAFF_INVITE_HOURS} ч после выполнения SQL, одноразовая):\n${linkOf(bot, token)}\n` +
      'Передайте её человеку лично и попросите открыть в Telegram на своём телефоне.');
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
