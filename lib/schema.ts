// ─── اسکیمای دیتابیس کارگردان ──────────────────────────────────────
//
// ⚠️ قواعد ایمنی — تغییرشان نده:
//   ۱. تمام دستورهای این فایل با `IF NOT EXISTS` هستند ⇒ اجرای چندباره بی‌خطر است (idempotent).
//   ۲. هیچ DROP / DELETE / TRUNCATE / ALTER … DROP در این فایل نیست.
//   ۳. هیچ داده‌ای پاک یا بازنویسی نمی‌شود. فقط جدول‌های نبوده ساخته می‌شوند.
//   ۴. اگر جدولی از قبل با ساختار متفاوت وجود داشته باشد، دست‌نخورده می‌ماند
//      (کاربر تصمیم می‌گیرد؛ ایجنت خودسرانه ALTER نمی‌زند).
//
// 🗑 طراحی «سطل بازیافت»: هیچ حذف واقعی‌ای وجود ندارد.
//    هر جدول یک ستون `deleted_at` دارد. حذف = پر کردن این ستون.
//    ردیف حذف‌شده همچنان در دیتابیس می‌ماند و از سطل بازیافت برمی‌گردد.

import type { Pool } from 'pg';

/** پیشوند همهٔ جدول‌ها — تا در دیتابیس مشترک، با جدول‌های دیگر قاطی نشود */
export const TABLE_PREFIX = 'kargardan_';

export const TABLES = {
  tasks: `${TABLE_PREFIX}tasks`,
  projects: `${TABLE_PREFIX}projects`,
  inbox: `${TABLE_PREFIX}inbox`,
  settings: `${TABLE_PREFIX}settings`,
  suggestions: `${TABLE_PREFIX}suggestions`,
  history: `${TABLE_PREFIX}history`,
  meta: `${TABLE_PREFIX}meta`,
} as const;

/** نسخهٔ اسکیما — با هر تغییر ساختاری یک عدد بالا می‌رود */
export const SCHEMA_VERSION = 1;

/**
 * دستورهای ساخت اسکیمای کارگردان.
 * همه idempotent — اجرای هزارباره‌شان هیچ اثری غیر از بار اول ندارد.
 */
