///Users/mervinlarry/workspaces/adam/Projects/adam/point_zero_one_master/frontend/apps/web/app/(marketing)/layout.tsx

import type { Metadata } from 'next';
import type { ReactNode } from 'react';
import { Barlow_Condensed, DM_Mono, DM_Sans } from 'next/font/google';

const barlow = Barlow_Condensed({
  subsets: ['latin'],
  weight: ['600', '700', '800', '900'],
  variable: '--font-barlow',
  display: 'swap',
});

const dmMono = DM_Mono({
  subsets: ['latin'],
  weight: ['400', '500'],
  variable: '--font-dm-mono',
  display: 'swap',
});

const dmSans = DM_Sans({
  subsets: ['latin'],
  weight: ['400', '500', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

export const metadata: Metadata = {
  title: 'Point Zero One',
  description: 'Master this game. Master real money.',
};

export default function MarketingLayout({ children }: { children: ReactNode }) {
  return (
    <html lang="en" className={`${barlow.variable} ${dmMono.variable} ${dmSans.variable}`}>
      <body
        style={{
          margin: 0,
          padding: 0,
          background: '#030308',
          color: '#F0F0FF',
          fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
        }}
      >
        {children}
      </body>
    </html>
  );
}