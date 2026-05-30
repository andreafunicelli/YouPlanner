const API_BASE = import.meta.env.VITE_API_BASE || '';

export const DEMO_CREDENTIALS = {
  manager: { email: 'manager@peopleplanner.local', password: 'demo123' },
  dipendente: { email: 'employee@peopleplanner.local', password: 'demo123' },
  admin: { email: 'superadmin@peopleplanner.local', password: 'demo123' },
  managerEmpty: { email: 'manager-empty@peopleplanner.local', password: 'demo123' },
};

let token = localStorage.getItem('peopleplanner_token') || '';

export function setToken(nextToken) {
  token = nextToken || '';
  if (token) localStorage.setItem('peopleplanner_token', token);
  else localStorage.removeItem('peopleplanner_token');
}

export function getToken() { return token; }

export async function api(path, options = {}) {
  const headers = { 'Content-Type': 'application/json', ...(options.headers || {}) };
  if (token) headers.Authorization = `Bearer ${token}`;
  const res = await fetch(`${API_BASE}${path}`, { ...options, headers });
  const text = await res.text();
  const data = text ? JSON.parse(text) : null;
  if (!res.ok) {
    const err = new Error(data?.message || `Errore API ${res.status}`);
    err.status = res.status;
    err.payload = data;
    throw err;
  }
  return data;
}

export async function login(email, password) {
  const data = await api('/api/login', { method: 'POST', body: JSON.stringify({ email, password }) });
  setToken(data.token);
  return data;
}

export async function bootstrap() { return api('/api/bootstrap'); }
export async function getNotifications() { return api('/api/notifications'); }
export async function getProfile() { return api('/api/profile'); }
export async function updateProfile(payload) { return api('/api/profile', { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function decideRequest(id, decision, reason) { return api(`/api/requests/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) }); }
export async function createRequest(payload) { return api('/api/requests', { method: 'POST', body: JSON.stringify(payload) }); }
export async function saveAssignment(payload) { return api('/api/assignments', { method: 'POST', body: JSON.stringify(payload) }); }
export async function createOnCall(payload) { return api('/api/oncall', { method: 'POST', body: JSON.stringify(payload) }); }
export async function createShift(payload) { return api('/api/shifts', { method: 'POST', body: JSON.stringify(payload) }); }
export async function createPerson(payload) { return api('/api/admin/people', { method: 'POST', body: JSON.stringify(payload) }); }
export async function getFaq() { return api('/api/faq'); }
export async function changePassword(payload) { return api('/api/profile/password', { method: 'POST', body: JSON.stringify(payload) }); }
export async function updateClosureAssignment(closureId, payload) { return api(`/api/closures/${closureId}/assignment`, { method: 'POST', body: JSON.stringify(payload) }); }
export async function uploadAvatar(payload) { return api('/api/profile/avatar', { method: 'POST', body: JSON.stringify(payload) }); }
