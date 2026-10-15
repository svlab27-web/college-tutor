// Синхронизация уроков: content/**/*.json → lessons, *.kk.json → lesson_translations (docs/api.md, п. 3).
//
//   npm run lessons:check   — только проверка файлов (без базы; так же в CI на каждом PR)
//   npm run lessons:sync    — проверка + запись в базу из DATABASE_URL (одна транзакция)
//
// Правила:
//   • урок — одна запись lessons (subject_id, slug, version = 1); повторный запуск обновляет её,
//     id не меняется — прогресс и попытки студентов не теряются;
//   • is_published = status «approved» (утверждает преподаватель); approved_by — из файла;
//   • перевод kk — в lesson_translations со своим status (draft / review / approved);
//   • уроки, которых больше нет в content/, не удаляем (на них ссылаются попытки) — только сообщаем;
//   • хоть одна ошибка в файлах — в базу ничего не пишем.
// Строку подключения берём из окружения, в репозиторий и логи она не попадает.

import { resolve } from 'node:path';
import type postgres from 'postgres';
import { closeDb, db } from '../api/_lib/db';
import { loadContent, type LessonPair } from './lessons';

export interface SyncReport {
  inserted: string[];
  updated: string[];
  unchanged: string[];
  translations: string[];
  notInContent: string[];
}

export async function syncLessons(sql: postgres.Sql, lessons: LessonPair[]): Promise<SyncReport> {
  const report: SyncReport = { inserted: [], updated: [], unchanged: [], translations: [], notInContent: [] };
  await sql.begin(async (tx) => {
    for (const { base, translations } of lessons) {
      const c = base.content;
      const name = `${base.subject}/${base.slug}`;
      const published = c.status === 'approved';
      const approvedBy = typeof c.approved_by === 'string' ? c.approved_by : null;
      const [row] = await tx<{ id: string; inserted: boolean; changed: boolean }[]>`
        insert into lessons (subject_id, slug, title, version, content, language, is_published, approved_by)
        values (${base.subject}, ${base.slug}, ${c.title as string}, 1, ${tx.json(c as never)}, 'ru', ${published}, ${approvedBy})
        on conflict (subject_id, slug, version) do update
          set title = excluded.title, content = excluded.content, language = excluded.language,
              is_published = excluded.is_published, approved_by = excluded.approved_by
          where lessons.content is distinct from excluded.content
             or lessons.is_published is distinct from excluded.is_published
             or lessons.approved_by is distinct from excluded.approved_by
        returning id, (xmax = 0) as inserted, true as changed`;
      if (!row) report.unchanged.push(name);
      else (row.inserted ? report.inserted : report.updated).push(name);
      const [{ id }] = row ? [row] : await tx<{ id: string }[]>`
        select id from lessons where subject_id = ${base.subject} and slug = ${base.slug} and version = 1`;

      for (const t of translations) {
        const status = t.content.status as string;
        await tx`
          insert into lesson_translations (lesson_id, language, content, status, approved_by, approved_at, updated_at)
          values (${id}, ${t.language}, ${tx.json(t.content as never)}, ${status},
                  ${typeof t.content.approved_by === 'string' ? t.content.approved_by : null},
                  ${status === 'approved' ? new Date() : null}, now())
          on conflict (lesson_id, language) do update
            set content = excluded.content, status = excluded.status, approved_by = excluded.approved_by,
                approved_at = case when excluded.status = 'approved'
                                   then coalesce(lesson_translations.approved_at, excluded.approved_at) end,
                updated_at = now()
            where lesson_translations.content is distinct from excluded.content
               or lesson_translations.status is distinct from excluded.status`;
        report.translations.push(`${name} (${t.language}, ${status})`);
      }
    }
    const known = new Set(lessons.map((l) => `${l.base.subject}/${l.base.slug}`));
    const rows = await tx<{ k: string }[]>`select subject_id || '/' || slug as k from lessons`;
    report.notInContent = rows.map((r) => r.k).filter((k) => !known.has(k));
  });
  return report;
}

async function main() {
  const checkOnly = process.argv.includes('--check');
  const root = resolve(process.argv.find((a) => a.startsWith('--content='))?.slice(10) ?? 'content');
  const { lessons, errors } = loadContent(root);
  if (errors.length) {
    console.error(`Ошибки в уроках (${errors.length}) — в базу ничего не записано:`);
    for (const e of errors) console.error(`  ✗ ${e}`);
    process.exit(1);
  }
  const nT = lessons.reduce((n, l) => n + l.translations.length, 0);
  console.log(`✓ Уроки проверены: ${lessons.length}, переводов: ${nT}`);
  for (const l of lessons) {
    console.log(`  ${l.base.subject}/${l.base.slug} — ${l.base.content.status}${l.translations.map((t) => `, ${t.language}: ${t.content.status}`).join('')}`);
  }
  if (checkOnly) return;

  try {
    const r = await syncLessons(db(), lessons);
    console.log(`✓ База: новых ${r.inserted.length}, обновлено ${r.updated.length}, без изменений ${r.unchanged.length}; переводов ${r.translations.length}`);
    if (r.notInContent.length) console.log(`  В базе есть уроки, которых нет в content/ (не удалены): ${r.notInContent.join(', ')}`);
    const draft = lessons.filter((l) => l.base.content.status !== 'approved').map((l) => `${l.base.subject}/${l.base.slug}`);
    if (draft.length) console.log(`  Ещё не опубликованы (status ≠ approved): ${draft.join(', ')}`);
  } finally {
    await closeDb();
  }
}

if (require.main === module) {
  main().catch((e) => {
    console.error('Синхронизация не удалась:', (e as Error).message);
    process.exit(1);
  });
}
