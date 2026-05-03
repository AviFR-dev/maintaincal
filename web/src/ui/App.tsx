import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { Dashboard } from './Dashboard';
import { EquipmentDetail } from './EquipmentDetail';
import { EquipmentNew } from './EquipmentNew';
import { Login } from './Login';
import { Scan } from './Scan';
import { AdminPanel } from './AdminPanel';

type Route =
  | { name: 'login' }
  | { name: 'dashboard' }
  | { name: 'scan' }
  | { name: 'admin' }
  | { name: 'equipment'; id: string }
  | { name: 'newEquipment'; barcodeValue?: string };

function parseRoute(): Route {
  const hash = window.location.hash.replace(/^#/, '');
  const [path, query] = hash.split('?');
  const parts = (path || '').split('/').filter(Boolean);
  const qp = new URLSearchParams(query ?? '');

  if (parts[0] === 'equipment' && parts[1]) return { name: 'equipment', id: parts[1] };
  if (parts[0] === 'scan') return { name: 'scan' };
  if (parts[0] === 'admin') return { name: 'admin' };
  if (parts[0] === 'new') return { name: 'newEquipment', barcodeValue: qp.get('barcode') ?? undefined };
  if (parts[0] === 'login') return { name: 'login' };
  return { name: 'dashboard' };
}

function nav(to: Route) {
  if (to.name === 'dashboard') window.location.hash = '#/';
  if (to.name === 'login') window.location.hash = '#/login';
  if (to.name === 'scan') window.location.hash = '#/scan';
  if (to.name === 'admin') window.location.hash = '#/admin';
  if (to.name === 'equipment') window.location.hash = `#/equipment/${encodeURIComponent(to.id)}`;
  if (to.name === 'newEquipment') {
    const qp = new URLSearchParams();
    if (to.barcodeValue) qp.set('barcode', to.barcodeValue);
    window.location.hash = `#/new${qp.toString() ? `?${qp}` : ''}`;
  }
}

function TopBar(props: { user: api.PublicUser; onLogout: () => void }) {
  return (
    <div className="sticky top-0 z-10 border-b border-zinc-800 bg-zinc-950/80 backdrop-blur">
      <div className="mx-auto flex max-w-5xl items-center justify-between px-4 py-3">
        <div className="flex items-center gap-3">
          <button className="font-semibold tracking-tight text-zinc-50" onClick={() => nav({ name: 'dashboard' })}>
            MaintainCal
          </button>
          <div className="hidden h-5 w-px bg-zinc-800 sm:block" />
          <div className="hidden items-center gap-2 sm:flex">
            <NavButton onClick={() => nav({ name: 'dashboard' })}>Dashboard</NavButton>
            <NavButton onClick={() => nav({ name: 'scan' })}>Scan</NavButton>
            {props.user.role === 'admin' ? <NavButton onClick={() => nav({ name: 'admin' })}>Admin</NavButton> : null}
          </div>
        </div>

        <div className="flex items-center gap-2 text-sm text-zinc-300">
          <span className="hidden sm:inline truncate max-w-64">
            {props.user.email} ({props.user.role})
          </span>
          <button className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900" onClick={() => nav({ name: 'scan' })}>
            Scan
          </button>
          {props.user.role === 'admin' ? (
            <button className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900" onClick={() => nav({ name: 'admin' })}>
              Admin
            </button>
          ) : null}
          <button className="rounded-lg border border-zinc-700 px-3 py-1.5 hover:bg-zinc-900" onClick={props.onLogout}>
            Logout
          </button>
        </div>
      </div>
    </div>
  );
}

function NavButton(props: { onClick: () => void; children: React.ReactNode }) {
  return (
    <button className="rounded-lg px-3 py-1.5 text-sm text-zinc-300 hover:bg-zinc-900 hover:text-zinc-100" onClick={props.onClick}>
      {props.children}
    </button>
  );
}

export function App() {
  const [route, setRoute] = useState<Route>(() => parseRoute());
  const [user, setUser] = useState<api.PublicUser | null>(null);
  const [bootError, setBootError] = useState<string | null>(null);

  useEffect(() => {
    const onHash = () => setRoute(parseRoute());
    window.addEventListener('hashchange', onHash);
    return () => window.removeEventListener('hashchange', onHash);
  }, []);

  useEffect(() => {
    (async () => {
      try {
        const m = await api.me();
        setUser(m.user);
      } catch (e) {
        setBootError(e instanceof Error ? e.message : String(e));
      }
    })();
  }, []);

  useEffect(() => {
    if (!user && route.name !== 'login') nav({ name: 'login' });
  }, [user, route.name]);

  const content = useMemo(() => {
    if (bootError) {
      return (
        <div className="mx-auto max-w-3xl px-4 py-10">
          <div className="rounded-xl border border-red-900/60 bg-red-950/30 p-4">
            <div className="font-semibold">Startup error</div>
            <div className="mt-1 text-sm text-zinc-300">{bootError}</div>
            <div className="mt-3 text-sm text-zinc-300">Check that the API is running and `VITE_API_BASE` points to it.</div>
          </div>
        </div>
      );
    }

    if (!user) return <Login onAuthed={(u) => setUser(u)} />;

    if (route.name === 'scan')
      return (
        <Scan
          onFound={(barcode) => {
            api
              .getEquipmentByBarcode(barcode)
              .then((d) => nav({ name: 'equipment', id: d.equipment.id }))
              .catch(() => nav({ name: 'newEquipment', barcodeValue: barcode }));
          }}
        />
      );
    if (route.name === 'equipment') return <EquipmentDetail id={route.id} user={user} />;
    if (route.name === 'newEquipment') return <EquipmentNew barcodeValue={route.barcodeValue} user={user} onCreated={(id) => nav({ name: 'equipment', id })} />;
    if (route.name === 'admin') return <AdminPanel user={user} onOpenEquipment={(id) => nav({ name: 'equipment', id })} />;
    return <Dashboard user={user} onOpen={(id) => nav({ name: 'equipment', id })} onNew={() => nav({ name: 'newEquipment' })} />;
  }, [bootError, route, user]);

  return (
    <div className="min-h-screen bg-[radial-gradient(1200px_600px_at_20%_-10%,rgba(59,130,246,0.15),transparent),radial-gradient(1200px_600px_at_80%_-10%,rgba(168,85,247,0.12),transparent)]">
      {user ? (
        <TopBar
          user={user}
          onLogout={async () => {
            await api.logout();
            setUser(null);
            nav({ name: 'login' });
          }}
        />
      ) : null}
      {content}
    </div>
  );
}

