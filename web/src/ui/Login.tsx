import React, { useState } from 'react';
import * as api from '../api';

export function Login(props: { onAuthed: (user: api.PublicUser) => void }) {
  const [email, setEmail] = useState('admin@example.com');
  const [password, setPassword] = useState('admin1234');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  return (
    <div className="mx-auto flex min-h-[70vh] max-w-md flex-col justify-center px-4 py-10">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-6 shadow">
        <div className="text-xl font-semibold">Sign in</div>
        <div className="mt-1 text-sm text-zinc-400">Use your lab credentials.</div>

        <div className="mt-6 space-y-3">
          <label className="block text-sm">
            <div className="mb-1 text-zinc-300">Email</div>
            <input
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              autoComplete="username"
            />
          </label>

          <label className="block text-sm">
            <div className="mb-1 text-zinc-300">Password</div>
            <input
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
              type="password"
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              autoComplete="current-password"
            />
          </label>
        </div>

        {error ? <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div> : null}

        <button
          className="mt-6 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              const res = await api.login(email.trim(), password);
              props.onAuthed(res.user);
              window.location.hash = '#/';
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Signing in…' : 'Sign in'}
        </button>
      </div>
    </div>
  );
}

