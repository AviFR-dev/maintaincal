import React, { useEffect, useRef, useState } from 'react';
import { BrowserMultiFormatReader, type IScannerControls } from '@zxing/browser';

export function Scan(props: { onFound: (barcodeValue: string) => void }) {
  const videoRef = useRef<HTMLVideoElement | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [last, setLast] = useState<string | null>(null);
  const [busy, setBusy] = useState(true);

  useEffect(() => {
    let stopped = false;
    const reader = new BrowserMultiFormatReader();
    let controls: IScannerControls | null = null;

    async function start() {
      setBusy(true);
      setError(null);
      try {
        const devices = await BrowserMultiFormatReader.listVideoInputDevices();
        const preferred = devices.find((d) => /back|rear|environment/i.test(d.label))?.deviceId ?? devices[0]?.deviceId;
        if (!preferred) throw new Error('No camera found');

        controls = await reader.decodeFromVideoDevice(preferred, videoRef.current!, (result, err) => {
          if (stopped) return;
          if (result) {
            const text = result.getText().trim();
            if (!text) return;
            setLast(text);
            // lock quickly to avoid repeated scans
            stopped = true;
            controls?.stop();
            props.onFound(text);
          } else if (err) {
            const name = (err as any)?.name;
            if (name !== 'NotFoundException') {
              setError(err instanceof Error ? err.message : String(err));
            }
          }
        });
      } catch (e) {
        setError(e instanceof Error ? e.message : String(e));
      } finally {
        setBusy(false);
      }
    }

    start();
    return () => {
      stopped = true;
      controls?.stop();
    };
  }, [props]);

  return (
    <div className="mx-auto max-w-3xl px-4 py-6">
      <div className="text-2xl font-semibold tracking-tight">Scan barcode</div>
      <div className="mt-1 text-sm text-zinc-400">Point your camera at the equipment barcode.</div>

      {error ? <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-5 overflow-hidden rounded-2xl border border-zinc-800 bg-black">
        <video ref={videoRef} className="aspect-video w-full" muted playsInline />
      </div>

      <div className="mt-3 text-sm text-zinc-400">
        {busy ? 'Starting camera…' : last ? `Last scan: ${last}` : 'Scanning…'}
      </div>
    </div>
  );
}

