'use client';

import React from 'react';
import { parseState, useStore } from '@/lib/store';
import { faNum } from '@/lib/format';

export default function SettingsView() {
  const { state, dispatch } = useStore();
  const cap = state.settings.activeProjectCap;

  const exportJson = () => {
    const blob = new Blob([JSON.stringify(state, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `kargardan-backup-${new Date().toISOString().slice(0, 10)}.json`;
    a.click();
    URL.revokeObjectURL(url);
  };

  const importFile = (e: React.ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    e.target.value = '';
    if (!f) return;
    f.text().then((raw) => {
      const parsed = parseState(raw);
      if (!parsed) {
        window.alert('این فایل پشتیبان معتبر کارگردان نیست.');
        return;
      }
      if (window.confirm('داده‌های فعلی با محتوای فایل جایگزین شود؟')) {
        dispatch({ type: 'STATE_REPLACE', state: parsed });
      }
    });
  };

  return (
    <>
      <section className="card">
        <h2 className="card-title">⚙️ تنظیمات</h2>

        <div className="settings-row">
          <div className="desc">
            <div className="t">سقف جبهه‌های فعال</div>
            <div className="d">
              هم‌زمان بیشتر از این تعداد پروژه‌ی فعال نداشته باشی. پیشنهاد: ۳
            </div>
          </div>
          <input
            type="number"
            min={1}
            max={10}
            className="input cap-input"
            value={cap}
            onChange={(e) => {
              if (e.target.value === '') return;
              dispatch({ type: 'SETTINGS_SET_CAP', cap: Number(e.target.value) });
            }}
          />
        </div>

        <div className="settings-row">
          <div className="desc">
            <div className="t">پشتیبان‌گیری (خروجی JSON)</div>
            <div className="d">
              فایل پشتیبان دانلود می‌شود — برای نگهداری یا انتقال به دستگاه دیگر.
            </div>
          </div>
          <button className="btn" onClick={exportJson}>
            ⬇️ دانلود پشتیبان
          </button>
        </div>

        <div className="settings-row">
          <div className="desc">
            <div className="t">بازیابی از فایل</div>
            <div className="d">داده‌های فعلی با فایل پشتیبان جایگزین می‌شود.</div>
          </div>
          <label className="btn" style={{ cursor: 'pointer' }}>
            انتخاب فایل…
            <input type="file" accept="application/json,.json" hidden onChange={importFile} />
          </label>
        </div>

        <div className="settings-row">
          <div className="desc">
            <div className="t">داده‌ی نمونه</div>
            <div className="d">برای آشنایی با سیستم، چند نمونه بگذار (جای داده‌های فعلی).</div>
          </div>
          <button
            className="btn"
            onClick={() => {
              if (window.confirm('داده‌های نمونه جای داده‌های فعلی گذاشته شود؟')) {
                dispatch({ type: 'STATE_SEED' });
              }
            }}
          >
            بارگذاری نمونه
          </button>
        </div>

        <div className="settings-row">
          <div className="desc">
            <div className="t">پاک‌کردن همه‌ی داده‌ها</div>
            <div className="d">
              همه‌ی کارها، پروژه‌ها و صندوق خالی می‌شود. برگشتی ندارد.
            </div>
          </div>
          <button
            className="btn btn-danger"
            onClick={() => {
              if (window.confirm('همه‌ی داده‌ها پاک شود؟ این کار برگشت‌پذیر نیست.')) {
                dispatch({ type: 'STATE_RESET' });
              }
            }}
          >
            پاک‌کردن
          </button>
        </div>

        <p className="quote">
          داده‌های تو هرگز از مرورگرت خارج نمی‌شود — کارگردان هیچ سروری ندارد؛ همه‌چیز همین‌جا،
          در دستگاه توست.
        </p>
      </section>

      <p className="footer">
        هم‌اکنون: {faNum(state.tasks.length)} کار · {faNum(state.projects.length)} پروژه ·{' '}
        {faNum(state.inbox.length)} مورد در صندوق
      </p>
    </>
  );
}
