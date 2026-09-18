// ─── لایهٔ دسترسی به داده (Repository) ─────────────────────────────
//
// ⚠️ قواعد ایمنی — تغییرشان نده:
//   ۱. هیچ DELETE ای روی داده‌ها اجرا نمی‌شود. حذف = پر کردن ستون `deleted_at`.
//      تنها استثنا: `purgeTrash` که فقط با دستور صریح خودِ کاربر صدا زده می‌شود.
//   ۲. `writeState` فقط با «شمارهٔ نسخهٔ درست» می‌نویسد. اگر کسی در این فاصله
//      چیزی عوض کرده باشد، نوشتن **رد می‌شود** تا داده‌ی تازه از بین نرود.
//   ۳. تمام کوئری‌ها پارامتری هستند (بدون چسباندن رشته).

import type { Pool } from 'pg';
import { TABLES } from './schema';
import type {
  AppState,
  HistoryEntityKind,
  HistoryEvent,
  InboxItem,
  Project,
  ProjectStatus,
  Suggestion,
  SuggestionKind,
  SuggestionStatus,
  Task,
  TaskStatus,
  TrashItem,
  TrashKind,
} from './types';

// ─── کمک‌های داخلی ────────────────────────────────────────────────

const ENTITY_TABLE: Record<TrashKind, string> = {
  task: TABLES.tasks,
  project: TABLES.projects,
  inbox: TABLES.inbox,
};

/** فقط مقادیر از پیش شناخته‌شده به SQL می‌روند — نه ورودی کاربر */
function assertKind(kind: string): asserts kind is TrashKind {
  if (!(kind in ENTITY_TABLE)) throw new Error(`نوع ناشناخته: ${kind}`);
}

export const newId = (): string =>
  Math.random().toString(36).slice(2, 8) + Date.now().toString(36);

// ─── خواندن وضعیت کامل ───────────────────────────────────────────

export interface StateSnapshot {
  state: AppState;
  revision: number;
}

export async function readState(pool: Pool): Promise<StateSnapshot> {
  const [tasks, projects, inbox, settings, revision] = await Promise.all([
    pool.query(
      `select id, text, status, project_id, is_next_step, waiting_on, note, done,
              created_at, updated_at
         from ${TABLES.tasks}
        where deleted_at is null
        order by created_at desc`
    ),
    pool.query(
      `select id, name, status, created_at
         from ${TABLES.projects}
        where deleted_at is null
        order by created_at desc`
    ),
    pool.query(
      `select id, text, created_at
         from ${TABLES.inbox}
        where deleted_at is null
        order by created_at desc`
    ),
    pool.query(`select key, value from ${TABLES.settings}`),
    getRevision(pool),
  ]);

  const settingsMap = new Map<string, string>(
    settings.rows.map((r: { key: string; value: string }) => [r.key, r.value])
  );
  const capRaw = Number(settingsMap.get('activeProjectCap') ?? '3');

  return {
    revision,
    state: {
      version: 1,
      settings: {
        activeProjectCap: Number.isFinite(capRaw) ? Math.min(10, Math.max(1, capRaw)) : 3,
      },
      tasks: tasks.rows.map(
        (r): Task => ({
          id: r.id,
          text: r.text,
          status: r.status as TaskStatus,
          projectId: r.project_id,
          isNextStep: r.is_next_step,
          waitingOn: r.waiting_on ?? '',
          note: r.note ?? '',
          done: r.done,
          createdAt: Number(r.created_at),
          updatedAt: Number(r.updated_at),
        })
      ),
      projects: projects.rows.map(
        (r): Project => ({
          id: r.id,
          name: r.name,
          status: r.status as ProjectStatus,
          createdAt: Number(r.created_at),
        })
      ),
      inbox: inbox.rows.map(
        (r): InboxItem => ({
          id: r.id,
          text: r.text,
          createdAt: Number(r.created_at),
        })
      ),
    },
  };
}

async function getRevision(pool: Pool): Promise<number> {
  const res = await pool.query<{ value: string }>(
    `select value from ${TABLES.meta} where key = 'state_revision'`
  );
  return res.rows[0] ? Number(res.rows[0].value) || 0 : 0;
}

