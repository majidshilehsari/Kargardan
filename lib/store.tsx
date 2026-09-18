'use client';

// ─── استور مرکزی: reducer + ذخیره‌ی خودکار در localStorage ────────
import React, {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useReducer,
  useRef,
  useState,
} from 'react';
import type { AppState, ProjectStatus, Task, TaskStatus } from './types';
import { seedState } from './seed';

const STORAGE_KEY = 'kargardan-state-v1';
export const THEME_KEY = 'kargardan-theme';

export const uid = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

export const initialState: AppState = {
  version: 1,
  settings: { activeProjectCap: 3 },
  inbox: [],
  tasks: [],
  projects: [],
};

// ─── اکشن‌ها ──────────────────────────────────────────────────────
export type Action =
  | { type: 'INBOX_ADD'; id: string; now: number; text: string }
  | { type: 'INBOX_DELETE'; id: string }
  | { type: 'INBOX_EDIT'; id: string; text: string; now: number }
  | { type: 'INBOX_TO_TASK'; id: string; status: TaskStatus; now: number }
  | { type: 'INBOX_TO_PROJECT'; id: string; now: number; startActive: boolean }
  | { type: 'TASK_ADD'; id: string; now: number; text: string; status: TaskStatus; projectId?: string | null; isNext?: boolean; waitingOn?: string }
  | { type: 'TASK_UPDATE'; id: string; now: number; patch: Partial<Pick<Task, 'text' | 'waitingOn' | 'note' | 'projectId'>> }
  | { type: 'TASK_DELETE'; id: string }
  | { type: 'TASK_TOGGLE_DONE'; id: string; now: number }
  | { type: 'TASK_SET_STATUS'; id: string; status: TaskStatus; now: number }
  | { type: 'TASK_TOGGLE_NEXT'; id: string; now: number }
  | { type: 'PROJECT_ADD'; id: string; now: number; name: string; startActive: boolean }
  | { type: 'PROJECT_RENAME'; id: string; name: string }
  | { type: 'PROJECT_SET_STATUS'; id: string; status: ProjectStatus; now: number }
  | { type: 'PROJECT_DELETE'; id: string }
  | { type: 'SETTINGS_SET_CAP'; cap: number }
  | { type: 'STATE_REPLACE'; state: AppState }
  | { type: 'STATE_SEED' }
  | { type: 'STATE_RESET' };

// ─── کمک‌های داخلی ───────────────────────────────────────────────
const activeProjectCount = (s: AppState): number =>
  s.projects.filter((p) => p.status === 'active').length;

const newTask = (
  id: string,
  now: number,
  text: string,
  status: TaskStatus,
  projectId: string | null = null,
  extra: Partial<Task> = {}
): Task => ({
  id,
  text,
  status,
  projectId,
  isNextStep: false,
  waitingOn: '',
  note: '',
  done: false,
  createdAt: now,
  updatedAt: now,
  ...extra,
});

/** ستاره‌ی «قدم بعدی» برای هر پروژه/زمینه فقط روی یک کار می‌ماند */
const withSingleNext = (tasks: Task[], id: string): Task[] => {
  const target = tasks.find((t) => t.id === id);
  if (!target) return tasks;
  return tasks.map((t) =>
    t.projectId === target.projectId ? { ...t, isNextStep: t.id === id } : t
  );
};

