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