async function bumpRevision(pool: Pool): Promise<number> {
  const res = await pool.query<{ value: string }>(
    `insert into ${TABLES.meta} (key, value) values ('state_revision', '1')
     on conflict (key) do update set value = (cast(${TABLES.meta}.value as bigint) + 1)::text
     returning value`
  );
  return Number(res.rows[0]?.value ?? 1) || 1;
}

// ─── نوشتن وضعیت ─────────────────────────────────────────────────

export interface WriteResult {
  ok: boolean;
  revision: number;
  /** اگر true: کسی در این فاصله داده را عوض کرده و نوشتن رد شد */
  stale?: boolean;
  /** چند مورد به سطل بازیافت رفت */
  softDeleted?: number;
}

/**
 * نوشتن وضعیت کامل در دیتابیس.
 *
 * 🛡 حفاظت از داده: اگر `expectedRevision` با نسخهٔ فعلی دیتابیس نخواند،
 *    هیچ چیزی نوشته نمی‌شود و `stale: true` برگردانده می‌شود.
 *    کلاینت باید دوباره بخواند و تغییر را دوباره اعمال کند.
 */
export async function writeState(
  pool: Pool,
  next: AppState,
  expectedRevision: number
): Promise<WriteResult> {
  const client = await pool.connect();
  try {
    await client.query('begin');

    const current = await client.query<{ value: string }>(
      `select value from ${TABLES.meta} where key = 'state_revision' for update`
    );
    const currentRev = current.rows[0] ? Number(current.rows[0].value) || 0 : 0;

    // «نوشتنِ شرطی»: اگر دیتابیس از آنچه کلاینت دیده جلوتر رفته، دست نزن
    if (expectedRevision >= 0 && currentRev !== expectedRevision) {
      await client.query('rollback');
      return { ok: false, stale: true, revision: currentRev };
    }

    const now = Date.now();
    let softDeleted = 0;

    // ── کارها ──
    for (const t of next.tasks) {
      await client.query(
        `insert into ${TABLES.tasks}
           (id, text, status, project_id, is_next_step, waiting_on, note, done,
            created_at, updated_at, deleted_at, deleted_by)
         values ($1,$2,$3,$4,$5,$6,$7,$8,$9,$10,null,null)
         on conflict (id) do update set
           text = excluded.text, status = excluded.status,
           project_id = excluded.project_id, is_next_step = excluded.is_next_step,
           waiting_on = excluded.waiting_on, note = excluded.note,
           done = excluded.done, updated_at = excluded.updated_at,
           deleted_at = null, deleted_by = null`,
        [
          t.id, t.text, t.status, t.projectId, t.isNextStep,
          t.waitingOn ?? '', t.note ?? '', t.done, t.createdAt, t.updatedAt ?? now,
        ]
      );
    }
    softDeleted += await softDeleteMissing(client, TABLES.tasks, next.tasks.map((t) => t.id), now);

    // ── پروژه‌ها ──
    for (const p of next.projects) {
      await client.query(
        `insert into ${TABLES.projects} (id, name, status, created_at, deleted_at, deleted_by)
         values ($1,$2,$3,$4,null,null)
         on conflict (id) do update set
           name = excluded.name, status = excluded.status, deleted_at = null, deleted_by = null`,
        [p.id, p.name, p.status, p.createdAt]
      );
    }
    softDeleted += await softDeleteMissing(client, TABLES.projects, next.projects.map((p) => p.id), now);

    // ── صندوق ذهن ──
    for (const i of next.inbox) {
      await client.query(
        `insert into ${TABLES.inbox} (id, text, created_at, deleted_at, deleted_by)
         values ($1,$2,$3,null,null)
         on conflict (id) do update set
           text = excluded.text, deleted_at = null, deleted_by = null`,
        [i.id, i.text, i.createdAt]
      );
    }
    softDeleted += await softDeleteMissing(client, TABLES.inbox, next.inbox.map((i) => i.id), now);

    // ── تنظیمات ──
    await client.query(
      `insert into ${TABLES.settings} (key, value, updated_at) values ($1,$2,$3)
       on conflict (key) do update set value = excluded.value, updated_at = excluded.updated_at`,
      ['activeProjectCap', String(next.settings.activeProjectCap), now]
    );

    const revision = await bumpRevisionTx(client, currentRev);

    await client.query('commit');
    return { ok: true, revision, softDeleted };
  } catch (err) {
    await client.query('rollback').catch(() => {});
    throw err;
  } finally {
    client.release();
  }
}