// ─── Reducer ──────────────────────────────────────────────────────
export function reducer(state: AppState, action: Action): AppState {
  switch (action.type) {
    case 'INBOX_ADD':
      return {
        ...state,
        inbox: [
          { id: action.id, text: action.text, createdAt: action.now },
          ...state.inbox,
        ],
      };

    case 'INBOX_DELETE':
      return { ...state, inbox: state.inbox.filter((i) => i.id !== action.id) };

    case 'INBOX_EDIT':
      return {
        ...state,
        inbox: state.inbox.map((i) =>
          i.id === action.id ? { ...i, text: action.text } : i
        ),
      };

    case 'INBOX_TO_TASK': {
      const item = state.inbox.find((i) => i.id === action.id);
      if (!item) return state;
      return {
        ...state,
        inbox: state.inbox.filter((i) => i.id !== action.id),
        tasks: [
          newTask(item.id, action.now, item.text, action.status),
          ...state.tasks,
        ],
      };
    }

    case 'INBOX_TO_PROJECT': {
      const item = state.inbox.find((i) => i.id === action.id);
      if (!item) return state;
      const canBeActive =
        action.startActive && activeProjectCount(state) < state.settings.activeProjectCap;
      return {
        ...state,
        inbox: state.inbox.filter((i) => i.id !== action.id),
        projects: [
          {
            id: item.id,
            name: item.text,
            status: canBeActive ? 'active' : 'queued',
            createdAt: action.now,
          },
          ...state.projects,
        ],
      };
    }

    case 'TASK_ADD': {
      let tasks = [newTask(action.id, action.now, action.text, action.status, action.projectId ?? null, { waitingOn: action.waitingOn ?? '' }), ...state.tasks];
      if (action.isNext) tasks = withSingleNext(tasks, action.id);
      return { ...state, tasks };
    }

    case 'TASK_UPDATE':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id ? { ...t, ...action.patch, updatedAt: action.now } : t
        ),
      };

    case 'TASK_DELETE':
      return { ...state, tasks: state.tasks.filter((t) => t.id !== action.id) };

    case 'TASK_TOGGLE_DONE':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? { ...t, done: !t.done, isNextStep: t.done ? t.isNextStep : false, updatedAt: action.now }
            : t
        ),
      };

    case 'TASK_SET_STATUS':
      return {
        ...state,
        tasks: state.tasks.map((t) =>
          t.id === action.id
            ? {
                ...t,
                status: action.status,
                isNextStep: action.status === 'now' ? t.isNextStep : false,
                updatedAt: action.now,
              }
            : t
        ),
      };

    case 'TASK_TOGGLE_NEXT': {
      const target = state.tasks.find((t) => t.id === action.id);
      if (!target) return state;
      if (target.isNextStep) {
        // خاموش‌کردن ستاره
        return {
          ...state,
          tasks: state.tasks.map((t) =>
            t.id === action.id ? { ...t, isNextStep: false, updatedAt: action.now } : t
          ),
        };
      }
      return {
        ...state,
        tasks: withSingleNext(
          state.tasks.map((t) =>
            t.id === action.id ? { ...t, status: 'now', updatedAt: action.now } : t
          ),
          action.id
        ),
      };
    }

    case 'PROJECT_ADD': {
      const canBeActive =
        action.startActive && activeProjectCount(state) < state.settings.activeProjectCap;
      return {
        ...state,
        projects: [
          {
            id: action.id,
            name: action.name,
            status: canBeActive ? 'active' : 'queued',
            createdAt: action.now,
          },
          ...state.projects,
        ],
      };
    }

    case 'PROJECT_RENAME':
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, name: action.name } : p
        ),
      };

    case 'PROJECT_SET_STATUS': {
      // سقف جبهه‌های فعال: اگر پر است، فعال‌سازی نادیده گرفته می‌شود
      if (
        action.status === 'active' &&
        activeProjectCount(state) >= state.settings.activeProjectCap
      ) {
        const alreadyActive = state.projects.find(
          (p) => p.id === action.id && p.status === 'active'
        );
        if (!alreadyActive) return state;
      }
      return {
        ...state,
        projects: state.projects.map((p) =>
          p.id === action.id ? { ...p, status: action.status } : p
        ),
      };
    }

    case 'PROJECT_DELETE':
      return {
        ...state,
        projects: state.projects.filter((p) => p.id !== action.id),
        // کارهای پروژه حذف نمی‌شوند؛ فقط از پروژه جدا می‌شوند
        tasks: state.tasks.map((t) =>
          t.projectId === action.id ? { ...t, projectId: null } : t
        ),
      };

    case 'SETTINGS_SET_CAP': {
      const cap = Math.min(10, Math.max(1, Math.round(action.cap) || 1));
      return { ...state, settings: { ...state.settings, activeProjectCap: cap } };
    }

    case 'STATE_REPLACE':
      return action.state;

    case 'STATE_SEED':
      return seedState();

    case 'STATE_RESET':
      return { ...initialState, settings: state.settings };

    default:
      return state;
  }
}

// ─── Context + Provider ───────────────────────────────────────────

/**
 * منبع داده:
 *   'db'    → دیتابیس وصل است و منبع اصلی همان است
 *   'local' → دیتابیس در دسترس نیست؛ همه‌چیز مثل قبل در همین مرورگر
 */
export type DataSource = 'db' | 'local';

interface StoreValue {
  state: AppState;
  dispatch: React.Dispatch<Action>;
  hydrated: boolean;
  source: DataSource;
  /** دیتابیس از این نسخه جلوتر رفته و باید دوباره خوانده شود */
  syncError: string;
  /** در حال نوشتن در دیتابیس */
  saving: boolean;
  /** دیتابیس وصل است ولی خالی است و داده‌ی محلی برای انتقال وجود دارد */
  canImportLocal: boolean;
  /** انتقال یک‌بارهٔ داده‌ی مرورگر به دیتابیس (localStorage پاک نمی‌شود) */
  importLocal: () => Promise<void>;
  /** خواندن دوباره از دیتابیس */
  refresh: () => Promise<void>;
}

