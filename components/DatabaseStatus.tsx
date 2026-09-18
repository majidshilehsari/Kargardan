'use client';

// ─── بخش «وضعیت دیتابیس» در تنظیمات ──────────────────────────────────
// فقط وضعیت را نشان می‌دهد — هیچ چیزی در دیتابیس تغییر نمی‌دهد.
// داده‌ها از /api/db/health می‌آید که تنها SELECT می‌زند.

import React, { useCallback, useEffect, useState } from 'react';
import type { DbHealth } from '@/lib/db-types';
import { faNum } from '@/lib/format';

type LoadState =
  | { kind: 'loading' }
  | { kind: 'ready'; health: DbHealth }
  | { kind: 'failed'; message: string };

const STATUS_META: Record<
  DbHealth['status'],
  { label: string; dot: string; tone: 'ok' | 'warn' | 'bad' }
> = {
  ok: { label: 'وصل است', dot: '🟢', tone: 'ok' },
  not_configured: { label: 'تنظیم نشده', dot: '🟡', tone: 'warn' },
  error: { label: 'وصل نیست', dot: '🔴', tone: 'bad' },
};

function timeFa(ts: number): string {
  return new Intl.DateTimeFormat('fa-IR', {
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
  }).format(ts);
}

/** نسخهٔ سرور پستگرس معمولاً با کلمهٔ PostgreSQL شروع می‌شود؛ فقط بخش اول را نشان می‌دهیم */
function shortVersion(v: string): string {
  const m = v.match(/(PostgreSQL\s+[\d.]+)/i);
  return m ? m[1] : v.slice(0, 40);
}

function Row({ label, value }: { label: string; value: React.ReactNode }) {
  return (
    <div className="kv">
      <span className="kv-k">{label}</span>
      <span className="kv-v">{value}</span>
    </div>
  );
}

