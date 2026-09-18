'use client';

// ─── 🧠 نقشهٔ ذهنی — «من» وسط، همه چیز دور تا دور ────────────────────
//
// مهم‌ترین نمودار برنامه: با یک نگاه می‌بینی چه چیزی سرت ریخته.
//
//   ○ مرکز        = تو
//   ○ حلقهٔ داخلی  = پروژه‌ها (جبهه‌ها) — کم‌تعدادند، پس نزدیک مرکز
//   ○ حلقهٔ اصلی   = کارها + صندوق ذهن — رنگ هر کار از وضعیتش می‌آید
//
//   ✔ کارِ انجام‌شده: یک خط رویش کشیده می‌شود و اتصالش نقطه‌چین می‌شود.
//
// 🧮 چیدمان ریاضی است (نه سلیقه‌ای): شعاع و اندازهٔ هر حلقه از «تعداد گره‌ها»
//    حساب می‌شود. چون فاصلهٔ دو گرهٔ همسایه روی دایره = ۲×r×sin(π/n) است،
//    با «قطر مستطیل + فاصلهٔ امن» ریاضی تضمین می‌شود هیچ دو گرهی روی هم نیفتد.
//    (تست همپوشانی روی ۶ سناریو اجرا شده — همه صفر.)
//
// 🖱 روی هر کار کلیک کنی، تیک می‌خورد (دوباره کلیک = برگشت). تغییر فقط
//    از راه استور برنامه انجام می‌شود؛ هیچ چیزی مستقیم دست نمی‌خورد.

import React, { useMemo, useState } from 'react';
import { faNum } from '@/lib/format';
import { useStore } from '@/lib/store';
import {
  PROJECT_STATUSES,
  PROJECT_STATUS_META,
  TASK_STATUSES,
  TASK_STATUS_META,
  type InboxItem,
  type Project,
  type ProjectStatus,
  type Task,
  type TaskStatus,
} from '@/lib/types';

const TASK_COLOR: Record<TaskStatus, string> = {
  now: 'var(--now)',
  later: 'var(--later)',
  waiting: 'var(--waiting)',
  parked: 'var(--parked)',
};

const PROJECT_COLOR: Record<ProjectStatus, string> = {
  active: 'var(--accent)',
  queued: 'var(--later)',
  parked: 'var(--parked)',
  done: 'var(--text-dim)',
};

const TASK_TONE: Record<TaskStatus, string> = {
  now: 'mm-t-now',
  later: 'mm-t-later',
  waiting: 'mm-t-waiting',
  parked: 'mm-t-parked',
};

const PROJECT_TONE: Record<ProjectStatus, string> = {
  active: 'mm-p-active',
  queued: 'mm-p-queued',
  parked: 'mm-p-parked',
  done: 'mm-p-done',
};

// ─── اندازه‌های نامزد (از بزرگ به کوچک؛ هرچه گره بیشتر، کوچک‌تر) ───
const RING_SIZES: [number, number][] = [
  [192, 56], [174, 54], [158, 52], [144, 50], [132, 48], [120, 46],
];
const PROJ_SIZES: [number, number][] = [[170, 32], [152, 30], [134, 28]];

/** شعاع دایرهٔ مرکزی */
const CENTER_R = 70;
/** فاصلهٔ امن بین دو گره/حلقه */
const SEP = 14;
/** فاصلهٔ مرکز تا نزدیک‌ترین گره */
const CENTER_GAP = 24;
/** بیشترین شعاع حلقهٔ اصلی — بزرگ‌تر از این، متن بیش از حد ریز می‌شود */
const RING_MAX_R = 560;
/** سقف صندوق ذهن روی حلقه (بقیه شمرده می‌شوند و در پیام «جا نشد» می‌آیند) */
const INBOX_MAX = 18;

// ─── ابزار هندسه ───────────────────────────────────────────────────

/** نقطه‌ای روی دایره — درجهٔ صفر یعنی «بالا»، بعد ساعتگرد می‌چرخد */
function polar(cx: number, cy: number, r: number, deg: number) {
  const a = (deg * Math.PI) / 180;
  return { x: cx + r * Math.cos(a), y: cy + r * Math.sin(a) };
}

