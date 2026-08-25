'use client';

import React, { useEffect, useState } from 'react';
import { THEME_KEY, useStore } from '@/lib/store';
import { faNum } from '@/lib/format';
import Dashboard from './Dashboard';
import InboxView from './Inbox';
import TasksBoard from './TasksBoard';
import ProjectsView from './Projects';
import SettingsView from './Settings';

export type TabId = 'dash' | 'inbox' | 'tasks' | 'projects' | 'settings';

const TABS: { id: TabId; label: string; icon: string }[] = [
  { id: 'dash', label: 'داشبورد', icon: '🏠' },
  { id: 'inbox', label: 'صندوق ذهن', icon: '🧠' },
  { id: 'tasks', label: 'کارها', icon: '📋' },
  { id: 'projects', label: 'پروژه‌ها', icon: '🚀' },
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

export default function App() {
  const { state, hydrated } = useStore();
  const [tab, setTab] = useState<TabId>('dash');

  return (
    <div className="container">
      <header className="app-header">
        <div className="brand">
          <div className="logo">ک</div>
          <div>
            <h1>کاردان</h1>
            <p className="tagline">سیستم‌عامل زندگی — نه کار بیشتر؛ تسلط بیشتر</p>
          </div>
        </div>
        <div className="header-actions">
          <ThemeToggle />
        </div>
      </header>

      <nav className="tabs">
        {TABS.map((t) => (
          <button
            key={t.id}
            className={`tab ${tab === t.id ? 'active' : ''}`}
            onClick={() => setTab(t.id)}
          >
            <span aria-hidden>{t.icon}</span>
            <span>{t.label}</span>
            {t.id === 'inbox' && state.inbox.length > 0 && (
              <span className="tab-badge">{faNum(state.inbox.length)}</span>
            )}
          </button>
        ))}
      </nav>

      {!hydrated ? (
        <div className="loading">در حال آماده‌سازی…</div>
      ) : (
        <div className="view" key={tab}>
          {tab === 'dash' && <Dashboard onNavigate={setTab} />}
          {tab === 'inbox' && <InboxView />}
          {tab === 'tasks' && <TasksBoard />}
          {tab === 'projects' && <ProjectsView />}
          {tab === 'settings' && <SettingsView />}
        </div>
      )}

      <footer className="footer">
        داده‌ها فقط در مرورگر خودت ذخیره می‌شوند — پشتیبان‌گیری از «تنظیمات»
      </footer>
    </div>
  );
}
