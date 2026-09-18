// ─── مدل داده‌ی کارگردان ───────────────────────────────────────────
// چهار وضعیت کار (تفکیک «مهم» از «فوری»):
//   الان     → باید در آینده‌ی نزدیک انجام شود
//   بعداً    → مهم است ولی فعلاً نه
//   منتظر    → توپ در زمین شخص دیگری است
//   پارک‌شده → عمداً تصمیم گرفته‌ای الان انجامش ندهی
export type TaskStatus = 'now' | 'later' | 'waiting' | 'parked';

// وضعیت پروژه: فقط چند «جبهه‌ی فعال» محدود مجاز است؛ بقیه در صف می‌مانند
export type ProjectStatus = 'active' | 'queued' | 'parked' | 'done';

export interface Task {
  id: string;
  text: string;
  status: TaskStatus;
  projectId: string | null;
  /** قدم بعدیِ آن پروژه/زمینه — برای هر پروژه حداکثر یکی */
  isNextStep: boolean;
  /** فقط برای وضعیت «منتظر»: توپ در زمین کیست؟ */
  waitingOn: string;
  /** فقط برای وضعیت «پارک‌شده»: چرا پارک شده / چه زمانی سراغش بیاییم */
  note: string;
  done: boolean;
  createdAt: number;
  updatedAt: number;
}

export interface Project {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: number;
}

export interface InboxItem {
  id: string;
  text: string;
  createdAt: number;
}

export interface AppState {
  version: 1;
  settings: {
    /** سقف پروژه‌های فعال — پیش‌فرض ۳ */
    activeProjectCap: number;
  };
  inbox: InboxItem[];
  tasks: Task[];
  projects: Project[];
}

export const TASK_STATUSES: TaskStatus[] = ['now', 'later', 'waiting', 'parked'];

export const TASK_STATUS_META: Record<
  TaskStatus,
  { label: string; sub: string }
> = {
  now: { label: 'الان', sub: 'در آینده‌ی نزدیک انجام شود' },
  later: { label: 'بعداً', sub: 'مهم است، ولی فعلاً نه' },
  waiting: { label: 'منتظر', sub: 'توپ در زمین دیگری است' },
  parked: { label: 'پارک‌شده', sub: 'عمداً کنار گذاشته‌ای' },
};

export const PROJECT_STATUSES: ProjectStatus[] = ['active', 'queued', 'parked', 'done'];

export const PROJECT_STATUS_META: Record<ProjectStatus, { label: string }> = {
  active: { label: 'فعال' },
  queued: { label: 'در صف' },
  parked: { label: 'پارک‌شده' },
  done: { label: 'تمام‌شده' },
};