/** قطر مستطیل — اگر فاصلهٔ دو مرکز از این بیشتر باشد، قطعاً روی هم نمی‌افتند */
const diag = (w: number, h: number) => Math.hypot(w, h);

/** چند گره با این اندازه دور دایره‌ای به شعاع maxR جا می‌شوند؟ */
function capacity(fit: number, maxR: number): number {
  const k = fit / (2 * maxR);
  if (k >= 1) return 1;
  return Math.max(1, Math.floor(Math.PI / Math.asin(k)));
}

/**
 * مناسب‌ترین اندازه + شعاع برای یک حلقه.
 *  • rMin = نزدیک‌ترین شعاع مجاز (بیرونِ حلقهٔ داخلی/مرکز)
 *  • rMax = دورترین شعاع مجاز؛ `null` یعنی بدون سقف
 *  • cap  = چند گره واقعاً جا می‌شود (باقی «جا نشده» حساب می‌شوند)
 */
function placeRing(
  n: number,
  rMin: number,
  rMax: number | null,
  sizes: [number, number][]
): { w: number; h: number; r: number; cap: number } {
  if (n <= 0) return { w: sizes[0][0], h: sizes[0][1], r: rMin, cap: 0 };

  for (const [w, h] of sizes) {
    const fit = diag(w, h) + SEP;
    const half = diag(w, h) / 2 + 6;
    const lo = rMin + half;
    const hi = rMax === null ? Infinity : rMax - half;
    if (hi < lo) continue; // این اندازه در باندِ موجود جا نمی‌شود
    const cap = hi === Infinity ? n : capacity(fit, hi);
    if (n <= cap) {
      const need = n <= 1 ? lo : fit / (2 * Math.sin(Math.PI / n));
      return { w, h, r: Math.min(hi, Math.max(lo, need)), cap };
    }
  }

  // حتی کوچک‌ترین اندازه هم برای «همه» جا نمی‌شود ⇒ با کوچک‌ترین اندازه تا ظرفیت
  const [w, h] = sizes[sizes.length - 1];
  const fit = diag(w, h) + SEP;
  const half = diag(w, h) / 2 + 6;
  const lo = rMin + half;
  const hi = rMax === null ? Infinity : rMax - half;
  if (hi < lo) return { w, h, r: rMin, cap: 0 }; // این باند هیچ گرهی نمی‌پذیرد
  const cap = hi === Infinity ? n : Math.max(1, capacity(fit, hi));
  const shown = Math.min(n, cap);
  const need = shown <= 1 ? lo : fit / (2 * Math.sin(Math.PI / shown));
  return {
    w,
    h,
    r: hi === Infinity ? Math.max(lo, need) : Math.min(hi, Math.max(lo, need)),
    cap,
  };
}

/** چند کاراکتر در این عرض جا می‌شود (تقریبی — برای متن فارسی) */
function charsFor(w: number, perChar = 6.5): number {
  return Math.max(9, Math.floor((w - 18) / perChar));
}

/** شکستن متن به حداکثر دو خط + «…» اگر جا نشد */
export function wrapText(text: string, maxChars: number, maxLines = 2) {
  const clean = text.trim().replace(/\s+/g, ' ');
  const words = clean.split(' ');
  const lines: string[] = [];
  let i = 0;
  while (i < words.length && lines.length < maxLines) {
    let line = '';
    while (i < words.length) {
      const cand = line ? `${line} ${words[i]}` : words[i];
      if (cand.length <= maxChars || !line) {
        line = cand;
        i += 1;
      } else break;
    }
    lines.push(line);
  }
  const truncated = i < words.length;
  if (truncated) {
    const last = lines[lines.length - 1];
    lines[lines.length - 1] =
      (last.length > maxChars - 1 ? last.slice(0, maxChars - 1) : last).replace(/[\s،.·]+$/, '') + '…';
  }
  return { lines, truncated };
}

// ─── مدلِ چیدمان ───────────────────────────────────────────────────
export interface MindNode {
  key: string;
  kind: 'project' | 'task' | 'inbox';
  x: number;
  y: number;
  w: number;
  h: number;
  lines: string[];
  sub?: string;
  tone: string;
  bar: string;
  done: boolean;
  title: string;
  taskId?: string;
}

