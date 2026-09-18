// ─── API: وضعیت کامل کارگردان (خواندن/نوشتن) ────────────────────────
//
// 🛡 حفاظت ضدِ گم‌شدن داده:
//   نوشتن فقط زمانی انجام می‌شود که شمارهٔ نسخه‌ای که کلاینت دیده،
//   هنوز همان نسخهٔ دیتابیس باشد. اگر کسی در این فاصله چیزی عوض کرده باشد،
//   نوشتن **رد** می‌شود و کلاینت موظف است اول دوباره بخواند.
import { getAppPool } from '@/lib/db';
import { readState, writeState } from '@/lib/repo';
import { ensureSchema, fail, notConfigured, okJson, readJson } from '@/lib/api-utils';
import type { AppState } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  try {
    // ?migrate=0 → بدون ساخت جدول (حالت فقط‌خواندنی)
    const url = new URL(req.url);
    const autoMigrate = url.searchParams.get('migrate') !== '0';
    if (autoMigrate) await ensureSchema(pool);

    const { state, revision } = await readState(pool);
    return okJson({ ok: true, source: 'db', revision, state });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در خواندن دیتابیس');
  }
}

export async function POST(req: Request) {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  const body = await readJson<{ state?: AppState; revision?: number }>(req);
  const state = body?.state;
  const revision = typeof body?.revision === 'number' ? body.revision : -1;

  if (!state || state.version !== 1 || !Array.isArray(state.tasks)) {
    return fail(400, 'داده‌ی ارسالی معتبر نیست.', 'وضعیت باید ساختار AppState نسخهٔ ۱ داشته باشد.');
  }

  try {
    await ensureSchema(pool);
    const result = await writeState(pool, state, revision);

    if (!result.ok && result.stale) {
      return okJson({
        ok: false,
        status: 'stale',
        revision: result.revision,
        error: 'دیتابیس از نسخه‌ای که دیدی جلوتر رفته؛ برای جلوگیری از گم‌شدن داده چیزی نوشته نشد.',
        hint: 'لطفاً دوباره بخوان و تغییر را تکرار کن.',
      });
    }

    return okJson({ ok: true, revision: result.revision, softDeleted: result.softDeleted ?? 0 });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در نوشتن دیتابیس');
  }
}
