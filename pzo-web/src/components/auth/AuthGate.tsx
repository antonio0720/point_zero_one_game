/**
 * pzo-web/src/components/auth/AuthGate.tsx
 * Login / Register wall — shown before landing screen
 * Dark financial terminal aesthetic. No fluff.
 */

import React, { useState, useCallback } from 'react';
import type { useAuth } from '../../hooks/useAuth';

type AuthGateProps = {
  onAuth: () => void;
  auth: ReturnType<typeof useAuth>;
};

type Mode = 'LOGIN' | 'REGISTER';

export function AuthGate({ onAuth, auth }: AuthGateProps) {
  const [mode,        setMode]        = useState<Mode>('LOGIN');
  const [username,    setUsername]    = useState('');
  const [email,       setEmail]       = useState('');
  const [password,    setPassword]    = useState('');
  const [displayName, setDisplayName] = useState('');
  const [confirm,     setConfirm]     = useState('');
  const [localError,  setLocalError]  = useState('');
  const [submitting,  setSubmitting]  = useState(false);

  const handleSubmit = useCallback(async () => {
    setLocalError('');
    auth.clearError();

    if (mode === 'REGISTER') {
      if (password !== confirm) { setLocalError('Passwords do not match.'); return; }
      if (password.length < 8)  { setLocalError('Password must be at least 8 characters.'); return; }
    }

    setSubmitting(true);
    try {
      if (mode === 'LOGIN') {
        await auth.login(username, password);
      } else {
        await auth.register(username, email, password, displayName || username);
      }
      onAuth();
    } catch {
      // error is already in auth.error
    } finally {
      setSubmitting(false);
    }
  }, [mode, username, email, password, displayName, confirm, auth, onAuth]);

  const error = localError || auth.error;

  return (
    <div className="min-h-screen bg-zinc-950 text-white flex flex-col items-center justify-center p-4">

      {/* Logo */}
      <div className="text-center mb-8">
        <h1 className="text-4xl font-black tracking-tight">
          POINT <span className="text-indigo-400">ZERO ONE</span>
        </h1>
        <p className="text-zinc-500 text-sm mt-2 tracking-widest uppercase">
          The 0.01% starts here
        </p>
      </div>

      {/* Card */}
      <div className="w-full max-w-sm bg-zinc-900 border border-zinc-800 rounded-2xl p-6 shadow-2xl shadow-black/60">

        {/* Tab toggle */}
        <div className="flex rounded-xl overflow-hidden border border-zinc-800 mb-6">
          {(['LOGIN', 'REGISTER'] as const).map((m) => (
            <button
              key={m}
              onClick={() => { setMode(m); setLocalError(''); auth.clearError(); }}
              className={`flex-1 py-2 text-xs font-bold tracking-widest uppercase transition-colors ${
                mode === m
                  ? 'bg-indigo-600 text-white'
                  : 'bg-zinc-900 text-zinc-500 hover:text-zinc-300'
              }`}
            >
              {m === 'LOGIN' ? 'Sign In' : 'Create Account'}
            </button>
          ))}
        </div>

        {/* Fields */}
        <div className="flex flex-col gap-3">

          {/* Username */}
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
              Username
            </label>
            <input
              value={username}
              onChange={(e) => setUsername(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder="your_handle"
              autoComplete="username"
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors font-mono"
            />
          </div>

          {/* Email (register only) */}
          {mode === 'REGISTER' && (
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
                Email
              </label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@example.com"
                autoComplete="email"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Display name (register only) */}
          {mode === 'REGISTER' && (
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
                Display Name <span className="text-zinc-600">(optional)</span>
              </label>
              <input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder="How you appear in chat"
                autoComplete="name"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors"
              />
            </div>
          )}

          {/* Password */}
          <div>
            <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
              Password
            </label>
            <input
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
              placeholder={mode === 'REGISTER' ? '8+ characters' : '••••••••'}
              autoComplete={mode === 'LOGIN' ? 'current-password' : 'new-password'}
              className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors font-mono"
            />
          </div>

          {/* Confirm password (register only) */}
          {mode === 'REGISTER' && (
            <div>
              <label className="text-[10px] text-zinc-500 uppercase tracking-widest font-semibold block mb-1">
                Confirm Password
              </label>
              <input
                type="password"
                value={confirm}
                onChange={(e) => setConfirm(e.target.value)}
                onKeyDown={(e) => e.key === 'Enter' && handleSubmit()}
                placeholder="••••••••"
                autoComplete="new-password"
                className="w-full bg-zinc-800 border border-zinc-700 rounded-lg px-3 py-2 text-sm text-white placeholder-zinc-600 outline-none focus:border-indigo-500 transition-colors font-mono"
              />
            </div>
          )}
        </div>

        {/* Error */}
        {error && (
          <div className="mt-3 p-2.5 bg-red-950/50 border border-red-800/50 rounded-lg">
            <p className="text-red-400 text-xs">{error}</p>
          </div>
        )}

        {/* Submit */}
        <button
          onClick={handleSubmit}
          disabled={submitting || auth.loading || !username || !password}
          className="mt-5 w-full py-3 rounded-xl font-black text-sm tracking-widest uppercase
                     bg-indigo-600 hover:bg-indigo-500 active:bg-indigo-700
                     disabled:opacity-40 disabled:cursor-not-allowed
                     transition-all duration-150 shadow-lg shadow-indigo-900/40"
        >
          {submitting || auth.loading
            ? 'ONE MOMENT...'
            : mode === 'LOGIN'
              ? 'ENTER THE GAME'
              : 'CREATE ACCOUNT'}
        </button>

        {/* Register disclaimer */}
        {mode === 'REGISTER' && (
          <p className="text-zinc-600 text-[10px] text-center mt-3 leading-relaxed">
            This game is hard. Life is hard. You were warned.
          </p>
        )}
      </div>

      {/* Hater teaser */}
      <div className="mt-6 text-center max-w-xs">
        <p className="text-zinc-700 text-[10px] font-mono tracking-wide">
          ⚖️ &ldquo;The 1% is not a destination. It&rsquo;s an invitation list. You weren&rsquo;t invited.&rdquo;
        </p>
        <p className="text-zinc-800 text-[9px] mt-1">— STATUS_QUO_ML</p>
      </div>

    </div>
  );
}
