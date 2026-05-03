// Default to same-origin (recommended). In dev, Vite proxies `/api` to the API.
const API_BASE = import.meta.env.VITE_API_BASE ?? '/api';

export type Role = 'admin' | 'user';
export type PublicUser = { id: string; email: string; role: Role };

async function request(path: string, init?: RequestInit) {
  const res = await fetch(`${API_BASE}${path}`, {
    credentials: 'include',
    headers: {
      'content-type': 'application/json',
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  const text = await res.text();
  const data = text ? JSON.parse(text) : null;

  if (!res.ok) {
    const message = data?.error ?? `HTTP ${res.status}`;
    throw new Error(message);
  }
  return data;
}

export async function health() {
  return request('/health');
}

export async function me(): Promise<{ user: PublicUser | null }> {
  return request('/me');
}

export async function login(email: string, password: string): Promise<{ user: PublicUser }> {
  return request('/auth/login', { method: 'POST', body: JSON.stringify({ email, password }) });
}

export async function logout(): Promise<{ ok: true }> {
  return request('/auth/logout', { method: 'POST', body: JSON.stringify({}) });
}

export type EquipmentListItem = {
  id: string;
  name: string;
  barcodeValue: string;
  assetTag: string | null;
  location: string | null;
  model: string | null;
  serialNumber: string | null;
  status: string;
  intervalDays: number;
  graceDays: number;
  lastCalibratedAt: string | null;
  nextDueAt: string | null;
  updatedAt: string;
};

export type EquipmentDetail = {
  equipment: {
    id: string;
    name: string;
    barcodeValue: string;
    assetTag: string | null;
    location: string | null;
    model: string | null;
    serialNumber: string | null;
    status: string;
    notes: string | null;
    createdAt: string;
    updatedAt: string;
  };
  rule: {
    intervalDays: number;
    graceDays: number;
    lastCalibratedAt: string | null;
    nextDueAt: string | null;
  } | null;
  events: Array<{
    id: string;
    calibratedAt: string;
    performedByUserId: string | null;
    performedByEmail: string | null;
    notes: string | null;
    createdAt: string;
  }>;
};

export async function listEquipment(params?: { search?: string; due?: 'overdue' | 'dueSoon'; location?: string; status?: 'active' | 'retired'; model?: string }) {
  const usp = new URLSearchParams();
  if (params?.search) usp.set('search', params.search);
  if (params?.due) usp.set('due', params.due);
  if (params?.location) usp.set('location', params.location);
  if (params?.status) usp.set('status', params.status);
  if (params?.model) usp.set('model', params.model);
  const qs = usp.toString() ? `?${usp.toString()}` : '';
  return request(`/equipment${qs}`) as Promise<{ items: EquipmentListItem[] }>;
}

export async function equipmentMeta(): Promise<{ locations: string[]; models: string[]; statuses: Array<'active' | 'retired'> }> {
  return request('/equipment/meta');
}

export async function getEquipment(id: string): Promise<EquipmentDetail> {
  return request(`/equipment/${encodeURIComponent(id)}`);
}

export async function getEquipmentByBarcode(value: string): Promise<EquipmentDetail> {
  return request(`/equipment/by-barcode/${encodeURIComponent(value)}`);
}

export async function createEquipment(input: {
  name: string;
  barcodeValue: string;
  assetTag?: string | null;
  location?: string | null;
  model?: string | null;
  serialNumber?: string | null;
  status?: 'active' | 'retired';
  notes?: string | null;
  intervalDays: number;
  graceDays?: number;
  lastCalibratedAt?: string | null;
}): Promise<EquipmentDetail> {
  return request(`/equipment`, { method: 'POST', body: JSON.stringify(input) });
}

export async function addCalibrationEvent(equipmentId: string, input: { calibratedAt: string; notes?: string | null }): Promise<EquipmentDetail> {
  return request(`/equipment/${encodeURIComponent(equipmentId)}/calibration-events`, { method: 'POST', body: JSON.stringify(input) });
}

export type AdminUser = { id: string; email: string; role: Role; createdAt: string };

export async function adminListUsers(): Promise<{ users: AdminUser[] }> {
  return request('/admin/users');
}

export async function adminCreateUser(input: { email: string; password: string; role: Role }): Promise<{ ok: true }> {
  return request('/admin/users', { method: 'POST', body: JSON.stringify(input) });
}

export async function adminPatchUser(id: string, patch: { role?: Role; password?: string }): Promise<{ ok: true }> {
  return request(`/admin/users/${encodeURIComponent(id)}`, { method: 'PATCH', body: JSON.stringify(patch) });
}

