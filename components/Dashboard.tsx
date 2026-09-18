'use client';

import React, { useState } from 'react';
import { useActions, useStore } from '@/lib/store';
import { faNum, faToday } from '@/lib/format';
import { TASK_STATUSES, TASK_STATUS_META } from '@/lib/types';
import type { TabId } from './App';

/**
 * داشبورد — پاسخ چهار سؤال:
 * الان کجا هستم؟ چه چیزی واقعاً مهم است؟ قدم بعدی چیست؟
 * و: چه چیزهایی را فعلاً لازم نیست حل کنم؟
 */
export default function Dashboard({ onNavigate }: { onNavigate: (t: TabId) => void }) {
  const { state, dispatch } = useStore();
  const actions = useActions();
  const cap = state.settings.activeProjectCap;
  const activeProjects = state.projects.filter((p) => p.status === 'active');
  const queuedProjects = state.projects.filter((p) => p.status === 'queued');
  const openTasks = state.tasks.filter((t) => !t.done);
  const later = openTasks.filter((t) => t.status === 'later');
  const parked = openTasks.filter((t) => t.status === 'parked');
  const nextSteps = openTasks.filter((t) => t.isNextStep);
  const isEmpty =
    state.inbox.length === 0 && state.tasks.length === 0 && state.projects.length === 0;

  const nextOf = (projectId: string) =>
    openTasks.find((t) => t.projectId === projectId && t.isNextStep);

  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const createNext = (projectId: string) => {
    const v = (drafts[projectId] ?? '').trim();
    if (!v) return;
    actions.taskAdd(v, 'now', { projectId, isNext: true });
    setDrafts((d) => ({ ...d, [projectId]: '' }));
  };

  const projectChip = (projectId: string | null) => {
    const p = state.projects.find((x) => x.id === projectId);
    return p ? p.name : 'بدون پروژه';
  };

  // ─── شروع خالی ────────────────────────────────────────────────
  if (isEmpty) {
    return (
      <section className="card">
        <h2 className="card-title">به کارگردان خوش آمدی 👋</h2>
        <p className="inbox-intro">
          این سیستم قرار نیست زندگی را بدون استرس کند؛ قرار است نگذارد استرس، مدیر زندگی تو
          باشد. جریان کار ساده است:
        </p>
        <ol style={{ margin: '0 0 6px', paddingInlineStart: 22, fontSize: 14 }}>
          <li>هر چیزی که ذهنت را اشغال کرده، در «صندوق ذهن» خالی کن.</li>
          <li>
            به هر مورد یک وضعیت بده: <b>الان</b>، <b>بعداً</b>، <b>منتظر</b> (توپ در زمین
            دیگری) یا <b>پارک‌شده</b> (عمداً نه).
          </li>
          <li>
            فقط <b>۳ جبهه‌ی فعال</b> داشته باش؛ بقیه در صف نوبت می‌مانند.
          </li>
        </ol>
        <div className="empty" style={{ border: 0, padding: '16px 0 4px' }}>
          <div className="actions">
            <button className="btn btn-primary" onClick={() => onNavigate('inbox')}>
              شروع تخلیه‌ی ذهن
            </button>
            <button className="btn" onClick={() => dispatch({ type: 'STATE_SEED' })}>
              بگذار با داده‌ی نمونه ببینمش
            </button>
          </div>
        </div>
      </section>
    );
  }

  // ─── داشبورد اصلی ─────────────────────────────────────────────
  return (
    <>
      {state.inbox.length > 0 && (
        <div className="banner">
          <span aria-hidden>🧠</span>
          <span>
            {faNum(state.inbox.length)} مورد در صندوق ذهنت منتظر پردازش است — ذهن انبار
            نیست.
          </span>
          <span className="spacer" />
          <button className="btn btn-small" onClick={() => onNavigate('inbox')}>
            پردازش ←
          </button>
        </div>
      )}

      <div className="grid-stats">
        {TASK_STATUSES.map((s) => {
          const n = openTasks.filter((t) => t.status === s).length;
          return (
            <button
              key={s}
              className="stat-card"
              onClick={() => onNavigate('tasks')}
              title={TASK_STATUS_META[s].sub}
            >
              <span className="stat-top">
                <span className={`dot dot-${s}`} />
                {TASK_STATUS_META[s].label}
              </span>
              <div className={`stat-num st-${s}`}>{faNum(n)}</div>
            </button>
          );
        })}
      </div>

      <section className="card">
        <h2 className="card-title">
          🚀 جبهه‌های فعال
          <span className="card-sub">
            {faNum(activeProjects.length)} از {faNum(cap)}
          </span>
        </h2>
        <p className="front-count">
          <strong>۳ جبهه + یک صف انتظار</strong> — به‌جای ۳۰ جبهه‌ی جنگ.
        </p>

        {activeProjects.length === 0 && (
          <div className="empty">
            هنوز جبهه‌ی فعالی نداری — از بخش «پروژه‌ها» یکی را فعال کن.
          </div>
        )}

        {activeProjects.map((p) => {
          const next = nextOf(p.id);
          return (
            <div className="project-row" key={p.id}>
              <div style={{ flex: 1 }}>
                <div className="p-name">{p.name}</div>
                {next ? (
                  <div className="p-next">
                    <span className="star" title="قدم بعدی">
                      ★
                    </span>
                    <span>{next.text}</span>
                    <button
                      className="icon-btn"
                      title="انجام شد"
                      onClick={() =>
                        dispatch({ type: 'TASK_TOGGLE_DONE', id: next.id, now: Date.now() })
                      }
                    >
                      ✓
                    </button>
                  </div>
                ) : (
                  <form
                    className="next-form"
                    onSubmit={(e) => {
                      e.preventDefault();
                      createNext(p.id);
                    }}
                  >
                    <input
                      className="input"
                      placeholder="قدم بعدی این جبهه چیست؟"
                      value={drafts[p.id] ?? ''}
                      onChange={(e) => setDrafts((d) => ({ ...d, [p.id]: e.target.value }))}
                    />
                    <button type="submit" className="btn btn-small">
                      ثبت
                    </button>
                  </form>
                )}
              </div>
            </div>
          );
        })}
      </section>

      <section className="card">
        <h2 className="card-title">⭐ قدم‌های بعدی</h2>
        {nextSteps.length === 0 ? (
          <p className="card-sub" style={{ margin: 0 }}>
            هنوز قدم بعدی مشخص نکرده‌ای — برای هر جبهه‌ی فعال، یک قدم مشخص کن تا همیشه
            بدانی از کجا شروع کنی.
          </p>
        ) : (
          nextSteps.map((t) => (
            <div className="project-row" key={t.id}>
              <input
                type="checkbox"
                className="task-check"
                checked={false}
                title="انجام شد"
                onChange={() =>
                  dispatch({ type: 'TASK_TOGGLE_DONE', id: t.id, now: Date.now() })
                }
              />
              <div style={{ flex: 1 }}>
                <div className="p-next" style={{ color: 'var(--text)' }}>
                  <span className="star">★</span>
                  <span style={{ fontWeight: 600 }}>{t.text}</span>
                </div>
                <div className="task-meta" style={{ margin: 0 }}>
                  <span className={`chip chip-${t.projectId ? 'now' : 'parked'}`}>
                    {projectChip(t.projectId)}
                  </span>
                </div>
              </div>
            </div>
          ))
        )}
      </section>

      <details className="card under-control">
        <summary>
          😴 تحت کنترل
          <span className="card-sub">
            بعداً {faNum(later.length)} · پارک‌شده {faNum(parked.length)} · صف پروژه‌ها{' '}
            {faNum(queuedProjects.length)}
          </span>
          <span className="chev" aria-hidden>
            ‹
          </span>
        </summary>
        <p className="quote">
          این‌ها فعلاً تحت کنترل‌اند؛ لازم نیست امشب بهشان فکر کنی.
        </p>
        <div className="uc-grid">
          <div>
            <h4>
              <span className="dot dot-later" />
              بعداً — مهم است، ولی نه حالا
            </h4>
            {later.length === 0 && <div className="uc-item">—</div>}
            {later.map((t) => (
              <div className="uc-item" key={t.id}>
                {t.text}
              </div>
            ))}
          </div>
          <div>
            <h4>
              <span className="dot dot-parked" />
              پارک‌شده — تصمیم گرفته‌ای الان نه
            </h4>
            {parked.length === 0 && <div className="uc-item">—</div>}
            {parked.map((t) => (
              <div className="uc-item" key={t.id}>
                {t.text}
                {t.note && <span className="uc-note">{t.note}</span>}
              </div>
            ))}
          </div>
          <div>
            <h4>
              <span className="dot dot-later" />
              صف پروژه‌ها — منتظر نوبت
            </h4>
            {queuedProjects.length === 0 && <div className="uc-item">—</div>}
            {queuedProjects.map((p) => (
              <div className="uc-item" key={p.id}>
                {p.name}
              </div>
            ))}
          </div>
        </div>
      </details>

      <p className="footer">
        {faToday()} · لایه‌های بعدی — ظرفیت روزانه و مرور هفتگی — به‌زودی 🌱
      </p>
    </>
  );
}