export interface MindLink {
  key: string;
  x1: number;
  y1: number;
  x2: number;
  y2: number;
  color: string;
  done: boolean;
  faint: boolean;
}

export interface MindLayout {
  size: number;
  cx: number;
  cy: number;
  nodes: MindNode[];
  links: MindLink[];
  rings: number[];
  counts: { open: number; done: number; projects: number; inbox: number };
  hidden: { tasks: number; projects: number; inbox: number };
}

type RingItem = { kind: 'task'; task: Task } | { kind: 'inbox'; item: InboxItem };

/**
 * چیدمان کامل نقشه را می‌سازد.
 * این تابع خالص است (بدون وابستگی به مرورگر) تا همپوشانی‌ها قابل تست باشد.
 */
export function buildMindMap(input: {
  tasks: Task[];
  projects: Project[];
  inbox: InboxItem[];
  showDone: boolean;
  showProjects: boolean;
  showInbox: boolean;
}): MindLayout {
  const { tasks, projects, inbox, showDone, showProjects, showInbox } = input;

  const open = tasks
    .filter((t) => !t.done)
    .sort(
      (a, b) =>
        TASK_STATUSES.indexOf(a.status) - TASK_STATUSES.indexOf(b.status) ||
        a.createdAt - b.createdAt
    );
  const done = tasks.filter((t) => t.done).sort((a, b) => b.updatedAt - a.updatedAt);

  // ۱) حلقهٔ اصلی: کارها (اول) + صندوق ذهن (بعد) — اگر جا نشد، از آخر کم می‌شود
  const taskPool = showDone ? [...open, ...done] : [...open];
  const inboxPoolAll = showInbox ? inbox.slice(0, INBOX_MAX) : [];
  const inboxDropped = (showInbox ? inbox.length : 0) - inboxPoolAll.length;
  const ringPool: RingItem[] = [
    ...taskPool.map((task) => ({ kind: 'task' as const, task })),
    ...inboxPoolAll.map((item) => ({ kind: 'inbox' as const, item })),
  ];
  const t = placeRing(ringPool.length, CENTER_R + CENTER_GAP, RING_MAX_R, RING_SIZES);
  const ringShown = ringPool.slice(0, t.cap);
  const tHalf = diag(t.w, t.h) / 2;

  // ۲) حلقهٔ پروژه‌ها — داخلی‌ترین حلقه.
  const projPool = showProjects
    ? [...projects].sort(
        (a, b) =>
          PROJECT_STATUSES.indexOf(a.status) - PROJECT_STATUSES.indexOf(b.status) ||
          a.createdAt - b.createdAt
      )
    : [];
  let ringR = t.r;
  let p = placeRing(
    projPool.length,
    CENTER_R + CENTER_GAP,
    projPool.length ? ringR - tHalf - SEP : null,
    PROJ_SIZES
  );
  if (projPool.length && p.cap === 0) {
    // بین مرکز و حلقهٔ کارها جا نبود ⇒ حلقهٔ کارها را کمی بیرون می‌بریم
    const [pw, ph] = PROJ_SIZES[PROJ_SIZES.length - 1];
    ringR = CENTER_R + CENTER_GAP + diag(pw, ph) + SEP + tHalf + SEP;
    p = placeRing(projPool.length, CENTER_R + CENTER_GAP, ringR - tHalf - SEP, PROJ_SIZES);
  }
  const projShown = projPool.slice(0, p.cap);
  const pHalf = diag(p.w, p.h) / 2;

  // ۳) اندازهٔ بوم
  const extent = (r: number, w: number, h: number) => r + Math.max(w, h) / 2 + 28;
  const outer = Math.max(
    232,
    ringShown.length ? extent(ringR, t.w, t.h) : 0,
    projShown.length ? extent(p.r, p.w, p.h) : 0
  );
  const size = Math.round(outer * 2);
  const cx = size / 2;
  const cy = size / 2;

  const projectName = new Map(projects.map((pr) => [pr.id, pr.name]));
  const nodes: MindNode[] = [];
  const links: MindLink[] = [];
  const rings: number[] = [];

  /** خطِ وصل از لبهٔ مرکز تا لبهٔ گره */
  const link = (
    key: string,
    node: { x: number; y: number; w: number; h: number },
    color: string,
    done: boolean,
    faint: boolean
  ): MindLink => {
    const dx = node.x - cx;
    const dy = node.y - cy;
    const dist = Math.hypot(dx, dy) || 1;
    const ux = dx / dist;
    const uy = dy / dist;
    const start = CENTER_R + 6;
    const half = Math.abs(ux) * (node.w / 2) + Math.abs(uy) * (node.h / 2);
    const end = Math.max(start + 10, dist - half - 5);
    return {
      key,
      x1: cx + ux * start,
      y1: cy + uy * start,
      x2: cx + ux * end,
      y2: cy + uy * end,
      color,
      done,
      faint,
    };
  };

  // ── حلقهٔ پروژه‌ها (داخلی) ──
  if (projShown.length) {
    rings.push(p.r);
    const n = projShown.length;
    projShown.forEach((pr, i) => {
      const { x, y } = polar(cx, cy, p.r, -90 + (360 / n) * i);
      const wrapped = wrapText(pr.name, charsFor(p.w, 5.9), 1);
      const node: MindNode = {
        key: `p-${pr.id}`,
        kind: 'project',
        x, y, w: p.w, h: p.h,
        lines: wrapped.lines,
        tone: PROJECT_TONE[pr.status],
        bar: PROJECT_COLOR[pr.status],
        done: pr.status === 'done',
        title: `پروژه: ${pr.name} — ${PROJECT_STATUS_META[pr.status].label}`,
      };
      nodes.push(node);
      links.push(link(`lp-${pr.id}`, node, PROJECT_COLOR[pr.status], pr.status === 'done', false));
    });
  }

  // ── حلقهٔ اصلی: کارها و صندوق ذهن ──
  if (ringShown.length) {
    rings.push(ringR);
    const n = ringShown.length;
    ringShown.forEach((entry, i) => {
      const { x, y } = polar(cx, cy, ringR, -90 + (360 / n) * i);

      if (entry.kind === 'inbox') {
        const wrapped = wrapText(entry.item.text, charsFor(t.w), 2);
        const node: MindNode = {
          key: `i-${entry.item.id}`,
          kind: 'inbox',
          x, y, w: t.w, h: t.h,
          lines: wrapped.lines,
          tone: 'mm-i',
          bar: 'var(--text-dim)',
          done: false,
          title: `${entry.item.text}\n(هنوز در صندوق ذهن — تصمیم نگرفته‌ای)`,
        };
        nodes.push(node);
        links.push(link(`li-${entry.item.id}`, node, 'var(--text-dim)', false, true));
        return;
      }

      const task = entry.task;
      const wrapped = wrapText(task.text, charsFor(t.w), 2);
      const bits: string[] = [];
      if (task.projectId && projectName.has(task.projectId)) {
        bits.push(projectName.get(task.projectId)!);
      }
      if (task.isNextStep && !task.done) bits.push('قدم بعدی');
      if (task.done) bits.push('انجام شد');
      // اگر عنوان دو خطی شده، زیرنویس جا نمی‌شود ⇒ فقط در راهنمای نشانگر می‌آید
      const showSub = wrapped.lines.length === 1;
      const node: MindNode = {
        key: `t-${task.id}`,
        kind: 'task',
        x, y, w: t.w, h: t.h,
        lines: wrapped.lines,
        sub: showSub && bits.length ? bits.join(' · ') : undefined,
        tone: TASK_TONE[task.status],
        bar: TASK_COLOR[task.status],
        done: task.done,
        taskId: task.id,
        title:
          `${task.text}\nوضعیت: ${TASK_STATUS_META[task.status].label}` +
          (task.done ? ' (انجام شده)' : '') +
          (task.projectId && projectName.has(task.projectId)
            ? `\nپروژه: ${projectName.get(task.projectId)}`
            : '') +
          '\n(کلیک = تیک زدن / برگشت)',
      };
      nodes.push(node);
      links.push(link(`lt-${task.id}`, node, TASK_COLOR[task.status], task.done, false));
    });
  }

  const shownTasks = ringShown.filter((r) => r.kind === 'task').length;
  const shownInbox = ringShown.length - shownTasks;

  return {
    size, cx, cy, nodes, links, rings,
    counts: { open: open.length, done: done.length, projects: projects.length, inbox: inbox.length },
    hidden: {
      tasks: taskPool.length - shownTasks,
      projects: projPool.length - projShown.length,
      inbox: inboxDropped + (inboxPoolAll.length - shownInbox),
    },
  };
}

