-- 003_lesson_languages — уроки на русском и казахском (#15)
-- Применять после 002. Затем: NOTIFY pgrst, 'reload schema';
--
-- Принцип: урок — ОДНА запись в lessons с общими step_id, эталонами и тестами.
--   lessons.content       — урок на основном языке (ru): структура + тексты + эталоны.
--   lesson_translations   — тексты на других языках (kk) для той же записи урока.
-- Прогресс (progress, attempts) ссылается на lesson_id, поэтому смена языка
-- посреди урока прогресс не теряет.
--
-- Файлы в content/:
--   python/01-skidka-v-kafe.json     — основной (ru), language: "ru"
--   python/01-skidka-v-kafe.kk.json  — перевод (kk), language: "kk", тот же slug
-- Синхронизация (отдельная задача): .json → lessons.content, .kk.json → lesson_translations.
-- Перевод принимается, только если совпадает структура с основным файлом:
-- те же step id, answer_type, expected, tests, число options и hints.
-- Переводятся только тексты: title, story, material, prompt, options, hints,
-- common_mistakes.feedback, solution.
-- Как и в 001/002: RLS включён, политик нет — доступ только через api/.

-- ── 1. Основной язык урока ───────────────────────────────────
alter table lessons
  add column language text not null default 'ru' check (language in ('ru','kk'));

-- ── 2. Переводы урока ────────────────────────────────────────
create table lesson_translations (
  lesson_id    uuid not null references lessons(id) on delete cascade,
  language     text not null check (language in ('ru','kk')),
  content      jsonb not null,               -- урок целиком на этом языке, как в файле .kk.json
  status       text not null default 'draft' check (status in ('draft','review','approved')),
  approved_by  text,                         -- кто проверил перевод (носитель языка)
  approved_at  timestamptz,
  updated_at   timestamptz not null default now(),
  primary key (lesson_id, language)
);

-- ── 3. Язык интерфейса студента ──────────────────────────────
-- null = ещё не выбирал → берём language_code из Telegram, затем groups.language
alter table users
  add column ui_language text check (ui_language in ('ru','kk'));

-- ── 4. На каком языке студент работал ───────────────────────
-- Для отчётов преподавателю и проверки ответов AI на казахском.
alter table attempts
  add column language text check (language in ('ru','kk'));

alter table ai_messages
  add column language text check (language in ('ru','kk'));

-- ── RLS ───────────────────────────────────────────────────────
alter table lesson_translations enable row level security;
