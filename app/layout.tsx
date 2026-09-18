import type { Metadata, Viewport } from 'next';
import '@fontsource-variable/vazirmatn';
import './globals.css';

export const metadata: Metadata = {
  title: 'کارگردان | سیستم‌عامل زندگی',
  description:
    'تخلیه‌ی ذهن، تفکیک مهم از فوری، و سقف جبهه‌های فعال — سیستم‌عامل زندگی شخصی. داده‌ها فقط در مرورگر شما ذخیره می‌شوند.',
};

export const viewport: Viewport = {
  themeColor: '#0d7a6f',
  width: 'device-width',
  initialScale: 1,
};

/** جلوگیری از فلش تم اشتباه، قبل از اجرای React */
const themeInitScript = `
try {
  var t = localStorage.getItem('kargardan-theme');
  if (!t) t = window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
  document.documentElement.setAttribute('data-theme', t);
} catch (e) {}
`;

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="fa" dir="rtl" suppressHydrationWarning>
      <head>
        <script dangerouslySetInnerHTML={{ __html: themeInitScript }} />
      </head>
      <body>{children}</body>
    </html>
  );
}
