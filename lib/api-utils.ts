// ─── کمک‌های مشترک API ─────────────────────────────────────────────
import { NextResponse } from 'next/server';
import type { Pool } from 'pg';
import { getAppPool } from './db';
import { migrate, schemaReady } from './schema';

/** پیام‌های خطای قابل‌فهم برای کاربر فارسی‌زبان */
const DB_ERROR_HINTS: Record<string, string> = {
  '28P01': 'نام کاربری یا رمز عبور دیتابیس اشتباه است.',
  '3D000': 'دیتابیس با این نام وجود ندارد.',
  '42501': 'این کاربر دیتابیس اجازهٔ دسترسی لازم را ندارد.',
  ENOTFOUND: 'آدرس میزبان دیتابیس پیدا نشد.',
  ECONNREFUSED: 'اتصال به دیتابیس رد شد.',
  ETIMEDOUT: 'زمان اتصال به دیتابیس تمام شد.',
  '53300': 'تعداد اتصال‌های دیتابیس پر است.',
};

export function dbErrorHint(code: string): string {
  return DB_ERROR_HINTS[code] ?? 'ارتباط با دیتابیس برقرار نشد.';
}

/** پاسخ استاندارد خطا */
export function fail(
  status: number,
  error: string,
  hint = '',
  extra: Record<string, unknown> = {}
) {
  return NextResponse.json({ ok: false, error, hint, ...extra }, { status });
}

/** هدرهای «هیچ‌چیز را کش نکن» */
const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' } as const;

export function okJson(data: unknown, status = 200) {
  return NextResponse.json(data, { status, headers: NO_STORE });
}

export interface PoolContext {
  pool: Pool;
  /** آیا جدول‌های کارگردان آماده‌اند؟ */
  ready: boolean;
}

/**
 * استخر اتصال را می‌گیرد و مطمئن می‌شود اسکیما آماده است.
 * اگر دیتابیس تنظیم نشده باشد `null` برمی‌گرداند (به‌جای خطا).
 */
export async function getReadyPool(): Promise<PoolContext | null> {
  const pool = getAppPool();
  if (!pool) return null;
  const ready = await schemaReady(pool);
  return { pool, ready };
}

/**
 * ساخت جدول‌ها (idempotent).
 * فقط جدول‌های نبوده را می‌سازد — هیچ داده‌ای را نمی‌بَرد و تغییر نمی‌دهد.
 */
export async function ensureSchema(pool: Pool) {
  return migrate(pool);
}

/** خواندن بدنهٔ JSON با محافظت — هرگز خطا پرت نمی‌کند */
export async function readJson<T = Record<string, unknown>>(
  req: Request
): Promise<T | null> {
  try {
    const body = await req.json();
    if (!body || typeof body !== 'object') return null;
    return body as T;
  } catch {
    return null;
  }
}

/** پاسخ استاندارد «دیتابیس تنظیم نشده» */
export function notConfigured() {
  return okJson(
    {
      ok: false,
      status: 'not_configured',
      error: 'هیچ متغیر محیطی دیتابیسی پیدا نشد.',
      hint:
        'PRISMA_DATABASE_URL (یا POSTGRES_URL / DATABASE_URL) را در متغیرهای محیطی بگذار ' +
        'و برنامه را دوباره راه‌اندازی کن.',
      items: [],
    },
    200
  );
}

// ─── تشخیص «نشانی عمومی» برنامه ────────────────────────────────────
//
// 📌 چرا لازم است؟ فایل OpenAPI باید نشانی‌ای بدهد که ChatGPT واقعاً بتواند
//    صدا بزند. اگر اشتباهاً «http://0.0.0.0:3000» یا «localhost» بدهد،
//    ChatGPT هیچ‌وقت نمی‌تواند به کارگردان وصل شود.
//
// ترتیب اولویت:
//   ۱. VERCEL_PROJECT_PRODUCTION_URL  → دامنهٔ پایدار پروژه در Vercel (بهترین)
//   ۲. VERCEL_URL                     → دامنهٔ همین دیپلوی
//   ۳. x-forwarded-host / host        → اگر عمومی باشد
//   ۴. req.url                        → آخرین گزینه