async function bumpRevisionTx(
  client: { query: (sql: string, values?: unknown[]) => Promise<unknown> },
  currentRev: number
): Promise<number> {
  const nextRev = currentRev + 1;
  await client.query(
    `insert into ${TABLES.meta} (key, value) values ('state_revision', $1)
     on conflict (key) do update set value = excluded.value`,
    [String(nextRev)]
  );
  return nextRev;
}

/**
 * 🗑 هر ردیفی که در دیتابیس فعال است ولی در وضعیت جدید نیست ⇒ به سطل بازیافت می‌رود.
 * هیچ ردیفی حذف نمی‌شود؛ فقط `deleted_at` پر می‌شود.
 */
async function softDeleteMissing(
  client: { query: (sql: string, values?: unknown[]) => Promise<{ rowCount: number | null }> },
  table: string,
  keepIds: string[],
  now: number
): Promise<number> {
  const res = await client.query(
    `update ${table}
        set deleted_at = $1,
            deleted_by = 'user'
      where deleted_at is null
        and not (id = any($2::text[]))`,
    [now, keepIds]
  );
  return res.rowCount ?? 0;
}

// ─── 🗑 سطل بازیافت ───────────────────────────────────────────────

export async function listTrash(pool: Pool): Promise<TrashItem[]> {
  const [tasks, projects, inbox] = await Promise.all([
    pool.query(
      `select id, text, status, deleted_at, deleted_by from ${TABLES.tasks}
        where deleted_at is not null order by deleted_at desc limit 500`
    ),
    pool.query(
      `select id, name, status, deleted_at, deleted_by from ${TABLES.projects}
        where deleted_at is not null order by deleted_at desc limit 500`
    ),
    pool.query(
      `select id, text, deleted_at, deleted_by from ${TABLES.inbox}
        where deleted_at is not null order by deleted_at desc limit 500`
    ),
  ]);

  const items: TrashItem[] = [
    ...tasks.rows.map(
      (r): TrashItem => ({
        kind: 'task', id: r.id, label: r.text,
        sub: `کار · وضعیت: ${r.status}`,
        deletedAt: Number(r.deleted_at),
        deletedBy: r.deleted_by === 'agent' ? 'agent' : 'user',
      })
    ),
    ...projects.rows.map(
      (r): TrashItem => ({
        kind: 'project', id: r.id, label: r.name,
        sub: `پروژه · وضعیت: ${r.status}`,
        deletedAt: Number(r.deleted_at),
        deletedBy: r.deleted_by === 'agent' ? 'agent' : 'user',
      })
    ),
    ...inbox.rows.map(
      (r): TrashItem => ({
        kind: 'inbox', id: r.id, label: r.text, sub: 'صندوق ذهن',
        deletedAt: Number(r.deleted_at),
        deletedBy: r.deleted_by === 'agent' ? 'agent' : 'user',
      })
    ),
  ];

  return items.sort((a, b) => b.deletedAt - a.deletedAt);
}

/** ♻️ برگرداندن یک مورد از سطل بازیافت */
export async function restoreTrash(pool: Pool, kind: string, id: string): Promise<boolean> {
  assertKind(kind);
  const res = await pool.query(
    `update ${ENTITY_TABLE[kind]} set deleted_at = null, deleted_by = null
      where id = $1 and deleted_at is not null`,
    [id]
  );
  if ((res.rowCount ?? 0) > 0) {
    await logEvent(pool, {
      entityKind: kind, entityId: id, action: 'restore',
      before: null, after: { restored: true }, source: 'user', suggestionId: null,
    });
    await bumpRevision(pool);
  }
  return (res.rowCount ?? 0) > 0;
}

/**
 * 🔥 پاک‌کردن قطعی — تنها جایی که یک ردیف واقعاً از دیتابیس می‌رود.
 * فقط با درخواست صریح کاربر (تأیید دوباره در رابط کاربری) صدا زده می‌شود.
 */
export async function purgeTrash(pool: Pool, kind: string, id: string): Promise<boolean> {
  assertKind(kind);
  const res = await pool.query(
    `delete from ${ENTITY_TABLE[kind]} where id = $1 and deleted_at is not null`,
    [id]
  );
  if ((res.rowCount ?? 0) > 0) await bumpRevision(pool);
  return (res.rowCount ?? 0) > 0;
}

// ─── تاریخچه ──────────────────────────────────────────────────────

