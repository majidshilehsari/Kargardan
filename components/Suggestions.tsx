'use client';

// ─── تب «پیشنهادات ایجنت» ──────────────────────────────────────────
// ایجنت همکار پیشنهاد می‌دهد؛ تو تصمیم می‌گیری. هیچ چیزی خودکار اجرا نمی‌شود
// و هر پیشنهادِ اجراشده هم قابل برگرداندن است.

import React, { useCallback, useEffect, useState } from 'react';
import { SUGGESTION_KIND_META, type Suggestion } from '@/lib/types';
import { faNum } from '@/lib/format';
import { useStore } from '@/lib/store';
import { withBusy } from '@/lib/busy';
import { BusyRow, Spinner } from './Busy';

type Filter = 'pending' | 'approved' | 'rejected' | 'all';

const FILTERS: { id: Filter; label: string; icon: string }[] = [
  { id: 'pending', label: 'در انتظار تصمیم', icon: '⏳' },
  { id: 'approved', label: 'تأییدشده', icon: '✅' },
  { id: 'rejected', label: 'ردشده', icon: '❌' },
  { id: 'all', label: 'همه', icon: '📋' },
];

function timeFa(ts: number): string {
  return new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(ts);
}

/** خلاصهٔ خوانا از payload — برای اینکه بفهمی پیشنهاد دقیقاً چه می‌کند */
function payloadSummary(s: Suggestion): string {
  const p = s.payload ?? {};
  const v = (k: string) => (typeof p[k] === 'string' ? (p[k] as string) : '');
  switch (s.kind) {
    case 'task_add':
      return `کار «${v('text')}» با وضعیت «${v('status') || 'later'}» ساخته می‌شود`;
    case 'task_update':
      return `کار ${v('id')} ویرایش می‌شود${v('text') ? ` → «${v('text')}»` : ''}`;
    case 'task_set_status':
      return `وضعیت کار ${v('id')} به «${v('status')}» عوض می‌شود`;
    case 'task_toggle_done':
      return `کار ${v('id')} ${p.done === false ? 'به حالت انجام‌نشده برمی‌گردد' : 'تمام‌شده می‌شود'}`;
    case 'project_add':
      return `پروژهٔ «${v('name')}» با وضعیت «${v('status') || 'queued'}» ساخته می‌شود`;
    case 'project_set_status':
      return `وضعیت پروژه ${v('id')} به «${v('status')}» عوض می‌شود`;
    default:
      return 'فقط یک یادداشت — هیچ داده‌ای تغییر نمی‌کند';
  }
}

