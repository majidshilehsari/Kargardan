'use client';

// ─── تب «ایجنت همکار» ──────────────────────────────────────────────
// کارگردان دو ایجنت دارد:
//   • ایجنت همکار → فقط از راه API به دیتابیس دسترسی دارد، به سورس‌کد ندارد.
//   • ایجنت مادر   → به سورس‌کد و دیتابیس دسترسی دارد (همان که این برنامه را می‌سازد).
// این صفحه، «درِ ورودی» ایجنت همکار و راهنمای اتصالش است.

import React, { useCallback, useEffect, useState } from 'react';
import { faNum } from '@/lib/format';

interface AgentStatus {
  agentAccessEnabled: boolean;
  keyEnvVar: string;
  databaseConnected: boolean;
  baseUrl: string;
  endpoints: { context: string; state: string; suggestions: string };
}

function CopyButton({ text, label = 'کپی' }: { text: string; label?: string }) {
  const [done, setDone] = useState(false);

  const copy = async () => {
    try {
      await navigator.clipboard.writeText(text);
      setDone(true);
      setTimeout(() => setDone(false), 1600);
    } catch {
      window.prompt('دستی کپی کن:', text);
    }
  };

  return (
    <button className="btn btn-small" onClick={() => void copy()}>
      {done ? '✅ کپی شد' : `📋 ${label}`}
    </button>
  );
}

