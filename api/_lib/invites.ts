// Вход по личной ссылке (миграция 004, решение 14.10.2026).
// Студента заранее заводит куратор (ФИО, год, группа). Ссылка одноразовая и принадлежит
// одному студенту: при первом входе привязываем к нему Telegram — одна транзакция.

import type postgres from 'postgres';

export type JoinStatus =
  | 'joined' // ссылка привязана к этому Telegram
  | 'already_yours' // своя ссылка, открыта повторно
  | 'used' // ссылкой уже вошёл другой Telegram
  | 'already_registered' // этот Telegram уже привязан к другому студенту
  | 'invalid'
  | 'expired'
  | 'revoked';

export interface JoinResult {
  status: JoinStatus;
  group?: { id: string; title: string };
}

const TOKEN_FORMAT = /^[A-Za-z0-9_-]{16,64}$/; // как invites_token_format в 004

// start_param бывает и не приглашением (демо-ссылки startapp=student / teacher)
export function isInviteToken(value: string | undefined): value is string {
  return value !== undefined && TOKEN_FORMAT.test(value);
}

interface InviteRow {
  user_id: string;
  group_id: string;
  group_title: string;
  role: 'student' | 'teacher';
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
      const [invite] = await tx<InviteRow[]>`
        select i.user_id, i.group_id, g.title as group_title, i.role,
               (i.used_at is not null) as used,
               (i.expires_at is not null and i.expires_at <= now()) as expired,
               (i.revoked_at is not null) as revoked,
               (u.telegram_user_id is not null) as user_has_telegram
          from invites i
          join groups g on g.id = i.group_id
          join users u on u.id = i.user_id
         where i.token = ${token}
         for update of i, u`;
      if (!invite) throw new Rejected('invalid');
      const group = { id: invite.group_id, title: invite.group_title };

      const [current] = await tx<{ id: string }[]>`
        select id from users where telegram_user_id = ${telegramUserId}`;
      const isOwner = current?.id === invite.user_id;

      if (invite.used) return { status: isOwner ? 'already_yours' : 'used', group } as JoinResult;
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
      await tx`
        insert into group_members (group_id, user_id, role, invite_token)
        values (${invite.group_id}, ${invite.user_id}, ${invite.role}, ${token})
        on conflict (group_id, user_id) do update set invite_token = excluded.invite_token`;
      return { status: 'joined', group } as JoinResult;
    });
  } catch (error) {
    if (error instanceof Rejected) return { status: error.status };
    throw error;
  }
}
