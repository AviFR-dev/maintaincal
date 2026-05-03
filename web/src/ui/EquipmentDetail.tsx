import React, { useEffect, useState } from 'react';
import * as api from '../api';
import { dueBadge, formatDate } from './util';

export function EquipmentDetail(props: { id: string; user: api.PublicUser }) {
  const [data, setData] = useState<api.EquipmentDetail | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const d = await api.getEquipment(props.id);
      setData(d);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [props.id]);

  if (error) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4 text-sm text-red-200">{error}</div>
      </div>
    );
  }
  if (!data) {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10 text-sm text-zinc-400">
        {busy ? 'Loading…' : 'Not found.'}
      </div>
    );
  }

  const badge = dueBadge(data.rule?.nextDueAt ?? null);

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">{data.equipment.name}</div>
          <div className="mt-1 text-sm text-zinc-400">
            Barcode: <span className="font-mono text-zinc-200">{data.equipment.barcodeValue}</span>
          </div>
        </div>
        <div className="flex items-center gap-2">
          <div className={`inline-flex items-center rounded-full border px-3 py-1 text-xs ${badge.cls}`}>{badge.label}</div>
          <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={() => refresh()} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      <div className="mt-6 grid grid-cols-1 gap-4 md:grid-cols-3">
        <div className="rounded-2xl border border-zinc-800 p-4 md:col-span-2">
          <div className="text-sm font-semibold text-zinc-200">Details</div>
          <div className="mt-3 grid grid-cols-1 gap-3 sm:grid-cols-2 text-sm">
            <div>
              <div className="text-xs text-zinc-500">Asset tag</div>
              <div className="text-zinc-200">{data.equipment.assetTag ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Location</div>
              <div className="text-zinc-200">{data.equipment.location ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Model</div>
              <div className="text-zinc-200">{data.equipment.model ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Serial</div>
              <div className="text-zinc-200">{data.equipment.serialNumber ?? '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Interval</div>
              <div className="text-zinc-200">{data.rule ? `${data.rule.intervalDays} days` : '—'}</div>
            </div>
            <div>
              <div className="text-xs text-zinc-500">Next due</div>
              <div className="text-zinc-200">{formatDate(data.rule?.nextDueAt ?? null)}</div>
            </div>
            <div className="sm:col-span-2">
              <div className="text-xs text-zinc-500">Notes</div>
              <div className="whitespace-pre-wrap text-zinc-200">{data.equipment.notes ?? '—'}</div>
            </div>
          </div>
        </div>

        <div className="rounded-2xl border border-zinc-800 p-4">
          <div className="text-sm font-semibold text-zinc-200">Add calibration</div>
          <AddCalibration equipmentId={data.equipment.id} onSaved={(d) => setData(d)} />
        </div>
      </div>

      <div className="mt-6 rounded-2xl border border-zinc-800">
        <div className="border-b border-zinc-800 px-4 py-3 text-sm font-semibold text-zinc-200">History</div>
        {data.events.length === 0 ? (
          <div className="px-4 py-8 text-sm text-zinc-400">No calibration events yet.</div>
        ) : (
          data.events.map((ev) => (
            <div key={ev.id} className="border-b border-zinc-900 px-4 py-3 text-sm">
              <div className="flex items-center justify-between">
                <div className="font-medium text-zinc-200">{formatDate(ev.calibratedAt)}</div>
                <div className="text-xs text-zinc-500">{ev.performedByEmail ?? '—'}</div>
              </div>
              {ev.notes ? <div className="mt-1 whitespace-pre-wrap text-zinc-300">{ev.notes}</div> : null}
            </div>
          ))
        )}
      </div>
    </div>
  );
}

function AddCalibration(props: { equipmentId: string; onSaved: (d: api.EquipmentDetail) => void }) {
  const [date, setDate] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  return (
    <div className="mt-3 space-y-3">
      <label className="block text-sm">
        <div className="mb-1 text-xs text-zinc-500">Calibrated on</div>
        <input
          type="date"
          className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
          value={date}
          onChange={(e) => setDate(e.target.value)}
        />
      </label>
      <label className="block text-sm">
        <div className="mb-1 text-xs text-zinc-500">Notes</div>
        <textarea
          className="min-h-20 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
          value={notes}
          onChange={(e) => setNotes(e.target.value)}
          placeholder="Optional"
        />
      </label>
      {error ? <div className="rounded-lg border border-red-900/60 bg-red-950/30 px-3 py-2 text-sm text-red-200">{error}</div> : null}
      <button
        className="w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
        disabled={busy}
        onClick={async () => {
          setError(null);
          setBusy(true);
          try {
            const iso = new Date(`${date}T12:00:00`).toISOString();
            const d = await api.addCalibrationEvent(props.equipmentId, { calibratedAt: iso, notes: notes.trim() || null });
            props.onSaved(d);
            setNotes('');
          } catch (e) {
            setError(e instanceof Error ? e.message : String(e));
          } finally {
            setBusy(false);
          }
        }}
      >
        {busy ? 'Saving…' : 'Save'}
      </button>
    </div>
  );
}

