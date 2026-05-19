'use client';

import { signIn, signOut, useSession } from 'next-auth/react';
import { useCallback, useState } from 'react';

export function AuthButton() {
  const { data: session, status } = useSession();
  const [loading, setLoading] = useState(false);

  const handleSignIn = useCallback(async () => {
    setLoading(true);
    try {
      await signIn('credentials', {
        message: 'demo-sign-in',
        signature: 'demo',
        redirect: false,
      });
    } finally {
      setLoading(false);
    }
  }, []);

  const handleSignOut = useCallback(async () => {
    await signOut({ redirect: false });
  }, []);

  if (status === 'loading') {
    return (
      <div className="flex items-center gap-2 rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs text-slate-400">
        Loading…
      </div>
    );
  }

  if (session) {
    return (
      <div className="flex items-center gap-2">
        <span className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-200">
          {session.user?.name ?? 'Connected'}
        </span>
        <button
          type="button"
          onClick={() => void handleSignOut()}
          className="rounded-full border border-white/10 bg-slate-900/80 px-3 py-1.5 text-xs font-medium text-slate-400 transition hover:text-white"
        >
          Disconnect
        </button>
      </div>
    );
  }

  return (
    <button
      type="button"
      onClick={() => void handleSignIn()}
      disabled={loading}
      className="rounded-full border border-cyan-300/30 bg-cyan-300/10 px-4 py-2 text-sm font-medium text-cyan-100 transition hover:bg-cyan-300/20 disabled:cursor-not-allowed disabled:opacity-60"
    >
      {loading ? 'Connecting…' : 'Connect Wallet'}
    </button>
  );
}