/** اولین مقدار یک هدر (هدرهای زنجیره‌ای با کاما جدا می‌شوند) */
function firstValue(v: string | null): string {
  return (v ?? '').split(',')[0].trim();
}

/** آیا این میزبان، داخلی/غیرقابل‌دسترس از اینترنت است؟ */
export function isInternalHost(host: string): boolean {
  const h = host.toLowerCase();
  return (
    h.startsWith('localhost') ||
    h.startsWith('127.') ||
    h.startsWith('0.0.0.0') ||
    h.startsWith('[::1]') ||
    h.startsWith('10.') ||
    h.startsWith('192.168.') ||
    /^172\.(1[6-9]|2\d|3[01])\./.test(h)
  );
}

/** نشانی عمومی و قابل‌دسترس برنامه را برمی‌گرداند */
export function resolvePublicOrigin(req: Request): string {
  // ۰) راه فرار دستی — اگر کاربر نشانی عمومی را صریح بگذارد، همان مقدم است
  const manual = (process.env.KARGARDAN_PUBLIC_URL ?? '').trim();
  if (manual) return manual.replace(/\/+$/, '');

  const fwdHost = firstValue(req.headers.get('x-forwarded-host'));
  const hostHeader = firstValue(req.headers.get('host'));
  const candidate = fwdHost || hostHeader;

  // ۱) دامنهٔ پایدار Vercel — همیشه بر بقیه مقدم است، چون ثابت می‌ماند
  const prodUrl = (process.env.VERCEL_PROJECT_PRODUCTION_URL ?? '').trim();
  if (prodUrl && (!candidate || isInternalHost(candidate))) {
    return `https://${prodUrl.replace(/^https?:\/\//, '')}`;
  }

  // ۲) دامنهٔ همین دیپلوی
  const deployUrl = (process.env.VERCEL_URL ?? '').trim();

  if (candidate && !isInternalHost(candidate)) {
    const proto = firstValue(req.headers.get('x-forwarded-proto')) || 'https';
    return `${proto}://${candidate}`;
  }

  if (deployUrl) {
    return `https://${deployUrl.replace(/^https?:\/\//, '')}`;
  }

  // ۳) آخرین گزینه — همان چیزی که در req.url هست
  return new URL(req.url).origin;
}

// ─── 🛡 محافظت پایه برای مسیرهای خودِ برنامه ────────────────────────
//
// ⚠️ این «احراز هویت» نیست — فقط جلوی یک حملهٔ مشخص را می‌گیرد:
//    یک وب‌سایت مخرب که مرورگر تو را وادار کند به کارگردان درخواست بفرستد
//    (حملهٔ CSRF). مرورگر همیشه هدر `Sec-Fetch-Site` را خودش می‌گذارد و
//    هیچ وب‌سایتی نمی‌تواند آن را جعل کند.
//
// ❗️ این محافظ جلوی کسی که مستقیم با curl به API وصل شود را **نمی‌گیرد**.
//    برای آن، احراز هویت واقعی لازم است — در گزارش به کارفرما توضیح داده شده.
export function isCrossSiteRequest(req: Request): boolean {
  return (req.headers.get('sec-fetch-site') ?? '').toLowerCase() === 'cross-site';
}

/** پاسخ استاندارد رد درخواست میان‌سایتی */
export function crossSiteRejected() {
  return fail(
    403,
    'درخواست از یک سایت دیگر رد شد.',
    'این محافظ جلوی حملهٔ CSRF را می‌گیرد. اگر با ابزار خودت درخواست می‌فرستی، ' +
      'از مسیرهای /api/agent/* با کلید استفاده کن.'
  );
}
