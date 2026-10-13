// Вступление в группу по ссылке (миграция 004, порядок — в её шапке).
// Одна транзакция: студент уже в группе → ссылка не расходуется;
// ссылка истекла / отозвана / мест нет → ничего не меняем.

import type postgres from 'postgres';

export type JoinStatus = 'joined' | 'already_member' | 'invalid' | 'expired' | 'revoked' | 'full';

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
  group_id: string;
  group_title: string;
  role: 'student' | 'teacher';
  full_name: string | null;
  max_uses: number | null;
  uses: number;
  expired: boolean;
  revoked: boolean;
}

class Rejected extends Error {
  constructor(public readonly status: JoinStatus) {
    super(status);
  }
}

export async function joinByInvite(sql: postgres.Sql, userId: string, token: string): Promise<JoinResult> {
  try {
    return await sql.begin(async (tx) => {
      const [invite] = await tx<InviteRow[]>`
        select i.group_id, g.title as group_title, i.role, i.full_name, i.max_uses, i.uses,
               (i.expires_at is not null and i.expires_at <= now()) as expired,
               (i.revoked_at is not null) as revoked
          from invites i join groups g on g.id = i.group_id
         where i.token = ${token}
         for update of i`;
      if (!invite) throw new Rejected('invalid');
      const group = { id: invite.group_id, title: invite.group_title };

      const inserted = await tx`
        insert into group_members (group_id, user_id, role, invite_token)
        values (${invite.group_id}, ${userId}, ${invite.role}, ${token})
        on conflict (group_id, user_id) do nothing
        returning 1`;
      if (inserted.length === 0) return { status: 'already_member', group } as JoinResult;

      if (invite.revoked) throw new Rejected('revoked');
      if (invite.expired) throw new Rejected('expired');
      if (invite.max_uses !== null && invite.uses >= invite.max_uses) throw new Rejected('full');

      await tx`
        update invites
           set uses    = uses + 1,
               used_by = case when max_uses = 1 then ${userId}::uuid else used_by end,
               used_at = case when max_uses = 1 then now() else used_at end
         where token = ${token}`;

      // Персональное приглашение: ФИО из списка колледжа, роль преподавателя
      if (invite.full_name) {
        await tx`
          update users set full_name = ${invite.full_name}, full_name_source = 'roster'
           where id = ${userId} and full_name is null`;
      }
      if (invite.role === 'teacher') {
        await tx`update users set role = 'teacher' where id = ${userId} and role = 'student'`;
      }
      return { status: 'joined', group } as JoinResult;
    });
  } catch (error) {
    if (error instanceof Rejected) return { status: error.status };
    throw error;
  }
}
