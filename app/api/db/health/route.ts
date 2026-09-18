// ─── API: وضعیت اتصال دیتابیس ────────────────────────────────────────
// ⚠️ این مسیر «فقط خواندنی» است. هیچ داده‌ای نمی‌سازد، عوض نمی‌کند یا پاک نمی‌کند.
//    فقط یک SELECT روی اطلاعات سیستم و فهرست جدول‌ها می‌زند.
import { NextResponse } from 'next/server';
import { checkDatabaseHealth } from '@/lib/db';

// درایور `pg` فقط روی سرور کار می‌کند — نه Edge
export const runtime = 'nodejs';

// هیچ‌وقت کش نشود؛ هر بار وضعیت تازه گزارش شود
export const dynamic = 'force-dynamic';
export const revalidate = 0;

export async function GET() {
  const health = await checkDatabaseHealth();

  // همیشه ۲۰۰ برمی‌گردانیم؛ معنیِ وضعیت داخل خودِ بدنه است.
  // این کار باعث نمی‌شود مرورگر خطای قرمز نشان دهد و کلاینت ساده می‌ماند.
  return NextResponse.json(health, {
    status: 200,
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
    },
  });
}
