// ─── فایل OpenAPI برای «ChatGPT Actions» ────────────────────────────
//
// 🤖 چرا این فایل لازم است؟
//    ChatGPT Actions نمی‌تواند هدر سفارشی بفرستد، ولی می‌تواند کلید را
//    به‌صورت پارامتر آدرس (?k=...) بفرستد. این فایل دقیقاً همین را
//    توصیف می‌کند تا ChatGPT بفهمد چطور با کارگردان حرف بزند.
//
// 🔒 این مسیر عمداً «عمومی» است و کلیدی لازم ندارد:
//    چون هیچ رمزی داخلش نیست — فقط شکل API را توصیف می‌کند.
//    ChatGPT باید بتواند این آدرس را بدون احراز هویت بخواند.
//
// 🛡 توجه: فقط و فقط ۴ عملیات اینجا تعریف شده‌اند.
//    هیچ مسیر دیگری (سطل بازیافت، ساخت جدول، کنترل کلید، …) اینجا نیست،
//    پس ایجنت ChatGPT نمی‌تواند بیرون از این محدوده قدم بگذارد.
import { NextResponse } from 'next/server';
import { isInternalHost, resolvePublicOrigin } from '@/lib/api-utils';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

export async function GET(req: Request) {
  // نشانی‌ای که ChatGPT باید صدا بزند — نه localhost، نه 0.0.0.0
  const origin = resolvePublicOrigin(req);

  // اگر نشانی عمومی واقعی پیدا نشد (مثلاً اجرای محلیِ بدون KARGARDAN_PUBLIC_URL)،
  // به‌جای «http://0.0.0.0:3000» نشانی **نسبی** می‌دهیم. طبق استاندارد OpenAPI،
  // نشانی نسبی نسبت به محل سرو شدن همین سند حل می‌شود — پس روی هر دامنه‌ای
  // (پیش‌نمایش سندباکس، Vercel، دامنهٔ اختصاصی) خودکار درست می‌شود.
  const serverUrl = isInternalHost(new URL(origin).host) ? '/' : origin;

  const spec = {
    openapi: '3.1.0',
    info: {
      title: 'کارگردان — API ایجنت همکار',
      version: '1.0.0',
      description:
        'سیستم‌عامل زندگی شخصی «کارگردان». این API به ایجنت همکار اجازه می‌دهد ' +
        'وضعیت کارها، پروژه‌ها و صندوق ذهن را بخواند و پیشنهاد ثبت کند.\n\n' +
        'قواعد مهم:\n' +
        '• پیشنهادها خودکار اجرا نمی‌شوند؛ کاربر هر پیشنهاد را دستی تأیید یا رد می‌کند.\n' +
        '• هیچ چیزی در این سیستم پاک نمی‌شود؛ «حذف» یعنی رفتن به سطل بازیافت.\n' +
        '• کد ۴۰۳ یعنی کاربر دسترسی را قطع کرده است — در این حالت دوباره تلاش نکنید.\n' +
        '• همیشه اول /api/agent/context را بخوانید تا مدل داده و قواعد را بفهمید.',
    },
    servers: [{ url: serverUrl }],
    // احراز هویت: کلید در پارامتر آدرس ?k= — چون ChatGPT هدر سفارشی نمی‌فرستد
    security: [{ bridgeKey: [] }],
    components: {
      securitySchemes: {
        bridgeKey: {
          type: 'apiKey',
          in: 'query',
          name: 'k',
          description:
            'کلید دسترسی ایجنت همکار. کاربر آن را از برنامه → تب «🔌 ایجنت همکار» می‌گیرد.',
        },
      },
      schemas: {
        Context: {
          type: 'object',
          description: 'راهنمای کامل: هدف برنامه، مدل داده، انواع پیشنهاد و قواعد.',
          properties: {
            ok: { type: 'boolean' },
            app: { type: 'object' },
            dataModel: { type: 'object' },
            suggestionKinds: { type: 'object' },
            rules: { type: 'array', items: { type: 'string' } },
          },
        },
        AgentState: {
          type: 'object',
          description: 'وضعیت کامل کارگردان.',
          properties: {
            ok: { type: 'boolean' },
            counts: {
              type: 'object',
              properties: {
                tasks: { type: 'integer' },
                openTasks: { type: 'integer' },
                doneTasks: { type: 'integer' },
                projects: { type: 'integer' },
                activeProjects: { type: 'integer' },
                inbox: { type: 'integer' },
                trash: { type: 'integer' },
                pendingSuggestions: { type: 'integer' },
              },
            },
            settings: {
              type: 'object',
              properties: { activeProjectCap: { type: 'integer' } },
            },
            projects: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  name: { type: 'string' },
                  status: { type: 'string', enum: ['active', 'queued', 'parked', 'done'] },
                  nextStep: { type: ['string', 'null'] },
                  openTaskCount: { type: 'integer' },
                  createdAt: { type: 'integer' },
                },
              },
            },
            tasks: {
              type: 'array',
              description: 'کارهای باز (انجام‌نشده).',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  status: { type: 'string', enum: ['now', 'later', 'waiting', 'parked'] },
                  projectId: { type: ['string', 'null'] },
                  projectName: { type: ['string', 'null'] },
                  isNextStep: { type: 'boolean' },
                  waitingOn: { type: 'string' },
                  note: { type: 'string' },
                  ageDays: { type: 'number' },
                  createdAt: { type: 'integer' },
                },
              },
            },
            inbox: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  text: { type: 'string' },
                  ageDays: { type: 'number' },
                },
              },
            },
            trash: { type: 'array', items: { type: 'object' } },
            suggestions: { type: 'array', items: { type: 'object' } },
          },
        },
        SuggestionList: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            count: { type: 'integer' },
            items: {
              type: 'array',
              items: {
                type: 'object',
                properties: {
                  id: { type: 'string' },
                  title: { type: 'string' },
                  body: { type: 'string' },
                  kind: {
                    type: 'string',
                    enum: [
                      'task_add',
                      'task_update',
                      'task_set_status',
                      'task_toggle_done',
                      'project_add',
                      'project_set_status',
                      'note',
                    ],
                  },
                  status: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
                  payload: { type: ['object', 'null'] },
                  createdAt: { type: 'integer' },
                },
              },
            },
          },
        },
        NewSuggestion: {
          type: 'object',
          required: ['title', 'kind'],
          properties: {
            title: {
              type: 'string',
              description: 'عنوان کوتاه و روشن پیشنهاد.',
            },
            body: {
              type: 'string',
              description: 'توضیح دهید چرا این پیشنهاد را می‌دهید. کاربر بر اساس همین تصمیم می‌گیرد.',
            },
            kind: {
              type: 'string',
              enum: [
                'task_add',
                'task_update',
                'task_set_status',
                'task_toggle_done',
                'project_add',
                'project_set_status',
                'note',
              ],
              description:
                'نوع تغییر. برای «note» فقط title و body لازم است و هیچ داده‌ای تغییر نمی‌کند.',
            },
            payload: {
              type: 'object',
              description:
                'دادهٔ اجرایی. بسته به kind متفاوت است:\n' +
                '• task_add: {text (اجباری), status?, projectId?, waitingOn?, note?}\n' +
                '• task_update: {id (اجباری), text?, waitingOn?, note?, projectId?}\n' +
                '• task_set_status: {id (اجباری), status (اجباری)}\n' +
                '• task_toggle_done: {id (اجباری), done?}\n' +
                '• project_add: {name (اجباری), status?}\n' +
                '• project_set_status: {id (اجباری), status (اجباری)}',
              additionalProperties: true,
            },
            agentName: {
              type: 'string',
              description: 'نام ایجنت. پیش‌فرض: «ایجنت همکار».',
            },
          },
        },
        SuggestionCreated: {
          type: 'object',
          properties: {
            ok: { type: 'boolean' },
            createdCount: { type: 'integer' },
            rejectedCount: { type: 'integer' },
            message: { type: 'string' },
          },
        },
      },
      responses: {
        Unauthorized: {
          description: 'کلید نادرست یا غایب است (کد ۴۰۱).',
        },
        Forbidden: {
          description:
            'کاربر دسترسی ایجنت را قطع کرده است (کد ۴۰۳). ' +
            'در این حالت دوباره تلاش نکنید و به کاربر اطلاع دهید.',
        },
      },
    },
    paths: {
      '/api/agent/context': {
        get: {
          operationId: 'getKargardanContext',
          summary: 'راهنمای کارگردان (اول این را بخوانید)',
          description:
            'هدف برنامه، فلسفه، مدل داده، انواع پیشنهاد مجاز با ساختار payload، و قواعد. ' +
            'همیشه قبل از هر کاری این را بخوانید.',
          tags: ['راهنما'],
          responses: {
            '200': {
              description: 'راهنمای کامل',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/Context' } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/agent/state': {
        get: {
          operationId: 'getKargardanState',
          summary: 'خواندن وضعیت کامل کارگردان',
          description:
            'کارها، پروژه‌ها، صندوق ذهن، سطل بازیافت، پیشنهادها و تاریخچه. ' +
            'شامل ageDays (چند روز از ساخت هر مورد می‌گذرد) و nextStep هر پروژه.',
          tags: ['داده'],
          responses: {
            '200': {
              description: 'وضعیت کامل',
              content: { 'application/json': { schema: { $ref: '#/components/schemas/AgentState' } } },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
      '/api/agent/suggestions': {
        get: {
          operationId: 'listKargardanSuggestions',
          summary: 'فهرست پیشنهادهای قبلی',
          description: 'قبل از دادن پیشنهاد جدید، این را بخوانید تا پیشنهاد تکراری ندهید.',
          tags: ['پیشنهاد'],
          parameters: [
            {
              name: 'status',
              in: 'query',
              required: false,
              description: 'فیلتر بر اساس وضعیت',
              schema: { type: 'string', enum: ['pending', 'approved', 'rejected'] },
            },
          ],
          responses: {
            '200': {
              description: 'فهرست پیشنهادها',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/SuggestionList' } },
              },
            },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
        post: {
          operationId: 'createKargardanSuggestion',
          summary: 'ثبت یک پیشنهاد جدید',
          description:
            '⚠️ ثبت پیشنهاد به معنی اجرای آن نیست. پیشنهاد در برنامه ثبت می‌شود و ' +
            'کاربر خودش تصمیم می‌گیرد آن را تأیید یا رد کند. هر پیشنهاد باید «یک تغییر کوچک» باشد.',
          tags: ['پیشنهاد'],
          requestBody: {
            required: true,
            content: {
              'application/json': { schema: { $ref: '#/components/schemas/NewSuggestion' } },
            },
          },
          responses: {
            '200': {
              description: 'پیشنهاد ثبت شد',
              content: {
                'application/json': { schema: { $ref: '#/components/schemas/SuggestionCreated' } },
              },
            },
            '400': { description: 'بدنهٔ درخواست ناقص یا نامعتبر است.' },
            '401': { $ref: '#/components/responses/Unauthorized' },
            '403': { $ref: '#/components/responses/Forbidden' },
          },
        },
      },
    },
  };

  return NextResponse.json(spec, {
    headers: {
      'Cache-Control': 'no-store, no-cache, must-revalidate',
      // اجازهٔ خواندن از دامنهٔ ChatGPT
      'Access-Control-Allow-Origin': '*',
    },
  });
}
