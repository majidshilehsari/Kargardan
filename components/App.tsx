'use client';

import React, { useEffect, useState } from 'react';
import { THEME_KEY, useStore } from '@/lib/store';
import { faNum } from '@/lib/format';
import Dashboard from './Dashboard';
import InboxView from './Inbox';
import TasksBoard from './TasksBoard';
import ProjectsView from './Projects';
import SettingsView from './Settings';
import SuggestionsView from './Suggestions';
import AgentPanel from './AgentPanel';
import ChartsView from './Charts';
import RecycleBinView from './RecycleBin';

export type TabId =
  | 'suggestions'
  | 'agent'
  | 'dash'
  | 'inbox'
  | 'tasks'
  | 'projects'
  | 'charts'
  | 'trash'
  | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'suggestions', label: 'پیشنهادات ایجنت', icon: '🤝' },
  { id: 'agent', label: 'ایجنت همکار', icon: '🔌' },
  { id: 'dash', label: 'داشبورد', icon: '🏠' },
  { id: 'inbox', label: 'صندوق ذهن', icon: '🧠' },
  { id: 'tasks', label: 'کارها', icon: '📋' },
  { id: 'projects', label: 'پروژه‌ها', icon: '🚀' },
  { id: 'charts', label: 'نمودارها', icon: '📊' },
  { id: 'trash', label: 'سطل بازیافت', icon: '🗑' },
  { id: 'settings', label: 'تنظیمات', icon: '⚙️' },
];

function ThemeToggle() {
  const [theme, setTheme] = useState<'light' | 'dark'>('light');

  useEffect(() => {
    const t = document.documentElement.getAttribute('data-theme');
    if (t === 'dark' || t === 'light') setTheme(t);
  }, []);

  const toggle = () => {
    const next = theme === 'dark' ? 'light' : 'dark';
    setTheme(next);
    document.documentElement.setAttribute('data-theme', next);
    try {
      window.localStorage.setItem(THEME_KEY, next);
    } catch {
      /* نادیده بگیر */
    }
  };

  return (
    <button
      className="icon-btn"
      onClick={toggle}
      title={theme === 'dark' ? 'حالت روشن' : 'حالت تاریک'}
      aria-label="تغییر روشن/تاریک"
    >
      {theme === 'dark' ? '☀️' : '🌙'}
    </button>
  );
}

/** نشانگر همگام‌سازی — همیشه می‌دانی داده کجاست */
function SyncBadge() {
  const { source, saving, syncError } = useStore();

  const label = syncError
    ? '⚠️ ' + syncError
    : source === 'db'
      ? saving
        ? '☁️ در حال ذخیره…'
        : '☁️ دیتابیس وصل است'
      : '💾 فقط در این مرورگر';

  const tone = syncError ? 'sync-warn' : source === 'db' ? 'sync-ok' : 'sync-local';

  return (
    <span className={`sync-badge ${tone}`} title={syncError || label}>
      {label}
    </span>
  );
}

/** اگر دیتابیس خالی است و مرورگر داده دارد، پیشنهاد انتقال می‌دهد (هیچ‌وقت خودکار) */
function ImportBanner() {
  const { canImportLocal, importLocal, state } = useStore();
  const [busy, setBusy] = useState(false);
  const [hidden, setHidden] = useState(false);

  if (!canImportLocal || hidden) return null;

  return (
    <div className="banner">
      <span aria-hidden>📤</span>
      <span>
        داده‌های <b>{faNum(state.tasks.length + state.projects.length + state.inbox.length)}</b> موردی
        در این مرورگر داری، ولی دیتابیس خالی است. انتقالشان بدهم؟
        <br />
        <span className="dim" style={{ fontSize: 12 }}>
          نسخهٔ مرورگر پاک نمی‌شود — به‌عنوان پشتیبان همان‌جا می‌ماند.
        </span>
      </span>
      <span className="spacer" />
      <button
        className="btn btn-primary btn-small"
        disabled={busy}
        onClick={() => {
          setBusy(true);
          void importLocal().finally(() => setBusy(false));
        }}
      >
        {busy ? 'در حال انتقال…' : 'انتقال به دیتابیس'}
      </button>
      <button className="btn btn-small" onClick={() => setHidden(true)}>
        بعداً
      </button>
    </div>
  );
}

