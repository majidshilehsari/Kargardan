// ─── اتصال «کارگردان» به دیتابیس Postgres ──────────────────────────────────
//
// ⚠️ قواعد ایمنی این فایل — تغییرشان نده:
//   ۱. رمز عبور دیتابیس هرگز لاگ نمی‌شود و هرگز به مرورگر فرستاده نمی‌شود.
//   ۲. تمام کوئری‌های این فایل «فقط خواندنی» هستند (SELECT).
//      هیچ INSERT / UPDATE / DELETE / DROP / CREATE در این فایل وجود ندارد.
//   ۳. اگر دیتابیس در دسترس نباشد، برنامه crash نمی‌کند — فقط وضعیت «وصل نیست» برمی‌گردد.

import { Pool } from 'pg';
import { DB_URL_ENV_VARS, type DbHealth, type SafeTarget } from './db-types';

// تایپ‌ها و فهرست نام متغیرها در `lib/db-types.ts` هستند (بدون وابستگی، امن برای مرورگر).
export { DB_URL_ENV_VARS };
export type { DbHealth, SafeTarget };

// ─── پیدا کردن رشتهٔ اتصال ────────────────────────────────────────────
export function findDatabaseUrl(): { envVar: string; value: string } | null {
  for (const envVar of DB_URL_ENV_VARS) {
    const v = process.env[envVar];
    if (v && v.trim()) return { envVar, value: v.trim() };
  }
  return null;
}

/** آیا مقدارِ متغیر شبیه رمزِ ستاره‌دار / جای‌خالیِ کپی‌شده است؟ */
function looksLikePlaceholder(value: string): boolean {
  return (
    /\*{3,}/.test(value) ||
    /x{5,}/i.test(value) ||
    /<[^>]{2,}>/.test(value) ||
    /\bYOUR[-_]?/i.test(value) ||
    /\bchangeme\b/i.test(value) ||
    /\.\.\./.test(value)
  );
}

