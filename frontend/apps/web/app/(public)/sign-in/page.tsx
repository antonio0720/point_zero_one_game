//frontend/apps/web/app/(public)/sign-in/page.tsx

'use client';

import Link from 'next/link';
import { useRouter } from 'next/navigation';
import { useState } from 'react';

export default function SignInPage() {
  const router = useRouter();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');

  const handleDevSignIn = (e: React.FormEvent) => {
    e.preventDefault();

    if (typeof window !== 'undefined') {
      window.localStorage.setItem(
        'pzo_dev_session',
        JSON.stringify({
          email: email || 'dev@pointzeroone.local',
          role: 'developer',
          signedInAt: new Date().toISOString(),
        }),
      );
    }

    router.push('/play');
  };

  return (
    <main
      style={{
        minHeight: '100vh',
        display: 'grid',
        placeItems: 'center',
        background: '#070711',
        color: '#F0F0FF',
        padding: 24,
      }}
    >
      <div
        style={{
          width: '100%',
          maxWidth: 480,
          background: 'rgba(255,255,255,0.04)',
          border: '1px solid rgba(255,255,255,0.08)',
          borderRadius: 16,
          padding: 24,
          boxShadow: '0 20px 60px rgba(0,0,0,0.35)',
        }}
      >
        <div style={{ marginBottom: 20 }}>
          <div style={{ fontSize: 12, letterSpacing: '0.18em', opacity: 0.7, textTransform: 'uppercase' }}>
            Point Zero One
          </div>
          <h1 style={{ margin: '8px 0 0', fontSize: 32, lineHeight: 1.05 }}>Sign In</h1>
          <p style={{ marginTop: 10, color: '#B8B8D8' }}>
            Dev-safe auth entry. This can be swapped to Clerk, NextAuth, Supabase, or custom JWT later.
          </p>
        </div>

        <form onSubmit={handleDevSignIn} style={{ display: 'grid', gap: 14 }}>
          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#D8D8F8' }}>Email</span>
            <input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              placeholder="dev@pointzeroone.local"
              autoComplete="email"
              style={{
                height: 46,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: '#0F1020',
                color: '#F0F0FF',
                padding: '0 14px',
                outline: 'none',
              }}
            />
          </label>

          <label style={{ display: 'grid', gap: 8 }}>
            <span style={{ fontSize: 13, color: '#D8D8F8' }}>Password</span>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              placeholder="••••••••"
              autoComplete="current-password"
              style={{
                height: 46,
                borderRadius: 10,
                border: '1px solid rgba(255,255,255,0.12)',
                background: '#0F1020',
                color: '#F0F0FF',
                padding: '0 14px',
                outline: 'none',
              }}
            />
          </label>

          <button
            type="submit"
            style={{
              marginTop: 8,
              height: 48,
              borderRadius: 10,
              border: 'none',
              background: '#818CF8',
              color: '#050510',
              fontWeight: 800,
              cursor: 'pointer',
            }}
          >
            Continue
          </button>
        </form>

        <div style={{ marginTop: 16, fontSize: 14, color: '#B8B8D8' }}>
          Need an account?{' '}
          <Link href="/sign-up" style={{ color: '#A5B4FC', textDecoration: 'none' }}>
            Create one
          </Link>
        </div>

        <div style={{ marginTop: 12, fontSize: 12, color: '#8C8CA8' }}>
          Current behavior: dev session → redirects to <code>/play</code>.
        </div>
      </div>
    </main>
  );
}