export default function App() {
  const { state, hydrated } = useStore();
  const [tab, setTab] = useState<TabId>('dash');
  const [pendingSuggestions, setPendingSuggestions] = useState(0);

  // شمارش پیشنهادهای در انتظار — برای نشان قرمز روی تب
  useEffect(() => {
    let alive = true;
    const tick = async () => {
      try {
        const res = await fetch('/api/suggestions?status=pending', { cache: 'no-store' });
        const data = await res.json();
        if (alive && data?.ok) setPendingSuggestions(data.pendingCount ?? 0);
      } catch {
        /* اگر دیتابیس نبود، نشان هم لازم نیست */
      }
    };
    void tick();
    const id = setInterval(tick, 30_000);
    return () => {
      alive = false;
      clearInterval(id);
    };
  }, [tab]);

  const badgeFor = (id: TabId): number => {
    if (id === 'inbox') return state.inbox.length;
    if (id === 'suggestions') return pendingSuggestions;
    return 0;
  };

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          {/* آیکون تختهٔ کلاق — همان نماد «کارگردان» */}
          <div className="logo" aria-hidden>
            <svg viewBox="0 0 64 64" width="34" height="34" role="img" aria-label="کارگردان">
              <defs>
                <linearGradient id="kg-bg-h" x1="0" y1="0" x2="64" y2="64" gradientUnits="userSpaceOnUse">
                  <stop offset="0" stopColor="#16a99b" />
                  <stop offset="1" stopColor="#0a5f57" />
                </linearGradient>
              </defs>
              <rect width="64" height="64" rx="15" fill="url(#kg-bg-h)" />
              <path d="M10.5 24.5 L19 13 L26.5 13 L18 24.5 Z" fill="#0a5f57" />
              <path d="M27.5 24.5 L36 13 L43.5 13 L35 24.5 Z" fill="#0a5f57" />
              <path d="M44.5 24.5 L53 13 L58 13 L54.5 24.5 Z" fill="#0a5f57" />
              <rect x="8.5" y="12.5" width="47" height="12" rx="2.5" fill="none" stroke="#0a5f57" strokeWidth="1.6" />
              <rect x="8.5" y="25.4" width="47" height="2.6" fill="#0a5f57" />
              <rect x="8.5" y="28.8" width="47" height="23.7" rx="3" fill="#ffffff" />
              <rect x="14" y="34" width="24" height="3.4" rx="1.7" fill="#0d7a6f" />
              <rect x="14" y="41" width="36" height="3.4" rx="1.7" fill="#0d7a6f" opacity="0.5" />
              <rect x="14" y="48" width="17" height="3.4" rx="1.7" fill="#0d7a6f" opacity="0.28" />
            </svg>
          </div>
          <div>
            <h1>کارگردان</h1>
            <p className="tagline">سیستم‌عامل زندگی — نه کار بیشتر؛ تسلط بیشتر</p>
          </div>
        </div>
        <div className="header-actions">
          <SyncBadge />
          <ThemeToggle />
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => {
          const n = badgeFor(t.id);
          return (
            <button
              key={t.id}
              className={`tab ${tab === t.id ? 'active' : ''}`}
              onClick={() => setTab(t.id)}
            >
              <span aria-hidden>{t.icon}</span>
              <span>{t.label}</span>
              {n > 0 && <span className="tab-badge">{faNum(n)}</span>}
            </button>
          );
        })}
      </nav>

      {!hydrated ? (
        <div className="loading">در حال آماده‌سازی…</div>
      ) : (
        <div className="view" key={tab}>
          <ImportBanner />
          {tab === 'suggestions' && <SuggestionsView />}
          {tab === 'agent' && <AgentPanel />}
          {tab === 'dash' && <Dashboard onNavigate={setTab} />}
          {tab === 'inbox' && <InboxView />}
          {tab === 'tasks' && <TasksBoard />}
          {tab === 'projects' && <ProjectsView />}
          {tab === 'charts' && <ChartsView />}
          {tab === 'trash' && <RecycleBinView />}
          {tab === 'settings' && <SettingsView />}
        </div>
      )}

      <footer className="footer">
        داده‌ها در دیتابیس خودت ذخیره می‌شوند · هیچ چیزی پاک نمی‌شود · پشتیبان‌گیری از «تنظیمات»
      </footer>
    </div>
  );
}
