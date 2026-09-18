'use client';

// ─── نشانگر «کاری در جریان است» ────────────────────────────────────
// هر عملیاتی که ممکن است طول بکشد (تأیید پیشنهاد، برگرداندن از سطل بازیافت،
// ساخت جدول‌ها …) از این استفاده می‌کند تا کاربر بی‌خبر نماند.
//
// طرز کار: یک شمارندهٔ ساده که در تمام برنامه مشترک است. هر عملیات که شروع
// می‌شود شمارنده را یکی بالا می‌برد و در پایان یکی پایین می‌آورد.

import { useSyncExternalStore } from 'react';

let count = 0;
const listeners = new Set<() => void>();

function emit() {
  for (const l of listeners) l();
}

function subscribe(fn: () => void): () => void {
  listeners.add(fn);
  return () => {
    listeners.delete(fn);
  };
}

function getCount(): number {
  return count;
}

/** فقط برای رندر سرور — همیشه صفر */
function getServerCount(): number {
  return 0;
}

/** شروع یک عملیات — تابع پایان را برمی‌گرداند */
export function startBusy(): () => void {
  count += 1;
  emit();

  let ended = false;
  return () => {
    if (ended) return; // جلوگیری از کم‌کردن دوباره
    ended = true;
    count = Math.max(0, count - 1);
    emit();
  };
}

/** یک وعده را با نشانگر «در حال انجام» اجرا کن */
export async function withBusy<T>(fn: () => Promise<T>): Promise<T> {
  const end = startBusy();
  try {
    return await fn();
  } finally {
    end();
  }
}

/** تعداد عملیات‌های در جریان — برای نشانگر سراسری */
export function useBusyCount(): number {
  return useSyncExternalStore(subscribe, getCount, getServerCount);
}
