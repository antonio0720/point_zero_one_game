'use client';
import React, { useEffect, useState } from 'react';
import Link from 'next/link';

const LAUNCH_DATE = new Date('2026-06-01T00:00:00Z');
function useCountdown(target: Date) {
  const [delta, setDelta] = useState(() => Math.max(0, target.getTime() - Date.now()));
  useEffect(() => {
    const id = setInterval(() => setDelta(Math.max(0, target.getTime() - Date.now())), 1000);
    return () => clearInterval(id);
  }, [target]);
  const s = Math.floor(delta / 1000);
  return { days: Math.floor(s/86400), hours: Math.floor((s%86400)/3600), minutes: Math.floor((s%3600)/60), seconds: s%60 };
}
const ARTIFACTS = [
  { id: 1, name: 'Founder Mark', description: 'Permanent on-chain proof of Season 0 participation.' },
  { id: 2, name: 'Genesis Proof Card', description: 'Your first verified run, immortalized.' },
  { id: 3, name: 'Sovereign Seal', description: 'Exclusive cosmetic for Season 0 survivors.' },
];
export default function Season0Page() {
  const { days, hours, minutes, seconds } = useCountdown(LAUNCH_DATE);
  const pad = (n: number) => String(n).padStart(2, '0');
  return (
    <main className="min-h-screen bg-black text-white flex flex-col items-center py-16 px-4">
      <h1 className="text-4xl font-bold mb-2">Secure your Founder Mark</h1>
      <p className="text-gray-400 mb-10">Season 0 · Limited to first 1,000 players</p>
      <div className="flex gap-6 text-center mb-12">
        {([['Days',days],['Hrs',hours],['Min',minutes],['Sec',seconds]] as const).map(([l,v]) => (
          <div key={l} className="flex flex-col items-center">
            <span className="text-5xl font-mono font-bold">{pad(v as number)}</span>
            <span className="text-xs text-gray-500 mt-1 uppercase tracking-widest">{l}</span>
          </div>
        ))}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-6 max-w-3xl w-full mb-12">
        {ARTIFACTS.map(({ id, name, description }) => (
          <div key={id} className="border border-gray-700 rounded-lg p-5 bg-gray-900">
            <p className="font-semibold text-sm mb-1">{name}</p>
            <p className="text-xs text-gray-400">{description}</p>
          </div>
        ))}
      </div>
      <Link href="/claim" className="bg-white text-black font-bold px-8 py-3 rounded-lg hover:bg-gray-200 transition">
        Claim Founder Status →
      </Link>
    </main>
  );
}
