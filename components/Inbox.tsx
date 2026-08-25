'use client';

import React, { useState } from 'react';
import { useActions, useStore } from '@/lib/store';
import { faDate } from '@/lib/format';
import { TASK_STATUSES, TASK_STATUS_META } from '@/lib/types';
import { InlineEdit } from './common';

/**
 * لایه‌ی ۱ — تخلیه‌ی کامل:
 * مغز نباید محل نگهداری فهرست کارها باشد.
 */
export default function InboxView() {
  const { state, dispatch } = useStore();
  const { inboxAdd } = useActions();
  const [text, setText] = useState('');

  const submit = (e: React.FormEvent) => {
    e.preventDefault();
    const v = text.trim();
    if (!v) return;
    inboxAdd(v);
    setText('');
  };

  return (
    <>
      <section className="card">
        <h2 className="card-title">🧠 تخلیه‌ی ذهن</h2>
        <p className="inbox-intro">
          هر چیزی که ذهنت را اشغال کرده — کار، پول، ایده، تصمیم، «باید یک روزی…» — همین‌جا
          خالی کن. پردازش، قدم بعد است؛ اول تخلیه.
        </p>

        <form className="add-row" onSubmit={submit}>
          <input
            className="input"
            placeholder="مثلاً: تمدید بیمه‌ی خودرو…"
            value={text}
            onChange={(e) => setText(e.target.value)}
            autoFocus
          />
          <button type="submit" className="btn btn-primary">
            بریز در صندوق
          </button>
        </form>

        {state.inbox.length === 0 ? (
          <div className="empty">
            <div className="big">✨</div>
            ذهنت خلوت است.
          </div>
        ) : (
          state.inbox.map((item) => (
            <div className="inbox-item" key={item.id}>
              <div className="top">
                <InlineEdit
                  className="text"
                  value={item.text}
                  onSave={(v) =>
                  dispatch({ type: 'INBOX_EDIT', id: item.id, text: v, now: Date.now() })
                }
                />
                <span className="when">{faDate(item.createdAt)}</span>
                <button
                  className="icon-btn danger"
                  title="حذف"
                  onClick={() => dispatch({ type: 'INBOX_DELETE', id: item.id })}
                >
                  🗑
                </button>
              </div>
              <div className="process-row">
                <span className="process-label">کار:</span>
                {TASK_STATUSES.map((s) => (
                  <button
                    key={s}
                    className={`status-btn sb-${s}`}
                    title={TASK_STATUS_META[s].sub}
                    onClick={() =>
                      dispatch({
                        type: 'INBOX_TO_TASK',
                        id: item.id,
                        status: s,
                        now: Date.now(),
                      })
                    }
                  >
                    {TASK_STATUS_META[s].label}
                  </button>
                ))}
                <span className="process-label">یا</span>
                <button
                  className="btn btn-small"
                  title="اگر جا باشد فعال می‌شود، وگرنه در صف می‌رود"
                  onClick={() =>
                    dispatch({
                      type: 'INBOX_TO_PROJECT',
                      id: item.id,
                      now: Date.now(),
                      startActive: true,
                    })
                  }
                >
                  پروژه‌ی جدید 🚀
                </button>
              </div>
            </div>
          ))
        )}
      </section>

      <p className="footer">
        قانون: هر مورد باید جایی غیر از ذهن تو زندگی کند — اینجا، یا در یکی از وضعیت‌ها.
      </p>
    </>
  );
}