export default function AgentPanel() {
  const [status, setStatus] = useState<AgentStatus | null>(null);
  const [loading, setLoading] = useState(true);
  const [reveal, setReveal] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/agent/status', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) setStatus(data);
    } catch {
      /* ignore */
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  if (loading) {
    return (
      <section className="card">
        <h2 className="card-title">🤝 ایجنت همکار</h2>
        <p className="db-note">⏳ در حال خواندن وضعیت…</p>
      </section>
    );
  }

  const base = status?.baseUrl ?? '';
  const enabled = status?.agentAccessEnabled ?? false;

  return (
    <>
      <section className="card">
        <h2 className="card-title">
          🤝 ایجنت همکار
          <span className="card-sub">— دسترسی به دیتابیس، از راه API</span>
        </h2>

        <p className="inbox-intro">
          کارگردان دو ایجنت دارد. <b>ایجنت همکار</b> فقط از راه همین APIها به داده‌ها نگاه
          می‌کند و پیشنهاد می‌دهد — به سورس‌کد دسترسی ندارد. <b>ایجنت مادر</b> (همان که این
          برنامه را می‌سازد) به سورس‌کد و دیتابیس هر دو دسترسی دارد.
        </p>

        <div className={`db-status ${enabled ? 'db-status-ok' : 'db-status-warn'}`}>
          <span className="db-dot">{enabled ? '🟢' : '🟡'}</span>
          <span className="db-label">
            {enabled ? 'درِ ایجنت همکار باز است' : 'درِ ایجنت همکار بسته است'}
          </span>
        </div>

        {!enabled && (
          <p className="db-hint">
            🔒 برای بازکردن این در، یک متغیر محیطی به نام{' '}
            <code className="db-code">{status?.keyEnvVar ?? 'AGENT_API_KEY'}</code> بساز و مقدارش را
            یک رشتهٔ تصادفی طولانی بگذار (مثلاً ۴۰ کاراکتر). این کلید را در{' '}
            <b>Vercel → Settings → Environment Variables</b> بگذار و برنامه را دوباره راه‌اندازی کن.
            بعد همان کلید را به ایجنت همکار بده.
            <br />
            <br />
            🔐 تا آن موقع، این مسیرها <b>کاملاً بسته</b> می‌مانند و هیچ‌کس به داده‌هایت دسترسی
            ندارد.
          </p>
        )}

        <div className="db-grid" style={{ marginTop: 12 }}>
          <div className="kv">
            <span className="kv-k">نشانی پایه</span>
            <span className="kv-v">
              <code className="db-code">{base || 'نامشخص'}</code>
            </span>
          </div>
          <div className="kv">
            <span className="kv-k">دیتابیس</span>
            <span className="kv-v">
              {status?.databaseConnected ? '🟢 وصل است' : '🔴 وصل نیست'}
            </span>
          </div>
          <div className="kv">
            <span className="kv-k">متغیر کلید</span>
            <span className="kv-v">
              <code className="db-code">{status?.keyEnvVar ?? 'AGENT_API_KEY'}</code>
            </span>
          </div>
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">🔌 APIهایی که در اختیار ایجنت همکار است</h2>

        {[
          {
            method: 'GET',
            url: status?.endpoints.context ?? '/api/agent/context',
            desc: 'دفترچهٔ راهنما — مدل داده، انواع پیشنهاد، قواعد. ایجنت اول این را می‌خواند.',
          },
          {
            method: 'GET',
            url: status?.endpoints.state ?? '/api/agent/state',
            desc: 'خواندن کامل دیتابیس — کارها، پروژه‌ها، صندوق ذهن، سطل بازیافت، پیشنهادها و سن هر مورد.',
          },
          {
            method: 'GET',
            url: status?.endpoints.suggestions ?? '/api/agent/suggestions',
            desc: 'فهرست پیشنهادهای قبلی — تا پیشنهاد تکراری داده نشود.',
          },
          {
            method: 'POST',
            url: status?.endpoints.suggestions ?? '/api/agent/suggestions',
            desc: 'ثبت پیشنهاد جدید. ⚠️ ثبت ≠ اجرا؛ پیشنهاد در تب «پیشنهادات ایجنت» منتظر تأیید تو می‌ماند.',
          },
        ].map((e) => (
          <div className="api-row" key={`${e.method}-${e.url}`}>
            <span className={`api-method ${e.method === 'GET' ? 'api-get' : 'api-post'}`}>
              {e.method}
            </span>
            <code className="db-code api-url">{e.url}</code>
            <CopyButton text={e.url} />
            <p className="api-desc">{e.desc}</p>
          </div>
        ))}

        <p className="db-note" style={{ marginTop: 12 }}>
          همهٔ این مسیرها به هدر <code className="db-code">Authorization: Bearer &lt;کلید&gt;</code>{' '}
          نیاز دارند.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">📨 متن آماده برای دادن به ایجنت همکار</h2>
        <p className="db-note">
          این متن را کپی کن و به ایجنت همکارت بده. کلید را جایگزین کن (کلید را اینجا ننوشتم تا در
          تاریخچهٔ مرورگر نماند).
        </p>

        <div className="prompt-box">
          <div className="prompt-head">
            <span>متن راهنمای ایجنت همکار</span>
            <div>
              <button className="btn btn-small" onClick={() => setReveal((v) => !v)}>
                {reveal ? '🙈 پنهان کن' : '👁 نشانم بده'}
              </button>{' '}
              <CopyButton
                label="کپی متن"
                text={
                  `تو «ایجنت همکار» پروژهٔ کارگردان هستی.\n` +
                  `کارگردان یک سیستم‌عامل زندگی شخصی است: تخلیهٔ ذهن، تفکیک مهم از فوری، سقف جبهه‌های فعال.\n\n` +
                  `نشانی پایه: ${base}\n` +
                  `کلید دسترسی: <AGENT_API_KEY خودت را اینجا بگذار>\n\n` +
                  `اول این را بخوان تا مدل داده و انواع پیشنهاد را بفهمی:\n` +
                  `GET ${status?.endpoints.context ?? base + '/api/agent/context'}\n` +
                  `هدر: Authorization: Bearer <کلید>\n\n` +
                  `بعد وضعیت کامل را بخوان:\n` +
                  `GET ${status?.endpoints.state ?? base + '/api/agent/state'}\n\n` +
                  `سپس بر اساس آنچه دیدی، پیشنهادهای کوچک و مشخص بده:\n` +
                  `POST ${status?.endpoints.suggestions ?? base + '/api/agent/suggestions'}\n` +
                  `Content-Type: application/json\n` +
                  `Authorization: Bearer <کلید>\n\n` +
                  `نمونهٔ بدنه:\n` +
                  `{"title":"عنوان کوتاه","body":"چرا این پیشنهاد را می‌دهم","kind":"task_set_status","payload":{"id":"<شناسه>","status":"later"}}\n\n` +
                  `قواعد:\n` +
                  `- پیشنهادها خودکار اجرا نمی‌شوند؛ کارفرما دستی تأیید می‌کند.\n` +
                  `- هر پیشنهاد فقط یک تغییر کوچک باشد.\n` +
                  `- همیشه در body توضیح بده چرا.\n` +
                  `- قبل از پیشنهاد، GET suggestions را بزن تا تکراری ندهی.\n` +
                  `- هیچ چیزی پاک نمی‌شود؛ حذف یعنی رفتن به سطل بازیافت.\n`
                }
              />
            </div>
          </div>

          {reveal && (
            <pre className="prompt-pre">
{`تو «ایجنت همکار» پروژهٔ کارگردان هستی.
کارگردان یک سیستم‌عامل زندگی شخصی است: تخلیهٔ ذهن، تفکیک مهم از فوری، سقف جبهه‌های فعال.

نشانی پایه: ${base}
کلید دسترسی: <AGENT_API_KEY خودت را اینجا بگذار>

۱) خواندن راهنما:
   GET ${status?.endpoints.context ?? base + '/api/agent/context'}

۲) خواندن وضعیت کامل:
   GET ${status?.endpoints.state ?? base + '/api/agent/state'}

۳) ثبت پیشنهاد:
   POST ${status?.endpoints.suggestions ?? base + '/api/agent/suggestions'}
   Content-Type: application/json

نمونهٔ بدنه:
{"title":"انتقال «تماس با بانک» به بعداً","body":"۹ روز است در الان مانده و قدم بعدی هیچ جبهه‌ای نیست.","kind":"task_set_status","payload":{"id":"<شناسه>","status":"later"}}

همهٔ درخواست‌ها یک هدر لازم دارند:
   Authorization: Bearer <کلید>`}
            </pre>
          )}
        </div>
      </section>

      <section className="card">
        <h2 className="card-title">🧪 نمونهٔ curl</h2>
        <pre className="prompt-pre">
{`# ۱) راهنما
curl -H "Authorization: Bearer $AGENT_API_KEY" \\
  ${base}/api/agent/context

# ۲) وضعیت کامل
curl -H "Authorization: Bearer $AGENT_API_KEY" \\
  ${base}/api/agent/state

# ۳) ثبت یک پیشنهاد
curl -X POST ${base}/api/agent/suggestions \\
  -H "Authorization: Bearer $AGENT_API_KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"...","body":"...","kind":"note"}'`}
        </pre>
      </section>

      <p className="footer">
        🔒 ایجنت همکار فقط <b>می‌خواند</b> و <b>پیشنهاد</b> می‌دهد. هیچ‌وقت مستقیم چیزی را
        عوض نمی‌کند — و تو همیشه می‌توانی برگردانی.
      </p>
    </>
  );
}
