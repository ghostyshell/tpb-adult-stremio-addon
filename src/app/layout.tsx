import type { Metadata } from 'next';
import { JetBrains_Mono, Space_Grotesk } from 'next/font/google';
import { ADDON_NAME } from '../manifest';
import './globals.css';

const spaceGrotesk = Space_Grotesk({
  subsets: ['latin'],
  weight: ['400', '500', '600', '700'],
  variable: '--font-sans',
});

const jetbrainsMono = JetBrains_Mono({
  subsets: ['latin'],
  weight: ['400', '500', '600'],
  variable: '--font-mono',
});

export const metadata: Metadata = {
  title: `${ADDON_NAME} - Configure`,
  description: 'Configure adult Stremio catalogs, debrid providers, and metadata sources.',
  icons: { icon: '/icon.svg' },
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="en" className={`${spaceGrotesk.variable} ${jetbrainsMono.variable}`}>
      <body style={{ fontFamily: 'var(--font-sans, var(--sans))' }}>{children}</body>
    </html>
  );
}
