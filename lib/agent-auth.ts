// ─── احراز هویت «ایجنت همکار» ──────────────────────────────────────
//
// 🔒 چرا لازم است؟ ایجنت همکار به «کل دیتابیس» دسترسی می‌خواند.
//    اگر این مسیرها باز باشند، هر کسی در اینترنت می‌تواند داده‌های تو را بخواند.
//
// طرز کار: یک کلید مخفی در متغیر محیطی `AGENT_API_KEY` می‌گذاری
// (Vercel → Settings → Environment Variables) و ایجنت همکار آن را
// در هدر `Authorization: Bearer <کلید>` می‌فرستد.
//
// اگر `AGENT_API_KEY` تنظیم نشده باشد، این مسیرها **کاملاً بسته** می‌مانند
// و به‌جای داده، راهنمای تنظیم کلید برمی‌گردانند. (امن به‌صورت پیش‌فرض)

import { timingSafeEqual } from 'node:crypto';

export const AGENT_KEY_ENV = 'AGENT_API_KEY';

export type AuthResult =
  | { ok: true }
  | { ok: false; status: number; error: string; hint: string };

/** مقایسهٔ امن کلیدها — مقاوم در برابر حملات زمان‌سنجی */
function safeEqual(a: string, b: string): boolean {
  const ba = Buffer.from(a, 'utf8');
  const bb = Buffer.from(b, 'utf8');
  if (ba.length !== bb.length) {
    // طول‌ها متفاوت است؛ یک مقایسهٔ ساختگی انجام بده تا زمان پاسخ لو ندهد
    timingSafeEqual(ba, ba);
    return false;
  }
  return timingSafeEqual(ba, bb);
}

export function checkAgentAuth(req: Request): AuthResult {
  const expected = (process.env[AGENT_KEY_ENV] ?? '').trim();

  if (!expected) {
    return {
      ok: false,
      status: 503,
      error: 'دسترسی ایجنت همکار هنوز فعال نشده است.',
      hint:
        `برای فعال‌کردن، متغیر محیطی ${AGENT_KEY_ENV} را در ` +
        'Vercel → Settings → Environment Variables (یا فایل .env.local) با یک رشتهٔ تصادفی طولانی مقداردهی کن، ' +
        'و بعد از راه‌اندازی مجدد، همان کلید را در هدر Authorization: Bearer <کلید> بفرست.',
    };
  }

  const header = req.headers.get('authorization') ?? '';
  const bearer = header.toLowerCase().startsWith('bearer ') ? header.slice(7).trim() : '';
  const direct = (req.headers.get('x-agent-key') ?? '').trim();
  const provided = bearer || direct;

  if (!provided || !safeEqual(provided, expected)) {
    return {
      ok: false,
      status: 401,
      error: 'کلید دسترسی ایجنت نادرست یا غایب است.',
      hint: 'هدر Authorization: Bearer <AGENT_API_KEY> را بفرست.',
    };
  }

  return { ok: true };
}
