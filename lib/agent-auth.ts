// ─── احراز هویت و کنترل «ایجنت همکار» ─────────────────────────────
//
// 🔒 چرا لازم است؟ ایجنت همکار به «کل دیتابیس» دسترسی خواندن دارد.
//    اگر این مسیرها باز باشند، هر کسی در اینترنت می‌تواند داده‌های تو را بخواند.
//
// ✅ دیگر هیچ متغیر محیطی‌ای لازم نیست:
//    • کلید API در همان دیتابیس ساخته می‌شود (جدول kargardan_settings).
//    • روشن/خاموش بودن دسترسی هم همان‌جا ذخیره می‌شود.
//    • کنترل هر دو، از تب «🔌 ایجنت همکار» در خودِ برنامه انجام می‌شود.
//
// 🔴 کلید توقف (kill switch):
//    اگر دسترسی «خاموش» باشد، **حتی با کلید درست** هیچ درخواستی پذیرفته نمی‌شود.
//    این یعنی حتی اگر کلید لو برود، با یک کلیک می‌توانی در را ببندی.
//
// ℹ️ سازگاری با گذشته: اگر متغیر محیطی AGENT_API_KEY تنظیم شده باشد،
//    آن بر کلید دیتابیس مقدم می‌شود (کاربران قدیمی دست‌نخورده می‌مانند).
//    ولی کلید توقف همیشه اعمال می‌شود.

import { randomBytes, timingSafeEqual } from 'node:crypto';
import type { Pool } from 'pg';
import { readSetting, writeSetting } from './repo';

/** متغیر محیطی اختیاری (مقدم بر کلید دیتابیس، اگر تنظیم شده باشد) */
export const AGENT_KEY_ENV = 'AGENT_API_KEY';

/** نام تنظیم‌ها در جدول kargardan_settings */
export const KEY_SETTING = 'agent_api_key';
export const ENABLED_SETTING = 'agent_access_enabled';

export interface AgentAccessInfo {
  /** آیا دسترسی باز است؟ (کلید توقف) */
  enabled: boolean;
  /** آیا کلیدی وجود دارد؟ */
  keyConfigured: boolean;
  /** کلید از کجا می‌آید */
  keySource: 'db' | 'env' | 'none';
  /** آیا متغیر محیطی بر کلید دیتابیس مقدم شده؟ */
  envOverride: boolean;
  /**
   * کلید برای نمایش در رابط کاربری خود برنامه.
   * اگر از متغیر محیطی بیاید، خالی است (چون نباید در مرورگر دیده شود).
   */
  key: string;
  /** آخرین به‌روزرسانی کلید */
  updatedAt: number | null;
}

function envKey(): string {
  return (process.env[AGENT_KEY_ENV] ?? '').trim();
}

/** یک کلید تصادفی ۴۳ کاراکتری می‌سازد */
export function generateAgentKey(): string {
  return randomBytes(32).toString('base64url');
}

// ─── خواندن وضعیت ─────────────────────────────────────────────────
export async function getAgentAccess(pool: Pool): Promise<AgentAccessInfo> {
  const [keyRow, enabledRow] = await Promise.all([
    pool.query(`select value, updated_at from kargardan_settings where key = $1`, [KEY_SETTING]),
    readSetting(pool, ENABLED_SETTING),
  ]);

  const dbKey = keyRow.rows[0] ? String(keyRow.rows[0].value).trim() : '';
  const updatedAt = keyRow.rows[0]?.updated_at ? Number(keyRow.rows[0].updated_at) : null;
  const env = envKey();
  const override = env.length > 0;

  return {
    // پیش‌فرض «باز» است؛ فقط وقتی صریحاً 'false' ذخیره شده باشد بسته می‌شود
    enabled: enabledRow === null ? true : enabledRow === 'true',
    keyConfigured: override || dbKey.length > 0,
    keySource: override ? 'env' : dbKey ? 'db' : 'none',
    envOverride: override,
    key: override ? '' : dbKey,
    updatedAt,
  };
}

// ─── ساخت / بازسازی کلید ──────────────────────────────────────────

/** اگر کلیدی وجود ندارد، یکی می‌سازد و دسترسی را باز می‌کند */
export async function ensureAgentKey(pool: Pool): Promise<string> {
  const current = (await readSetting(pool, KEY_SETTING))?.trim() ?? '';
  if (current) return current;

  const fresh = generateAgentKey();
  await writeSetting(pool, KEY_SETTING, fresh);

  // اولین باری که کلید ساخته می‌شود، دسترسی باز است
  await writeSetting(pool, ENABLED_SETTING, 'true');
  return fresh;
}