export interface LogInput {
  entityKind: HistoryEntityKind;
  entityId: string;
  action: string;
  before: unknown;
  after: unknown;
  source: 'user' | 'agent';
  suggestionId: string | null;
}

export async function logEvent(pool: Pool, input: LogInput): Promise<string> {
  const id = newId();
  await pool.query(
    `insert into ${TABLES.history}
       (id, entity_kind, entity_id, action, before_state, after_state, source, suggestion_id, created_at)
     values ($1,$2,$3,$4,$5,$6,$7,$8,$9)`,
    [
      id, input.entityKind, input.entityId, input.action,
      input.before === undefined ? null : JSON.stringify(input.before ?? null),
      input.after === undefined ? null : JSON.stringify(input.after ?? null),
      input.source, input.suggestionId, Date.now(),
    ]
  );
  return id;
}

export async function listHistory(pool: Pool, limit = 50): Promise<HistoryEvent[]> {
  const res = await pool.query(
    `select id, entity_kind, entity_id, action, before_state, after_state,
            source, suggestion_id, created_at, undone_at
       from ${TABLES.history}
      order by created_at desc
      limit $1`,
    [Math.min(500, Math.max(1, limit))]
  );
  return res.rows.map((r) => ({
    id: r.id,
    entityKind: r.entity_kind,
    entityId: r.entity_id,
    action: r.action,
    before: r.before_state,
    after: r.after_state,
    source: r.source === 'agent' ? 'agent' : 'user',
    suggestionId: r.suggestion_id,
    at: Number(r.created_at),
    undoneAt: r.undone_at === null ? null : Number(r.undone_at),
  }));
}

// ─── پیشنهادهای ایجنت همکار ──────────────────────────────────────

const SUGGESTION_COLS = `id, agent_name, title, body, kind, payload, status,
                         created_at, decided_at, decision_note, applied_event_id`;

function toSuggestion(r: Record<string, unknown>): Suggestion {
  return {
    id: String(r.id),
    agentName: String(r.agent_name ?? 'ایجنت همکار'),
    title: String(r.title ?? ''),
    body: String(r.body ?? ''),
    kind: (r.kind as SuggestionKind) ?? 'note',
    payload: (r.payload as Record<string, unknown> | null) ?? null,
    status: (r.status as SuggestionStatus) ?? 'pending',
    createdAt: Number(r.created_at) || 0,
    decidedAt: r.decided_at === null || r.decided_at === undefined ? null : Number(r.decided_at),
    decisionNote: String(r.decision_note ?? ''),
    appliedEventId: r.applied_event_id === null ? null : String(r.applied_event_id),
  };
}

export async function listSuggestions(
  pool: Pool,
  status?: string
): Promise<Suggestion[]> {
  const valid = ['pending', 'approved', 'rejected'];
  const useStatus = status && valid.includes(status) ? status : null;

  const res = useStatus
    ? await pool.query(
        `select ${SUGGESTION_COLS} from ${TABLES.suggestions}
          where status = $1 order by created_at desc limit 300`,
        [useStatus]
      )
    : await pool.query(
        `select ${SUGGESTION_COLS} from ${TABLES.suggestions}
          order by created_at desc limit 300`
      );

  return res.rows.map(toSuggestion);
}

export interface NewSuggestion {
  agentName?: string;
  title: string;
  body?: string;
  kind?: SuggestionKind;
  payload?: Record<string, unknown> | null;
  id?: string;
}

export async function insertSuggestion(pool: Pool, input: NewSuggestion): Promise<Suggestion> {
  const id = input.id?.trim() || newId();
  const res = await pool.query(
    `insert into ${TABLES.suggestions}
       (id, agent_name, title, body, kind, payload, status, created_at)
     values ($1,$2,$3,$4,$5,$6,'pending',$7)
     on conflict (id) do nothing
     returning ${SUGGESTION_COLS}`,
    [
      id,
      (input.agentName ?? 'ایجنت همکار').slice(0, 80),
      input.title.slice(0, 300),
      (input.body ?? '').slice(0, 4000),
      input.kind ?? 'note',
      input.payload ? JSON.stringify(input.payload) : null,
      Date.now(),
    ]
  );

  if (res.rows[0]) return toSuggestion(res.rows[0]);

  // اگر شناسه تکراری بود، همان را برگردان (بدون بازنویسی)
  const existing = await pool.query(
    `select ${SUGGESTION_COLS} from ${TABLES.suggestions} where id = $1`,
    [id]
  );
  return toSuggestion(existing.rows[0]);
}

