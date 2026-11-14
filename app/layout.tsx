import type { Metadata } from 'next';
import { Plus_Jakarta_Sans, DM_Sans, JetBrains_Mono } from 'next/font/google';
import './globals.css';

const plusJakarta = Plus_Jakarta_Sans({
  subsets: ['latin'],
  weight: ['500', '600', '700'],
  variable: '--font-display',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
  display: 'swap',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'SLASH — Repo Unifier | URLMIND Digital Intelligence',
  description:
    'Unified AI-powered Digital Intelligence Platform combining URLMIND web intelligence, deep GitHub repository analysis, unified React Flow & Mermaid architecture graphs, and human-approved AI Copilot.',
  openGraph: {
    title: 'SLASH — Repo Unifier | URLMIND Digital Intelligence',
    description:
      'Turn URLs, websites, GitHub repositories, OpenAPI specs, and digital systems into one connected, evidence-backed intelligence graph.',
    type: 'website',
  },
  twitter: {
    card: 'summary_large_image',
    title: 'SLASH — Repo Unifier | URLMIND Digital Intelligence',
    description:
      'Turn URLs, websites, GitHub repositories, OpenAPI specs, and digital systems into one connected, evidence-backed intelligence graph.',
  },
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html
      lang="en"
      className={`${plusJakarta.variable} ${dmSans.variable} ${jetbrainsMono.variable}`}
      suppressHydrationWarning
    >
      <body
        className="font-sans bg-slate-50 text-slate-900 dark:bg-slate-950 dark:text-slate-100 antialiased selection:bg-blue-600 selection:text-white"
        suppressHydrationWarning
      >
        {children}
      </body>
    </html>
  );
}
