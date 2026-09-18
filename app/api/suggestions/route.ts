// ─── API: پیشنهادهای ایجنت همکار (برای خودِ برنامه) ────────────────
// این مسیر برای رابط کاربری خودت است؛ نیاز به کلید ایجنت ندارد
// (چون از داخل خود برنامه و روی دامنهٔ خودت صدا زده می‌شود).
import { getAppPool } from '@/lib/db';
import { listRevertedSuggestionIds, listSuggestions } from '@/lib/repo';
import { ensureSchema, fail, notConfigured, okJson } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  try {
    await ensureSchema(pool);
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    const [items, revertedIds] = await Promise.all([
      listSuggestions(pool, status),
      listRevertedSuggestionIds(pool),
    ]);

    return okJson({
      ok: true,
      count: items.length,
      pendingCount: items.filter((s) => s.status === 'pending').length,
      revertedIds,
      items,
    });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در خواندن پیشنهادها');
  }
}