export default function DatabaseStatus() {
  const [state, setState] = useState<LoadState>({ kind: 'loading' });

  const load = useCallback(async () => {
    setState({ kind: 'loading' });
    try {
      const res = await fetch('/api/db/health', { cache: 'no-store' });
      if (!res.ok) {
        setState({
          kind: 'failed',
          message: `سرور پاسخ ${faNum(res.status)} داد.`,
        });
        return;
      }
      const health = (await res.json()) as DbHealth;
      setState({ kind: 'ready', health });
    } catch {
      setState({
        kind: 'failed',
        message:
          'به بخش سلامت دیتابیس دسترسی پیدا نکردم. اگر برنامه را به‌صورت خروجی استاتیک اجرا می‌کنی، این بخش کار نمی‌کند.',
      });
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  return (
    <section className="card">
      <h2 className="card-title">
        🗄️ وضعیت دیتابیس
        <span className="card-sub">— آیا کارگردان به دیتابیس تو وصل است؟</span>
      </h2>

      {state.kind === 'loading' && <p className="db-note">⏳ در حال بررسی اتصال…</p>}

      {state.kind === 'failed' && (
        <>
          <div className="db-status db-status-bad">
            <span className="db-dot">🔴</span>
            <span className="db-label">وضعیت نامشخص</span>
          </div>
          <p className="db-note">{state.message}</p>
        </>
      )}

      {state.kind === 'ready' && <HealthBody health={state.health} />}

      <div className="db-actions">
        <button className="btn btn-small" onClick={() => void load()} disabled={state.kind === 'loading'}>
          🔄 بررسی دوباره
        </button>
        {state.kind === 'ready' && (
          <span className="db-stamp">آخرین بررسی: {timeFa(state.health.checkedAt)}</span>
        )}
      </div>

      <p className="db-privacy">
        🔒 این بخش فقط وضعیت را <strong>می‌خواند</strong>. هیچ چیزی در دیتابیس ساخته، عوض یا پاک
        نمی‌شود و رمز عبور هرگز به مرورگر فرستاده نمی‌شود.
      </p>
    </section>
  );
}

export function HealthBody({ health }: { health: DbHealth }) {
  const meta = STATUS_META[health.status];

  return (
    <>
      <div className={`db-status db-status-${meta.tone}`}>
        <span className="db-dot">{meta.dot}</span>
        <span className="db-label">{meta.label}</span>
        {health.status === 'ok' && <span className="db-latency">{faNum(health.latencyMs)} میلی‌ثانیه</span>}
      </div>

      {health.status === 'not_configured' && (
        <>
          <p className="db-note">
            هیچ‌کدام از متغیرهای محیطی دیتابیس پیدا نشد. برنامه همچنان کار می‌کند و داده‌ها در همین
            مرورگر ذخیره می‌شوند.
          </p>
          <div className="db-grid">
            <Row
              label="متغیرهای بررسی‌شده"
              value={<code className="db-code">{health.varsChecked.join(' · ')}</code>}
            />
          </div>
          <p className="db-hint">
            💡 مقدار را در <strong>Vercel → Settings → Environment Variables</strong> بگذار (برای هر سه
            محیط Production، Preview و Development) و برای اجرای روی کامپیوتر خودت در فایل{' '}
            <code className="db-code">.env.local</code>. بعد از تغییر، برنامه را دوباره اجرا کن — متغیرهای
            محیطی فقط در شروع مجدد خوانده می‌شوند.
          </p>
        </>
      )}

      {health.status === 'error' && (
        <>
          <div className="db-grid">
            <Row label="کد خطا" value={<code className="db-code">{health.code}</code>} />
            {health.target && (
              <>
                <Row label="متغیر استفاده‌شده" value={<code className="db-code">{health.target.envVar}</code>} />
                <Row label="میزبان" value={health.target.host} />
                <Row label="نام دیتابیس" value={health.target.database} />
                <Row label="کاربر" value={health.target.userMasked} />
                <Row label="SSL" value={health.target.ssl} />
              </>
            )}
            <Row label="زمان انتظار" value={`${faNum(health.latencyMs)} میلی‌ثانیه`} />
            <Row label="پیام سرور" value={<span className="db-mono">{health.message}</span>} />
          </div>
          <p className="db-hint">🛠️ راهنمای رفع: {health.hint}</p>
          <p className="db-note" style={{ marginTop: 8 }}>
            خیالت راحت باشد: برنامه به کار خودش ادامه می‌دهد و داده‌های فعلی‌ات در همین مرورگر سالم
            می‌مانند. این خطا فقط یعنی «اتصال برقرار نشد».
          </p>
        </>
      )}

      {health.status === 'ok' && (
        <>
          <div className="db-grid">
            <Row label="متغیر استفاده‌شده" value={<code className="db-code">{health.target.envVar}</code>} />
            <Row
              label="میزبان"
              value={`${health.target.host}:${health.target.port}`}
            />
            <Row label="نام دیتابیس" value={health.database} />
            <Row label="کاربر" value={health.target.userMasked} />
            <Row label="SSL" value={health.target.ssl} />
            <Row label="نسخهٔ سرور" value={shortVersion(health.serverVersion)} />
            <Row label="اسکیمای پیش‌فرض" value={health.schema} />
            <Row label="ساعت سرور" value={<span className="db-mono">{health.serverTime}</span>} />
            <Row label="تعداد جدول‌ها" value={faNum(health.tableCount)} />
          </div>

          {!health.appTablesPresent && (
            <p className="db-hint">
              ✅ اتصال برقرار است. هنوز جدول‌های خودِ کارگردان ساخته نشده — چون ساخت جدول یک «نوشتن» در
              دیتابیس است و طبق قرارمان جدول‌ها را فقط با تأیید جداگانهٔ تو می‌سازیم. تا آن زمان داده‌هایت
              در همین مرورگر ذخیره می‌شود و هیچ‌چیز از بین نمی‌رود.
            </p>
          )}
        </>
      )}
    </>
  );
}
