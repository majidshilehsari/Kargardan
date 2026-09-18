'use client';

// ─── تب «ایجنت همکار» ──────────────────────────────────────────────
// کارگردان دو ایجنت دارد:
//   • ایجنت همکار → فقط از راه API به دیتابیس دسترسی دارد، به سورس‌کد ندارد.
//   • ایجنت مادر   → سورس‌کد + دیتابیس (همان که این برنامه را می‌سازد).
//
// 🔑 همه‌چیز از همین‌جا کنترل می‌شود — بدون هیچ متغیر محیطی:
//   • کلید خودش ساخته می‌شود
//   • با یک دکمه قطع/وصل می‌شود
//   • کلید را می‌توانی عوض کنی

import React, { useCallback, useEffect, useState } from 'react';
import { withBusy } from '@/lib/busy';
import { BusyRow, Spinner } from './Busy';
import ChatGptBridge from './ChatGptBridge';

interface AgentKeyState {
  enabled: boolean;
  keyConfigured: boolean;
  keySource: 'db' | 'env' | 'none';
  envOverride: boolean;
  key: string;
  updatedAt: number | null;
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

function timeFa(ts: number): string {
  return new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(ts);
}

export default function AgentPanel() {
  const [state, setState] = useState<AgentKeyState | null>(null);
  const [base, setBase] = useState('');
  const [dbConnected, setDbConnected] = useState(true);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [reveal, setReveal] = useState(false);
  const [working, setWorking] = useState('');

  /** خواندن وضعیت؛ اگر کلید نبود، خودش می‌سازد */
  const load = useCallback(async (createIfMissing: boolean) => {
    try {
      const res = await fetch('/api/agent/key', {
        method: createIfMissing ? 'POST' : 'GET',
        headers: createIfMissing ? { 'Content-Type': 'application/json' } : undefined,
        body: createIfMissing ? JSON.stringify({ action: 'ensure' }) : undefined,
        cache: 'no-store',
      });
      const data = await res.json();

      if (!data?.ok) {
        setDbConnected(false);
        return;
      }

      setDbConnected(true);
      setState({
        enabled: Boolean(data.enabled),
        keyConfigured: Boolean(data.keyConfigured),
        keySource: data.keySource ?? 'none',
        envOverride: Boolean(data.envOverride),
        key: String(data.key ?? ''),
        updatedAt: data.updatedAt ?? null,
      });

      const st = await fetch('/api/agent/status', { cache: 'no-store' });
      const stData = await st.json();
      if (stData?.baseUrl) setBase(stData.baseUrl);
    } catch {
      setDbConnected(false);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    // بار اول که این تب باز می‌شود، اگر کلیدی نباشد ساخته می‌شود
    void load(true);
  }, [load]);

  const act = async (action: 'enable' | 'disable' | 'regenerate') => {
    if (
      action === 'regenerate' &&
      !window.confirm(
        'کلید جدید ساخته شود؟\n\n' +
          '⚠️ کلید فعلی بلافاصله از کار می‌افتد. اگر ایجنت همکارت در حال استفاده از آن است، ' +
          'باید کلید جدید را به آن بدهی.'
      )
    ) {
      return;
    }

    setBusy(true);
    setMessage('');
    setWorking(
      action === 'disable'
        ? 'در حال قطع دسترسی'
        : action === 'enable'
          ? 'در حال بازکردن دسترسی'
          : 'در حال ساخت کلید جدید'
    );

    try {
      await withBusy(async () => {
        const res = await fetch('/api/agent/key', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action }),
        });
        const data = await res.json();
        setMessage(String(data?.message ?? (data?.ok ? 'انجام شد.' : data?.error ?? 'انجام نشد.')));
        await load(false);
        if (action === 'regenerate') setReveal(true);
      });
    } catch {
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy(false);
      setWorking('');
    }
  };

  if (loading) {
    return (
      <section className="card">
        <h2 className="card-title">🤝 ایجنت همکار</h2>
        <p className="db-note">⏳ در حال آماده‌سازی…</p>
      </section>
    );
  }

  if (!dbConnected || !state) {
    return (
      <section className="card">
        <h2 className="card-title">🤝 ایجنت همکار</h2>
        <div className="db-status db-status-warn" style={{ marginTop: 8 }}>
          <span className="db-dot">🟡</span>
          <span className="db-label">دیتابیس وصل نیست</span>
        </div>
        <p className="db-note">
          کلید ایجنت همکار در دیتابیس ذخیره می‌شود. تا وقتی دیتابیس وصل نباشد، این بخش کار
          نمی‌کند. بقیهٔ برنامه بدون هیچ مشکلی کار می‌کند.
        </p>
      </section>
    );
  }

  const isOpen = state.enabled && state.keyConfigured;
  const keyForCopy = state.key;

  const templateText =
    `تو «ایجنت همکار» پروژهٔ کارگردان هستی.\n` +
    `کارگردان یک سیستم‌عامل زندگی شخصی است: تخلیهٔ ذهن، تفکیک مهم از فوری، سقف جبهه‌های فعال.\n\n` +
    `نشانی پایه: ${base}\n` +
    `کلید دسترسی: ${state.key || '<کلید از متغیر محیطی می‌آید>'}\n\n` +
    `۱) خواندن راهنما:\nGET ${base}/api/agent/context\n\n` +
    `۲) خواندن وضعیت کامل:\nGET ${base}/api/agent/state\n\n` +
    `۳) ثبت پیشنهاد:\nPOST ${base}/api/agent/suggestions\n` +
    `Content-Type: application/json\n\n` +
    `نمونهٔ بدنه:\n` +
    `{"title":"عنوان کوتاه","body":"چرا این پیشنهاد را می‌دهم","kind":"task_set_status","payload":{"id":"<شناسه>","status":"later"}}\n\n` +
    `همهٔ درخواست‌ها این هدر را لازم دارند:\n` +
    `Authorization: Bearer ${state.key || '<کلید>'}\n\n` +
    `قواعد:\n` +
    `- پیشنهادها خودکار اجرا نمی‌شوند؛ کارفرما دستی تأیید می‌کند.\n` +
    `- هر پیشنهاد فقط یک تغییر کوچک باشد.\n` +
    `- همیشه در body توضیح بده چرا.\n` +
    `- قبل از پیشنهاد، GET suggestions را بزن تا تکراری ندهی.\n` +
    `- هیچ چیزی پاک نمی‌شود؛ حذف یعنی رفتن به سطل بازیافت.\n` +
    `- اگر کد ۴۰۳ گرفتی یعنی کارفرما دسترسی را قطع کرده؛ دوباره تلاش نکن.`;

  return (
    <>
      {/* ─── کنترل دسترسی ──────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">
          🔌 کنترل دسترسی ایجنت همکار
          <span className="card-sub">— همه‌چیز از همین‌جا، با یک دکمه</span>
        </h2>

        <div className={`db-status ${isOpen ? 'db-status-ok' : 'db-status-bad'}`}>
          <span className="db-dot">{isOpen ? '🟢' : '🔴'}</span>
          <span className="db-label">
            {isOpen
              ? 'دسترسی باز است — ایجنت همکار با کلید، درست کار می‌کند'
              : state.keyConfigured
                ? 'دسترسی قطع شده — حتی با کلید درست هم کسی پذیرفته نمی‌شود'
                : 'کلید ساخته نشده'}
          </span>
        </div>

        <div className="kill-switch">
          <div className="kill-desc">
            <div className="t">
              {isOpen ? '⏸ قطع‌کردن دسترسی' : '▶️ بازکردن دسترسی'}
            </div>
            <div className="d">
              {isOpen
                ? 'با یک کلیک، دسترسی ایجنت همکار را قطع کن. حتی اگر کلید لو رفته باشد، از این لحظه هیچ درخواستی پذیرفته نمی‌شود.'
                : 'دسترسی از سر گرفته می‌شود و کلید فعلی دوباره کار می‌کند.'}
            </div>
          </div>
          <button
            className={`btn btn-busy ${isOpen ? 'btn-danger-solid' : 'btn-primary'}`}
            disabled={busy}
            onClick={() => void act(isOpen ? 'disable' : 'enable')}
          >
            {busy ? (
              <>
                <Spinner /> در حال انجام…
              </>
            ) : isOpen ? (
              '⏸ قطع دسترسی'
            ) : (
              '▶️ فعال‌سازی'
            )}
          </button>
        </div>

        {message && <p className="db-hint" style={{ marginTop: 12 }}>{message}</p>}

        {working && <BusyRow text={`${working}… چند لحظه صبر کن`} />}

        <p className="db-note" style={{ marginTop: 12 }}>
          کنترل قطع‌وصل <b>فوری</b> است — در دیتابیس ذخیره می‌شود و از همان لحظه روی همهٔ
          درخواست‌ها اعمال می‌گردد. نیازی به Deploy دوباره یا راه‌اندازی مجدد نیست.
        </p>
      </section>

      {/* ─── کلید دسترسی ───────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">
          🔑 کلید دسترسی
          <span className="card-sub">— خودکار ساخته می‌شود</span>
        </h2>

        {state.envOverride ? (
          <p className="db-hint">
            کلید از متغیر محیطی <code className="db-code">{'AGENT_API_KEY'}</code> می‌آید و
            اینجا نمایش داده نمی‌شود. اگر می‌خواهی از کلید دیتابیسی استفاده کنی، آن متغیر
            محیطی را حذف کن.
          </p>
        ) : (
          <>
            <div className="key-box">
              <code className="key-value">
                {reveal ? state.key : '•'.repeat(43)}
              </code>
            </div>

            <div className="key-actions">
              <button className="btn btn-small" onClick={() => setReveal((v) => !v)}>
                {reveal ? '🙈 پنهان کن' : '👁 نشانم بده'}
              </button>
              <CopyButton text={keyForCopy} label="کپی کلید" />
              <button
                className="btn btn-small btn-busy"
                disabled={busy}
                onClick={() => void act('regenerate')}
              >
                {busy ? (
                  <>
                    <Spinner /> در حال ساخت…
                  </>
                ) : (
                  '🔄 ساخت کلید جدید'
                )}
              </button>
              {state.updatedAt && (
                <span className="db-stamp">ساخته‌شده: {timeFa(state.updatedAt)}</span>
              )}
            </div>

            <p className="db-note" style={{ marginTop: 10 }}>
              🔑 این کلید در دیتابیس خودت ذخیره می‌شود (جدول{' '}
              <code className="db-code">kargardan_settings</code>). فقط به ایجنت همکارت بده.
              <br />
              🔄 اگر کلید لو رفت، «ساخت کلید جدید» را بزن — کلید قبلی همان لحظه از کار می‌افتد.
              <br />
              ⏸ حتی اگر کلید لو برود، دکمهٔ «قطع دسترسی» بالا در را می‌بندد.
            </p>
          </>
        )}
      </section>

      {/* ─── اتصال ChatGPT ──────────────────────────────────────── */}
      {!state.envOverride && <ChatGptBridge apiKey={state.key} />}

      {/* ─── APIها ─────────────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">🔌 APIهایی که در اختیار ایجنت همکار است</h2>

        {[
          {
            method: 'GET',
            url: `${base}/api/agent/context`,
            desc: 'دفترچهٔ راهنما — مدل داده، انواع پیشنهاد، قواعد. ایجنت اول این را می‌خواند.',
          },
          {
            method: 'GET',
            url: `${base}/api/agent/state`,
            desc: 'خواندن کامل دیتابیس — کارها، پروژه‌ها، صندوق ذهن، سطل بازیافت، پیشنهادها و سن هر مورد.',
          },
          {
            method: 'GET',
            url: `${base}/api/agent/suggestions`,
            desc: 'فهرست پیشنهادهای قبلی — تا پیشنهاد تکراری داده نشود.',
          },
          {
            method: 'POST',
            url: `${base}/api/agent/suggestions`,
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
          🔑 کلید را به سه شکل می‌توانی بفرستی (هر کدام راحت‌تر است):
          <br />• هدر <code className="db-code">Authorization: Bearer &lt;کلید&gt;</code> — برای
          curl و اسکریپت‌ها
          <br />• هدر <code className="db-code">x-agent-key: &lt;کلید&gt;</code>
          <br />• پارامتر آدرس <code className="db-code">?k=&lt;کلید&gt;</code> — برای
          <b> ChatGPT</b> (که نمی‌تواند هدر سفارشی بفرستد)
          <br />
          <br />🔴 اگر دسترسی قطع باشد، همهٔ این مسیرها با کد{' '}
          <code className="db-code">۴۰۳</code> رد می‌شوند.
        </p>
      </section>

      {/* ─── متن آماده ─────────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">📨 متن آماده برای دادن به ایجنت همکار</h2>
        <p className="db-note">
          با یک کلیک کپی کن و به ایجنت همکارت بده — کلید هم داخلش هست.
        </p>

        <div className="prompt-box">
          <div className="prompt-head">
            <span>راهنمای کامل + کلید دسترسی</span>
            <div>
              <button className="btn btn-small" onClick={() => setReveal((v) => !v)}>
                {reveal ? '🙈 پنهان کن' : '👁 نشانم بده'}
              </button>{' '}
              <CopyButton label="کپی متن کامل" text={templateText} />
            </div>
          </div>

          <pre className="prompt-pre">
{`تو «ایجنت همکار» پروژهٔ کارگردان هستی.
کارگردان یک سیستم‌عامل زندگی شخصی است: تخلیهٔ ذهن، تفکیک مهم از فوری، سقف جبهه‌های فعال.

نشانی پایه: ${base}
کلید دسترسی: ${reveal ? state.key || '(از متغیر محیطی)' : '•'.repeat(30)}

۱) خواندن راهنما:
   GET ${base}/api/agent/context

۲) خواندن وضعیت کامل:
   GET ${base}/api/agent/state

۳) ثبت پیشنهاد:
   POST ${base}/api/agent/suggestions
   Content-Type: application/json

نمونهٔ بدنه:
{"title":"انتقال «تماس با بانک» به بعداً","body":"۹ روز است در الان مانده و قدم بعدی هیچ جبهه‌ای نیست.","kind":"task_set_status","payload":{"id":"<شناسه>","status":"later"}}

همهٔ درخواست‌ها یک هدر لازم دارند:
   Authorization: Bearer <کلید>`}
          </pre>
        </div>

        <p className="db-note" style={{ marginTop: 10 }}>
          ⚠️ متنی که کپی می‌شود <b>کلید واقعی</b> را در خود دارد. آن را جای عمومی نگذار.
        </p>
      </section>

      {/* ─── curl ──────────────────────────────────────────────── */}
      <section className="card">
        <h2 className="card-title">🧪 نمونهٔ curl</h2>
        <pre className="prompt-pre">
{`export KEY="${reveal ? state.key || '<کلید>' : '<کلید>'}"
export BASE="${base}"

# ۱) راهنما
curl -H "Authorization: Bearer $KEY" $BASE/api/agent/context

# ۲) وضعیت کامل
curl -H "Authorization: Bearer $KEY" $BASE/api/agent/state

# ۳) ثبت یک پیشنهاد
curl -X POST $BASE/api/agent/suggestions \\
  -H "Authorization: Bearer $KEY" \\
  -H "Content-Type: application/json" \\
  -d '{"title":"...","body":"...","kind":"note"}'`}
        </pre>
      </section>

      <p className="footer">
        🔒 ایجنت همکار فقط <b>می‌خواند</b> و <b>پیشنهاد</b> می‌دهد — هیچ‌وقت مستقیم چیزی را عوض
        نمی‌کند · کنترل کامل دست توست
      </p>
    </>
  );
}
