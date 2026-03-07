/**
 * layout.tsx — (app) route group
 * Point Zero One · Density6 LLC · Confidential
 *
 * Fonts loaded via next/font (no inline <style> tag → no hydration mismatch).
 * Design tokens mirror the zinc/indigo terminal system used across PZO.
 */

import type { Metadata } from 'next';
import { Barlow_Condensed, DM_Mono, DM_Sans } from 'next/font/google';

// ─── Font loading ─────────────────────────────────────────────────────────────

const barlowCondensed = Barlow_Condensed({
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
  weight: ['400', '500', '600', '700'],
  variable: '--font-dm-sans',
  display: 'swap',
});

// ─── Metadata ─────────────────────────────────────────────────────────────────

export const metadata: Metadata = {
  title: 'Point Zero One — Play',
  description:
    'The financial roguelike where every decision has permanent weight. Master this game. Master real money.',
};

// ─── Layout ───────────────────────────────────────────────────────────────────

export default function AppLayout({ children }: { children: React.ReactNode }) {
  const fontClasses = [
    barlowCondensed.variable,
    dmMono.variable,
    dmSans.variable,
  ].join(' ');

  return (
    <html lang="en" className={fontClasses}>
      <head />
      <body
        style={{
          margin: 0,
          padding: 0,
          background: '#030308',
          color: '#F0F0FF',
          fontFamily: 'var(--font-dm-sans), system-ui, sans-serif',
          WebkitFontSmoothing: 'antialiased',
          MozOsxFontSmoothing: 'grayscale',
          overscrollBehavior: 'none',
        }}
      >
        <style>{`
          *, *::before, *::after { box-sizing: border-box; -webkit-tap-highlight-color: transparent; }
          ::-webkit-scrollbar { width: 4px; background: #0A0A16; }
          ::-webkit-scrollbar-thumb { background: rgba(255,255,255,0.12); border-radius: 2px; }
          html { scroll-behavior: smooth; }
        `}</style>
        {children}
      </body>
    </html>
  );
}