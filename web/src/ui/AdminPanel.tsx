import React, { useEffect, useMemo, useState } from 'react';
import * as api from '../api';
import { Logs } from './Logs';

type Tab = 'users' | 'equipment' | 'logs';

export function AdminPanel(props: { user: api.PublicUser; onOpenEquipment: (id: string) => void }) {
  const [tab, setTab] = useState<Tab>('users');

  if (props.user.role !== 'admin') {
    return (
      <div className="mx-auto max-w-3xl px-4 py-10">
        <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 text-sm text-zinc-300">Admins only.</div>
      </div>
    );
  }

  return (
    <div className="mx-auto max-w-5xl px-4 py-6">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
        <div>
          <div className="text-2xl font-semibold tracking-tight">Admin</div>
          <div className="mt-1 text-sm text-zinc-400">Manage users, equipment, and view audit logs.</div>
        </div>
        <div className="flex gap-2">
          <TabButton active={tab === 'users'} onClick={() => setTab('users')}>
            Users
          </TabButton>
          <TabButton active={tab === 'equipment'} onClick={() => setTab('equipment')}>
            Equipment
          </TabButton>
          <TabButton active={tab === 'logs'} onClick={() => setTab('logs')}>
            Logs
          </TabButton>
        </div>
      </div>

      <div className="mt-6">
        {tab === 'users' ? (
          <UsersAdmin />
        ) : tab === 'equipment' ? (
          <EquipmentAdmin onOpen={props.onOpenEquipment} />
        ) : (
          <Logs user={props.user} />
        )}
      </div>
    </div>
  );
}

function TabButton(props: { active: boolean; onClick: () => void; children: React.ReactNode }) {
  return (
    <button
      onClick={props.onClick}
      className={`rounded-lg border px-3 py-2 text-sm hover:bg-zinc-900 ${
        props.active ? 'border-zinc-500 bg-zinc-900/40 text-zinc-100' : 'border-zinc-800 text-zinc-300'
      }`}
    >
      {props.children}
    </button>
  );
}

function UsersAdmin() {
  const [users, setUsers] = useState<api.AdminUser[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [role, setRole] = useState<api.Role>('user');

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.adminListUsers();
      setUsers(res.users);
    } catch (e) {
      setError(e instanceof Error ? e.message : String(e));
    } finally {
      setBusy(false);
    }
  }

  useEffect(() => {
    refresh();
  }, []);

  const sorted = useMemo(() => users.slice(), [users]);

  return (
    <div className="grid grid-cols-1 gap-4 md:grid-cols-3">
      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5 md:col-span-2">
        <div className="flex items-center justify-between">
          <div className="text-sm font-semibold text-zinc-200">Users</div>
          <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={refresh} disabled={busy}>
            Refresh
          </button>
        </div>

        {error ? <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}

        <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
          <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-400">
            <div className="col-span-7">Email</div>
            <div className="col-span-3">Role</div>
            <div className="col-span-2 text-right">Actions</div>
          </div>
          {sorted.map((u) => (
            <div key={u.id} className="grid grid-cols-12 items-center gap-2 border-b border-zinc-900 px-4 py-3 text-sm">
              <div className="col-span-7 truncate text-zinc-200">{u.email}</div>
              <div className="col-span-3">
                <RoleSelect
                  value={u.role}
                  onChange={async (next) => {
                    await api.adminPatchUser(u.id, { role: next });
                    await refresh();
                  }}
                />
              </div>
              <div className="col-span-2 text-right">
                <ResetPasswordButton
                  onReset={async (newPass) => {
                    await api.adminPatchUser(u.id, { password: newPass });
                  }}
                />
              </div>
            </div>
          ))}
          {sorted.length === 0 ? <div className="px-4 py-8 text-center text-sm text-zinc-400">{busy ? 'Loading…' : 'No users.'}</div> : null}
        </div>
      </div>

      <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
        <div className="text-sm font-semibold text-zinc-200">Create user</div>
        <div className="mt-3 space-y-3">
          <Field label="Email" value={email} onChange={setEmail} placeholder="user@lab.local" />
          <Field label="Password" value={password} onChange={setPassword} placeholder="Min 8 chars" type="password" />
          <label className="block text-sm">
            <div className="mb-1 text-xs text-zinc-500">Role</div>
            <select
              className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
              value={role}
              onChange={(e) => setRole(e.target.value as api.Role)}
            >
              <option value="user">user</option>
              <option value="admin">admin</option>
            </select>
          </label>
        </div>

        <button
          className="mt-4 w-full rounded-lg bg-white px-3 py-2 text-sm font-semibold text-zinc-950 hover:bg-zinc-200 disabled:opacity-60"
          disabled={busy}
          onClick={async () => {
            setError(null);
            setBusy(true);
            try {
              await api.adminCreateUser({ email: email.trim(), password, role });
              setEmail('');
              setPassword('');
              setRole('user');
              await refresh();
            } catch (e) {
              setError(e instanceof Error ? e.message : String(e));
            } finally {
              setBusy(false);
            }
          }}
        >
          Create
        </button>
      </div>
    </div>
  );
}

