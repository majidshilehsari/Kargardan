'use client';

import React, { useState } from 'react';
import { useActions, useStore } from '@/lib/store';
import { faNum } from '@/lib/format';
import { TASK_STATUSES, TASK_STATUS_META, type Task, type TaskStatus } from '@/lib/types';
import { InlineEdit } from './common';

/**
 * لایه‌ی ۲ — تفکیک «مهم» از «فوری»:
 * هر چیزی که وارد سیستم می‌شود، الزاماً نباید الان انجام شود.
 */
function TaskCard({ task }: { task: Task }) {
  const { state, dispatch } = useStore();
  const now = () => Date.now();

  return (
    <div
      className={`task-card ${task.done ? 'is-done' : ''} ${task.isNextStep ? 'is-next' : ''}`}
    >
      <div className="task-main">
        <input
          type="checkbox"
          className="task-check"
          checked={task.done}
          title={task.done ? 'برگرداندن به حالت باز' : 'انجام شد'}
          onChange={() => dispatch({ type: 'TASK_TOGGLE_DONE', id: task.id, now: now() })}
        />
        <InlineEdit
          className="text"
          value={task.text}
          onSave={(v) => dispatch({ type: 'TASK_UPDATE', id: task.id, now: now(), patch: { text: v } })}
        />
        {task.status === 'now' && !task.done && (
          <button
            className={`star-btn ${task.isNextStep ? 'on' : ''}`}
            title={task.isNextStep ? 'برداشتن ستاره‌ی قدم بعدی' : 'ستاره‌دار: قدم بعدی'}
            onClick={() => dispatch({ type: 'TASK_TOGGLE_NEXT', id: task.id, now: now() })}
          >
            ★
          </button>
        )}
        <button
          className="icon-btn danger"
          title="حذف"
          onClick={() => dispatch({ type: 'TASK_DELETE', id: task.id })}
        >
          🗑
        </button>
      </div>

      {task.status === 'waiting' && (
        <div className="task-meta">
          در انتظارِ
          <InlineEdit
            value={task.waitingOn}
            placeholder="کی؟"
            onSave={(v) =>
              dispatch({ type: 'TASK_UPDATE', id: task.id, now: now(), patch: { waitingOn: v } })
            }
          />
        </div>
      )}

      {task.status === 'parked' && (
        <div className="task-meta">
          یادداشت:
          <InlineEdit
            value={task.note}
            placeholder="چرا پارک شد؟"
            onSave={(v) =>
              dispatch({ type: 'TASK_UPDATE', id: task.id, now: now(), patch: { note: v } })
            }
          />
        </div>
      )}

      <div className="task-meta">
        <select
          className="select"
          value={task.projectId ?? ''}
          title="پروژه"
          onChange={(e) =>
            dispatch({
              type: 'TASK_UPDATE',
              id: task.id,
              now: now(),
              patch: { projectId: e.target.value || null },
            })
          }
        >
          <option value="">بدون پروژه</option>
          {state.projects.map((p) => (
            <option key={p.id} value={p.id}>
              {p.name}
            </option>
          ))}
        </select>
        <select
          className="select"
          value={task.status}
          title="وضعیت"
          onChange={(e) =>
            dispatch({
              type: 'TASK_SET_STATUS',
              id: task.id,
              status: e.target.value as TaskStatus,
              now: now(),
            })
          }
        >
          {TASK_STATUSES.map((s) => (
            <option key={s} value={s}>
              {TASK_STATUS_META[s].label}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export default function TasksBoard() {
  const { state } = useStore();
  const { taskAdd } = useActions();
  const [showDone, setShowDone] = useState(false);
  const [drafts, setDrafts] = useState<Record<string, string>>({});

  const open = state.tasks.filter((t) => !t.done);
  const done = state.tasks.filter((t) => t.done);

  const add = (status: TaskStatus) => {
    const v = (drafts[status] ?? '').trim();
    if (!v) return;
    taskAdd(v, status);
    setDrafts((d) => ({ ...d, [status]: '' }));
  };

  return (
    <>
      <div className="banner" style={{ marginBottom: 12 }}>
        <span aria-hidden>🌿</span>
        <span>هر چیزی که وارد سیستم می‌شود، الزاماً نباید الان انجام شود.</span>
        <span className="spacer" />
        {done.length > 0 && (
          <label style={{ display: 'flex', gap: 6, alignItems: 'center', fontSize: 12.5, cursor: 'pointer' }}>
            <input
              type="checkbox"
              checked={showDone}
              onChange={(e) => setShowDone(e.target.checked)}
              style={{ accentColor: 'var(--accent)' }}
            />
            انجام‌شده‌ها ({faNum(done.length)})
          </label>
        )}
      </div>

      <div className="columns">
        {TASK_STATUSES.map((s) => {
          const items = [...open, ...(showDone ? done : [])]
            .filter((t) => t.status === s)
            .sort((a, b) => {
              if (a.done !== b.done) return a.done ? 1 : -1;
              if (a.isNextStep !== b.isNextStep) return a.isNextStep ? -1 : 1;
              return b.createdAt - a.createdAt;
            });
          return (
            <div className="col" key={s}>
              <div className="col-head">
                <span className={`dot dot-${s}`} />
                <span className="label">{TASK_STATUS_META[s].label}</span>
                <span className="count">
                  {faNum(open.filter((t) => t.status === s).length)}
                </span>
              </div>
              <p className="col-sub">{TASK_STATUS_META[s].sub}</p>
              <input
                className="add-input"
                placeholder="+ افزودن…"
                value={drafts[s] ?? ''}
                onChange={(e) => setDrafts((d) => ({ ...d, [s]: e.target.value }))}
                onKeyDown={(e) => {
                  if (e.key === 'Enter') {
                    e.preventDefault();
                    add(s);
                  }
                }}
              />
              {items.length === 0 && <div className="empty-col">—</div>}
              {items.map((t) => (
                <TaskCard key={t.id} task={t} />
              ))}
            </div>
          );
        })}
      </div>
    </>
  );
}
