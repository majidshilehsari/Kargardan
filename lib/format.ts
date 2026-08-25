// ─── قالب‌بندی اعداد و تاریخ به فارسی ────────────────────────────
export const faNum = (n: number): string => n.toLocaleString('fa-IR');

export const faDate = (ts: number): string =>
  new Intl.DateTimeFormat('fa-IR', { day: 'numeric', month: 'long' }).format(ts);

export const faToday = (): string =>
  new Intl.DateTimeFormat('fa-IR', {
    weekday: 'long',
    day: 'numeric',
    month: 'long',
  }).format(new Date());