export interface DecideResult {
  ok: boolean;
  message: string;
  suggestion?: Suggestion;
}

/**
 * ✅ تأیید یا ❌ رد یک پیشنهاد.
 * هنگام تأیید، پیشنهاد واقعاً اجرا می‌شود و یک رکورد تاریخچه با
 * «وضعیت قبل» ثبت می‌گردد تا بعداً بتوانی برگردانی.
 */
export async function decideSuggestion(
  pool: Pool,
  id: string,
  decision: 'approved' | 'rejected',
  note = ''
): Promise<DecideResult> {
  const found = await pool.query(
    `select ${SUGGESTION_COLS} from ${TABLES.suggestions} where id = $1`,
    [id]
  );
  if (!found.rows[0]) return { ok: false, message: 'پیشنهاد پیدا نشد.' };

  const sug = toSuggestion(found.rows[0]);
  if (sug.status !== 'pending') {
    return { ok: false, message: 'این پیشنهاد قبلاً تصمیم‌گیری شده است.' };
  }

  let appliedEventId: string | null = null;
  let applyNote = '';

  if (decision === 'approved') {
    const applied = await applySuggestion(pool, sug);
    appliedEventId = applied.eventId;
    applyNote = applied.message;
  }

  await pool.query(
    `update ${TABLES.suggestions}
        set status = $1, decided_at = $2, decision_note = $3, applied_event_id = $4
      where id = $5`,
    [decision, Date.now(), note.slice(0, 1000), appliedEventId, id]
  );

  const after = await pool.query(
    `select ${SUGGESTION_COLS} from ${TABLES.suggestions} where id = $1`,
    [id]
  );

  return {
    ok: true,
    message:
      decision === 'rejected'
        ? 'پیشنهاد رد شد.'
        : `پیشنهاد اجرا شد. ${applyNote}`.trim(),
    suggestion: toSuggestion(after.rows[0]),
  };
}

