'use client';

// ─── تب «نمودارها» — یک نگاه به کل زندگی ───────────────────────────
// نمودارها با SVG خالص کشیده می‌شوند؛ هیچ کتابخانهٔ اضافه‌ای نصب نشده.

import React, { useMemo } from 'react';
import { useStore } from '@/lib/store';
import { faNum } from '@/lib/format';
import { PROJECT_STATUS_META, TASK_STATUSES, TASK_STATUS_META, type TaskStatus } from '@/lib/types';

const STATUS_COLOR: Record<TaskStatus, string> = {
  now: 'var(--now)',
  later: 'var(--later)',
  waiting: 'var(--waiting)',
  parked: 'var(--parked)',
};

// ─── نمودار دونات ──────────────────────────────────────────────────
function Donut({
  slices,
  total,
  centerLabel,
}: {
  slices: { label: string; value: number; color: string }[];
  total: number;
  centerLabel: string;
}) {
  const size = 190;
  const stroke = 30;
  const r = (size - stroke) / 2;
  const c = 2 * Math.PI * r;
  let offset = 0;

  const nonEmpty = slices.filter((s) => s.value > 0);

  return (
    <div className="donut-wrap">
      <svg viewBox={`0 0 ${size} ${size}`} className="donut" role="img" aria-label={centerLabel}>
        <circle
          cx={size / 2} cy={size / 2} r={r}
          fill="none" stroke="var(--surface-2)" strokeWidth={stroke}
        />
        {nonEmpty.map((s) => {
          const len = total > 0 ? (s.value / total) * c : 0;
          const el = (
            <circle
              key={s.label}
              cx={size / 2} cy={size / 2} r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={`${len} ${c - len}`}
              strokeDashoffset={-offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
              strokeLinecap="butt"
            />
          );
          offset += len;
          return el;
        })}
        <text
          x={size / 2} y={size / 2 - 2}
          textAnchor="middle"
          className="donut-num"
          fill="var(--text)"
        >
          {faNum(total)}
        </text>
        <text
          x={size / 2} y={size / 2 + 18}
          textAnchor="middle"
          className="donut-cap"
          fill="var(--text-dim)"
        >
          {centerLabel}
        </text>
      </svg>

      <ul className="legend">
        {slices.map((s) => (
          <li key={s.label}>
            <span className="legend-dot" style={{ background: s.color }} />
            <span className="legend-label">{s.label}</span>
            <span className="legend-val">{faNum(s.value)}</span>
          </li>
        ))}
      </ul>
    </div>
  );
}

// ─── نمودار میله‌ای افقی ───────────────────────────────────────────
function Bars({
  rows,
  emptyText,
}: {
  rows: { label: string; value: number; hint?: string }[];
  emptyText: string;
}) {
  const max = Math.max(1, ...rows.map((r) => r.value));

  if (rows.length === 0) return <div className="empty">{emptyText}</div>;

  return (
    <div className="bars">
      {rows.map((r) => (
        <div className="bar-row" key={r.label} title={r.hint ?? ''}>
          <span className="bar-label">{r.label}</span>
          <span className="bar-track">
            <span
              className="bar-fill"
              style={{ width: `${Math.max(2, (r.value / max) * 100)}%` }}
            />
          </span>
          <span className="bar-val">{faNum(r.value)}</span>
        </div>
      ))}
    </div>
  );
}

// ─── نمودار خطیِ ساده (ایجاد کارها در ۱۴ روز گذشته) ───────────────
function Sparkline({ points }: { points: { day: string; value: number }[] }) {
  const w = 560;
  const h = 150;
  const pad = { t: 14, r: 12, b: 26, l: 12 };
  const max = Math.max(1, ...points.map((p) => p.value));
  const innerW = w - pad.l - pad.r;
  const innerH = h - pad.t - pad.b;
  const step = points.length > 1 ? innerW / (points.length - 1) : 0;

  const xy = points.map((p, i) => ({
    x: pad.l + i * step,
    y: pad.t + innerH - (p.value / max) * innerH,
    ...p,
  }));

  const line = xy.map((p, i) => `${i === 0 ? 'M' : 'L'}${p.x.toFixed(1)},${p.y.toFixed(1)}`).join(' ');
  const area = `${line} L${(pad.l + innerW).toFixed(1)},${pad.t + innerH} L${pad.l},${pad.t + innerH} Z`;

  return (
    <svg viewBox={`0 0 ${w} ${h}`} className="spark" role="img" aria-label="روند ایجاد کارها">
      <path d={area} fill="var(--accent-soft)" />
      <path d={line} fill="none" stroke="var(--accent)" strokeWidth="2.5" strokeLinejoin="round" />
      {xy.map((p, i) =>
        p.value > 0 ? <circle key={i} cx={p.x} cy={p.y} r="3.5" fill="var(--accent)" /> : null
      )}
      {xy.map((p, i) =>
        i % 2 === 0 || i === xy.length - 1 ? (
          <text key={i} x={p.x} y={h - 8} textAnchor="middle" className="spark-x" fill="var(--text-dim)">
            {p.day}
          </text>
        ) : null
      )}
    </svg>
  );
}

// ─── کامپوننت اصلی ─────────────────────────────────────────────────
export default function ChartsView() {
  const { state } = useStore();
  const { tasks, projects, inbox } = state;

  const open = useMemo(() => tasks.filter((t) => !t.done), [tasks]);
  const done = useMemo(() => tasks.filter((t) => t.done), [tasks]);

  const byStatus = TASK_STATUSES.map((s) => ({
    label: TASK_STATUS_META[s].label,
    value: open.filter((t) => t.status === s).length,
    color: STATUS_COLOR[s],
  }));

  const byProject = useMemo(
    () =>
      projects
        .map((p) => ({
          label: p.name,
          value: open.filter((t) => t.projectId === p.id).length,
          hint: `${PROJECT_STATUS_META[p.status].label}`,
        }))
        .sort((a, b) => b.value - a.value)
        .slice(0, 8),
    [projects, open]
  );

  const byProjectStatus = (['active', 'queued', 'parked', 'done'] as const).map((s) => ({
    label: PROJECT_STATUS_META[s].label,
    value: projects.filter((p) => p.status === s).length,
  }));

  const noProject = open.filter((t) => !t.projectId).length;

  /** روند ۱۴ روز گذشته — چند کار در هر روز ساخته شده */
  const trend = useMemo(() => {
    const day = 86_400_000;
    const today = new Date();
    today.setHours(0, 0, 0, 0);
    const start = today.getTime() - day * 13;

    const buckets = Array.from({ length: 14 }, (_, i) => {
      const d = new Date(start + i * day);
      return {
        day: new Intl.DateTimeFormat('fa-IR', { day: 'numeric' }).format(d),
        ts: d.getTime(),
        value: 0,
      };
    });

    for (const t of tasks) {
      const idx = Math.floor((t.createdAt - start) / day);
      if (idx >= 0 && idx < 14) buckets[idx].value += 1;
    }
    return buckets;
  }, [tasks]);

  const stats = [
    { label: 'کارهای باز', value: open.length, tone: 'st-now' },
    { label: 'انجام‌شده', value: done.length, tone: 'st-later' },
    { label: 'جبهه‌های فعال', value: projects.filter((p) => p.status === 'active').length, tone: 'st-waiting' },
    { label: 'صندوق ذهن', value: inbox.length, tone: 'st-parked' },
  ];

  const isEmpty = tasks.length === 0 && projects.length === 0 && inbox.length === 0;

  if (isEmpty) {
    return (
      <section className="card">
        <h2 className="card-title">📊 نمودارها</h2>
        <div className="empty">
          <div className="big">📈</div>
          هنوز داده‌ای نیست. از «صندوق ذهن» شروع کن — نمودارها خودشان پر می‌شوند.
        </div>
      </section>
    );
  }

  return (
    <>
      <div className="grid-stats">
        {stats.map((s) => (
          <div className="stat-card" key={s.label}>
            <span className="stat-top">{s.label}</span>
            <div className={`stat-num ${s.tone}`}>{faNum(s.value)}</div>
          </div>
        ))}
      </div>

      <section className="card">
        <h2 className="card-title">
          🍩 توزیع کارهای باز
          <span className="card-sub">— مهم در برابر فوری</span>
        </h2>
        <Donut slices={byStatus} total={open.length} centerLabel="کار باز" />
        <p className="quote">
          اگر میلهٔ <b>الان</b> بزرگ‌تر از بقیه است، شاید بیش از ظرفیتت روی صفحه گذاشته‌ای.
          «پارک‌شده» بد نیست — تصمیمِ بسته‌شده است.
        </p>
      </section>

      <section className="card">
        <h2 className="card-title">
          📈 روند ۱۴ روز گذشته
          <span className="card-sub">— چند کار در هر روز وارد سیستم شد</span>
        </h2>
        <Sparkline points={trend} />
      </section>

      <div className="columns">
        <div className="col">
          <section className="card">
            <h2 className="card-title">🚀 کارها به تفکیک جبهه</h2>
            <Bars rows={byProject} emptyText="هنوز کاری به پروژه‌ای وصل نشده." />
            {noProject > 0 && (
              <p className="db-note" style={{ marginTop: 10 }}>
                {faNum(noProject)} کار بدون پروژه — لزوماً بد نیست؛ کارهای مستقل هم لازم‌اند.
              </p>
            )}
          </section>
        </div>

        <div className="col">
          <section className="card">
            <h2 className="card-title">🗂 وضعیت جبهه‌ها</h2>
            <Bars rows={byProjectStatus} emptyText="هنوز پروژه‌ای نساخته‌ای." />
            <p className="db-note" style={{ marginTop: 10 }}>
              سقف فعلی: {faNum(state.settings.activeProjectCap)} جبههٔ فعال هم‌زمان.
            </p>
          </section>
        </div>
      </div>

      <p className="footer">
        📊 نمودارها از داده‌های همین حالای تو ساخته می‌شوند — هر تغییری، فوری اینجا دیده می‌شود.
      </p>
    </>
  );
}