export default function SuggestionsView() {
  const { refresh } = useStore();
  const [items, setItems] = useState<Suggestion[]>([]);
  const [revertedIds, setRevertedIds] = useState<string[]>([]);
  const [filter, setFilter] = useState<Filter>('pending');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState<string>('');
  const [message, setMessage] = useState('');
  const [dbMissing, setDbMissing] = useState(false);

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/suggestions', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) {
        setItems(data.items ?? []);
        setRevertedIds(data.revertedIds ?? []);
        setDbMissing(false);
      } else {
        setDbMissing(true);
      }
    } catch {
      setDbMissing(true);
    } finally {
      setLoading(false);
    }
  }, []);

  useEffect(() => {
    void load();
  }, [load]);

  /** در همین لحظه چه کاری روی چه پیشنهادی در جریان است؟ (برای نمایش وضعیت) */
  const [working, setWorking] = useState<{ id: string; decision: string } | null>(null);

  const decide = async (id: string, decision: 'approved' | 'rejected' | 'revert') => {
    setBusy(id);
    setMessage('');

    const verb =
      decision === 'approved' ? 'در حال اجرای پیشنهاد' : decision === 'revert' ? 'در حال برگرداندن' : 'در حال رد کردن';
    setWorking({ id, decision: verb });

    try {
      await withBusy(async () => {
        const res = await fetch(`/api/suggestions/${encodeURIComponent(id)}`, {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ decision }),
        });
        const data = await res.json();
        setMessage(data?.message ?? (data?.ok ? 'انجام شد.' : data?.error ?? 'انجام نشد.'));
        await load();
        // اگر داده‌ای عوض شده، نمای اصلی را هم تازه کن
        if (decision !== 'rejected') await refresh();
      });
    } catch {
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy('');
      setWorking(null);
    }
  };

  const counts = {
    pending: items.filter((s) => s.status === 'pending').length,
    approved: items.filter((s) => s.status === 'approved').length,
    rejected: items.filter((s) => s.status === 'rejected').length,
    all: items.length,
  };

  const shown = filter === 'all' ? items : items.filter((s) => s.status === filter);

  if (dbMissing) {
    return (
      <section className="card">
        <h2 className="card-title">🤝 پیشنهادات ایجنت</h2>
        <div className="db-status db-status-warn" style={{ marginTop: 8 }}>
          <span className="db-dot">🟡</span>
          <span className="db-label">دیتابیس وصل نیست</span>
        </div>
        <p className="db-note">
          پیشنهادهای ایجنت همکار در دیتابیس ذخیره می‌شوند. تا وقتی متغیرهای محیطی دیتابیس
          تنظیم نشده باشند، این بخش خالی می‌ماند. بقیهٔ برنامه بدون هیچ مشکلی کار می‌کند.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2 className="card-title">
          🤝 پیشنهادات ایجنت
          <span className="card-sub">
            — ایجنت همکار پیشنهاد می‌دهد، تصمیم با توست
          </span>
        </h2>

        <p className="inbox-intro">
          ایجنت همکار فقط <b>پیشنهاد</b> می‌دهد. هیچ‌چیز خودکار اجرا نمی‌شود: تو تأیید می‌کنی،
          و حتی بعد از تأیید هم می‌توانی پیشنهاد را <b>برگردانی</b>.
        </p>

        <div className="filter-row">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              className={`btn btn-small ${filter === f.id ? 'btn-primary' : ''}`}
              onClick={() => setFilter(f.id)}
            >
              {f.icon} {f.label}
              {counts[f.id] > 0 && <span className="pill">{faNum(counts[f.id])}</span>}
            </button>
          ))}
        </div>

        {message && <p className="db-hint" style={{ marginTop: 12 }}>{message}</p>}

        {working && (
          <BusyRow
            text={`${working.decision}… اگر طول کشید، نگران نباش — درخواست در حال پردازش است.`}
          />
        )}

        {loading && <p className="db-note" style={{ marginTop: 12 }}>⏳ در حال خواندن…</p>}

        {!loading && shown.length === 0 && (
          <div className="empty">
            <div className="big">✨</div>
            {filter === 'pending'
              ? 'هیچ پیشنهاد در انتظاری نیست.'
              : 'در این دسته چیزی نیست.'}
          </div>
        )}
      </section>

      {shown.map((s) => {
        const meta = SUGGESTION_KIND_META[s.kind] ?? SUGGESTION_KIND_META.note;
        const reverted = revertedIds.includes(s.id);
        const isWorking = busy === s.id;
        return (
          <section className={`card sug-card ${isWorking ? 'is-busy' : ''}`} key={s.id}>
            <div className="sug-head">
              <span className={`chip chip-${s.status === 'pending' ? 'waiting' : s.status === 'approved' ? 'now' : 'parked'}`}>
                {s.status === 'pending' ? '⏳ در انتظار' : s.status === 'approved' ? '✅ تأییدشده' : '❌ ردشده'}
              </span>
              <span className="chip chip-later">{meta.icon} {meta.label}</span>
              {reverted && <span className="chip chip-parked">⏪ برگردانده‌شده</span>}
              <span className="spacer" />
              <span className="dim" style={{ fontSize: 12 }}>{timeFa(s.createdAt)}</span>
            </div>

            <h3 className="sug-title">{s.title}</h3>
            {s.body && <p className="sug-body">{s.body}</p>}

            <div className="sug-effect">
              <span className="dim">اثر اجرا:</span> {payloadSummary(s)}
            </div>

            {isWorking && <BusyRow text={`${working?.decision ?? 'در حال انجام'}… چند لحظه صبر کن`} />}

            <div className="sug-foot">
              <span className="dim" style={{ fontSize: 12 }}>از: {s.agentName}</span>
              <span className="spacer" />
              {s.status === 'pending' && (
                <>
                  <button
                    className="btn btn-primary btn-small btn-busy"
                    disabled={isWorking}
                    onClick={() => void decide(s.id, 'approved')}
                  >
                    {isWorking ? (
                      <>
                        <Spinner /> در حال اجرا…
                      </>
                    ) : (
                      '✅ تأیید و اجرا'
                    )}
                  </button>
                  <button
                    className="btn btn-small btn-busy"
                    disabled={isWorking}
                    onClick={() => void decide(s.id, 'rejected')}
                  >
                    ❌ رد کردن
                  </button>
                </>
              )}
              {s.status === 'approved' && !reverted && (
                <button
                  className="btn btn-small btn-busy"
                  disabled={isWorking}
                  onClick={() => void decide(s.id, 'revert')}
                >
                  {isWorking ? (
                    <>
                      <Spinner /> در حال برگرداندن…
                    </>
                  ) : (
                    '⏪ برگرداندن'
                  )}
                </button>
              )}
              {s.status === 'approved' && reverted && (
                <span className="dim" style={{ fontSize: 12 }}>این پیشنهاد برگردانده شده است</span>
              )}
              {s.status === 'rejected' && (
                <span className="dim" style={{ fontSize: 12 }}>رد شده — هیچ تغییری اعمال نشد</span>
              )}
            </div>
          </section>
        );
      })}

      <p className="footer">
        🔒 هیچ پیشنهادی خودکار اجرا نمی‌شود · هیچ چیزی پاک نمی‌شود · هر پیشنهاد اجراشده قابل برگرداندن است
      </p>
    </>
  );
}