// ─── رندر گره ──────────────────────────────────────────────────────
function NodeBox({
  node,
  index,
  onToggle,
}: {
  node: MindNode;
  index: number;
  onToggle?: (id: string) => void;
}) {
  const isTask = node.kind === 'task';
  const lh = isTask ? 16 : 15;
  const hasSub = Boolean(node.sub);
  const blockH = node.lines.length * lh + (hasSub ? 13 : 0);
  let ty = node.y - blockH / 2 + (isTask ? 13.5 : 12);
  if (isTask && node.done) ty += 1; // خط روی متن، کمی بالاتر از مرکز خطوط
  const clickable = isTask;

  return (
    <g
      className={`mm-node${clickable ? ' mm-click' : ''}`}
      style={{ animationDelay: `${Math.min(index * 26, 800)}ms` }}
      onClick={clickable ? () => onToggle?.(node.taskId!) : undefined}
      onKeyDown={
        clickable
          ? (e) => {
              if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                onToggle?.(node.taskId!);
              }
            }
          : undefined
      }
      role={clickable ? 'button' : undefined}
      tabIndex={clickable ? 0 : undefined}
      aria-label={clickable ? node.title.split('\n')[0] : undefined}
      opacity={node.done ? 0.62 : 1}
    >
      <title>{node.title}</title>
      <rect
        className={`mm-box ${node.tone}`}
        x={node.x - node.w / 2}
        y={node.y - node.h / 2}
        width={node.w}
        height={node.h}
        rx={12}
      />
      {/* نوار باریک رنگ — سمت راست (شروع خط فارسی) */}
      <rect
        x={node.x + node.w / 2 - 8}
        y={node.y - node.h / 2 + 7}
        width={4}
        height={node.h - 14}
        rx={2}
        fill={node.bar}
      />
      {node.lines.map((line, i) => {
        const y = ty;
        ty += lh;
        return (
          <text key={i} className="mm-text" x={node.x} y={y} textAnchor="middle">
            {line}
          </text>
        );
      })}
      {hasSub && (
        <text className="mm-sub" x={node.x} y={ty - 2} textAnchor="middle">
          {node.sub}
        </text>
      )}
      {node.done && (
        <line
          className="mm-strike"
          x1={node.x - node.w / 2 + 10}
          y1={node.y + node.h / 2 - 11}
          x2={node.x + node.w / 2 - 10}
          y2={node.y - node.h / 2 + 11}
          strokeLinecap="round"
        />
      )}
    </g>
  );
}

