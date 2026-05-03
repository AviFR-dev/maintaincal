import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { dueBadge, formatDate } from './util';

export function Dashboard(props: { user: api.PublicUser; onOpen: (id: string) => void; onNew: () => void }) {
  const [items, setItems] = useState<api.EquipmentListItem[]>([]);
  const [search, setSearch] = useState('');
  const [filter, setFilter] = useState<'all' | 'overdue' | 'dueSoon'>('all');
  const [location, setLocation] = useState<string>('');
  const [status, setStatus] = useState<'active' | 'retired' | ''>('');
  const [model, setModel] = useState<string>('');
  const [meta, setMeta] = useState<{ locations: string[]; models: string[] } | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  const dueParam = useMemo(() => (filter === 'all' ? undefined : filter), [filter]);

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.listEquipment({
        search: search.trim() || undefined,
        due: dueParam,
        location: location || undefined,
        status: (status || undefined) as any,
        model: model || undefined,
      });
      setItems(res.items);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    (async () => {
      try {
        const m = await api.equipmentMeta();
        setMeta({ locations: m.locations, models: m.models });
      } catch {
        // non-fatal; filters can still be typed manually
      }
    })();
  }, []);

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [filter]);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Equipment</div>
          <div className="mt-1 text-sm text-zinc-400">Track calibration due dates and scan by barcode.</div>
        </div>
        <div className="flex gap-2">
          <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={() => refresh()} disabled={busy}>
            Refresh
          </button>
          {props.user.role === 'admin' ? (
            <button className="rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200" onClick={props.onNew}>
              New equipment
            </button>
          ) : null}
        </div>
      </div>

      <div className="mt-5 flex flex-col gap-2">
        <input
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
          placeholder="Search name, barcode, asset tag, location…"
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') refresh();
          }}
        />
        <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex flex-wrap gap-2">
            <select
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              value={location}
              onChange={(e) => setLocation(e.target.value)}
            >
              <option value="">All locations</option>
              {(meta?.locations ?? []).map((l) => (
                <option key={l} value={l}>
                  {l}
                </option>
              ))}
            </select>

            <select
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              value={status}
              onChange={(e) => setStatus(e.target.value as any)}
            >
              <option value="">All statuses</option>
              <option value="active">active</option>
              <option value="retired">retired</option>
            </select>

            <select
              className="rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600"
              value={model}
              onChange={(e) => setModel(e.target.value)}
            >
              <option value="">All models</option>
              {(meta?.models ?? []).map((m) => (
                <option key={m} value={m}>
                  {m}
                </option>
              ))}
            </select>

            <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={() => refresh()} disabled={busy}>
              Apply
            </button>
            <button
              className="rounded-lg border border-zinc-800 px-3 py-2 text-sm text-zinc-300 hover:bg-zinc-900"
              onClick={() => {
                setLocation('');
                setStatus('');
                setModel('');
              }}
              disabled={busy}
            >
              Reset
            </button>
          </div>

          <div className="flex gap-2">
          <button
            className={`rounded-lg border px-3 py-2 text-sm hover:bg-zinc-900 ${filter === 'all' ? 'border-zinc-500' : 'border-zinc-800'}`}
            onClick={() => setFilter('all')}
          >
            All
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm hover:bg-zinc-900 ${filter === 'dueSoon' ? 'border-amber-600/60' : 'border-zinc-800'}`}
            onClick={() => setFilter('dueSoon')}
          >
            Due soon
          </button>
          <button
            className={`rounded-lg border px-3 py-2 text-sm hover:bg-zinc-900 ${filter === 'overdue' ? 'border-red-600/60' : 'border-zinc-800'}`}
            onClick={() => setFilter('overdue')}
          >
            Overdue
          </button>
        </div>
      </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-6 overflow-hidden rounded-2xl border border-zinc-800">
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-400">
          <div className="col-span-5">Name</div>
          <div className="col-span-3 hidden sm:block">Barcode</div>
          <div className="col-span-2 hidden sm:block">Location</div>
          <div className="col-span-4 sm:col-span-2 text-right">Next due</div>
        </div>
        {items.length === 0 ? (
          <div className="px-4 py-10 text-center text-sm text-zinc-400">{busy ? 'Loading…' : 'No results.'}</div>
        ) : (
          items.map((it) => {
            const badge = dueBadge(it.nextDueAt);
            return (
              <button
                key={it.id}
                className="grid w-full grid-cols-12 gap-2 border-b border-zinc-900 px-4 py-3 text-left hover:bg-zinc-900/40"
                onClick={() => props.onOpen(it.id)}
              >
                <div className="col-span-7 sm:col-span-5">
                  <div className="font-medium">{it.name}</div>
                  <div className="mt-0.5 text-xs text-zinc-400 sm:hidden">{it.barcodeValue}</div>
                </div>
                <div className="col-span-3 hidden truncate text-sm text-zinc-300 sm:block">{it.barcodeValue}</div>
                <div className="col-span-2 hidden truncate text-sm text-zinc-300 sm:block">{it.location ?? '—'}</div>
                <div className="col-span-5 sm:col-span-2 text-right">
                  <div className={`inline-flex items-center rounded-full border px-2 py-0.5 text-xs ${badge.cls}`}>{badge.label}</div>
                  <div className="mt-1 text-xs text-zinc-500">{formatDate(it.nextDueAt)}</div>
                </div>
              </button>
            );
          })
        )}
      </div>
    </div>
  );
}

