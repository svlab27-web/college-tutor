// Уроки content/ → SQL для Supabase SQL Editor — когда строки подключения под рукой нет.
// DATABASE_URL в Vercel помечена Sensitive: посмотреть её нельзя, а сбрасывать пароль базы ради загрузки
// уроков — риск уронить прод (так было 15.10). SQL Editor работает без пароля, под входом в Supabase.
//
//   npm run --silent lessons:sql > lessons.sql            — загрузка: то же, что lessons:sync (syncLessons)
//   npm run --silent lessons:sql -- --verify > verify.sql  — проверка: тексты в базе = файлам, ответ «всё совпадает: N из N»
//
// Копировать в буфер — только как UTF-8 (иначе русский текст станет кракозябрами, 16.10 так и было):
//   LANG=en_US.UTF-8 pbcopy < lessons.sql
// Повторный запуск безопасен: те же записи обновляются, id уроков не меняются — прогресс сохраняется.

import { resolve } from 'node:path';
import { loadContent, type Obj } from './lessons';

const lit = (s: unknown) => (s === null || s === undefined ? 'null' : `'${String(s).replace(/'/g, "''")}'`);

function json(o: unknown): string {
  const t = JSON.stringify(o);
  let tag = 'j';
  while (t.includes(`$${tag}$`)) tag += 'x';
  return `$${tag}$${t}$${tag}$::jsonb`;
}

const approvedBy = (c: Obj) => (typeof c.approved_by === 'string' ? c.approved_by : null);
const lessonRef = (subject: string, slug: string) =>
  `(select id from lessons where subject_id = ${lit(subject)} and slug = ${lit(slug)} and version = 1)`;

export function syncSql(root: string): string {
  const { lessons, errors } = loadContent(root);
  if (errors.length) throw new Error(`Ошибки в уроках — SQL не собран:\n${errors.join('\n')}`);
  const out = [
    '-- Уроки «Мой колледж» → база (то же, что npm run lessons:sync). Собрано: npm run lessons:sql',
    '-- Повторный запуск безопасен: те же записи обновляются, id уроков не меняются — прогресс сохраняется.',
    'begin;',
  ];
  for (const { base, translations } of lessons) {
    const c = base.content;
    out.push(`
-- ${base.subject}/${base.slug}
insert into lessons (subject_id, slug, title, version, content, language, is_published, approved_by)
values (${lit(base.subject)}, ${lit(base.slug)}, ${lit(c.title)}, 1, ${json(c)}, 'ru', ${c.status === 'approved'}, ${lit(approvedBy(c))})
on conflict (subject_id, slug, version) do update
  set title = excluded.title, content = excluded.content, language = excluded.language,
      is_published = excluded.is_published, approved_by = excluded.approved_by
  where lessons.content is distinct from excluded.content
     or lessons.is_published is distinct from excluded.is_published
     or lessons.approved_by is distinct from excluded.approved_by;`);
    for (const t of translations) {
      const st = t.content.status as string;
      out.push(`insert into lesson_translations (lesson_id, language, content, status, approved_by, approved_at, updated_at)
values (${lessonRef(base.subject, base.slug)}, ${lit(t.language)}, ${json(t.content)}, ${lit(st)}, ${lit(approvedBy(t.content))},
        ${st === 'approved' ? 'now()' : 'null'}, now())
on conflict (lesson_id, language) do update
  set content = excluded.content, status = excluded.status, approved_by = excluded.approved_by,
      approved_at = case when excluded.status = 'approved'
                         then coalesce(lesson_translations.approved_at, excluded.approved_at) end,
      updated_at = now()
  where lesson_translations.content is distinct from excluded.content
     or lesson_translations.status is distinct from excluded.status;`);
    }
  }
  out.push(`
commit;

-- Что теперь в базе
select subject_id, slug, is_published as опубликован, approved_by as утвердил,
       (content->>'week')::int as неделя, (content->>'order')::int as номер
  from lessons where version = 1 order by subject_id, неделя nulls first, номер;`);
  return out.join('\n') + '\n';
}

// Проверка: содержимое каждого урока и перевода в базе равно файлу (сравнение jsonb, без контрольных сумм)
export function verifySql(root: string): string {
  const { lessons, errors } = loadContent(root);
  if (errors.length) throw new Error(`Ошибки в уроках — SQL не собран:\n${errors.join('\n')}`);
  const rows: string[] = [];
  for (const { base, translations } of lessons) {
    rows.push(`('урок', ${lit(`${base.subject}/${base.slug}`)}, ${json(base.content)}, ${base.content.status === 'approved'})`);
    for (const t of translations) rows.push(`('перевод ${t.language}', ${lit(`${base.subject}/${base.slug}`)}, ${json(t.content)}, null)`);
  }
  return `-- Проверка: уроки в базе совпадают с файлами content/. Ожидается одна строка «всё совпадает: N из N».
with expected(kind, lesson, content, published) as (values
  ${rows.join(',\n  ')}
), actual as (
  select 'урок' as kind, subject_id || '/' || slug as lesson, content, is_published as published from lessons where version = 1
  union all
  select 'перевод ' || t.language, l.subject_id || '/' || l.slug, t.content, null from lesson_translations t join lessons l on l.id = t.lesson_id
), cmp as (
  select e.kind, e.lesson, (a.content is not distinct from e.content and a.published is not distinct from e.published) as ok
    from expected e left join actual a on a.kind = e.kind and a.lesson = e.lesson
)
select case when bool_and(ok) then 'всё совпадает: ' || count(*) || ' из ' || count(*)
            else 'НЕ совпадает: ' || string_agg(kind || ' ' || lesson, ', ') filter (where not ok) end as итог
  from cmp;
`;
}

if (require.main === module) {
  const root = resolve(process.argv.find((a) => a.startsWith('--content='))?.slice(10) ?? 'content');
  try {
    process.stdout.write(process.argv.includes('--verify') ? verifySql(root) : syncSql(root));
  } catch (e) {
    console.error((e as Error).message);
    process.exit(1);
  }
}