/** 🔄 کلید جدید می‌سازد. کلید قبلی **بلافاصله** بی‌اعتبار می‌شود. */
export async function regenerateAgentKey(pool: Pool): Promise<string> {
  const fresh = generateAgentKey();
  await writeSetting(pool, KEY_SETTING, fresh);
  return fresh;
}

/** ⏸ / ▶️ کلید توقف */
export async function setAgentEnabled(pool: Pool, enabled: boolean): Promise<void> {
  await writeSetting(pool, ENABLED_SETTING, enabled ? 'true' : 'false');
}

// ─── بررسی درخواست ────────────────────────────────────────────────

export type AuthResult =
  | { ok: true; via: 'header' | 'x-agent-key' | 'query' }
  | { ok: false; status: 503 | 403 | 401; error: string; hint: string };

/** مقایسهٔ امن کلیدها — مقاوم در برابر حملات زمان‌سنجی */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    timingSafeEqual(ba, ba); // یک مقایسهٔ ساختگی، تا زمان پاسخ لو ندهد
    return false;
  }
  return timingSafeEqual(ba, bb);
}

/**
 * بررسی دسترسی ایجنت همکار.
 * ترتیب بررسی: دیتابیس ← کلید توقف ← کلید
 */
export async function checkAgentAuth(req: Request, pool: Pool | null): Promise<AuthResult> {
  if (!pool) {
    return {
      ok: false,
      status: 503,
      error: 'برنامه به دیتابیس وصل نیست.',
      hint: 'کارگردان بدون دیتابیس نمی‌تواند دسترسی ایجنت را بررسی کند.',
    };
  }

  let access: AgentAccessInfo;
  try {
    access = await getAgentAccess(pool);
  } catch {
    return {
      ok: false,
      status: 503,
      error: 'خواندن تنظیمات دسترسی ایجنت ممکن نشد.',
      hint: 'کمی بعد دوباره تلاش کن.',
    };
  }

  if (!access.keyConfigured) {
    return {
      ok: false,
      status: 503,
      error: 'کلید ایجنت همکار هنوز ساخته نشده است.',
      hint: 'در برنامه، تب «🔌 ایجنت همکار» را باز کن — کلید همان‌جا ساخته می‌شود.',
    };
  }

  // 🔴 کلید توقف: حتی با کلید درست هم در بسته است
  if (!access.enabled) {
    return {
      ok: false,
      status: 403,
      error: 'دسترسی ایجنت همکار بسته است.',
      hint:
        'کارفرما با یک کلیک این دسترسی را قطع کرده است. ' +
        'برای بازکردن، در برنامه → تب «🔌 ایجنت همکار» → دکمهٔ «فعال‌سازی» را بزن.',
    };
  }

  // 🔑 کلید را از سه جا می‌پذیریم — چون همهٔ کلاینت‌ها نمی‌توانند هدر سفارشی بفرستند:
  //   ۱. Authorization: Bearer <کلید>   → برای curl و اسکریپت‌ها
  //   ۲. x-agent-key: <کلید>            → هدر جایگزین
  //   ۳. ?k=<کلید> در آدرس              → 🔴 برای ChatGPT
  //      ChatGPT Actions نمی‌تواند هدر سفارشی بفرستد، ولی apiKey با in:query
  //      را پشتیبانی می‌کند. این همان مسیری است که ایجنت همکار ChatGPT لازم دارد.
  const header = req.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const direct = (req.headers.get('x-agent-key') ?? '').trim();

  let fromQuery = '';
  try {
    const url = new URL(req.url);
    fromQuery = (url.searchParams.get('k') ?? url.searchParams.get('key') ?? '').trim();
  } catch {
    /* آدرس نامعتبر — نادیده بگیر */
  }

  const provided = bearer || direct || fromQuery;

  if (!provided || !safeEqual(provided, access.key)) {
    return {
      ok: false,
      status: 401,
      error: 'کلید دسترسی ایجنت نادرست یا غایب است.',
      hint:
        'کلید را به یکی از این سه شکل بفرست: ' +
        'هدر Authorization: Bearer <کلید> · هدر x-agent-key: <کلید> · ' +
        'یا پارامتر آدرس ?k=<کلید> (مناسب برای ChatGPT). ' +
        'کلید را از تب «🔌 ایجنت همکار» بگیر.',
    };
  }

  return { ok: true, via: bearer ? 'header' : direct ? 'x-agent-key' : 'query' };
}
