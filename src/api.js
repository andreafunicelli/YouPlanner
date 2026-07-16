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

export async function getAuthConfig() { return api('/api/auth/config'); }

export async function loginWithLdap(username, password) {
  const data = await api('/api/auth/ldap', { method: 'POST', body: JSON.stringify({ username, password }) });
  setToken(data.token);
  return data;
}

export async function loginWithGoogle(email) {
  const data = await api('/api/auth/google', { method: 'POST', body: JSON.stringify({ email }) });
  setToken(data.token);
  return data;
}

export async function logoutSession() {
  const activeToken = token;
  setToken('');
  if (!activeToken) return { ok: true };
  return api('/api/auth/logout', { method: 'POST', headers: { Authorization: `Bearer ${activeToken}` } });
}

export async function bootstrap() { return api('/api/bootstrap'); }
export async function updateGlobalTweaks(payload) { return api('/api/tweaks/global', { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function updateMyTweaks(payload) { return api('/api/tweaks/me', { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function resetMyTweaks() { return api('/api/tweaks/me', { method: 'DELETE' }); }
export async function getNotifications() { return api('/api/notifications'); }
export async function getProfile() { return api('/api/profile'); }
export async function updateProfile(payload) { return api('/api/profile', { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function decideRequest(id, decision, reason) { return api(`/api/requests/${id}/decision`, { method: 'POST', body: JSON.stringify({ decision, reason }) }); }
export async function createRequest(payload) { return api('/api/requests', { method: 'POST', body: JSON.stringify(payload) }); }
export async function saveAssignment(payload) { return api('/api/assignments', { method: 'POST', body: JSON.stringify(payload) }); }
export async function createOnCall(payload) { return api('/api/oncall', { method: 'POST', body: JSON.stringify(payload) }); }
export async function createShift(payload) { return api('/api/shifts', { method: 'POST', body: JSON.stringify(payload) }); }
export async function createPerson(payload) { return api('/api/admin/people', { method: 'POST', body: JSON.stringify(payload) }); }
export async function getAdminUsers() { return api('/api/admin/users'); }
export async function createAdminUser(payload) { return api('/api/admin/users', { method: 'POST', body: JSON.stringify(payload) }); }
export async function updateAdminUser(id, payload) { return api(`/api/admin/users/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function deleteAdminUser(id) { return api(`/api/admin/users/${id}`, { method: 'DELETE' }); }
export async function getAdminBus() { return api('/api/admin/bus'); }
export async function createAdminBu(payload) { return api('/api/admin/bus', { method: 'POST', body: JSON.stringify(payload) }); }
export async function updateAdminBu(id, payload) { return api(`/api/admin/bus/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function deleteAdminBu(id) { return api(`/api/admin/bus/${id}`, { method: 'DELETE' }); }
export async function createManagerEmployee(payload) { return api('/api/manager/people', { method: 'POST', body: JSON.stringify(payload) }); }
export async function getFaq() { return api('/api/faq'); }
export async function changePassword(payload) { return api('/api/profile/password', { method: 'POST', body: JSON.stringify(payload) }); }
export async function updateClosureAssignment(closureId, payload) { return api(`/api/closures/${closureId}/assignment`, { method: 'POST', body: JSON.stringify(payload) }); }
export async function bulkUpdateClosureAssignments(updates) { return api('/api/closures/bulk-assignment', { method: 'POST', body: JSON.stringify({ updates }) }); }
export async function uploadAvatar(payload) { return api('/api/profile/avatar', { method: 'POST', body: JSON.stringify(payload) }); }
export async function getAdminClosures() { return api('/api/admin/closures'); }
export async function createAdminClosure(payload) { return api('/api/admin/closures', { method: 'POST', body: JSON.stringify(payload) }); }
export async function updateAdminClosure(id, payload) { return api(`/api/admin/closures/${id}`, { method: 'PATCH', body: JSON.stringify(payload) }); }
export async function deleteAdminClosure(id) { return api(`/api/admin/closures/${id}`, { method: 'DELETE' }); }
