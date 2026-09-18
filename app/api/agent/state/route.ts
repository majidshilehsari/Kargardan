// ─── API ایجنت همکار: خواندن کامل دیتابیس ──────────────────────────
// 🔒 نیاز به کلید: Authorization: Bearer <AGENT_API_KEY>
// 🔒 فقط خواندنی — هیچ نوشتنی در این مسیر وجود ندارد.
import { checkAgentAuth } from '@/lib/agent-auth';
import { getAppPool } from '@/lib/db';
import { fail, okJson } from '@/lib/api-utils';
import { listHistory, listSuggestions, listTrash, readState } from '@/lib/repo';
import { listTables } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const auth = checkAgentAuth(req);
  if (!auth.ok) return fail(auth.status, auth.error, auth.hint);

  const pool = getAppPool();
  if (!pool) {
    return fail(503, 'برنامه به دیتابیس وصل نیست.', 'کارفرما باید متغیر محیطی دیتابیس را تنظیم کند.');
  }

  try {
    const { state, revision } = await readState(pool);
    const [trash, suggestions, history, tables] = await Promise.all([
      listTrash(pool),
      listSuggestions(pool),
      listHistory(pool, 50),
      listTables(pool),
    ]);

    // داده‌ی غنی برای تحلیل ایجنت: کارهای باز با سن‌شان
    const now = Date.now();
    const day = 86_400_000;
    const openTasks = state.tasks.filter((t) => !t.done);

    const projectName = (id: string | null) =>
      state.projects.find((p) => p.id === id)?.name ?? null;

    return okJson({
      ok: true,
      revision,
      tables,
      counts: {
        tasks: state.tasks.length,
        openTasks: openTasks.length,
        doneTasks: state.tasks.length - openTasks.length,
        projects: state.projects.length,
        activeProjects: state.projects.filter((p) => p.status === 'active').length,
        inbox: state.inbox.length,
        trash: trash.length,
        suggestions: suggestions.length,
        pendingSuggestions: suggestions.filter((s) => s.status === 'pending').length,
      },
      settings: state.settings,
      projects: state.projects.map((p) => ({
        ...p,
        nextStep:
          openTasks.find((t) => t.projectId === p.id && t.isNextStep)?.text ?? null,
        openTaskCount: openTasks.filter((t) => t.projectId === p.id).length,
      })),
      tasks: openTasks.map((t) => ({
        ...t,
        projectName: projectName(t.projectId),
        ageDays: Math.round(((now - t.createdAt) / day) * 10) / 10,
      })),
      doneTasks: state.tasks.filter((t) => t.done).slice(0, 50),
      inbox: state.inbox.map((i) => ({
        ...i,
        ageDays: Math.round(((now - i.createdAt) / day) * 10) / 10,
      })),
      trash,
      suggestions,
      recentHistory: history,
      generatedAt: new Date().toISOString(),
    });
  } catch (err) {
    const code = (err as { code?: string })?.code ?? 'UNKNOWN';
    return fail(500, code, err instanceof Error ? err.message : 'خطا در خواندن دیتابیس');
  }
}