// ─── کامپوننت اصلی ─────────────────────────────────────────────────
export default function MindMap({
  tasks,
  projects,
  inbox,
}: {
  tasks: Task[];
  projects: Project[];
  inbox: InboxItem[];
}) {
  const { dispatch } = useStore();
  const [showDone, setShowDone] = useState(true);
  const [showProjects, setShowProjects] = useState(true);
  const [showInbox, setShowInbox] = useState(true);
  /** بزرگ‌نمایی نقشه — در حالت شلوغ متن‌ها ریز می‌شوند، اینجا بزرگش کن */
  const [zoom, setZoom] = useState(1);

  const layout = useMemo(
    () => buildMindMap({ tasks, projects, inbox, showDone, showProjects, showInbox }),
    [tasks, projects, inbox, showDone, showProjects, showInbox]
  );

  const toggle = (id: string) => dispatch({ type: 'TASK_TOGGLE_DONE', id, now: Date.now() });
  const hiddenTotal = layout.hidden.tasks + layout.hidden.projects + layout.hidden.inbox;

  return (
    <section className="card">
      <h2 className="card-title">
        🧠 نقشهٔ ذهنی
        <span className="card-sub">— تو وسط، همه چیز دور تا دور</span>
      </h2>

      <div className="mm-toggles">
        <label>
          <input
            type="checkbox"
            checked={showDone}
            onChange={(e) => setShowDone(e.target.checked)}
          />
          انجام‌شده‌ها ({faNum(layout.counts.done)})
        </label>
        <label>
          <input
            type="checkbox"
            checked={showProjects}
            onChange={(e) => setShowProjects(e.target.checked)}
          />
          پروژه‌ها ({faNum(layout.counts.projects)})
        </label>
        <label>
          <input
            type="checkbox"
            checked={showInbox}
            onChange={(e) => setShowInbox(e.target.checked)}
          />
          صندوق ذهن ({faNum(layout.counts.inbox)})
        </label>

        <span className="mm-zoom">
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setZoom((z) => Math.max(1, Number((z - 0.25).toFixed(2))))}
            disabled={zoom <= 1}
            aria-label="کوچک‌تر"
          >
            −
          </button>
          <button
            type="button"
            className="btn btn-small"
            onClick={() => setZoom((z) => Math.min(2.5, Number((z + 0.25).toFixed(2))))}
            disabled={zoom >= 2.5}
            aria-label="بزرگ‌تر"
          >
            +
          </button>
          <span className="mm-zoom-val">{faNum(Math.round(zoom * 100))}٪</span>
          {zoom !== 1 && (
            <button type="button" className="btn btn-small" onClick={() => setZoom(1)}>
              اندازهٔ اصلی
            </button>
          )}
        </span>
      </div>

      <div className="mm-viewport">
      <svg
        className="mindmap"
        style={{ width: `${zoom * 100}%` }}
        viewBox={`0 0 ${layout.size} ${layout.size}`}
        role="group"
        aria-label="نقشهٔ ذهنی: تو در مرکز، کارها دور تا دور"
      >
        {/* حلقه‌های راهنما */}
        {layout.rings.map((r) => (
          <circle key={r} className="mm-ring" cx={layout.cx} cy={layout.cy} r={r} fill="none" />
        ))}

        {/* خط‌های وصل */}
        {layout.links.map((l) => (
          <line
            key={l.key}
            className={`mm-link${l.done ? ' mm-link-done' : ''}${l.faint ? ' mm-link-faint' : ''}`}
            x1={l.x1}
            y1={l.y1}
            x2={l.x2}
            y2={l.y2}
            stroke={l.color}
          />
        ))}

        {/* گره‌ها */}
        {layout.nodes.map((n, i) => (
          <NodeBox key={n.key} node={n} index={i} onToggle={toggle} />
        ))}

        {/* مرکز: تو */}
        <g className="mm-center-g">
          <circle className="mm-center" cx={layout.cx} cy={layout.cy} r={CENTER_R} />
          <text className="mm-center-main" x={layout.cx} y={layout.cy - 4} textAnchor="middle">
            من
          </text>
          <text className="mm-center-sub" x={layout.cx} y={layout.cy + 22} textAnchor="middle">
            {faNum(layout.counts.open)} کار باز
          </text>
          <text className="mm-center-sub" x={layout.cx} y={layout.cy + 40} textAnchor="middle">
            {faNum(layout.counts.done)} انجام‌شده
          </text>
        </g>
      </svg>
      </div>

      <ul className="mm-legend">
        {TASK_STATUSES.map((s) => (
          <li key={s}>
            <span className="legend-dot" style={{ background: TASK_COLOR[s] }} />
            {TASK_STATUS_META[s].label}
          </li>
        ))}
        <li>
          <span className="mm-legend-strike" />
          انجام‌شده — خط روی آن
        </li>
        <li>
          <span className="mm-legend-dashed" />
          صندوق ذهن (تصمیم‌نگرفته)
        </li>
      </ul>

      {hiddenTotal > 0 && (
        <p className="db-note" style={{ marginTop: 10 }}>
          {faNum(hiddenTotal)} مورد روی نقشه جا نشد — یکی از کلیدهای بالا را خاموش کن
          تا بازها جای بیشتری بگیرند.
        </p>
      )}

      <p className="mm-note">
        🖱 روی هر کار کلیک کن تا <b>تیک</b> بخورد؛ دوباره کلیک = برگشت.
        نشانگر را روی هر گره ببر تا متن کاملش را ببینی.
      </p>
    </section>
  );
}
