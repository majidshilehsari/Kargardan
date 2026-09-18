/** @type {import('next').NextConfig} */
const nextConfig = {
  // ⚠️ توجه: گزینهٔ `output: 'export'` عمداً برداشته شد.
  // دلیل: خروجی کاملاً استاتیک با API Route (بخش «وضعیت دیتابیس») در تضاد است؛
  //       Next.js در حالت export هر API Route را با خطای بیلد رد می‌کند.
  //       بدون آن، برنامه روی Vercel با همان یک Deploy ساده بالا می‌آید و کافی است
  //       متغیرهای محیطی دیتابیس تنظیم شده باشند.
  // اگر دیتابیس وصل نباشد، برنامه هیچ خطایی نمی‌دهد و مثل قبل با localStorage کار می‌کند.
};

export default nextConfig;
