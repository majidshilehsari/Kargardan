import type { AppState } from './types';

/**
 * داده‌ی نمونه — فقط برای آشنایی اولیه با سیستم.
 * بعد از شروع کار واقعی می‌توانی همه را پاک کنی (تنظیمات ← پاک‌کردن داده‌ها).
 */
export function seedState(): AppState {
  const now = Date.now();
  const day = 86_400_000;

  const pShop = 'prj-shop';
  const pMoney = 'prj-money';
  const pResume = 'prj-resume';
  const pGuitar = 'prj-guitar';
  const pStorage = 'prj-storage';

  return {
    version: 1,
    settings: { activeProjectCap: 3 },
    inbox: [
      { id: 'in1', text: 'ایده: اپلیکیشن پیاده‌روی گروهی صبح‌ها', createdAt: now - day * 0.2 },
      { id: 'in2', text: 'تمدید بیمه‌ی خودرو — مهلت تا پایان ماه', createdAt: now - day * 0.5 },
      { id: 'in3', text: 'تصمیم: تعطیلات پاییز کجا برویم؟', createdAt: now - day * 1.2 },
    ],
    projects: [
      { id: pShop, name: 'راه‌اندازی فروشگاه آنلاین', status: 'active', createdAt: now - day * 12 },
      { id: pMoney, name: 'مرتب‌کردن مالی شخصی', status: 'active', createdAt: now - day * 9 },
      { id: pResume, name: 'بازنویسی رزومه', status: 'active', createdAt: now - day * 6 },
      { id: pGuitar, name: 'یادگیری گیتار', status: 'queued', createdAt: now - day * 20 },
      { id: pStorage, name: 'بازچیدمان انبار خانه', status: 'parked', createdAt: now - day * 30 },
    ],
    tasks: [
      // قدم‌های بعدیِ جبهه‌های فعال
      { id: 't1', text: 'لیست ۱۰ محصول اول را آماده کن', status: 'now', projectId: pShop, isNextStep: true, waitingOn: '', note: '', done: false, createdAt: now - day * 2, updatedAt: now },
      { id: 't2', text: 'صورتحساب سه‌ماه اخیر را مرور کن', status: 'now', projectId: pMoney, isNextStep: true, waitingOn: '', note: '', done: false, createdAt: now - day * 2, updatedAt: now },
      { id: 't3', text: 'نوشتن نسخه‌ی اول متن رزومه', status: 'now', projectId: pResume, isNextStep: true, waitingOn: '', note: '', done: false, createdAt: now - day * 1, updatedAt: now },
      // یک کار بدون پروژه
      { id: 't4', text: 'تماس با بانک درباره‌ی کارمزد انتقال', status: 'now', projectId: null, isNextStep: false, waitingOn: '', note: '', done: false, createdAt: now - day * 0.4, updatedAt: now },
      // بعداً
      { id: 't5', text: 'ثبت‌نام کنفرانس توسعه‌ی فردی', status: 'later', projectId: null, isNextStep: false, waitingOn: '', note: '', done: false, createdAt: now - day * 5, updatedAt: now },
      { id: 't6', text: 'ادامه‌ی کتاب «اثر مرکب» — فصل بعدی', status: 'later', projectId: null, isNextStep: false, waitingOn: '', note: '', done: false, createdAt: now - day * 3, updatedAt: now },
      { id: 't7', text: 'مقایسه‌ی قیمت لپ‌تاپ برای ارتقا', status: 'later', projectId: null, isNextStep: false, waitingOn: '', note: '', done: false, createdAt: now - day * 8, updatedAt: now },
      // منتظر
      { id: 't8', text: 'پاسخ ایمیل درباره‌ی پیش‌فاکتور', status: 'waiting', projectId: pShop, isNextStep: false, waitingOn: 'امیر (مشتری)', note: '', done: false, createdAt: now - day * 4, updatedAt: now },
      { id: 't9', text: 'بازگشت وجه بلیت کنسل‌شده', status: 'waiting', projectId: null, isNextStep: false, waitingOn: 'شرکت هواپیمایی', note: '', done: false, createdAt: now - day * 6, updatedAt: now },
      // پارک‌شده — تصمیم‌های بسته‌شده
      { id: 't10', text: 'راه‌اندازی پادکست', status: 'parked', projectId: null, isNextStep: false, waitingOn: '', note: 'تا وقتی فروشگاه راه نیفتد، نه.', done: false, createdAt: now - day * 25, updatedAt: now },
      { id: 't11', text: 'یادگیری سولفژ', status: 'parked', projectId: null, isNextStep: false, waitingOn: '', note: 'پاییز، اگر گیتار شروع شد.', done: false, createdAt: now - day * 40, updatedAt: now },
      // انجام‌شده
      { id: 't12', text: 'گرفتن جواز کسب', status: 'now', projectId: pShop, isNextStep: false, waitingOn: '', note: '', done: true, createdAt: now - day * 11, updatedAt: now - day * 7 },
    ],
  };
}
