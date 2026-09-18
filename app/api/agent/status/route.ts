// ─── API: آیا درِ ایجنت همکار باز است؟ ──────────────────────────────
// فقط یک بله/خیر برمی‌گرداند — هیچ دادهٔ حساسی اینجا نیست.
import { NextResponse } from 'next/server';
import { AGENT_KEY_ENV } from '@/lib/agent-auth';
import { getAppPool } from '@/lib/db';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  const origin = new URL(req.url).origin;
  const configured = Boolean((process.env[AGENT_KEY_ENV] ?? '').trim());

  return NextResponse.json(
    {
      ok: true,
      agentAccessEnabled: configured,
      keyEnvVar: AGENT_KEY_ENV,
      databaseConnected: getAppPool() !== null,
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
