// ─── API ایجنت همکار: ثبت و خواندن پیشنهادها ───────────────────────
// 🔒 نیاز به کلید: Authorization: Bearer <AGENT_API_KEY>
//
// ⚠️ پیشنهادهایی که اینجا ثبت می‌شوند **اجرا نمی‌شوند**.
//    فقط در تب «پیشنهادات ایجنت» می‌نشینند تا کارفرما خودش تأیید یا رد کند.
import { checkAgentAuth } from '@/lib/agent-auth';
import { getAppPool } from '@/lib/db';
import { fail, okJson, readJson } from '@/lib/api-utils';
import { insertSuggestion, listSuggestions } from '@/lib/repo';
import { ensureSchema } from '@/lib/api-utils';
import type { SuggestionKind } from '@/lib/types';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const ALLOWED_KINDS: SuggestionKind[] = [
  'task_add', 'task_update', 'task_set_status', 'task_toggle_done',
  'project_add', 'project_set_status', 'note',
];

/** فهرست پیشنهادها را ببین (تا ایجنت پیشنهاد تکراری ندهد) */
export async function GET(req: Request) {
  const pool = getAppPool();
  const auth = await checkAgentAuth(req, pool);
  if (!auth.ok) return fail(auth.status, auth.error, auth.hint);
  if (!pool) return fail(503, 'برنامه به دیتابیس وصل نیست.', '');

  try {
    const status = new URL(req.url).searchParams.get('status') ?? undefined;
    const items = await listSuggestions(pool, status);
    return okJson({ ok: true, count: items.length, items });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در خواندن پیشنهادها');
  }
}

interface SuggestionBody {
  title?: unknown;
  body?: unknown;
  kind?: unknown;
  payload?: unknown;
  agentName?: unknown;
  id?: unknown;
  /** می‌توانی چند پیشنهاد را یک‌جا بفرستی */
  suggestions?: unknown;
}

export async function POST(req: Request) {
  const pool = getAppPool();
  const auth = await checkAgentAuth(req, pool);
  if (!auth.ok) return fail(auth.status, auth.error, auth.hint);
  if (!pool) return fail(503, 'برنامه به دیتابیس وصل نیست.', '');

  const raw = await readJson<SuggestionBody>(req);
  if (!raw) return fail(400, 'بدنهٔ درخواست JSON معتبر نیست.', '');

  // پشتیبانی از ارسال گروهی
  const list: SuggestionBody[] = Array.isArray(raw.suggestions)
    ? (raw.suggestions as SuggestionBody[])
    : [raw];

  if (list.length === 0) return fail(400, 'هیچ پیشنهادی فرستاده نشد.', '');
  if (list.length > 50) return fail(400, 'حداکثر ۵۰ پیشنهاد در هر درخواست.', '');

  try {
    await ensureSchema(pool);

    const created = [];
    const rejected: { title: string; reason: string }[] = [];

    for (const item of list) {
      const title = typeof item.title === 'string' ? item.title.trim() : '';
      if (!title) {
        rejected.push({ title: '(بی‌عنوان)', reason: 'عنوان (title) اجباری است.' });
        continue;
      }

      const kindRaw = typeof item.kind === 'string' ? item.kind : 'note';
      const kind = (ALLOWED_KINDS as string[]).includes(kindRaw)
        ? (kindRaw as SuggestionKind)
        : 'note';

      let payload: Record<string, unknown> | null = null;
      if (item.payload && typeof item.payload === 'object' && !Array.isArray(item.payload)) {
        payload = item.payload as Record<string, unknown>;
      }

      // اعتبارسنجی حداقلی payload تا پیشنهاد ناقص وارد نشود
      if (kind !== 'note') {
        const needId: SuggestionKind[] = ['task_update', 'task_set_status', 'task_toggle_done', 'project_set_status'];
        if (needId.includes(kind) && typeof payload?.id !== 'string') {
          rejected.push({ title, reason: `برای نوع «${kind}» فیلد payload.id اجباری است.` });
          continue;
        }
        if (kind === 'task_add' && typeof payload?.text !== 'string') {
          rejected.push({ title, reason: "برای نوع «task_add» فیلد payload.text اجباری است." });
          continue;
        }
        if (kind === 'project_add' && typeof payload?.name !== 'string') {
          rejected.push({ title, reason: "برای نوع «project_add» فیلد payload.name اجباری است." });
          continue;
        }
      }

      const sug = await insertSuggestion(pool, {
        agentName: typeof item.agentName === 'string' ? item.agentName : 'ایجنت همکار',
        title,
        body: typeof item.body === 'string' ? item.body : '',
        kind,
        payload,
        id: typeof item.id === 'string' ? item.id : undefined,
      });
      created.push(sug);
    }

    return okJson({
      ok: true,
      createdCount: created.length,
      rejectedCount: rejected.length,
      created,
      rejected,
      message:
        'پیشنهادها ثبت شدند و در تب «پیشنهادات ایجنت» منتظر تأیید کارفرما هستند. ' +
        'هیچ‌کدام خودکار اجرا نمی‌شوند.',
    });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در ثبت پیشنهاد');
  }
}
