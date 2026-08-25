'use client';

import React, { useState } from 'react';
import { useActions, useStore } from '@/lib/store';
import { faNum } from '@/lib/format';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
  type ProjectStatus,
} from '@/lib/types';
import { InlineEdit } from './common';

/**
 * لایه‌ی ۳ — سقف جبهه‌های فعال:
 * ممکن است ۳۰ کار داشته باشی، اما فقط چند تای آنها فعال‌اند.
 * بقیه منتظر نوبتشان هستند.
 */

const GROUP_DOT: Record<ProjectStatus, string> = {
  active: 'dot-now',
  queued: 'dot-later',
  parked: 'dot-parked',
  done: 'dot-parked',
};

export default function ProjectsView() {
  const { state, dispatch } = useStore();
  const { projectAdd } = useActions();
  const cap = state.settings.activeProjectCap;
  const active = state.projects.filter((p) => p.status === 'active');
  const capFull = active.length >= cap;

  const [name, setName] = useState('');
  const [pendingActivate, setPendingActivate] = useState<string | null>(null);
  const pendingProject = pendingActivate
    ? state.projects.find((p) => p.id === pendingActivate) ?? null
    : null;

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = name.trim();
    if (!v) return;
    projectAdd(v, true); // اگر سقف پر باشد، خودکار در صف می‌نشیند
    setName('');
  };

  const changeStatus = (id: string, s: ProjectStatus) => {
    const p = state.projects.find((x) => x.id === id);
    if (s === 'active' && capFull && p && p.status !== 'active') {
      setPendingActivate(id); // سقف پر است — اول یکی را به صف برگردان
      return;
    }
    dispatch({ type: 'PROJECT_SET_STATUS', id, status: s, now: Date.now() });
  };

  const demoteAndActivate = (activeId: string) => {
    if (!pendingActivate) return;
    dispatch({ type: 'PROJECT_SET_STATUS', id: activeId, status: 'queued', now: Date.now() });
    dispatch({
      type: 'PROJECT_SET_STATUS',
      id: pendingActivate,
      status: 'active',
      now: Date.now(),
    });
    setPendingActivate(null);
  };

  const openTaskCount = (pid: string) =>
    state.tasks.filter((t) => t.projectId === pid && !t.done).length;
  const nextOf = (pid: string) =>
    state.tasks.find((t) => t.projectId === pid && t.isNextStep && !t.done);

  return (
    <>
      <section className="card">
        <h2 className="card-title">🚀 جبهه‌ها</h2>
        <div className="cap-row">
          <div className="cap-dots" aria-hidden>
            {Array.from({ length: cap }).map((_, i) => (
              <span key={i} className={`cap-dot ${i < active.length ? 'on' : ''}`} />
            ))}
          </div>
          <span>
            <strong style={{ color: 'var(--accent-strong)' }}>{faNum(active.length)}</strong>{' '}
            از {faNum(cap)} جبهه فعال
          </span>
          <span className="card-sub">— بقیه در صف نوبت‌اند، نه در جنگ.</span>
        </div>

        <form className="add-row" onSubmit={submit}>
          <input
            className="input"
            placeholder="نام پروژه‌ی جدید…"
            value={name}
            onChange={(e) => setName(e.target.value)}
          />
          <button type="submit" className="btn btn-primary">
            {capFull ? 'افزودن به صف' : 'شروع پروژه'}
          </button>
        </form>
        {capFull && (
          <p className="card-sub" style={{ margin: 0 }}>
            سقف فعال‌ها پر است؛ پروژه‌ی جدید به «صف» می‌رود تا نوبتش برسد.
          </p>
        )}
      </section>

      {pendingProject && (
        <div className="warn-panel">
          <strong>سقف جبهه‌های فعال پر است.</strong> برای فعال‌کردن «{pendingProject.name}»
          اول یکی از این‌ها را به صف برگردان:
          {active
            .filter((p) => p.id !== pendingActivate)
            .map((p) => (
              <div className="option" key={p.id}>
                <span className="name">{p.name}</span>
                <button className="btn btn-small" onClick={() => demoteAndActivate(p.id)}>
                  به صف
                </button>
              </div>
            ))}
          <div style={{ marginTop: 10 }}>
            <button className="btn btn-small" onClick={() => setPendingActivate(null)}>
              بی‌خیال — در صف بماند
            </button>
          </div>
        </div>
      )}

      {PROJECT_STATUSES.map((group) => {
        const items = state.projects.filter((p) => p.status === group);
        if (items.length === 0) return null;
        return (
          <React.Fragment key={group}>
            <h3 className="group-title">
              <span className={`dot ${GROUP_DOT[group]}`} />
              {PROJECT_STATUS_META[group].label}
              <span className="card-sub">({faNum(items.length)})</span>
            </h3>
            {items.map((p) => {
              const next = nextOf(p.id);
              return (
                <div
                  className={`proj-card ${group === 'active' ? 'is-active' : ''} ${
                    group === 'done' ? 'is-done' : ''
                  }`}
                  key={p.id}
                >
                  <div className="proj-top">
                    <InlineEdit
                      className="name"
                      value={p.name}
                      onSave={(v) => dispatch({ type: 'PROJECT_RENAME', id: p.id, name: v })}
                    />
                    <select
                      className="select"
                      value={p.status}
                      onChange={(e) => changeStatus(p.id, e.target.value as ProjectStatus)}
                    >
                      {PROJECT_STATUSES.map((s) => (
                        <option key={s} value={s}>
                          {PROJECT_STATUS_META[s].label}
                        </option>
                      ))}
                    </select>
                    <button
                      className="icon-btn danger"
                      title="حذف پروژه — کارهایش حذف نمی‌شوند"
                      onClick={() => {
                        if (
                          window.confirm(
                            `پروژه‌ی «${p.name}» حذف شود؟ کارهای آن حذف نمی‌شوند؛ فقط بی‌پروژه می‌شوند.`
                          )
                        )
                          dispatch({ type: 'PROJECT_DELETE', id: p.id });
                      }}
                    >
                      🗑
                    </button>
                  </div>
                  <div className="proj-bottom">
                    <span>{faNum(openTaskCount(p.id))} کار باز</span>
                    <span>
                      قدم بعدی:{' '}
                      {next ? (
                        <span className="proj-next-text">★ {next.text}</span>
                      ) : (
                        <span className="dim">—</span>
                      )}
                    </span>
                  </div>
                </div>
              );
            })}
          </React.Fragment>
        );
      })}

      {state.projects.length === 0 && (
        <div className="empty">
          <div className="big">🗺️</div>
          هنوز پروژه‌ای نساخته‌ای — از صندوق ذهن یا همین‌جا شروع کن.
        </div>
      )}
    </>
  );
}
