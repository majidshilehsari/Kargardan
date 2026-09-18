// ─── API: تصمیم دربارهٔ یک پیشنهاد (تأیید / رد / برگرداندن) ─────────
import { getAppPool } from '@/lib/db';
import { decideSuggestion, revertSuggestion } from '@/lib/repo';
import { fail, notConfigured, okJson, readJson } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function POST(
  req: Request,
  ctx: { params: Promise<{ id: string }> }
) {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  const { id } = await ctx.params;
  const body = await readJson<{ decision?: string; note?: string }>(req);
  const decision = body?.decision;
  const note = typeof body?.note === 'string' ? body.note : '';

  if (!id) return fail(400, 'شناسهٔ پیشنهاد مشخص نیست.');

  try {
    if (decision === 'approved' || decision === 'rejected') {
      const result = await decideSuggestion(pool, id, decision, note);
      return okJson(result, result.ok ? 200 : 400);
    }

    if (decision === 'revert') {
      const result = await revertSuggestion(pool, id);
      return okJson(result, result.ok ? 200 : 400);
    }

    return fail(400, 'تصمیم نامعتبر.', "فقط 'approved' / 'rejected' / 'revert' مجاز است.");
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در اعمال تصمیم');
  }
}
