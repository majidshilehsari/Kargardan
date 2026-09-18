// ─── API: تاریخچهٔ تغییرات ─────────────────────────────────────────
// تا بتوانی ببینی چه چیزی، کِی و توسط کی عوض شده — و پیشنهادهای اجراشده را برگردانی.
import { getAppPool } from '@/lib/db';
import { fail, notConfigured, okJson } from '@/lib/api-utils';
import { listHistory } from '@/lib/repo';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  try {
    const limit = Number(new URL(req.url).searchParams.get('limit') ?? '50') || 50;
    const items = await listHistory(pool, limit);
    return okJson({ ok: true, count: items.length, items });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در خواندن تاریخچه');
  }
}