const StoreContext = createContext<StoreValue | null>(null);

/** اعتبارسنجی ساده‌ی داده‌ی واردشده (بازیابی از فایل) */
export function parseState(raw: string): AppState | null {
  try {
    const obj = JSON.parse(raw) as Partial<AppState>;
    if (!obj || typeof obj !== 'object') return null;
    if (obj.version !== 1) return null;
    if (!Array.isArray(obj.inbox) || !Array.isArray(obj.tasks) || !Array.isArray(obj.projects))
      return null;
    const cap =
      obj.settings && typeof obj.settings.activeProjectCap === 'number'
        ? Math.min(10, Math.max(1, Math.round(obj.settings.activeProjectCap)))
        : 3;
    return {
      version: 1,
      settings: { activeProjectCap: cap },
      inbox: obj.inbox,
      tasks: obj.tasks,
      projects: obj.projects,
    };
  } catch {
    return null;
  }
}

/** آیا وضعیت کاملاً خالی است؟ */
const isEmptyState = (s: AppState): boolean =>
  s.inbox.length === 0 && s.tasks.length === 0 && s.projects.length === 0;

export function StoreProvider({ children }: { children: React.ReactNode }) {
  const [state, dispatch] = useReducer(reducer, initialState);
  const [hydrated, setHydrated] = useState(false);
  const [source, setSource] = useState<DataSource>('local');
  const [syncError, setSyncError] = useState('');
  const [saving, setSaving] = useState(false);
  const [canImportLocal, setCanImportLocal] = useState(false);
  const [localBackup, setLocalBackup] = useState<AppState | null>(null);

  /** شمارهٔ نسخه‌ای که آخرین بار از دیتابیس خواندیم — برای نوشتن شرطی */
  const revisionRef = useRef<number>(-1);
  /** تا هیدریت نشده، هیچ نوشتنی انجام نمی‌شود */
  const hydratedRef = useRef(false);
  /** جلوگیری از نوشتن همان چیزی که تازه از دیتابیس خواندیم */
  const skipNextSaveRef = useRef(false);
  const saveTimer = useRef<ReturnType<typeof setTimeout> | null>(null);

  // ── بارگذاری اولیه: اول دیتابیس، بعد localStorage ──
  useEffect(() => {
    let alive = true;

    const load = async () => {
      // ۱) خواندن نسخهٔ مرورگر (همیشه — به‌عنوان پشتیبان)
      let local: AppState | null = null;
      try {
        const raw = window.localStorage.getItem(STORAGE_KEY);
        if (raw) local = parseState(raw);
      } catch {
        /* دسترسی به localStorage ممکن نیست */
      }
      if (local && alive) setLocalBackup(local);

      // ۲) تلاش برای خواندن از دیتابیس
      try {
        const res = await fetch('/api/state', { cache: 'no-store' });
        const data = await res.json();

        if (alive && data?.ok && data.state) {
          const dbState = parseState(JSON.stringify(data.state));
          if (dbState) {
            revisionRef.current = typeof data.revision === 'number' ? data.revision : 0;
            skipNextSaveRef.current = true;
            dispatch({ type: 'STATE_REPLACE', state: dbState });
            setSource('db');

            // دیتابیس خالی است ولی مرورگر داده دارد ⇒ پیشنهاد انتقال (نه انتقال خودکار)
            if (isEmptyState(dbState) && local && !isEmptyState(local)) {
              setCanImportLocal(true);
            }
            setHydrated(true);
            hydratedRef.current = true;
            return;
          }
        }
      } catch {
        /* دیتابیس در دسترس نیست — با حالت محلی ادامه بده */
      }

      // ۳) حالت محلی (مثل نسخه‌های قبل — برنامه هرگز خالی نمی‌ماند)
      if (alive) {
        if (local) dispatch({ type: 'STATE_REPLACE', state: local });
        setSource('local');
        setHydrated(true);
        hydratedRef.current = true;
      }
    };

    void load();
    return () => {
      alive = false;
    };
  }, []);

  // ── ذخیره: localStorage (همیشه) + دیتابیس (اگر وصل باشد) ──
  useEffect(() => {
    if (!hydrated) return;

    // ۱) نسخهٔ مرورگر — همیشه، به‌عنوان پشتیبانِ محلی
    try {
      window.localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
    } catch {
      /* نادیده بگیر */
    }

    // ۲) دیتابیس — با تأخیر کوتاه تا تایپ‌کردن سریع، چند درخواست نسازد
    if (source !== 'db') return;
    if (skipNextSaveRef.current) {
      skipNextSaveRef.current = false;
      return;
    }

    if (saveTimer.current) clearTimeout(saveTimer.current);
    saveTimer.current = setTimeout(() => {
      void (async () => {
        setSaving(true);
        try {
          const res = await fetch('/api/state', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json' },
            body: JSON.stringify({ state, revision: revisionRef.current }),
          });
          const data = await res.json();

          if (data?.ok) {
            revisionRef.current = typeof data.revision === 'number' ? data.revision : revisionRef.current;
            setSyncError('');
          } else if (data?.status === 'stale') {
            // کسی در این فاصله داده را عوض کرده — اول بخوان، بعد دوباره بنویس
            setSyncError('دیتابیس هم‌زمان تغییر کرده بود؛ داده‌ها دوباره خوانده شد.');
            revisionRef.current = typeof data.revision === 'number' ? data.revision : revisionRef.current;
            const fresh = await fetch('/api/state', { cache: 'no-store' });
            const freshData = await fresh.json();
            if (freshData?.ok && freshData.state) {
              const parsed = parseState(JSON.stringify(freshData.state));
              if (parsed) {
                revisionRef.current = freshData.revision ?? revisionRef.current;
                skipNextSaveRef.current = true;
                dispatch({ type: 'STATE_REPLACE', state: parsed });
              }
            }
          } else if (data?.error) {
            setSyncError(String(data.error));
          }
        } catch {
          setSyncError('نوشتن در دیتابیس ممکن نشد؛ داده‌ها در مرورگر سالم هستند.');
        } finally {
          setSaving(false);
        }
      })();
    }, 700);

    return () => {
      if (saveTimer.current) clearTimeout(saveTimer.current);
    };
  }, [state, hydrated, source]);

  // ── خواندن دوباره از دیتابیس ──
  const refresh = useCallback(async () => {
    try {
      const res = await fetch('/api/state', { cache: 'no-store' });
      const data = await res.json();
      if (data?.ok && data.state) {
        const parsed = parseState(JSON.stringify(data.state));
        if (parsed) {
          revisionRef.current = typeof data.revision === 'number' ? data.revision : 0;
          skipNextSaveRef.current = true;
          dispatch({ type: 'STATE_REPLACE', state: parsed });
          setSource('db');
          setSyncError('');
        }
      }
    } catch {
      setSyncError('خواندن دوباره از دیتابیس ممکن نشد.');
    }
  }, []);

  // ── انتقال یک‌بارهٔ داده‌ی مرورگر به دیتابیس ──
  // ⚠️ localStorage پاک نمی‌شود؛ نسخهٔ مرورگر به‌عنوان پشتیبان می‌ماند.
  const importLocal = useCallback(async () => {
    if (!localBackup) return;
    revisionRef.current = -1; // اجازهٔ نوشتن بدون شرط نسخه
    try {
      const res = await fetch('/api/state', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ state: localBackup, revision: -1 }),
      });
      const data = await res.json();
      if (data?.ok) {
        revisionRef.current = data.revision ?? 0;
        skipNextSaveRef.current = true;
        dispatch({ type: 'STATE_REPLACE', state: localBackup });
        setSource('db');
        setCanImportLocal(false);
      } else {
        setSyncError(String(data?.error ?? 'انتقال داده انجام نشد.'));
      }
    } catch {
      setSyncError('انتقال داده انجام نشد؛ نسخهٔ مرورگر دست‌نخورده باقی است.');
    }
  }, [localBackup]);

  return (
    <StoreContext.Provider
      value={{
        state, dispatch, hydrated, source, syncError, saving,
        canImportLocal, importLocal, refresh,
      }}
    >
      {children}
    </StoreContext.Provider>
  );
}

export function useStore(): StoreValue {
  const ctx = useContext(StoreContext);
  if (!ctx) throw new Error('useStore باید داخل StoreProvider استفاده شود');
  return ctx;
}

/** مخفف‌های dispatch برای ساختن موجودیت جدید (تولید id و زمان بیرون از reducer) */
export function useActions() {
  const { dispatch } = useStore();
  return useCallback(
    () => ({
      inboxAdd: (text: string) =>
        dispatch({ type: 'INBOX_ADD', id: uid(), now: Date.now(), text }),
      taskAdd: (
        text: string,
        status: TaskStatus,
        opts: { projectId?: string | null; isNext?: boolean; waitingOn?: string } = {}
      ) =>
        dispatch({
          type: 'TASK_ADD',
          id: uid(),
          now: Date.now(),
          text,
          status,
          ...opts,
        }),
      projectAdd: (name: string, startActive: boolean) =>
        dispatch({ type: 'PROJECT_ADD', id: uid(), now: Date.now(), name, startActive }),
    }),
    [dispatch]
  )();
}
