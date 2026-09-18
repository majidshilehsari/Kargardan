'use client';

// ─── اجزای کوچک مشترک رابط کاربری ─────────────────────────────────

import React from 'react';
import { useBusyCount } from '@/lib/busy';

/** چرخندهٔ کوچک — وقتی عملیاتی در جریان است */
export function Spinner({ className = '' }: { className?: string }) {
  return <span className={`spinner ${className}`} aria-hidden />;
}

/** ردیف «در حال انجام…» که داخل کارت‌ها نشان داده می‌شود */
export function BusyRow({ text = 'در حال انجام…' }: { text?: string }) {
  return (
    <div className="busy-row" role="status" aria-live="polite">
      <Spinner />
      <span>{text}</span>
    </div>
  );
}

/**
 * نوار نازک بالای صفحه — هر وقت عملیاتی در جریان باشد حرکت می‌کند.
 * در همهٔ صفحات دیده می‌شود، حتی اگر کاربر اسکرول کرده باشد.
 */
export function GlobalProgress() {
  const busy = useBusyCount();
  if (busy === 0) return null;

  return (
    <div className="global-progress" role="progressbar" aria-label="در حال انجام">
      <span className="global-progress-bar" />
    </div>
  );
}
