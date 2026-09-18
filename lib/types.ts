// ─── مدل داده‌ی کارگردان ───────────────────────────────────────────
// چهار وضعیت کار (تفکیک «مهم» از «فوری»):
//   الان     → باید در آینده‌ی نزدیک انجام شود
//   بعداً    → مهم است ولی فعلاً نه
//   منتظر    → توپ در زمین شخص دیگری است
//   پارک‌شده → عمداً تصمیم گرفته‌ای الان انجامش ندهی
export type TaskStatus = 'now' | 'later' | 'waiting' | 'parked';

// وضعیت پروژه: فقط چند «جبهه‌ی فعال» محدود مجاز است؛ بقیه در صف می‌مانند
export type ProjectStatus = 'active' | 'queued' | 'parked' | 'done';

/**
 * 🗑 سطل بازیافت — هیچ چیزی واقعاً پاک نمی‌شود.
 * هر موجودیت حذف‌شده فقط تاریخِ حذف می‌گیرد و از نمای عادی کنار می‌رود،
 * ولی در «سطل بازیافت» می‌ماند و هر وقت خواستی برمی‌گردد.
 */
export interface SoftDeletable {
  /** زمان حذف (میلی‌ثانیه). نبود/خالی یعنی حذف نشده. */
  deletedAt?: number | null;
  /** چه کسی حذف کرد: خودت یا ایجنت همکار */
  deletedBy?: 'user' | 'agent' | null;
}

export interface Task extends SoftDeletable {
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

export interface Project extends SoftDeletable {
  id: string;
  name: string;
  status: ProjectStatus;
  createdAt: number;
}

export interface InboxItem extends SoftDeletable {
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

/** هر چیزی که می‌تواند در سطل بازیافت بیفتد */
export type TrashKind = 'task' | 'project' | 'inbox';

export interface TrashItem {
  kind: TrashKind;
  id: string;
  /** متنِ قابل‌نمایش برای کاربر */
  label: string;
  /** توضیح کوتاه — مثلاً وضعیت یا نام پروژه */
  sub: string;
  deletedAt: number;
  deletedBy: 'user' | 'agent';
}

// ─── ایجنت همکار ────────────────────────────────────────────────────

/** چه نوع تغییری ایجنت پیشنهاد می‌دهد */
export type SuggestionKind =
  | 'task_add'
  | 'task_update'
  | 'task_set_status'
  | 'task_toggle_done'
  | 'project_add'
  | 'project_set_status'
  | 'note';

export type SuggestionStatus = 'pending' | 'approved' | 'rejected';

export interface Suggestion {
  id: string;
  /** نام ایجنتی که این پیشنهاد را داده */
  agentName: string;
  /** عنوان کوتاه — در فهرست نشان داده می‌شود */
  title: string;
  /** توضیح ایجنت: چرا این پیشنهاد را می‌دهد */
  body: string;
  kind: SuggestionKind;
  /** داده‌ی اجرایی پیشنهاد (مثلاً متن کار، یا شناسه‌ی چیزی که باید عوض شود) */
  payload: Record<string, unknown> | null;
  status: SuggestionStatus;
  createdAt: number;
  decidedAt: number | null;
  /** یادداشت تصمیم تو — چرا پذیرفتی یا رد کردی */
  decisionNote: string;
  /** اگر اجرا شده: شناسه‌ی رویداد تاریخی که با آن می‌توان برگرداند */
  appliedEventId: string | null;
}

export const SUGGESTION_KIND_META: Record<SuggestionKind, { label: string; icon: string }> = {
  task_add: { label: 'ساخت کار جدید', icon: '➕' },
  task_update: { label: 'ویرایش کار', icon: '✏️' },
  task_set_status: { label: 'تغییر وضعیت کار', icon: '🔀' },
  task_toggle_done: { label: 'تمام‌کردن کار', icon: '✓' },
  project_add: { label: 'ساخت پروژه‌ی جدید', icon: '🚀' },
  project_set_status: { label: 'تغییر وضعیت پروژه', icon: '🔁' },
  note: { label: 'یادداشت / پیشنهاد آزاد', icon: '💡' },
};

// ─── تاریخچه (برای برگرداندن هر اقدام) ────────────────────────────

export type HistoryEntityKind = 'task' | 'project' | 'inbox';

export interface HistoryEvent {
  id: string;
  entityKind: HistoryEntityKind;
  entityId: string;
  /** نوع کاری که انجام شد — ساخت / ویرایش / حذف / بازیابی … */
  action: string;
  /** وضعیت پیش از تغییر */
  before: unknown;
  /** وضعیت پس از تغییر */
  after: unknown;
  /** این تغییر از کجا آمده: خودت یا ایجنت همکار */
  source: 'user' | 'agent';
  /** اگر از یک پیشنهاد آمده، شناسه‌ی آن */
  suggestionId: string | null;
  at: number;
  undoneAt: number | null;
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

export const PROJECT_STATUS_LABEL_EN: Record<ProjectStatus, string> = {
  active: 'active',
  queued: 'queued',
  parked: 'parked',
  done: 'done',
};
