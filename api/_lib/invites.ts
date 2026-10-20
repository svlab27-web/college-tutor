// Вход по личной ссылке (миграция 004, решение 14.10.2026).
// Студента заранее заводит куратор (ФИО, год, группа). Ссылка одноразовая и принадлежит
// одному студенту: при первом входе привязываем к нему Telegram — одна транзакция.
// Сотрудник входит так же — по ссылке invites.role = 'staff' (007, #63): без группы,
// что он видит, решают staff_roles и staff_assignments (api/_lib/staff.ts).

import type postgres from 'postgres';

export type JoinStatus =
  | 'joined' // ссылка привязана к этому Telegram
  | 'already_yours' // своя ссылка, открыта повторно
  | 'used' // ссылкой уже вошёл другой Telegram
  | 'already_registered' // этот Telegram уже привязан к другому человеку
  | 'invalid'
  | 'expired'
  | 'revoked';

export interface JoinResult {
  status: JoinStatus;
  group?: { id: string; title: string };
  staff?: true; // вошёл сотрудник — интерфейсу открыть кабинет
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,64}$/; // как invites_token_format в 004

// start_param бывает и не приглашением (демо-ссылки startapp=student / teacher)
export function isInviteToken(value: string | undefined): value is string {
  return value !== undefined && TOKEN_FORMAT.test(value);
}

interface InviteRow {
  user_id: string;
  group_id: string | null;
  group_title: string | null;
  role: 'student' | 'teacher' | 'staff';
  used: boolean;
  expired: boolean;
  revoked: boolean;
  user_has_telegram: boolean;
}

class Rejected extends Error {
  constructor(public readonly status: JoinStatus) {
    super(status);
  }
}

export async function bindInvite(sql: postgres.Sql, telegramUserId: number, token: string): Promise<JoinResult> {
  try {
    return await sql.begin(async (tx) => {
      // Ссылка отключённого сотрудника (007, disabled_at) — как несуществующая
      const [invite] = await tx<InviteRow[]>`
        select i.user_id, i.group_id, g.title as group_title, i.role,
               (i.used_at is not null) as used,
               (i.expires_at is not null and i.expires_at <= now()) as expired,
               (i.revoked_at is not null) as revoked,
               (u.telegram_user_id is not null) as user_has_telegram
          from invites i
          left join groups g on g.id = i.group_id
          join users u on u.id = i.user_id and u.disabled_at is null
         where i.token = ${token}
         for update of i, u`;
      if (!invite) throw new Rejected('invalid');
      const staff = invite.role === 'staff' ? { staff: true as const } : {};
      const group = invite.group_id ? { group: { id: invite.group_id, title: invite.group_title! } } : {};

      const [current] = await tx<{ id: string }[]>`
        select id from users where telegram_user_id = ${telegramUserId}`;
      const isOwner = current?.id === invite.user_id;

      // Название группы — только владельцу ссылки: постороннему не раскрываем, чья это ссылка
      if (invite.used) return isOwner ? { status: 'already_yours', ...group, ...staff } : { status: 'used' };
      if (invite.revoked) throw new Rejected('revoked');
      if (invite.expired) throw new Rejected('expired');
      if (current && !isOwner) throw new Rejected('already_registered');
      // У студента уже другой Telegram (вошёл по прежней ссылке) — новая ссылка не перепривязывает
      if (invite.user_has_telegram && !isOwner) throw new Rejected('used');

      await tx`
        update users set telegram_user_id = ${telegramUserId}
         where id = ${invite.user_id} and telegram_user_id is null`;
      await tx`
        update invites set used_by = ${invite.user_id}, used_at = now()
         where token = ${token}`;
      if (invite.group_id && invite.role !== 'staff') {
        await tx`
          insert into group_members (group_id, user_id, role, invite_token)
          values (${invite.group_id}, ${invite.user_id}, ${invite.role}, ${token})
          on conflict (group_id, user_id) do update set invite_token = excluded.invite_token`;
      }
      // Прежняя ссылка преподавателя группы (004): права теперь из staff_assignments — куратор группы
      if (invite.group_id && invite.role === 'teacher') {
        await tx`
          insert into staff_assignments (user_id, group_id, role)
          values (${invite.user_id}, ${invite.group_id}, 'curator')
          on conflict do nothing`;
      }
      return { status: 'joined', ...group, ...staff };
    });
  } catch (error) {
    if (error instanceof Rejected) return { status: error.status };
    // Этот Telegram одновременно привязывают к двум людям (две ссылки открыты разом):
    // одна транзакция успела, вторая упёрлась в unique (telegram_user_id)
    if ((error as { code?: string }).code === '23505') return { status: 'already_registered' };
    throw error;
  }
}
