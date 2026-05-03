import React, { useState } from 'react';
import * as api from '../api';

export function EquipmentNew(props: { barcodeValue?: string; user: api.PublicUser; onCreated: (id: string) => void }) {
  const [name, setName] = useState('');
  const [barcodeValue, setBarcodeValue] = useState(props.barcodeValue ?? '');
  const [location, setLocation] = useState('');
  const [assetTag, setAssetTag] = useState('');
  const [model, setModel] = useState('');
  const [serialNumber, setSerialNumber] = useState('');
  const [intervalDays, setIntervalDays] = useState(365);
  const [graceDays, setGraceDays] = useState(0);
  const [lastCalibratedAt, setLastCalibratedAt] = useState(() => new Date().toISOString().slice(0, 10));
  const [notes, setNotes] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [busy, setBusy] = useState(false);

  if (props.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-xl border border-zinc-800 p-4 text-sm text-zinc-300">Only admins can create equipment.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="text-2xl font-semibold tracking-tight">New equipment</div>
      <div className="mt-1 text-sm text-zinc-400">Create a record and set its calibration interval.</div>

      <div className="mt-6 grid grid-cols-1 gap-4 rounded-2xl border border-zinc-800 p-5 sm:grid-cols-2">
        <Field label="Name" value={name} onChange={setName} placeholder="e.g. Balance #3" />
        <Field label="Barcode value" value={barcodeValue} onChange={setBarcodeValue} placeholder="Scan or type" mono />
        <Field label="Location" value={location} onChange={setLocation} placeholder="e.g. Lab A" />
        <Field label="Asset tag" value={assetTag} onChange={setAssetTag} placeholder="Optional" />
        <Field label="Model" value={model} onChange={setModel} placeholder="Optional" />
        <Field label="Serial number" value={serialNumber} onChange={setSerialNumber} placeholder="Optional" />

        <label className="block text-sm">
          <div className="mb-1 text-xs text-zinc-500">Interval (days)</div>
          <input
            type="number"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
            value={intervalDays}
            onChange={(e) => setIntervalDays(Number(e.target.value))}
            min={1}
          />
        </label>
        <label className="block text-sm">
          <div className="mb-1 text-xs text-zinc-500">Grace (days)</div>
          <input
            type="number"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
            value={graceDays}
            onChange={(e) => setGraceDays(Number(e.target.value))}
            min={0}
          />
        </label>
        <label className="block text-sm sm:col-span-2">
          <div className="mb-1 text-xs text-zinc-500">Last calibrated</div>
          <input
            type="date"
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
            value={lastCalibratedAt}
            onChange={(e) => setLastCalibratedAt(e.target.value)}
          />
        </label>

        <label className="block text-sm sm:col-span-2">
          <div className="mb-1 text-xs text-zinc-500">Notes</div>
          <textarea
            className="min-h-24 w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
            value={notes}
            onChange={(e) => setNotes(e.target.value)}
            placeholder="Optional"
          />
        </label>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-5 flex gap-2">
        <button
          className="rounded-lg bg-white px-4 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              const iso = new Date(`${lastCalibratedAt}T12:00:00`).toISOString();
              const d = await api.createEquipment({
                name: name.trim(),
                barcodeValue: barcodeValue.trim(),
                location: location.trim() || null,
                assetTag: assetTag.trim() || null,
                model: model.trim() || null,
                serialNumber: serialNumber.trim() || null,
                intervalDays,
                graceDays,
                lastCalibratedAt: iso,
                notes: notes.trim() || null,
              });
              props.onCreated(d.equipment.id);
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          {busy ? 'Creating…' : 'Create'}
        </button>
        <button className="rounded-lg border border-zinc-700 px-4 py-2 text-sm hover:bg-zinc-900" onClick={() => (window.location.hash = '#/')} disabled={busy}>
          Cancel
        </button>
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; mono?: boolean }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs text-zinc-500">{props.label}</div>
      <input
        className={`w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600 ${props.mono ? 'font-mono' : ''}`}
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </label>
  );
}