/** اجرای واقعی یک پیشنهاد — همیشه با ثبت «وضعیت قبل» */
async function applySuggestion(
  pool: Pool,
  sug: Suggestion
): Promise<{ eventId: string | null; message: string }> {
  const p = (sug.payload ?? {}) as Record<string, unknown>;
  const now = Date.now();
  const str = (k: string, d = ''): string => (typeof p[k] === 'string' ? (p[k] as string) : d);

  switch (sug.kind) {
    case 'task_add': {
      const text = str('text').trim();
      if (!text) return { eventId: null, message: 'متن کار خالی بود؛ چیزی ساخته نشد.' };
      const status = (['now', 'later', 'waiting', 'parked'] as TaskStatus[]).includes(
        str('status') as TaskStatus
      )
        ? (str('status') as TaskStatus)
        : 'later';
      const taskId = str('id') || newId();
      await pool.query(
        `insert into ${TABLES.tasks}
           (id, text, status, project_id, is_next_step, waiting_on, note, done,
            created_at, updated_at, deleted_at, deleted_by)
         values ($1,$2,$3,$4,false,$5,$6,false,$7,$7,null,null)
         on conflict (id) do nothing`,
        [taskId, text.slice(0, 1000), status, str('projectId') || null, str('waitingOn'), str('note'), now]
      );
      const eventId = await logEvent(pool, {
        entityKind: 'task', entityId: taskId, action: 'create',
        before: null, after: { text, status }, source: 'agent', suggestionId: sug.id,
      });
      await bumpRevision(pool);
      return { eventId, message: 'کار جدید ساخته شد.' };
    }

    case 'task_update': {
      const taskId = str('id');
      if (!taskId) return { eventId: null, message: 'شناسهٔ کار مشخص نبود.' };
      const before = await pool.query(`select * from ${TABLES.tasks} where id = $1`, [taskId]);
      if (!before.rows[0]) return { eventId: null, message: 'کار موردنظر پیدا نشد.' };
      await pool.query(
        `update ${TABLES.tasks} set
           text = coalesce($1, text),
           waiting_on = coalesce($2, waiting_on),
           note = coalesce($3, note),
           project_id = case when $4::boolean then $5 else project_id end,
           updated_at = $6
         where id = $7`,
        [
          p.text === undefined ? null : String(p.text).slice(0, 1000),
          p.waitingOn === undefined ? null : String(p.waitingOn).slice(0, 300),
          p.note === undefined ? null : String(p.note).slice(0, 1000),
          'projectId' in p, p.projectId === null ? null : String(p.projectId ?? ''),
          now, taskId,
        ]
      );
      const eventId = await logEvent(pool, {
        entityKind: 'task', entityId: taskId, action: 'update',
        before: before.rows[0], after: p, source: 'agent', suggestionId: sug.id,
      });
      await bumpRevision(pool);
      return { eventId, message: 'کار ویرایش شد.' };
    }

    case 'task_set_status': {
      const taskId = str('id');
      const status = str('status');
      if (!taskId) return { eventId: null, message: 'شناسهٔ کار مشخص نبود.' };
      if (!(['now', 'later', 'waiting', 'parked'] as string[]).includes(status)) {
        return { eventId: null, message: 'وضعیت نامعتبر بود.' };
      }
      const before = await pool.query(`select * from ${TABLES.tasks} where id = $1`, [taskId]);
      if (!before.rows[0]) return { eventId: null, message: 'کار موردنظر پیدا نشد.' };
      await pool.query(
        `update ${TABLES.tasks}
            set status = $1, updated_at = $2,
                is_next_step = case when $1 = 'now' then is_next_step else false end
          where id = $3`,
        [status, now, taskId]
      );
      const eventId = await logEvent(pool, {
        entityKind: 'task', entityId: taskId, action: 'set_status',
        before: before.rows[0], after: { status }, source: 'agent', suggestionId: sug.id,
      });
      await bumpRevision(pool);
      return { eventId, message: 'وضعیت کار عوض شد.' };
    }

    case 'task_toggle_done': {
      const taskId = str('id');
      if (!taskId) return { eventId: null, message: 'شناسهٔ کار مشخص نبود.' };
      const before = await pool.query(`select * from ${TABLES.tasks} where id = $1`, [taskId]);
      if (!before.rows[0]) return { eventId: null, message: 'کار موردنظر پیدا نشد.' };
      const done = p.done === undefined ? !before.rows[0].done : Boolean(p.done);
      await pool.query(
        `update ${TABLES.tasks} set done = $1, is_next_step = case when $1 then false else is_next_step end,
                updated_at = $2 where id = $3`,
        [done, now, taskId]
      );
      const eventId = await logEvent(pool, {
        entityKind: 'task', entityId: taskId, action: done ? 'done' : 'undone',
        before: before.rows[0], after: { done }, source: 'agent', suggestionId: sug.id,
      });
      await bumpRevision(pool);
      return { eventId, message: done ? 'کار تمام شد.' : 'کار به حالت انجام‌نشده برگشت.' };
    }

    case 'project_add': {
      const name = str('name').trim();
      if (!name) return { eventId: null, message: 'نام پروژه خالی بود.' };
      const projectId = str('id') || newId();
      const status = (['active', 'queued', 'parked', 'done'] as string[]).includes(str('status'))
        ? str('status')
        : 'queued';
      await pool.query(
        `insert into ${TABLES.projects} (id, name, status, created_at, deleted_at, deleted_by)
         values ($1,$2,$3,$4,null,null) on conflict (id) do nothing`,
        [projectId, name.slice(0, 300), status, now]
      );
      const eventId = await logEvent(pool, {
        entityKind: 'project', entityId: projectId, action: 'create',
        before: null, after: { name, status }, source: 'agent', suggestionId: sug.id,
      });
      await bumpRevision(pool);
      return { eventId, message: 'پروژهٔ جدید ساخته شد.' };
    }

    case 'project_set_status': {
      const projectId = str('id');
      const status = str('status');
      if (!projectId) return { eventId: null, message: 'شناسهٔ پروژه مشخص نبود.' };
      if (!(['active', 'queued', 'parked', 'done'] as string[]).includes(status)) {
        return { eventId: null, message: 'وضعیت نامعتبر بود.' };
      }
      const before = await pool.query(`select * from ${TABLES.projects} where id = $1`, [projectId]);
      if (!before.rows[0]) return { eventId: null, message: 'پروژه پیدا نشد.' };
      await pool.query(`update ${TABLES.projects} set status = $1 where id = $2`, [status, projectId]);
      const eventId = await logEvent(pool, {
        entityKind: 'project', entityId: projectId, action: 'set_status',
        before: before.rows[0], after: { status }, source: 'agent', suggestionId: sug.id,
      });
      await bumpRevision(pool);
      return { eventId, message: 'وضعیت پروژه عوض شد.' };
    }

    case 'note':
    default: {
      const eventId = await logEvent(pool, {
        entityKind: 'task', entityId: '', action: 'note',
        before: null, after: { title: sug.title }, source: 'agent', suggestionId: sug.id,
      });
      return { eventId, message: 'به‌عنوان یادداشت ثبت شد (بدون تغییر داده).' };
    }
  }
}

