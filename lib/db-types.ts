// ─── تایپ‌های وضعیت دیتابیس ────────────────────────────────────────────
// این فایل هیچ وابستگی‌ای ندارد و هم سرور و هم مرورگر می‌توانند از آن استفاده کنند.
// ⚠️ عمداً هیچ import از `pg` اینجا نیست تا درایور دیتابیس هرگز وارد باندل مرورگر نشود.

export const DB_URL_ENV_VARS = [
  'PRISMA_DATABASE_URL',
  'POSTGRES_URL',
  'DATABASE_URL',
  'POSTGRES_PRISMA_URL',
  'POSTGRES_URL_NON_POOLING',
] as const;

/** نشانی بی‌خطر دیتابیس — بدون هیچ رمز یا اطلاعات حساس */
export interface SafeTarget {
  /** نام متغیر محیطی‌ای که استفاده شد */
  envVar: string;
  host: string;
  port: string;
  database: string;
  userMasked: string;
  ssl: 'روشن' | 'خاموش' | 'سخت‌گیرانه';
}

export type DbHealth =
  | { status: 'not_configured'; checkedAt: number; varsChecked: readonly string[] }
  | {
      status: 'ok';
      checkedAt: number;
      latencyMs: number;
      target: SafeTarget;
      serverVersion: string;
      database: string;
      schema: string;
      serverTime: string;
      tableCount: number;
      tables: string[];
      /** آیا جدول‌های کارگردان ساخته شده‌اند؟ (فقط تشخیص — چیزی ساخته نمی‌شود) */
      appTablesPresent: boolean;
    }
  | {
      status: 'error';
      checkedAt: number;
      latencyMs: number;
      target: SafeTarget | null;
      code: string;
      message: string;
      hint: string;
    };
