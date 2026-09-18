// ─── API: کنترل دسترسی ایجنت همکار (از داخل خود برنامه) ────────────
//
// این مسیر برای رابط کاربری خودِ برنامه است — همان جایی که با یک دکمه
// دسترسی ایجنت را باز/بسته می‌کنی و کلید را می‌بینی یا عوض می‌کنی.
// این مسیر خودش با کلید ایجنت محافظت نمی‌شود (چون از داخل برنامه صدا زده می‌شود).
import { NextResponse } from 'next/server';
import { getAppPool } from '@/lib/db';
import {
  ensureAgentKey,
  getAgentAccess,
  regenerateAgentKey,
  setAgentEnabled,
} from '@/lib/agent-auth';
import {
  crossSiteRejected,
  ensureSchema,
  isCrossSiteRequest,
  readJson,
} from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

const NO_STORE = { 'Cache-Control': 'no-store, no-cache, must-revalidate' } as const;

function payload(access: Awaited<ReturnType<typeof getAgentAccess>>) {
  return {
    ok: true,
    enabled: access.enabled,
    keyConfigured: access.keyConfigured,
    keySource: access.keySource,
    envOverride: access.envOverride,
    key: access.key,
    updatedAt: access.updatedAt,
  };
}

async function withPool() {
  const pool = getAppPool();
  if (pool) await ensureSchema(pool);
  return pool;
}

export async function GET() {
  const pool = await withPool();
  if (!pool) {
    return NextResponse.json(
      {
        ok: false,
        status: 'not_configured',
        error: 'دیتابیس وصل نیست؛ کلید ایجنت در دیتابیس ذخیره می‌شود.',
      },
      { status: 200, headers: NO_STORE }
    );
  }

  try {
    const access = await getAgentAccess(pool);
    return NextResponse.json(payload(access), { headers: NO_STORE });
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as { code?: string })?.code ?? 'UNKNOWN',
        message: err instanceof Error ? err.message : 'خطای ناشناخته',
      },
      { status: 200, headers: NO_STORE }
    );
  }
}

export async function POST(req: Request) {
  if (isCrossSiteRequest(req)) return crossSiteRejected();

  const pool = await withPool();
  if (!pool) {
    return NextResponse.json(
      { ok: false, error: 'دیتابیس وصل نیست.' },
      { status: 200, headers: NO_STORE }
    );
  }

  const body = await readJson<{ action?: string }>(req);
  const action = body?.action;

  try {
    switch (action) {
      // ساخت کلید اگر وجود ندارد (بار اول که تب باز می‌شود)
      case 'ensure': {
        await ensureAgentKey(pool);
        const access = await getAgentAccess(pool);
        return NextResponse.json(
          { ...payload(access), message: 'کلید ایجنت آماده است.' },
          { headers: NO_STORE }
        );
      }

      // 🔄 ساخت کلید جدید — کلید قبلی بلافاصله بی‌اعتبار می‌شود
      case 'regenerate': {
        await regenerateAgentKey(pool);
        const access = await getAgentAccess(pool);
        return NextResponse.json(
          {
            ...payload(access),
            message: 'کلید جدید ساخته شد. کلید قبلی دیگر کار نمی‌کند.',
          },
          { headers: NO_STORE }
        );
      }

      // ▶️ بازکردن دسترسی
      case 'enable': {
        await setAgentEnabled(pool, true);
        const access = await getAgentAccess(pool);
        return NextResponse.json(
          { ...payload(access), message: 'دسترسی ایجنت همکار باز شد.' },
          { headers: NO_STORE }
        );
      }

      // ⏸ بستن دسترسی — کلید توقف
      case 'disable': {
        await setAgentEnabled(pool, false);
        const access = await getAgentAccess(pool);
        return NextResponse.json(
          {
            ...payload(access),
            message:
              'دسترسی ایجنت همکار قطع شد. از این لحظه حتی با کلید درست هم هیچ درخواستی پذیرفته نمی‌شود.',
          },
          { headers: NO_STORE }
        );
      }

      default:
        return NextResponse.json(
          {
            ok: false,
            error: 'عملیات نامعتبر.',
            hint: "action باید یکی از این‌ها باشد: ensure / regenerate / enable / disable",
          },
          { status: 400, headers: NO_STORE }
        );
    }
  } catch (err) {
    return NextResponse.json(
      {
        ok: false,
        error: (err as { code?: string })?.code ?? 'UNKNOWN',
        message: err instanceof Error ? err.message : 'خطای ناشناخته',
      },
      { status: 200, headers: NO_STORE }
    );
  }
}
