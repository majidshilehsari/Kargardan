'use client';

// ─── تب «🗑 سطل بازیافت» ───────────────────────────────────────────
// در این برنامه هیچ چیزی واقعاً پاک نمی‌شود.
// هر حذفی فقط اینجا می‌نشیند تا هر وقت خواستی برگردانی.

import React, { useCallback, useEffect, useState } from 'react';
import type { TrashItem } from '@/lib/types';
import { faNum } from '@/lib/format';
import { useStore } from '@/lib/store';
import { withBusy } from '@/lib/busy';
import { BusyRow, Spinner } from './Busy';

const KIND_META: Record<string, { label: string; icon: string }> = {
  task: { label: 'کار', icon: '📋' },
  project: { label: 'پروژه', icon: '🚀' },
  inbox: { label: 'صندوق ذهن', icon: '🧠' },
};

function timeFa(ts: number): string {
  return new Intl.DateTimeFormat('fa-IR', {
    day: 'numeric', month: 'short', hour: '2-digit', minute: '2-digit',
  }).format(ts);
}

export default function RecycleBinView() {
  const { refresh } = useStore();
  const [items, setItems] = useState<TrashItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState('');
  const [message, setMessage] = useState('');
  const [dbMissing, setDbMissing] = useState(false);
  const [working, setWorking] = useState('');

  const load = useCallback(async () => {
    setLoading(true);
    try {
      const res = await fetch('/api/trash', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok) {
        setItems(data.items ?? []);
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

  const act = async (kind: string, id: string, action: 'restore' | 'purge') => {
    if (action === 'purge') {
      const ok = window.confirm(
        'این مورد برای همیشه پاک شود؟\n\n' +
          'تا وقتی این دکمه را نزنی، همه‌چیز قابل برگشت است. بعد از این کار دیگر برنمی‌گردد.'
      );
      if (!ok) return;
    }

    setBusy(id);
    setMessage('');
    setWorking(action === 'restore' ? 'در حال برگرداندن' : 'در حال پاک‌کردن');

    try {
      await withBusy(async () => {
        const res = await fetch('/api/trash', {
          method: 'POST',
          headers: { 'Content-Type': 'application/json' },
          body: JSON.stringify({ action, kind, id }),
        });
        const data = await res.json();
        setMessage(data?.message ?? (data?.ok ? 'انجام شد.' : 'انجام نشد.'));
        await load();
        if (action === 'restore') await refresh();
      });
    } catch {
      setMessage('ارتباط با سرور برقرار نشد.');
    } finally {
      setBusy('');
      setWorking('');
    }
  };

  if (dbMissing) {
    return (
      <section className="card">
        <h2 className="card-title">🗑 سطل بازیافت</h2>
        <div className="db-status db-status-warn" style={{ marginTop: 8 }}>
          <span className="db-dot">🟡</span>
          <span className="db-label">دیتابیس وصل نیست</span>
        </div>
        <p className="db-note">
          سطل بازیافت روی دیتابیس کار می‌کند. تا وقتی دیتابیس وصل نشده، حذف‌ها مثل قبل
          مستقیم در مرورگر انجام می‌شود.
        </p>
      </section>
    );
  }

  return (
    <>
      <section className="card">
        <h2 className="card-title">
          🗑 سطل بازیافت
          <span className="card-sub">— {faNum(items.length)} مورد</span>
        </h2>
        <p className="inbox-intro">
          در کارگردان <b>هیچ چیزی پاک نمی‌شود</b>. هر موردی که حذف کرده‌ای اینجاست و با یک
          کلیک برمی‌گردد. حتی پیشنهادهایی که ایجنت همکار داده و اجرا کرده‌ای هم قابل برگشت‌اند
          (از تب «پیشنهادات ایجنت»).
        </p>

        {message && <p className="db-hint" style={{ marginTop: 4 }}>{message}</p>}

        {working && <BusyRow text={`${working}… چند لحظه صبر کن`} />}

        {loading && <p className="db-note" style={{ marginTop: 12 }}>⏳ در حال خواندن…</p>}

        {!loading && items.length === 0 && (
          <div className="empty">
            <div className="big">🌱</div>
            سطل بازیافت خالی است — یعنی هنوز چیزی حذف نکرده‌ای.
          </div>
        )}
      </section>

      {items.map((it) => {
        const meta = KIND_META[it.kind] ?? { label: it.kind, icon: '📦' };
        return (
          <section
            className={`card trash-row ${busy === it.id ? 'is-busy' : ''}`}
            key={`${it.kind}-${it.id}`}
          >
            <div className="trash-main">
              <div className="p-name">
                {meta.icon} {it.label}
              </div>
              <div className="task-meta" style={{ margin: 0 }}>
                <span className="chip chip-parked">{meta.label}</span>
                {it.deletedBy === 'agent' && <span className="chip chip-later">از ایجنت</span>}
                <span className="dim" style={{ fontSize: 12 }}>حذف: {timeFa(it.deletedAt)}</span>
              </div>
            </div>
            <div className="trash-actions">
              <button
                className="btn btn-primary btn-small btn-busy"
                disabled={busy === it.id}
                onClick={() => void act(it.kind, it.id, 'restore')}
              >
                {busy === it.id ? (
                  <>
                    <Spinner /> در حال انجام…
                  </>
                ) : (
                  '♻️ برگرداندن'
                )}
              </button>
              <button
                className="btn btn-danger btn-small"
                disabled={busy === it.id}
                onClick={() => void act(it.kind, it.id, 'purge')}
              >
                پاک‌کردن قطعی
              </button>
            </div>
          </section>
        );
      })}

      <p className="footer">
        🔒 «پاک‌کردن قطعی» تنها جایی است که داده واقعاً می‌رود — و فقط با تأیید خودت انجام می‌شود.
      </p>
    </>
  );
}
