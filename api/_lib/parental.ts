// Согласие родителя из списка колледжа (миграция 005, docs/decisions.md).
// Студент младше 18 указал ФИО и год → ищем его в списках своих групп.
// Совпала ровно одна свободная строка → пишем consents (granted_via = 'college_list').
// Ноль или несколько совпадений → ничего не делаем, решает преподаватель (бумага, кабинет #9).

import type postgres from 'postgres';

interface Candidate {
  id: string;
  parent_name: string;
  document_ref: string;
}

export async function matchCollegeList(
  sql: postgres.Sql,
  user: { id: string; full_name: string; birth_year: number },
  telegramUserId: number,
): Promise<boolean> {
  // Ключ ФИО — так же, как full_name_key в 005: пробелы, регистр, ё/е
  const candidates = await sql<Candidate[]>`
    select l.id, l.parent_name, l.document_ref
      from parental_consent_list l
      join group_members m on m.group_id = l.group_id and m.user_id = ${user.id} and m.role = 'student'
     where l.full_name_key = replace(lower(regexp_replace(btrim(${user.full_name}::text), '\s+', ' ', 'g')), 'ё', 'е')
       and (l.birth_year is null or l.birth_year = ${user.birth_year})
       and l.matched_user_id is null`;
  if (candidates.length !== 1) return false;
  const [row] = candidates;

  try {
    return await sql.begin(async (tx) => {
      const taken = await tx`
        update parental_consent_list set matched_user_id = ${user.id}, matched_at = now()
         where id = ${row.id} and matched_user_id is null
        returning 1`;
      if (taken.length === 0) return false; // строку только что занял другой запрос
      await tx`
        insert into consents (user_id, telegram_user_id, kind, doc_version, granted_via, parent_name, document_ref)
        values (${user.id}, ${telegramUserId}, 'parental', 'college_list', 'college_list',
                ${row.parent_name}, ${row.document_ref})`;
      return true;
    });
  } catch (error) {
    // Этот студент уже привязан к другой строке списка (unique по matched_user_id)
    if ((error as { code?: string }).code === '23505') return false;
    throw error;
  }
}