// ─── ⏪ برگرداندن یک پیشنهاد اجراشده ────────────────────────────────
//
// «هر پیشنهادی رو حتی اگه اجرا کردم بتونم برگردونم.»
// چون هنگام اجرا، «وضعیت قبل» ذخیره شده، اینجا دقیقاً همان وضعیت بازگردانده می‌شود.

export interface RevertResult {
  ok: boolean;
  message: string;
}

export async function revertSuggestion(pool: Pool, suggestionId: string): Promise<RevertResult> {
  const sugRes = await pool.query(
    `select id, applied_event_id, title from ${TABLES.suggestions} where id = $1`,
    [suggestionId]
  );
  const sug = sugRes.rows[0];
  if (!sug) return { ok: false, message: 'پیشنهاد پیدا نشد.' };
  if (!sug.applied_event_id) {
    return { ok: false, message: 'این پیشنهاد اجرا نشده بود؛ چیزی برای برگرداندن نیست.' };
  }

  const evRes = await pool.query(
    `select id, entity_kind, entity_id, before_state, undone_at
       from ${TABLES.history} where id = $1`,
    [sug.applied_event_id]
  );
  const ev = evRes.rows[0];
  if (!ev) return { ok: false, message: 'رکورد تاریخچه پیدا نشد.' };
  if (ev.undone_at !== null && ev.undone_at !== undefined) {
    return { ok: false, message: 'این پیشنهاد قبلاً برگردانده شده است.' };
  }

  const kind = ev.entity_kind as TrashKind;
  if (!(kind in ENTITY_TABLE)) return { ok: false, message: 'نوع موجودیت پشتیبانی نمی‌شود.' };
  const table = ENTITY_TABLE[kind];

  if (ev.before_state === null || ev.before_state === undefined) {
    // موجودیت تازه ساخته شده بود ⇒ برگرداندن = رفتن به سطل بازیافت (نه حذف واقعی)
    await pool.query(
      `update ${table} set deleted_at = $1, deleted_by = 'agent' where id = $2`,
      [Date.now(), ev.entity_id]
    );
  } else {
    const b = ev.before_state as Record<string, unknown>;
    if (kind === 'task') {
      await pool.query(
        `update ${TABLES.tasks} set
           text = $1, status = $2, project_id = $3, is_next_step = $4,
           waiting_on = $5, note = $6, done = $7, updated_at = $8,
           deleted_at = null, deleted_by = null
         where id = $9`,
        [
          b.text, b.status, b.project_id, b.is_next_step,
          b.waiting_on, b.note, b.done, Date.now(), ev.entity_id,
        ]
      );
    } else if (kind === 'project') {
      await pool.query(
        `update ${TABLES.projects} set name = $1, status = $2,
                deleted_at = null, deleted_by = null
          where id = $3`,
        [b.name, b.status, ev.entity_id]
      );
    } else {
      await pool.query(
        `update ${TABLES.inbox} set text = $1, deleted_at = null, deleted_by = null where id = $2`,
        [b.text, ev.entity_id]
      );
    }
  }

  await pool.query(`update ${TABLES.history} set undone_at = $1 where id = $2`, [
    Date.now(), ev.id,
  ]);
  await bumpRevision(pool);

  return { ok: true, message: `پیشنهاد «${sug.title}» برگردانده شد.` };
}

/** آیا پیشنهاد اجراشده برگردانده شده؟ (برای نمایش در رابط کاربری) */
export async function listRevertedSuggestionIds(pool: Pool): Promise<string[]> {
  const res = await pool.query(
    `select suggestion_id from ${TABLES.history}
      where undone_at is not null and suggestion_id is not null`
  );
  return res.rows.map((r) => String(r.suggestion_id));
}