// ─── ماسک‌کردن نشانی برای نمایش ───────────────────────────────────────
export function describeTarget(envVar: string, raw: string): SafeTarget {
  let host = '(نامعتبر)';
  let port = '—';
  let database = '—';
  let userMasked = '—';
  let ssl: SafeTarget['ssl'] = 'خاموش';

  try {
    const u = new URL(raw);
    host = u.hostname || '(خالی)';
    port = u.port || '5432';
    database = decodeURIComponent(u.pathname.replace(/^\//, '')) || '(پیش‌فرض)';
    const user = decodeURIComponent(u.username || '');
    userMasked = user ? `${user.slice(0, 1)}${'·'.repeat(Math.min(6, Math.max(2, user.length - 1)))}` : '—';
    const s = sslFor(raw, u);
    ssl = s === false ? 'خاموش' : s.rejectUnauthorized ? 'سخت‌گیرانه' : 'روشن';
  } catch {
    /* رشتهٔ اتصال نامعتبر — مقادیر پیش‌فرض بالا نمایش داده می‌شود */
  }

  return { envVar, host, port, database, userMasked, ssl };
}

/** تصمیم دربارهٔ SSL: سرویس‌های ابری لازم دارند، پستگرس محلی نه */
function sslFor(_raw: string, u: URL): false | { rejectUnauthorized: boolean } {
  const host = u.hostname.toLowerCase();
  const mode = (u.searchParams.get('sslmode') ?? '').toLowerCase();
  const isLocal =
    host === 'localhost' ||
    host === '127.0.0.1' ||
    host === '::1' ||
    host === '[::1]' ||
    host.endsWith('.local') ||
    host.endsWith('.internal');

  if (mode === 'disable') return false;
  if (isLocal && mode === '') return false;

  const strict = process.env.DB_SSL_STRICT === '1' || mode === 'verify-full' || mode === 'verify-ca';
  return { rejectUnauthorized: strict };
}

// ─── استخر اتصال (Pool) — یک بار ساخته می‌شود و در dev با HMR زنده می‌ماند ──
interface PoolCache {
  pool: Pool;
  signature: string;
  envVar: string;
}

const globalForDb = globalThis as unknown as { __kargardanDbPool?: PoolCache };

/** هش ساده — برای تشخیص تغییر رشتهٔ اتصال، بدون ذخیره‌کردن خود رشته */
function signatureOf(envVar: string, value: string): string {
  let h = 5381;
  for (let i = 0; i < value.length; i++) h = ((h << 5) + h + value.charCodeAt(i)) | 0;
  return `${envVar}:${value.length}:${h}`;
}

function getPool(found: { envVar: string; value: string }): Pool {
  const signature = signatureOf(found.envVar, found.value);
  const cached = globalForDb.__kargardanDbPool;
  if (cached && cached.signature === signature) return cached.pool;

  if (cached) {
    // رشتهٔ اتصال عوض شده — استخر قدیمی با احتیاط بسته می‌شود
    cached.pool.end().catch(() => {});
  }

  let url: URL;
  try {
    url = new URL(found.value);
  } catch {
    throw Object.assign(new Error('رشتهٔ اتصال، قالب معتبری ندارد.'), { code: 'INVALID_URL' });
  }

  const pool = new Pool({
    connectionString: found.value,
    ssl: sslFor(found.value, url),
    max: 3,
    idleTimeoutMillis: 30_000,
    connectionTimeoutMillis: 10_000,
    statement_timeout: 10_000,
    query_timeout: 10_000,
    allowExitOnIdle: true,
    application_name: 'kargardan',
  });

  // اگر خطای غیرمنتظره‌ای روی اتصال بی‌کار رخ داد، برنامه نباید از کار بیفتد
  pool.on('error', () => {});

  globalForDb.__kargardanDbPool = { pool, signature, envVar: found.envVar };
  return pool;
}

// ─── توضیح فارسی خطاها ────────────────────────────────────────────────
const ERROR_HINTS: Record<string, string> = {
  INVALID_URL: 'رشتهٔ اتصال باید با postgres:// یا postgresql:// شروع شود.',
  ENOTFOUND: 'دامنهٔ دیتابیس پیدا نشد. آدرس میزبان (host) در رشتهٔ اتصال اشتباه است یا DNS در دسترس نیست.',
  EAI_AGAIN: 'DNS موقتاً پاسخ نداد. چند لحظه بعد دوباره امتحان کن.',
  ECONNREFUSED: 'سرور دیتابیس اتصال را رد کرد. یا پورت بسته است، یا آدرس اشتباه است، یا دیتابیس خاموش است.',
  ETIMEDOUT: 'زمان انتظار تمام شد. یا اینترنت/فایروال جلوی اتصال را گرفته، یا دیتابیس بیش از حد کند است.',
  CONNECTION_TIMED_OUT: 'زمان انتظار تمام شد. یا اینترنت/فایروال جلوی اتصال را گرفته، یا دیتابیس بیش از حد کند است.',
  ECONNRESET: 'اتصال وسط راه قطع شد. بعضی سرویس‌ها اتصال بدون SSL را رد می‌کنند — sslmode=require را امتحان کن.',
  EPIPE: 'ارتباط با دیتابیس قطع شد. دوباره امتحان کن.',
  EHOSTUNREACH: 'میزبان دیتابیس در دسترس نیست.',
  ENETUNREACH: 'شبکه به میزبان دیتابیس نمی‌رسد.',
  '28P01': 'نام کاربری یا رمز عبور اشتباه است. رمز را از پنل سرویس دیتابیس کامل کپی کن (نسخهٔ ستاره‌دار «****» کار نمی‌کند).',
  '28000': 'احراز هویت پذیرفته نشد. ممکن است IP سرویس محدود شده باشد یا کاربر اشتباه باشد.',
  '3D000': 'دیتابیسی با این نام وجود ندارد. نام دیتابیس در انتهای رشتهٔ اتصال را بررسی کن.',
  '42501': 'این کاربر اجازهٔ دسترسی به این دیتابیس را ندارد.',
  '53300': 'تعداد اتصال‌های هم‌زمان دیتابیس پر است. کمی بعد دوباره امتحان کن.',
  '57P03': 'دیتابیس در حال راه‌اندازی است. چند لحظه صبر کن و دوباره امتحان کن.',
  '08P01': 'پروتکل ارتباطی ناسازگار است — احتمالاً به یک پورت غیرِ‌Postgres وصل شده‌ای.',
  DEPTH_ZERO_SELF_SIGNED_CERT: 'گواهی SSL خودامضا است. اگر مطمئن هستی میزبان درست است، متغیر DB_SSL_STRICT را صفر بگذار.',
  SELF_SIGNED_CERT_IN_CHAIN: 'زنجیرهٔ گواهی SSL کامل نیست. اگر مطمئن هستی میزبان درست است، DB_SSL_STRICT را صفر بگذار.',
  UNABLE_TO_VERIFY_LEAF_SIGNATURE: 'گواهی SSL قابل تأیید نبود. DB_SSL_STRICT را صفر بگذار (فقط اگر میزبان را می‌شناسی).',
  ERR_TLS_CERT_ALTNAME_INVALID: 'نام گواهی SSL با آدرس میزبان نمی‌خواند. رشتهٔ اتصال را از پنل سرویس دوباره کپی کن.',
};

function hintFor(code: string): string {
  return (
    ERROR_HINTS[code] ??
    'اتصال برقرار نشد. رشتهٔ اتصال، وضعیت دیتابیس و دسترسی شبکه را بررسی کن.'
  );
}

function codeOf(err: unknown): string {
  if (err && typeof err === 'object' && 'code' in err) {
    const c = (err as { code?: unknown }).code;
    if (typeof c === 'string' && c) return c;
  }
  if (err && typeof err === 'object' && 'name' in err) {
    const n = (err as { name?: unknown }).name;
    if (typeof n === 'string' && n) return n;
  }
  return 'UNKNOWN';
}

function messageOf(err: unknown): string {
  if (err instanceof Error) return err.message;
  return 'خطای ناشناخته';
}

/** جدول‌هایی که «کارگردان» در آینده خواهد ساخت — فقط برای تشخیص، نه ساخت */
const APP_TABLES = ['kargardan_tasks', 'kargardan_projects', 'kargardan_inbox', 'kargardan_settings'];

// ─── بررسی سلامت دیتابیس (فقط خواندنی) ───────────────────────────────
export async function checkDatabaseHealth(): Promise<DbHealth> {
  const checkedAt = Date.now();
  const found = findDatabaseUrl();

  if (!found) {
    return { status: 'not_configured', checkedAt, varsChecked: DB_URL_ENV_VARS };
  }

  if (looksLikePlaceholder(found.value)) {
    return {
      status: 'error',
      checkedAt,
      latencyMs: 0,
      target: null,
      code: 'PLACEHOLDER_VALUE',
      message: 'مقدار متغیر محیطی شبیه رمزِ ستاره‌دار یا جای‌خالی است، نه رشتهٔ اتصال واقعی.',
      hint:
        'مقدار کامل رشتهٔ اتصال را از پنل سرویس دیتابیس کپی کن. مقدارهای «********» یا نمونه‌ای کار نمی‌کنند. ' +
        `متغیرهای بررسی‌شده: ${DB_URL_ENV_VARS.join(' · ')}`,
    };
  }

  let target: SafeTarget | null = null;
  const start = Date.now();

  try {
    target = describeTarget(found.envVar, found.value);
    const pool = getPool(found);
    const client = await pool.connect();

    try {
      const meta = await client.query<{
        database: string;
        schema: string;
        server_version: string;
        server_time: string;
      }>(
        `select current_database() as database,
                current_schema() as schema,
                version()          as server_version,
                now()::text        as server_time`
      );

      const tableRes = await client.query<{ table_name: string }>(
        `select table_name
           from information_schema.tables
          where table_schema = current_schema()
            and table_type = 'BASE TABLE'
          order by table_name
          limit 200`
      );

      const tables = tableRes.rows.map((r) => r.table_name);
      const row = meta.rows[0];

      return {
        status: 'ok',
        checkedAt,
        latencyMs: Date.now() - start,
        target,
        serverVersion: row?.server_version ?? 'نامشخص',
        database: row?.database ?? '—',
        schema: row?.schema ?? '—',
        serverTime: row?.server_time ?? '—',
        tableCount: tables.length,
        tables,
        appTablesPresent: APP_TABLES.some((t) => tables.includes(t)),
      };
    } finally {
      client.release();
    }
  } catch (err) {
    const code = codeOf(err);
    return {
      status: 'error',
      checkedAt,
      latencyMs: Date.now() - start,
      target,
      code,
      message: messageOf(err),
      hint: hintFor(code),
    };
  }
}

// ─── دسترسی سروری به استخر اتصال ─────────────────────────────────
/**
 * استخر اتصال را برمی‌گرداند. اگر هیچ متغیر محیطی‌ای تنظیم نشده باشد،
 * `null` برمی‌گرداند (به‌جای throw) تا لایه‌های بالاتر بتوانند پیام‌های
 * دوستانه بدهند، نه صفحهٔ سفید.
 */
export function getAppPool(): Pool | null {
  const found = findDatabaseUrl();
  if (!found) return null;
  if (looksLikePlaceholder(found.value)) return null;
  try {
    return getPool(found);
  } catch {
    return null;
  }
}

/** آیا دیتابیس قابل استفاده است؟ (بدون تلاش برای اتصال) */
export function isDatabaseConfigured(): boolean {
  return getAppPool() !== null;
}
