// ─── API ایجنت همکار: دفترچهٔ راهنما ───────────────────────────────
// ایجنت همکار اول این را می‌خواند تا بفهمد چه داده‌ای هست و چه پیشنهادی می‌تواند بدهد.
// 🔒 نیاز به کلید: Authorization: Bearer <AGENT_API_KEY>
import { checkAgentAuth } from '@/lib/agent-auth';
import { getAppPool } from '@/lib/db';
import { fail, okJson } from '@/lib/api-utils';
import { readState } from '@/lib/repo';
import { TABLES } from '@/lib/schema';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const pool = getAppPool();
  const auth = await checkAgentAuth(req, pool);
  if (!auth.ok) {
    return fail(auth.status, auth.error, auth.hint);
  }
  if (!pool) {
    return fail(503, 'برنامه به دیتابیس وصل نیست.', '');
  }

  let counts = { tasks: 0, projects: 0, inbox: 0, pendingSuggestions: 0 };
  let dbReady = false;

  try {
    const { state } = await readState(pool);
    const pending = await pool.query(
      `select count(*)::int as n from ${TABLES.suggestions} where status = 'pending'`
    );
    counts = {
      tasks: state.tasks.length,
      projects: state.projects.length,
      inbox: state.inbox.length,
      pendingSuggestions: pending.rows[0]?.n ?? 0,
    };
    dbReady = true;
  } catch {
    dbReady = false;
  }

  return okJson({
    ok: true,
    app: {
      name: 'کارگردان',
      nameEn: 'Kargardan',
      purpose:
        'سیستم‌عامل زندگی شخصی: تخلیهٔ ذهن، تفکیک مهم از فوری، سقف جبهه‌های فعال. ' +
        'دستیار شخصی + سیستم مدیریت زندگی.',
      philosophy:
        'مغز محل نگهداری فهرست کارها نیست. سه لایه: ۱) تخلیهٔ کامل ذهن ۲) تفکیک مهم از فوری ' +
        '۳) سقف ۳ جبههٔ فعال هم‌زمان. «پارک‌شده» یعنی عمداً تصمیم گرفته‌ای الان نه — ' +
        'چیزی که آدم را خسته می‌کند کارهای زیاد نیست، تصمیم‌های باز است.',
      timezone: 'Asia/Tehran',
      language: 'فارسی (راست‌به‌چپ)',
    },
    database: { ready: dbReady, tables: TABLES },
    currentCounts: counts,

    // ─── مدل داده ────────────────────────────────────────────────
    dataModel: {
      task: {
        id: 'string',
        text: 'string — متن کار',
        status: "'now' (الان) | 'later' (بعداً) | 'waiting' (منتظر دیگری) | 'parked' (پارک‌شده)",
        projectId: 'string | null',
        isNextStep: 'boolean — قدم بعدیِ آن پروژه (برای هر پروژه حداکثر یکی)',
        waitingOn: "string — فقط برای waiting: توپ در زمین کیست",
        note: 'string — فقط برای parked: چرا پارک شده',
        done: 'boolean',
        createdAt: 'number (unix ms)',
        updatedAt: 'number (unix ms)',
        deletedAt: 'number | null — اگر پر باشد یعنی در سطل بازیافت است، نه پاک‌شده',
      },
      project: {
        id: 'string',
        name: 'string',
        status: "'active' (فعال) | 'queued' (در صف) | 'parked' | 'done'",
        createdAt: 'number',
        deletedAt: 'number | null',
      },
      inboxItem: {
        id: 'string',
        text: 'string — چیزی که ذهن را اشغال کرده و هنوز پردازش نشده',
        createdAt: 'number',
        deletedAt: 'number | null',
      },
    },

    // ─── APIهایی که در اختیار داری ───────────────────────────────
    endpoints: {
      'GET /api/agent/context': 'همین صفحه — راهنما و خلاصهٔ وضعیت',
      'GET /api/agent/state': 'خواندن کامل دیتابیس (کارها، پروژه‌ها، صندوق، پیشنهادها، سطل بازیافت)',
      'GET /api/agent/suggestions': 'فهرست پیشنهادهای قبلی و وضعیتشان',
      'POST /api/agent/suggestions': 'ثبت پیشنهاد جدید',
    },

    // ─── انواع پیشنهاد مجاز ──────────────────────────────────────
    suggestionKinds: {
      task_add: {
        label: 'ساخت کار جدید',
        payload: { text: 'string (اجباری)', status: "'now'|'later'|'waiting'|'parked'، پیش‌فرض later", projectId: 'string|null', waitingOn: 'string', note: 'string' },
      },
      task_update: {
        label: 'ویرایش کار موجود',
        payload: { id: 'string (اجباری، شناسهٔ کار موجود)', text: 'string', waitingOn: 'string', note: 'string', projectId: 'string|null' },
      },
      task_set_status: {
        label: 'تغییر وضعیت کار',
        payload: { id: 'string (اجباری)', status: "'now'|'later'|'waiting'|'parked' (اجباری)" },
      },
      task_toggle_done: {
        label: 'تمام‌کردن / برگرداندن کار',
        payload: { id: 'string (اجباری)', done: 'boolean (اختیاری، پیش‌فرض برعکس وضعیت فعلی)' },
      },
      project_add: {
        label: 'ساخت پروژهٔ جدید',
        payload: { name: 'string (اجباری)', status: "'active'|'queued'|'parked'|'done'، پیش‌فرض queued" },
      },
      project_set_status: {
        label: 'تغییر وضعیت پروژه',
        payload: { id: 'string (اجباری)', status: "'active'|'queued'|'parked'|'done' (اجباری)" },
      },
      note: {
        label: 'یادداشت / پیشنهاد آزاد (بدون تغییر داده)',
        payload: 'برای این نوع، payload لازم نیست — فقط title و body کافی است',
      },
    },

    // ─── قواعد مهم برای ایجنت ────────────────────────────────────
    rules: [
      'پیشنهادها به‌صورت «در انتظار تأیید» ثبت می‌شوند و هرگز خودکار اجرا نمی‌شوند.',
      'کارفرما هر پیشنهاد را دستی تأیید یا رد می‌کند.',
      'حتی پس از تأیید و اجرا، کارفرما می‌تواند پیشنهاد را برگرداند (revert).',
      'هیچ چیزی در این برنامه پاک نمی‌شود؛ حذف یعنی رفتن به سطل بازیافت.',
      'پیشنهادهای کوچک و مشخص بده؛ هر پیشنهاد یک تغییر.',
      'دسترسی تو از داخل برنامه قابل قطع است؛ اگر ۴۰۳ گرفتی یعنی کارفرما در را بسته است — دوباره تلاش نکن.',
      'همیشه در «body» توضیح بده چرا این پیشنهاد را می‌دهی.',
      'کد ۴۰۳ = دسترسی از طرف کارفرما قطع شده. کد ۴۰۱ = کلید اشتباه است.',
      'از ساخت پروژهٔ فعالِ زیاد پرهیز کن — سقف پیش‌فرض ۳ جبههٔ فعال است.',
    ],

    examples: {
      postSuggestion: {
        method: 'POST',
        url: '/api/agent/suggestions',
        headers: {
          Authorization: 'Bearer <AGENT_API_KEY>',
          'Content-Type': 'application/json',
        },
        body: {
          title: 'انتقال «تماس با بانک» به بعداً',
          body: 'این کار ۹ روز است در «الان» مانده ولی قدم بعدی هیچ جبهه‌ای نیست؛ بهتر است به «بعداً» برود تا فهرست الان خلوت بماند.',
          kind: 'task_set_status',
          payload: { id: '<شناسهٔ کار>', status: 'later' },
        },
      },
    },
  });
}
