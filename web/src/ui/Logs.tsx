import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { formatDate } from './util';

export type AuditLog = {
  id: string;
  userId: string;
  userEmail: string | null;
  action: string;
  entityType: string;
  entityId: string | null;
  changes: Record<string, any> | null;
  ipAddress: string | null;
  createdAt: string;
};

export function Logs(props: { user: api.PublicUser }) {
  const [logs, setLogs] = useState<AuditLog[]>([]);
  const [filter, setFilter] = useState<'all' | 'create' | 'update' | 'delete' | 'login' | 'logout'>('all');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await fetch(api['API_BASE'] ?? '/api' + '/audit-logs?limit=100' + (filter !== 'all' ? `&action=${filter}` : ''), {
        credentials: 'include',
      });
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const data = await res.json();
      setLogs(data.logs);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  if (props.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-5xl px-4 py-6">
        <div className="rounded-lg border border-amber-900/60 bg-amber-950/30 p-4 text-amber-200">
          Admin only
        </div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Audit Logs</div>
          <div className="mt-1 text-sm text-zinc-400">Track all system changes and user actions.</div>
        </div>
        <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={() => refresh()} disabled={busy}>
          Refresh
        </button>
      </div>

      <div className="mt-4 flex gap-2">
        {['all', 'create', 'update', 'delete', 'login', 'logout'].map((f) => (
          <button
            key={f}
            onClick={() => setFilter(f as any)}
            className={`rounded-lg px-3 py-1.5 text-sm ${
              filter === f
                ? 'bg-blue-600 text-white'
                : 'border border-zinc-700 text-zinc-300 hover:bg-zinc-900'
            }`}
          >
            {f}
          </button>
        ))}
      </div>

      {error && (
        <div className="mt-4 rounded-lg border border-red-900/60 bg-red-950/30 p-3 text-red-200">
          {error}
        </div>
      )}

      <div className="mt-4 overflow-auto rounded-lg border border-zinc-800">
        <table className="w-full text-sm">
          <thead>
            <tr className="border-b border-zinc-800 bg-zinc-950">
              <th className="px-3 py-2 text-left">Timestamp</th>
              <th className="px-3 py-2 text-left">User</th>
              <th className="px-3 py-2 text-left">Action</th>
              <th className="px-3 py-2 text-left">Entity</th>
              <th className="px-3 py-2 text-left">Changes</th>
            </tr>
          </thead>
          <tbody>
            {logs.length === 0 ? (
              <tr>
                <td colSpan={5} className="px-3 py-2 text-center text-zinc-500">
                  No logs found
                </td>
              </tr>
            ) : (
              logs.map((log) => (
                <tr key={log.id} className="border-b border-zinc-900 hover:bg-zinc-900/50">
                  <td className="px-3 py-2 text-zinc-400">{formatDate(log.createdAt)}</td>
                  <td className="px-3 py-2 text-zinc-300">{log.userEmail || 'system'}</td>
                  <td className="px-3 py-2">
                    <span className={`inline-block rounded px-2 py-0.5 text-xs font-medium ${
                      log.action === 'create' ? 'bg-green-900/30 text-green-200' :
                      log.action === 'delete' ? 'bg-red-900/30 text-red-200' :
                      log.action === 'login' ? 'bg-blue-900/30 text-blue-200' :
                      log.action === 'logout' ? 'bg-amber-900/30 text-amber-200' :
                      'bg-zinc-900/30 text-zinc-200'
                    }`}>
                      {log.action}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-zinc-400">{log.entityType}</td>
                  <td className="px-3 py-2 text-xs text-zinc-500">
                    {log.changes ? JSON.stringify(log.changes) : '—'}
                  </td>
                </tr>
              ))
            )}
          </tbody>
        </table>
      </div>
    </div>
  );
}
