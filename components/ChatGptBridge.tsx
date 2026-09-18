'use client';

// ─── اتصال ChatGPT به کارگردان (بدون هدر سفارشی) ────────────────────
//
// 🤖 مشکل: ChatGPT Actions نمی‌تواند هدر `Authorization` سفارشی بفرستد.
// ✅ راه‌حل: ما کلید را در «پارامتر آدرس» (?k=...) هم می‌پذیریم.
//    ChatGPT این را به‌صورت بومی پشتیبانی می‌کند (API Key → Query).
//
// پس نیازی به هیچ سرور واسط (bridge/proxy) جداگانه‌ای نیست:
//    ChatGPT  →  API خودِ کارگردان (با ?k=)  →  دیتابیس
//    (نه: ChatGPT → GitHub → دیتابیس)

import React, { useEffect, useState } from 'react';
import { Spinner } from './Busy';

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

export default function ChatGptBridge({ apiKey }: { apiKey: string }) {
  const [origin, setOrigin] = useState('');
  const [reveal, setReveal] = useState(false);

  useEffect(() => {
    // نشانی‌ای که کاربر همین حالا دارد برنامه را با آن می‌بیند —
    // مطمئن‌ترین منبع برای اینکه ChatGPT باید کجا را صدا بزند.
    setOrigin(window.location.origin);
  }, []);

  const schemaUrl = origin ? `${origin}/api/bridge/openapi` : '';
  const keyOrPlaceholder = apiKey || '<کلید از متغیر محیطی می‌آید>';
  const shownKey = reveal ? keyOrPlaceholder : '•'.repeat(30);

  const instructions = `تو «ایجنت همکار» پروژهٔ «کارگردان» هستی.
کارگردان یک سیستم‌عامل زندگی شخصی است: تخلیهٔ ذهن، تفکیک مهم از فوری، سقف جبهه‌های فعال.

قواعد کاری تو:
۱. همیشه اول اکشن getKargardanContext را صدا بزن تا مدل داده و قواعد را بفهمی.
۲. بعد getKargardanState را بزن و وضعیت واقعی را بخوان.
۳. قبل از هر پیشنهاد، listKargardanSuggestions را بزن تا تکراری ندهی.
۴. پیشنهادها را با createKargardanSuggestion ثبت کن.

مهم:
- تو هرگز داده‌ای را مستقیم تغییر نمی‌دهی. فقط پیشنهاد می‌گذاری و کاربر تصمیم می‌گیرد.
- هر پیشنهاد باید «یک تغییر کوچک و مشخص» باشد — نه مجموعه‌ای از تغییرات.
- همیشه در فیلد body توضیح بده چرا این پیشنهاد را می‌دهی.
- اگر کد ۴۰۳ گرفتی، یعنی کاربر دسترسی را قطع کرده؛ دوباره تلاش نکن و به کاربر بگو.
- هیچ چیزی در کارگردان پاک نمی‌شود؛ «حذف» یعنی رفتن به سطل بازیافت. پس پیشنهاد حذف نده.
- سقف پروژه‌های فعال ۳ است؛ پیشنهاد فعال‌کردن پروژهٔ بیشتر را با احتیاط بده.
- اگر چیزی مفید دیدی ولی تغییر مشخصی لازم نیست، از نوع note استفاده کن.`;

  return (
    <section className="card">
      <h2 className="card-title">
        🤖 اتصال ChatGPT
        <span className="card-sub">— بدون هدر سفارشی، بدون سرور واسط</span>
      </h2>

      <div className="db-status db-status-ok" style={{ marginBottom: 12 }}>
        <span className="db-dot">✅</span>
        <span className="db-label">
          مسیر آماده است — کلید در آدرس فرستاده می‌شود، پس ChatGPT نیازی به هدر ندارد
        </span>
      </div>

      <p className="db-note">
        ChatGPT نمی‌تواند هدر <code className="db-code">Authorization</code> سفارشی بفرستد. برای
        همین، کارگردان کلید را از <b>پارامتر آدرس</b> (<code className="db-code">?k=...</code>) هم
        می‌پذیرد — چیزی که ChatGPT به‌صورت بومی پشتیبانی می‌کند.
        <br />
        <b>اصلاح مسیر:</b>{' '}
        <code className="db-code">ChatGPT → API کارگردان → دیتابیس</code> (نه از راه GitHub).
      </p>

      {/* ─── نشانی فایل OpenAPI ─────────────────────────────────── */}
      <h3 className="sub-h">۱) نشانی فایل OpenAPI</h3>
      {schemaUrl ? (
        <>
          <div className="key-box">
            <code className="key-value">{schemaUrl}</code>
          </div>
          <div className="key-actions">
            <CopyButton text={schemaUrl} label="کپی نشانی" />
            <a
              className="btn btn-small"
              href={schemaUrl}
              target="_blank"
              rel="noreferrer"
              style={{ textDecoration: 'none' }}
            >
              🔍 بازکردن و بررسی
            </a>
          </div>
          <p className="db-note" style={{ marginTop: 8 }}>
            این فایل <b>عمومی</b> است و کلیدی ندارد — چون هیچ رمزی داخلش نیست، فقط شکل API را
            توصیف می‌کند (ChatGPT برای import کردنش نمی‌تواند احراز هویت بفرستد). فقط ۴ عملیات
            خواندنی/پیشنهادی آن داخلش تعریف شده — نه سطل بازیافت، نه ساخت جدول، نه کنترل کلید.
          </p>
        </>
      ) : (
        <p className="db-note">
          <Spinner /> در حال آماده‌سازی…
        </p>
      )}

      {/* ─── گام‌به‌گام ─────────────────────────────────────────── */}
      <h3 className="sub-h">۲) ساخت Custom GPT — گام‌به‌گام</h3>
      <ol className="steps">
        <li>
          در ChatGPT برو به <b>Explore GPTs → Create</b> (یا GPT موجودت را ویرایش کن).
        </li>
        <li>
          تب <b>Configure</b> را باز کن و متن «دستورها» (پایین‌تر) را در بخش{' '}
          <b>Instructions</b> بگذار.
        </li>
        <li>
          پایین صفحه، بخش <b>Actions → Create new action</b> را بزن.
        </li>
        <li>
          در قسمت <b>Schema</b>، گزینهٔ <b>Import from URL</b> را بزن و نشانی فایل OpenAPI
          بالا را بگذار.
        </li>
        <li>
          در بخش <b>Authentication</b>:
          <br />
          نوع را <b>API Key</b> بگذار · <b>Auth Type</b> را <b>Query</b> انتخاب کن · نام پارامتر
          را <code className="db-code">k</code> بگذار · مقدار را کلید پایین بریز.
          <div className="steps-note">
            ⚠️ اگر «Query» پیدا نکردی، <b>Custom</b> را بزن و در فیلد نام بنویس{' '}
            <code className="db-code">k</code>.
          </div>
        </li>
        <li>
          <b>Save</b> را بزن. تمام — حالا ChatGPT می‌تواند context و state را بخواند و پیشنهاد
          ثبت کند.
        </li>
      </ol>

      {/* ─── کلید ───────────────────────────────────────────────── */}
      <h3 className="sub-h">۳) کلید دسترسی (همان کلید قبلی)</h3>
      <div className="key-box">
        <code className="key-value">{shownKey}</code>
      </div>
      <div className="key-actions">
        <button className="btn btn-small" onClick={() => setReveal((v) => !v)}>
          {reveal ? '🙈 پنهان کن' : '👁 نشانم بده'}
        </button>
        <CopyButton text={apiKey} label="کپی کلید" />
      </div>
      <p className="db-note" style={{ marginTop: 8 }}>
        همان کلیدی است که در بالای همین صفحه دیدی — کلید جداگانه لازم نیست. برای اینکه ChatGPT
        بتواند به کلید دسترسی داشته باشد، فقط در Custom GPT واردش کن.
      </p>

      {/* ─── متن دستورها ────────────────────────────────────────── */}
      <h3 className="sub-h">۴) متن دستورها برای Custom GPT</h3>
      <div className="prompt-box">
        <div className="prompt-head">
          <span>Instructions — کپی کن و در Custom GPT بگذار</span>
          <CopyButton label="کپی دستورها" text={instructions} />
        </div>
        <pre className="prompt-pre">{instructions}</pre>
      </div>

      {/* ─── آزمون ─────────────────────────────────────────────── */}
      {schemaUrl && apiKey && (
        <>
          <h3 className="sub-h">۵) آزمون سریع (اختیاری)</h3>
          <p className="db-note">
            اگر می‌خواهی مطمئن شوی مسیر کار می‌کند، این دو آدرس را در مرورگر باز کن. اگر JSON
            دیدی، همه‌چیز درست است:
          </p>
          <div className="prompt-box">
            <pre className="prompt-pre">
{`${schemaUrl}

${origin}/api/agent/context?k=${reveal ? apiKey : 'CLICK_REVEAL_TO_SEE'}`}
            </pre>
          </div>
        </>
      )}

      <p className="db-hint" style={{ marginTop: 14 }}>
        🔒 <b>امنیت:</b> کلید در آدرس، در لاگ‌های سرور دیده می‌شود. اگر خواستی کلید را عوض کنی،
        بالای همین صفحه «🔄 ساخت کلید جدید» را بزن (کلید قبلی فوری از کار می‌افتد). و اگر خواستی
        دسترسی را کاملاً قطع کنی، دکمهٔ «⏸ قطع دسترسی» — آن دکمه روی این مسیر هم کار می‌کند و
        ChatGPT حتی با کلید درست هم <code className="db-code">403</code> می‌گیرد.
      </p>
    </section>
  );
}