function RoleSelect(props: { value: api.Role; onChange: (r: api.Role) => void }) {
  return (
    <select
      className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-2 py-1 text-sm outline-none focus:border-zinc-600"
      value={props.value}
      onChange={(e) => props.onChange(e.target.value as api.Role)}
    >
      <option value="user">user</option>
      <option value="admin">admin</option>
    </select>
  );
}

function ResetPasswordButton(props: { onReset: (newPass: string) => Promise<void> }) {
  return (
    <button
      className="rounded-lg border border-zinc-700 px-2 py-1 text-xs hover:bg-zinc-900"
      onClick={async () => {
        const newPass = window.prompt('New password (min 8 chars):');
        if (!newPass) return;
        if (newPass.length < 8) {
          window.alert('Password must be at least 8 characters.');
          return;
        }
        await props.onReset(newPass);
        window.alert('Password updated.');
      }}
    >
      Reset
    </button>
  );
}

function EquipmentAdmin(props: { onOpen: (id: string) => void }) {
  const [items, setItems] = useState<api.EquipmentListItem[]>([]);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [search, setSearch] = useState('');
  const [location, setLocation] = useState('');
  const [status, setStatus] = useState<'active' | 'retired' | ''>('');
  const [model, setModel] = useState('');
  const [meta, setMeta] = useState<{ locations: string[]; models: string[] } | null>(null);

  async function refresh() {
    setError(null);
    setBusy(true);
    try {
      const res = await api.listEquipment({
        search: search.trim() || undefined,
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
        // ignore
      }
    })();
    refresh();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  return (
    <div className="rounded-2xl border border-zinc-800 bg-zinc-950 p-5">
      <div className="flex flex-col gap-2 sm:flex-row sm:items-center sm:justify-between">
        <div>
          <div className="text-sm font-semibold text-zinc-200">Equipment</div>
          <div className="mt-1 text-xs text-zinc-400">Open a record to view details and history.</div>
        </div>
        <div className="flex gap-2">
          <input
            className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 text-sm outline-none focus:border-zinc-600 sm:w-72"
            placeholder="Search…"
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') refresh();
            }}
          />
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
          <button className="rounded-lg border border-zinc-700 px-3 py-2 text-sm hover:bg-zinc-900" onClick={refresh} disabled={busy}>
            Refresh
          </button>
        </div>
      </div>

      {error ? <div className="mt-4 rounded-xl border border-red-900/60 bg-red-950/30 p-3 text-sm text-red-200">{error}</div> : null}

      <div className="mt-4 overflow-hidden rounded-xl border border-zinc-800">
        <div className="grid grid-cols-12 gap-2 border-b border-zinc-800 bg-zinc-950 px-4 py-2 text-xs text-zinc-400">
          <div className="col-span-6">Name</div>
          <div className="col-span-4">Barcode</div>
          <div className="col-span-2 text-right">Status</div>
        </div>
        {items.map((it) => (
          <button
            key={it.id}
            className="grid w-full grid-cols-12 gap-2 border-b border-zinc-900 px-4 py-3 text-left text-sm hover:bg-zinc-900/40"
            onClick={() => props.onOpen(it.id)}
          >
            <div className="col-span-6 truncate text-zinc-200">{it.name}</div>
            <div className="col-span-4 truncate font-mono text-xs text-zinc-300">{it.barcodeValue}</div>
            <div className="col-span-2 text-right text-zinc-300">{it.status}</div>
          </button>
        ))}
        {items.length === 0 ? <div className="px-4 py-8 text-center text-sm text-zinc-400">{busy ? 'Loading…' : 'No equipment.'}</div> : null}
      </div>
    </div>
  );
}

function Field(props: { label: string; value: string; onChange: (v: string) => void; placeholder?: string; type?: string }) {
  return (
    <label className="block text-sm">
      <div className="mb-1 text-xs text-zinc-500">{props.label}</div>
      <input
        type={props.type ?? 'text'}
        className="w-full rounded-lg border border-zinc-800 bg-zinc-950 px-3 py-2 outline-none focus:border-zinc-600"
        value={props.value}
        onChange={(e) => props.onChange(e.target.value)}
        placeholder={props.placeholder}
      />
    </label>
  );
}

