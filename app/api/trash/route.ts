// ─── API: 🗑 سطل بازیافت ────────────────────────────────────────────
// هیچ چیزی در این برنامه واقعاً پاک نمی‌شود؛ حذف یعنی رفتن به اینجا.
// «پاک‌کردن قطعی» فقط با درخواست صریح کاربر (action: 'purge') انجام می‌شود.
import { getAppPool } from '@/lib/db';
import { listTrash, purgeTrash, restoreTrash } from '@/lib/repo';
import { fail, notConfigured, okJson, readJson } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET() {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  try {
    const items = await listTrash(pool);
    return okJson({ ok: true, count: items.length, items });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در خواندن سطل بازیافت');
  }
}

export async function POST(req: Request) {
  const pool = getAppPool();
  if (!pool) return notConfigured();

  const body = await readJson<{ action?: string; kind?: string; id?: string }>(req);
  const action = body?.action;
  const kind = body?.kind;
  const id = body?.id;

  if (!action || !kind || !id) {
    return fail(400, 'پارامتر ناقص است.', 'action / kind / id هر سه لازم‌اند.');
  }

  try {
    if (action === 'restore') {
      const done = await restoreTrash(pool, kind, id);
      return okJson({
        ok: done,
        message: done ? 'مورد از سطل بازیافت برگردانده شد.' : 'مورد پیدا نشد یا قبلاً برگردانده شده.',
      });
    }

    if (action === 'purge') {
      const done = await purgeTrash(pool, kind, id);
      return okJson({
        ok: done,
        message: done ? 'برای همیشه پاک شد.' : 'مورد پیدا نشد.',
      });
    }

    return fail(400, 'عملیات ناشناخته.', "فقط 'restore' یا 'purge' مجاز است.");
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در عملیات سطل بازیافت');
  }
}
