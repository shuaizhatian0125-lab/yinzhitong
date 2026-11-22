import type { Metadata, Viewport } from 'next';
import './globals.css';

export const viewport: Viewport = {
  width: 'device-width',
  initialScale: 1,
  maximumScale: 1,
};

export const metadata: Metadata = {
  title: {
    default: '银智通 | AI原生智能工作平台',
    template: '%s | 银智通',
  },
  description: '面向银行业的AI原生智能工作平台',
  keywords: [
    '银智通',
    'Bank AI OS',
    '银行智能工作平台',
    'AI工作台',
    '银行业务',
    '智能办公',
  ],
  authors: [{ name: '银智通团队' }],
  openGraph: {
    title: '银智通 | AI原生智能工作平台',
    description: '面向银行业的AI原生智能工作平台',
    locale: 'zh_CN',
    type: 'website',
  },
  robots: {
    index: true,
    follow: true,
  },
};

export default function RootLayout({
  children,
}: Readonly<{
  children: React.ReactNode;
}>) {
  return (
    <html lang="zh-CN">
      <body className={`antialiased`}>
        {children}
      </body>
    </html>
  );
}
