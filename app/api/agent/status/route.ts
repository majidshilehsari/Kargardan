// ─── API: وضعیت درِ ایجنت همکار (برای رابط کاربری خود برنامه) ───────
// فقط وضعیت را می‌گوید — کلید اینجا نمایش داده نمی‌شود (آن در /api/agent/key است).
import { NextResponse } from 'next/server';
import { getAppPool } from '@/lib/db';
import { getAgentAccess } from '@/lib/agent-auth';
import { resolvePublicOrigin } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = resolvePublicOrigin(req);
  const pool = getAppPool();

  let enabled = false;
  let keyConfigured = false;
  let keySource: 'db' | 'env' | 'none' = 'none';

  if (pool) {
    try {
      const access = await getAgentAccess(pool);
      enabled = access.enabled;
      keyConfigured = access.keyConfigured;
      keySource = access.keySource;
    } catch {
      /* دیتابیس در دسترس نیست */
    }
  }

  return NextResponse.json(
    {
      ok: true,
      agentAccessEnabled: enabled && keyConfigured,
      keyConfigured,
      keySource,
      databaseConnected: pool !== null,
      baseUrl: origin,
      endpoints: {
        context: `${origin}/api/agent/context`,
        state: `${origin}/api/agent/state`,
        suggestions: `${origin}/api/agent/suggestions`,
      },
    },
    { headers: { 'Cache-Control': 'no-store' } }
  );
}