export const SCHEMA_STATEMENTS: string[] = [
  // ── کارها ──────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.tasks} (
     id            TEXT PRIMARY KEY,
     text          TEXT        NOT NULL,
     status        TEXT        NOT NULL DEFAULT 'now',
     project_id    TEXT,
     is_next_step  BOOLEAN     NOT NULL DEFAULT FALSE,
     waiting_on    TEXT        NOT NULL DEFAULT '',
     note          TEXT        NOT NULL DEFAULT '',
     done          BOOLEAN     NOT NULL DEFAULT FALSE,
     created_at    BIGINT      NOT NULL,
     updated_at    BIGINT      NOT NULL,
     deleted_at    BIGINT,
     deleted_by    TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.tasks}_deleted_idx
     ON ${TABLES.tasks} (deleted_at)`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.tasks}_project_idx
     ON ${TABLES.tasks} (project_id)`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.tasks}_status_idx
     ON ${TABLES.tasks} (status)`,

  // ── پروژه‌ها (جبهه‌ها) ─────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.projects} (
     id          TEXT PRIMARY KEY,
     name        TEXT   NOT NULL,
     status      TEXT   NOT NULL DEFAULT 'queued',
     created_at  BIGINT NOT NULL,
     deleted_at  BIGINT,
     deleted_by  TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.projects}_deleted_idx
     ON ${TABLES.projects} (deleted_at)`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.projects}_status_idx
     ON ${TABLES.projects} (status)`,

  // ── صندوق ذهن ──────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.inbox} (
     id          TEXT PRIMARY KEY,
     text        TEXT   NOT NULL,
     created_at  BIGINT NOT NULL,
     deleted_at  BIGINT,
     deleted_by  TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.inbox}_deleted_idx
     ON ${TABLES.inbox} (deleted_at)`,

  // ── تنظیمات ────────────────────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.settings} (
     key        TEXT PRIMARY KEY,
     value      TEXT NOT NULL,
     updated_at BIGINT NOT NULL
   )`,

  // ── پیشنهادهای ایجنت همکار ────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.suggestions} (
     id               TEXT PRIMARY KEY,
     agent_name       TEXT   NOT NULL DEFAULT 'ایجنت همکار',
     title            TEXT   NOT NULL,
     body             TEXT   NOT NULL DEFAULT '',
     kind             TEXT   NOT NULL DEFAULT 'note',
     payload          JSONB,
     status           TEXT   NOT NULL DEFAULT 'pending',
     created_at       BIGINT NOT NULL,
     decided_at       BIGINT,
     decision_note    TEXT   NOT NULL DEFAULT '',
     applied_event_id TEXT
   )`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.suggestions}_status_idx
     ON ${TABLES.suggestions} (status)`,

  // ── تاریخچهٔ تغییرات (برای برگرداندن هر اقدام) ────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.history} (
     id            TEXT PRIMARY KEY,
     entity_kind   TEXT   NOT NULL,
     entity_id     TEXT   NOT NULL,
     action        TEXT   NOT NULL,
     before_state  JSONB,
     after_state   JSONB,
     source        TEXT   NOT NULL DEFAULT 'user',
     suggestion_id TEXT,
     created_at    BIGINT NOT NULL,
     undone_at     BIGINT
   )`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.history}_entity_idx
     ON ${TABLES.history} (entity_kind, entity_id)`,
  `CREATE INDEX IF NOT EXISTS ${TABLES.history}_created_idx
     ON ${TABLES.history} (created_at DESC)`,

  // ── اطلاعات نسخهٔ اسکیما ───────────────────────────────────────
  `CREATE TABLE IF NOT EXISTS ${TABLES.meta} (
     key   TEXT PRIMARY KEY,
     value TEXT NOT NULL
   )`,
];

export interface MigrationResult {
  ok: boolean;
  createdTables: string[];
  statementsRun: number;
  schemaVersion: number;
  error?: { code: string; message: string };
}

/**
 * ساخت جدول‌های کارگردان.
 * — فقط جدول‌های نبوده را می‌سازد.
 * — به هیچ داده‌ای دست نمی‌زند.
 * — اگر خطا بدهد، وضعیت را برمی‌گرداند و برنامه را از کار نمی‌اندازد.
 */
export async function migrate(pool: Pool): Promise<MigrationResult> {
  const before = await listTables(pool);

  for (const sql of SCHEMA_STATEMENTS) {
    await pool.query(sql);
  }

  // ثبت نسخهٔ اسکیما (upsert روی جدول متادیتا — بدون پاک‌کردن چیزی)
  await pool.query(
    `INSERT INTO ${TABLES.meta} (key, value) VALUES ($1, $2)
     ON CONFLICT (key) DO UPDATE SET value = EXCLUDED.value`,
    ['schema_version', String(SCHEMA_VERSION)]
  );

  const after = await listTables(pool);
  const createdTables = after.filter((t) => !before.includes(t));

  return {
    ok: true,
    createdTables,
    statementsRun: SCHEMA_STATEMENTS.length,
    schemaVersion: SCHEMA_VERSION,
  };
}

/** فهرست جدول‌های موجود (فقط خواندنی) */
export async function listTables(pool: Pool): Promise<string[]> {
  const res = await pool.query<{ table_name: string }>(
    `select table_name
       from information_schema.tables
      where table_schema = current_schema()
        and table_type = 'BASE TABLE'
      order by table_name`
  );
  return res.rows.map((r) => r.table_name);
}

/** آیا جدول‌های کارگردان ساخته شده‌اند؟ (فقط تشخیص — چیزی نمی‌سازد) */
export async function schemaReady(pool: Pool): Promise<boolean> {
  const tables = await listTables(pool);
  return Object.values(TABLES).every((t) => tables.includes(t));
}
