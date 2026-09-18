// ─── API: ساخت جدول‌های کارگردان ────────────────────────────────────
//
// 🛡 این مسیر «ساخت جدول» است — یک نوشتن در دیتابیس. ولی:
//    • فقط `CREATE TABLE IF NOT EXISTS` و `CREATE INDEX IF NOT EXISTS` می‌زند.
//    • هیچ DROP / DELETE / TRUNCATE / ALTER در آن نیست (به lib/schema.ts نگاه کن).
//    • اجرای چندباره‌اش هیچ اثر اضافه‌ای ندارد (idempotent).
//    • هیچ داده‌ای پاک یا بازنویسی نمی‌شود.
//
// فقط با کلیک صریح خودِ کاربر در رابط کاربری (تنظیمات → وضعیت دیتابیس) صدا زده می‌شود.
import { NextResponse } from 'next/server';
import { getAppPool } from '@/lib/db';
import { migrate, listTables, schemaReady } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/** فقط خواندن وضعیت — بدون هیچ تغییری */
export async function GET() {
  const pool = getAppPool();
  if (!pool) {
    return NextResponse.json({
      ok: false,
      status: 'not_configured',
      error: 'دیتابیس تنظیم نشده است.',
      hint: 'PRISMA_DATABASE_URL یا POSTGRES_URL را در متغیرهای محیطی بگذار.',
    });
  }

  try {
    const [tables, ready] = await Promise.all([listTables(pool), schemaReady(pool)]);
    return NextResponse.json(
      { ok: true, ready, tables },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return NextResponse.json({
      ok: false,
      status: 'error',
      error: code,
      message: err instanceof Error ? err.message : 'خطای ناشناخته',
    });
  }
}

export async function POST() {
  const pool = getAppPool();
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        status: 'not_configured',
        error: 'دیتابیس تنظیم نشده است.',
        hint: 'PRISMA_DATABASE_URL یا POSTGRES_URL را در متغیرهای محیطی بگذار.',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }

  try {
    const result = await migrate(pool);
    const tables = await listTables(pool);

    return NextResponse.json(
      {
        ok: true,
        status: 'migrated',
        createdTables: result.createdTables,
        statementsRun: result.statementsRun,
        schemaVersion: result.schemaVersion,
        tables,
        message:
          result.createdTables.length > 0
            ? `${result.createdTables.length} جدول ساخته شد.`
            : 'همهٔ جدول‌ها از قبل موجود بودند — چیزی ساخته نشد و هیچ داده‌ای تغییر نکرد.',
      },
      { headers: { 'Cache-Control': 'no-store' } }
    );
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return NextResponse.json(
      {
        ok: false,
        status: 'error',
        error: code,
        message: err instanceof Error ? err.message : 'خطای ناشناخته',
        hint: 'هیچ تغییری اعمال نشد. رشتهٔ اتصال و دسترسی نوشتن کاربر دیتابیس را بررسی کن.',
      },
      { status: 200, headers: { 'Cache-Control': 'no-store' } }
    );
  }
}
