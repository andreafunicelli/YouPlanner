import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { readState, writeState, resetState } from './store.mjs';
import { businessDays, clone, getEntries, hasAbsenceOverlap, hasOnCallOverlap, hasFullAbsence, id, scopedState, userScope, daysBetween, todayKey } from './domain.mjs';
import { DEFAULT_TWEAKS, validateTweakEdits } from './tweaks.mjs';

const app = express();
const PORT = Number(process.env.PORT || 4174);
const IS_PRODUCTION = process.env.NODE_ENV === 'production';
if (!IS_PRODUCTION) app.use(cors());
app.use(express.json());

function publicUser(state, user) {
  if (!user) return null;
  const emp = user.employeeId ? state.people.find((p) => p.id === user.employeeId) : null;
  return { ...user, password: undefined, name: user.name || emp?.name, job: user.job || emp?.job, initials: user.initials || emp?.initials, av: user.av || emp?.av, bu: emp?.bu, ferie: emp?.ferie, permessi: emp?.permessi, ferieTot: emp?.ferieTot, permessiTot: emp?.permessiTot };
}

async function requireUser(req, res, next) {
  const state = await readState();
  const token = req.get('authorization')?.replace(/^Bearer\s+/i, '');
  const user = state.users.find((u) => u.id === token);
  if (!user) return res.status(401).json({ error: 'AUTH_REQUIRED', message: 'Login richiesto' });
  req.state = state;
  req.user = user;
  next();
}

const canOperateTeam = (state, user, bu) => user.role === 'ADMIN' && userScope(state, user).teamIds.includes(bu);
const isDateKey = (v) => /^\d{4}-\d{2}-\d{2}$/.test(String(v || ''));
const isRange = (from, to) => isDateKey(from) && isDateKey(to) && to >= from;

app.get('/api/health', (_req, res) => res.json({ ok: true, app: 'peopleplanner', now: new Date().toISOString() }));

app.post('/api/dev/reset', async (_req, res) => {
  if (IS_PRODUCTION) return res.status(404).json({ error: 'NOT_FOUND', message: 'Endpoint non disponibile' });
  res.json({ ok: true, state: await resetState() });
});

app.post('/api/login', async (req, res) => {
  const state = await readState();
  const { email, password } = req.body || {};
  const user = state.users.find((u) => u.email === email && u.password === password);
  if (!user) return res.status(401).json({ error: 'BAD_CREDENTIALS', message: 'Credenziali non valide' });
  res.json({ token: user.id, user: publicUser(state, user) });
});

app.get('/api/bootstrap', requireUser, (req, res) => {
  res.json({ ...scopedState(req.state, publicUser(req.state, req.user)), allBus: req.user.role === 'SUPER_ADMIN' ? req.state.bus : undefined });
});

app.patch('/api/tweaks/global', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo il Super Admin può modificare i Tweaks globali' });
  const edits = validateTweakEdits(req.body);
  if (!edits) return res.status(400).json({ error: 'BAD_TWEAKS', message: 'Configurazione Tweaks non valida' });
  const next = clone(req.state);
  next.settings = {
    ...(next.settings || {}),
    globalTweaks: { ...DEFAULT_TWEAKS, ...(next.settings?.globalTweaks || {}), ...edits },
  };
  await writeState(next);
  res.json({ globalTweaks: next.settings.globalTweaks, userTweaks: next.users.find((u) => u.id === req.user.id)?.tweaks || {} });
});

app.patch('/api/tweaks/me', requireUser, async (req, res) => {
  const edits = validateTweakEdits(req.body);
  if (!edits) return res.status(400).json({ error: 'BAD_TWEAKS', message: 'Configurazione Tweaks non valida' });
  const next = clone(req.state);
  next.users = next.users.map((user) => user.id === req.user.id
    ? { ...user, tweaks: { ...(user.tweaks || {}), ...edits } }
    : user);
  await writeState(next);
  res.json({ globalTweaks: next.settings?.globalTweaks || DEFAULT_TWEAKS, userTweaks: next.users.find((u) => u.id === req.user.id)?.tweaks || {} });
});

app.delete('/api/tweaks/me', requireUser, async (req, res) => {
  const next = clone(req.state);
  next.users = next.users.map((user) => user.id === req.user.id ? { ...user, tweaks: {} } : user);
  await writeState(next);
  res.json({ globalTweaks: next.settings?.globalTweaks || DEFAULT_TWEAKS, userTweaks: {} });
});

app.get('/api/dashboard', requireUser, (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Dashboard non disponibile per Super Admin' });
  const view = scopedState(req.state, publicUser(req.state, req.user));
  const today = todayKey();
  const employeesCount = view.people.length;
  let absentTodayCount = 0;
  let permitsTodayCount = 0;
  view.people.forEach((p) => {
    const entries = getEntries(req.state, p.id, today);
    if (entries.some((e) => ['ferie', 'malattia', 'festa', 'chiusura'].includes(e.type))) absentTodayCount++;
    if (entries.some((e) => e.type === 'permesso')) permitsTodayCount++;
  });
  res.json({ employeesCount, absentTodayCount, permitsTodayCount, pendingRequests: view.requests.filter((r) => r.status === 'pending').length, uncoveredShifts: view.shifts.filter((s) => s.status === 'scoperto').length });
});

app.post('/api/assignments', requireUser, async (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_NOT_ALLOWED', message: 'Super Admin non può modificare assegnazioni' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono modificare assegnazioni operative' });
  const { empId, date, entries } = req.body || {};
  if (!empId || !isDateKey(date) || !Array.isArray(entries)) return res.status(400).json({ error: 'BAD_INPUT', message: 'Dipendente, data e lista assegnazioni sono obbligatori' });
  if (!entries.every((e) => ['turno', 'sw', 'ferie', 'permesso', 'malattia', 'reperibilita'].includes(e.type))) return res.status(400).json({ error: 'BAD_ASSIGNMENT_TYPE', message: 'Tipo assegnazione non valido' });
  const emp = req.state.people.find((p) => p.id === empId);
  if (!emp || !canOperateTeam(req.state, req.user, emp.bu)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Dipendente fuori ambito' });
  if (req.state.holidays[date] || req.state.closures.some((c) => c.date === date)) return res.status(409).json({ error: 'LOCKED_DAY', message: 'Festività/chiusura non modificabile come assegnazione manuale' });
  const next = clone(req.state);
  if (!entries?.length) delete next.assign[`${empId}|${date}`];
  else next.assign[`${empId}|${date}`] = entries;
  await writeState(next);
  res.json(scopedState(next, publicUser(next, req.user)));
});

app.post('/api/requests', requireUser, async (req, res) => {
  if (!['EMPLOYEE', 'ADMIN'].includes(req.user.role)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Solo dipendenti e manager possono inserire richieste' });
  const { type, from, to, time, note, empId: bodyEmpId } = req.body || {};
  if (!['ferie', 'permesso', 'malattia', 'sw'].includes(type)) return res.status(400).json({ error: 'BAD_TYPE', message: 'Tipo richiesta non valido' });
  if (!isRange(from, to)) return res.status(400).json({ error: 'BAD_DATES', message: 'Intervallo date non valido' });
  let empId;
  if (req.user.role === 'ADMIN') {
    empId = bodyEmpId || req.user.employeeId;
    const emp = req.state.people.find((p) => p.id === empId);
    if (!emp || !canOperateTeam(req.state, req.user, emp.bu)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Dipendente fuori ambito' });
  } else {
    empId = req.user.employeeId;
  }
  const overlap = hasAbsenceOverlap(req.state, empId, from, to);
  if (overlap) return res.status(409).json({ error: 'REQUEST_OVERLAP', message: `Sovrapposizione con richiesta ${overlap.id}` });
  const days = type === 'ferie' || type === 'sw' ? businessDays(req.state, from, to) : undefined;
  if (['ferie', 'sw'].includes(type) && days === 0) return res.status(400).json({ error: 'NO_WORKING_DAYS', message: 'Il periodo contiene solo weekend/festività/chiusure' });
  const emp = req.state.people.find((p) => p.id === empId);
  if (type === 'ferie' && days > emp.ferie) return res.status(409).json({ error: 'INSUFFICIENT_BALANCE', message: 'Saldo ferie insufficiente' });
  const next = clone(req.state);
  const request = { id: id('r'), empId, type, from, to, days: type === 'ferie' || type === 'sw' ? days : undefined, hours: type === 'permesso' ? 4 : undefined, time: type === 'permesso' ? (time || '09:00–13:00') : undefined, status: 'pending', submitted: todayKey(), note: note || '' };
  next.requests.unshift(request);
  await writeState(next);
  res.status(201).json({ request, state: scopedState(next, publicUser(next, req.user)) });
});

app.post('/api/requests/:id/decision', requireUser, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono decidere richieste operative' });
  const { decision, reason } = req.body || {};
  if (!['approved', 'rejected'].includes(decision)) return res.status(400).json({ error: 'BAD_DECISION', message: 'Decisione non valida' });
  const request = req.state.requests.find((r) => r.id === req.params.id);
  if (!request) return res.status(404).json({ error: 'NOT_FOUND', message: 'Richiesta non trovata' });
  const emp = req.state.people.find((p) => p.id === request.empId);
  if (!canOperateTeam(req.state, req.user, emp.bu)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Richiesta fuori ambito' });
  if (decision === 'rejected' && String(reason || '').trim().length < 4) return res.status(400).json({ error: 'REASON_REQUIRED', message: 'Motivazione obbligatoria' });
  const next = clone(req.state);
  const idx = next.requests.findIndex((r) => r.id === request.id);
  next.requests[idx] = { ...next.requests[idx], status: decision, reason: decision === 'rejected' ? reason : undefined, decidedBy: req.user.employeeId || req.user.id };
  if (decision === 'approved') {
    for (const d of daysBetween(request.from, request.to)) {
      if (request.type === 'ferie' && businessDays(next, d, d) === 1) next.assign[`${request.empId}|${d}`] = [{ type: 'ferie' }];
      if (request.type === 'permesso') next.assign[`${request.empId}|${d}`] = [{ type: 'permesso', time: request.time, note: `${request.hours || 4}h` }];
      if (request.type === 'sw') next.assign[`${request.empId}|${d}`] = [{ type: 'sw' }];
      if (request.type === 'malattia') next.assign[`${request.empId}|${d}`] = [{ type: 'malattia' }];
    }
  }
  await writeState(next);
  res.json({ request: next.requests[idx], state: scopedState(next, publicUser(next, req.user)) });
});

app.post('/api/oncall', requireUser, async (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_NOT_ALLOWED', message: 'Super Admin non può assegnare reperibilità' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono assegnare reperibilità' });
  let { empId, from, to, time, note } = req.body || {};
  if (!empId || !isDateKey(from)) return res.status(400).json({ error: 'BAD_DATES', message: 'Dipendente e data di inizio validi sono obbligatori' });
  if (!to) {
    const d = new Date(from + 'T00:00:00');
    d.setDate(d.getDate() + 6);
    to = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }
  if (!isRange(from, to)) return res.status(400).json({ error: 'BAD_DATES', message: 'Intervallo date non valido' });
  const emp = req.state.people.find((p) => p.id === empId);
  if (!emp || !canOperateTeam(req.state, req.user, emp.bu)) return res.status(403).json({ error: 'FORBIDDEN', message: 'Dipendente fuori ambito' });
  if (hasOnCallOverlap(req.state, empId, from, to)) return res.status(409).json({ error: 'ONCALL_OVERLAP', message: 'Reperibilità già assegnata nel periodo' });
  if (hasFullAbsence(req.state, empId, from, to)) return res.status(409).json({ error: 'ABSENCE_CONFLICT', message: 'Il dipendente è in ferie/malattia per tutto il periodo selezionato' });
  const next = clone(req.state);
  const row = { id: id('o'), empId, bu: emp.bu, from, to, time: time || '18:00–08:00', note: note || '' };
  next.oncall.unshift(row);
  daysBetween(from, to).forEach((d) => { next.assign[`${empId}|${d}`] = [{ type: 'reperibilita', time: row.time, note: row.note }]; });
  await writeState(next);
  res.status(201).json({ oncall: row, state: scopedState(next, publicUser(next, req.user)) });
});

app.post('/api/shifts', requireUser, async (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_NOT_ALLOWED', message: 'Super Admin non può creare turni' });
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono creare turni operativi' });
  let { empId, title, bu, day, time, start, end, preset, weekStart, weekEnd, days } = req.body || {};
  if (preset) {
    const presets = {
      venerdi: { title: 'Venerdì 11-18', day: 'Ven', time: '11:00–18:00' },
      'presidio-italo': { title: 'Presidio Italo', day: 'Lun,Gio', time: '09:00–18:00' },
      agn: { title: 'AGN', day: 'Lun–Ven', time: '08:30–17:30' },
    };
    const p = presets[preset];
    if (!p) return res.status(400).json({ error: 'BAD_PRESET', message: 'Preset non valido' });
    title = title || p.title;
    day = day || p.day;
    time = time || p.time;
  }
  if (weekStart && weekEnd) {
    start = weekStart;
    end = weekEnd;
  }
  if (!canOperateTeam(req.state, req.user, bu)) return res.status(403).json({ error: 'FORBIDDEN', message: 'BU fuori ambito' });
  if (!title || !day || !time || !isDateKey(start) || (end && !isDateKey(end)) || (end && end < start)) return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Titolo, giorni, fascia e date valide sono obbligatori' });
  if (empId) {
    const emp = req.state.people.find((p) => p.id === empId);
    if (!emp || emp.bu !== bu) return res.status(400).json({ error: 'BAD_EMPLOYEE', message: 'Dipendente non coerente con BU' });
  }
  const duplicate = req.state.shifts.find((s) => s.bu === bu && s.day === day && s.time === time && s.empId && s.empId !== empId && s.status !== 'scaduto');
  if (duplicate && empId) return res.status(409).json({ error: 'DUPLICATE_SHIFT', message: 'Turno già assegnato a un altro dipendente' });
  const next = clone(req.state);
  const row = { id: id('s'), empId: empId || null, title, bu, day, time, start, end: end || null, status: empId ? 'attivo' : 'scoperto' };
  next.shifts.unshift(row);
  await writeState(next);
  res.status(201).json({ shift: row, state: scopedState(next, publicUser(next, req.user)) });
});

// --- SUPER ADMIN: Users CRUD ---
app.get('/api/admin/users', requireUser, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const users = req.state.users.map((u) => {
    const emp = u.employeeId ? req.state.people.find((p) => p.id === u.employeeId) : null;
    return { id: u.id, email: u.email, role: u.role, employeeId: u.employeeId, name: u.name || emp?.name, job: u.job || emp?.job, bu: emp?.bu, initials: u.initials || emp?.initials, av: u.av || emp?.av };
  });
  res.json({ users });
});

app.post('/api/admin/users', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const { email, password, role, name, bu, job, ferie, permessi } = req.body || {};
  if (!email || !password || !role || !name) return res.status(400).json({ error: 'BAD_INPUT', message: 'Email, password, ruolo e nome sono obbligatori' });
  if (!['ADMIN', 'EMPLOYEE'].includes(role)) return res.status(400).json({ error: 'BAD_ROLE', message: 'Ruolo deve essere ADMIN o EMPLOYEE' });
  if (req.state.users.some((u) => u.email === email)) return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'Email già registrata' });
  const next = clone(req.state);
  const newUserId = id('u');
  let empId = null;
  const parts = name.split(' ');
  const initials = ((parts[0]?.[0] || 'P') + (parts.at(-1)?.[0] || 'P')).toUpperCase();
  if (bu) {
    if (!next.bus.some((b) => b.id === bu)) return res.status(400).json({ error: 'BAD_BU', message: 'Business Unit non valida' });
    empId = id('e');
    next.people.push({
      id: empId, name, bu, role: role === 'ADMIN' ? 'manager' : 'dipendente', job: job || (role === 'ADMIN' ? 'BU Manager' : 'Dipendente'),
      ferie: Number(ferie || 26), permessi: Number(permessi || 32), ferieTot: 26, permessiTot: 32, initials, av: '#5B6472'
    });
  }
  next.users.push({
    id: newUserId, email, password, role, employeeId: empId, name, job: job || (role === 'ADMIN' ? 'BU Manager' : 'Dipendente'), initials, av: '#5B6472'
  });
  if (role === 'ADMIN' && bu) {
    const buIdx = next.bus.findIndex((b) => b.id === bu);
    if (buIdx >= 0) next.bus[buIdx] = { ...next.bus[buIdx], managerId: empId };
  }
  await writeState(next);
  const created = next.users.find((u) => u.id === newUserId);
  res.status(201).json({ user: { ...created, password: undefined, bu }, state: { ...scopedState(next, publicUser(next, req.user)), allBus: next.bus } });
});

app.patch('/api/admin/users/:id', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const { email, password, role, name, job, bu, ferie, permessi } = req.body || {};
  const next = clone(req.state);
  const uidx = next.users.findIndex((u) => u.id === req.params.id);
  if (uidx < 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Utente non trovato' });
  const user = next.users[uidx];
  if (user.role === 'SUPER_ADMIN') return res.status(403).json({ error: 'FORBIDDEN', message: 'Non puoi modificare il Super Admin' });
  if (email && next.users.some((u) => u.email === email && u.id !== user.id)) return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'Email già registrata' });
  const updates = {};
  if (email) updates.email = email;
  if (password) updates.password = password;
  if (name) updates.name = name;
  if (job) updates.job = job;
  if (role && ['ADMIN', 'EMPLOYEE'].includes(role)) updates.role = role;
  next.users[uidx] = { ...user, ...updates };
  if (user.employeeId) {
    const pidx = next.people.findIndex((p) => p.id === user.employeeId);
    if (pidx >= 0) {
      const pUpdates = {};
      if (name) pUpdates.name = name;
      if (job) pUpdates.job = job;
      if (role) pUpdates.role = role === 'ADMIN' ? 'manager' : 'dipendente';
      if (ferie !== undefined) pUpdates.ferie = Number(ferie);
      if (permessi !== undefined) pUpdates.permessi = Number(permessi);
      if (bu && bu !== next.people[pidx].bu) {
        if (!next.bus.some((b) => b.id === bu)) return res.status(400).json({ error: 'BAD_BU', message: 'Business Unit non valida' });
        pUpdates.bu = bu;
      }
      next.people[pidx] = { ...next.people[pidx], ...pUpdates };
    }
  }
  await writeState(next);
  const updated = next.users.find((u) => u.id === req.params.id);
  res.json({ user: { ...updated, password: undefined }, state: { ...scopedState(next, publicUser(next, req.user)), allBus: next.bus } });
});

app.delete('/api/admin/users/:id', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const next = clone(req.state);
  const uidx = next.users.findIndex((u) => u.id === req.params.id);
  if (uidx < 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Utente non trovato' });
  if (next.users[uidx].role === 'SUPER_ADMIN') return res.status(403).json({ error: 'FORBIDDEN', message: 'Non puoi eliminare il Super Admin' });
  const empId = next.users[uidx].employeeId;
  next.users.splice(uidx, 1);
  if (empId) {
    const pidx = next.people.findIndex((p) => p.id === empId);
    if (pidx >= 0) next.people.splice(pidx, 1);
    next.bus = next.bus.map((b) => b.managerId === empId ? { ...b, managerId: null } : b);
  }
  await writeState(next);
  res.json({ ok: true, state: { ...scopedState(next, publicUser(next, req.user)), allBus: next.bus } });
});

// --- SUPER ADMIN: BU CRUD ---
app.get('/api/admin/bus', requireUser, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const bus = req.state.bus.map((b) => {
    const mgr = b.managerId ? req.state.people.find((p) => p.id === b.managerId) : null;
    return { ...b, managerName: mgr?.name || null };
  });
  res.json({ bus });
});

app.post('/api/admin/bus', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const { name, color, managerId } = req.body || {};
  if (!name) return res.status(400).json({ error: 'BAD_INPUT', message: 'Nome BU obbligatorio' });
  const next = clone(req.state);
  const newBu = { id: id('bu'), name, color: color || '#5B6472', managerId: managerId || null };
  next.bus.push(newBu);
  await writeState(next);
  res.status(201).json({ bu: newBu, state: { ...scopedState(next, publicUser(next, req.user)), allBus: next.bus } });
});

app.patch('/api/admin/bus/:id', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const { name, color, managerId } = req.body || {};
  const next = clone(req.state);
  const bidx = next.bus.findIndex((b) => b.id === req.params.id);
  if (bidx < 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Business Unit non trovata' });
  const updates = {};
  if (name) updates.name = name;
  if (color) updates.color = color;
  if (managerId !== undefined) updates.managerId = managerId || null;
  next.bus[bidx] = { ...next.bus[bidx], ...updates };
  await writeState(next);
  res.json({ bu: next.bus[bidx], state: { ...scopedState(next, publicUser(next, req.user)), allBus: next.bus } });
});

app.delete('/api/admin/bus/:id', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const next = clone(req.state);
  const bidx = next.bus.findIndex((b) => b.id === req.params.id);
  if (bidx < 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Business Unit non trovata' });
  next.bus.splice(bidx, 1);
  await writeState(next);
  res.json({ ok: true, state: { ...scopedState(next, publicUser(next, req.user)), allBus: next.bus } });
});

// --- MANAGER: Create employee in own BU ---
app.post('/api/manager/people', requireUser, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono creare dipendenti' });
  const { name, email, password, job, ferie, permessi } = req.body || {};
  if (!name || !email || !password) return res.status(400).json({ error: 'BAD_INPUT', message: 'Nome, email e password sono obbligatori' });
  if (req.state.users.some((u) => u.email === email)) return res.status(409).json({ error: 'DUPLICATE_EMAIL', message: 'Email già registrata' });
  const scope = userScope(req.state, req.user);
  if (scope.teamIds.length === 0) return res.status(403).json({ error: 'FORBIDDEN', message: 'Nessuna BU assegnata' });
  const bu = scope.teamIds[0];
  const next = clone(req.state);
  const empId = id('e');
  const userId = id('u');
  const parts = name.split(' ');
  const initials = ((parts[0]?.[0] || 'P') + (parts.at(-1)?.[0] || 'P')).toUpperCase();
  next.people.push({
    id: empId, name, bu, role: 'dipendente', job: job || 'Dipendente',
    ferie: Number(ferie || 26), permessi: Number(permessi || 32), ferieTot: 26, permessiTot: 32, initials, av: '#5B6472'
  });
  next.users.push({
    id: userId, email, password, role: 'EMPLOYEE', employeeId: empId, name, job: job || 'Dipendente', initials, av: '#5B6472'
  });
  await writeState(next);
  res.status(201).json({ person: next.people.find((p) => p.id === empId), state: scopedState(next, publicUser(next, req.user)) });
});





app.get('/api/notifications', requireUser, (req, res) => {
  if (req.user.role === 'SUPER_ADMIN') {
    return res.json({ sections: [], notifications: [], message: 'Il Super Admin gestisce configurazione e utenti; le notifiche operative sono disponibili per manager e dipendenti.' });
  }
  const view = scopedState(req.state, publicUser(req.state, req.user));
  res.json({ notifications: view.notifications || [] });
});

app.get('/api/profile', requireUser, (req, res) => {
  res.json({ user: publicUser(req.state, req.user) });
});

app.patch('/api/profile', requireUser, async (req, res) => {
  const { name, job, av } = req.body || {};
  if (name !== undefined && String(name).trim().length < 2) return res.status(400).json({ error: 'BAD_NAME', message: 'Nome troppo corto' });
  if (job !== undefined && String(job).trim().length < 2) return res.status(400).json({ error: 'BAD_JOB', message: 'Ruolo/mansione troppo corto' });
  const next = clone(req.state);
  next.users = next.users.map((u) => u.id === req.user.id ? { ...u, ...(name !== undefined ? { name: String(name).trim() } : {}), ...(job !== undefined ? { job: String(job).trim() } : {}), ...(av !== undefined ? { av: String(av).trim() || u.av } : {}) } : u);
  if (req.user.employeeId) {
    next.people = next.people.map((p) => p.id === req.user.employeeId ? { ...p, ...(name !== undefined ? { name: String(name).trim() } : {}), ...(job !== undefined ? { job: String(job).trim() } : {}), ...(av !== undefined ? { av: String(av).trim() || p.av } : {}) } : p);
  }
  await writeState(next);
  const user = next.users.find((u) => u.id === req.user.id);
  res.json({ user: publicUser(next, user), state: scopedState(next, publicUser(next, user)) });
});

app.get('/api/faq', requireUser, (req, res) => {
  res.json({ sections: [
    { title: 'Dipendenti', items: ['Inserisci ferie/permessi da Le mie richieste.', 'Le festività italiane e le chiusure non scalano ferie.'] },
    ...(req.user.role !== 'EMPLOYEE' ? [{ title: 'Manager', items: ['Approva o rifiuta solo richieste delle BU assegnate.', 'Un manager senza BU assegnate vede zero record operativi.'] }] : []),
    ...(req.user.role === 'SUPER_ADMIN' ? [{ title: 'Super Admin', items: ['Gestisce persone e Business Unit; non opera sui dati fuori regola di scope manager.'] }] : []),
  ] });
});

app.post('/api/profile/password', requireUser, async (req, res) => {
  const { currentPassword, newPassword } = req.body || {};
  if (req.user.password !== currentPassword) return res.status(401).json({ error: 'BAD_PASSWORD', message: 'Password attuale errata' });
  if (String(newPassword || '').length < 6) return res.status(400).json({ error: 'WEAK_PASSWORD', message: 'Nuova password troppo corta' });
  const next = clone(req.state);
  next.users = next.users.map((u) => u.id === req.user.id ? { ...u, password: newPassword } : u);
  await writeState(next);
  res.json({ ok: true });
});

app.post('/api/profile/avatar', requireUser, async (req, res) => {
  const { avatar } = req.body || {};
  if (!avatar) return res.status(400).json({ error: 'BAD_INPUT', message: 'Avatar obbligatorio' });
  const next = clone(req.state);
  next.users = next.users.map((u) => u.id === req.user.id ? { ...u, avatar } : u);
  await writeState(next);
  const user = next.users.find((u) => u.id === req.user.id);
  res.json({ user: publicUser(next, user) });
});

app.post('/api/closures/:id/assignment', requireUser, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono modificare le assegnazioni chiusure' });
  const { presidio } = req.body || {};
  if (!Array.isArray(presidio)) return res.status(400).json({ error: 'BAD_INPUT', message: 'Lista presidio obbligatoria' });
  const closure = req.state.closures.find((c) => c.id === req.params.id);
  if (!closure) return res.status(404).json({ error: 'NOT_FOUND', message: 'Chiusura non trovata' });
  const next = clone(req.state);
  const idx = next.closures.findIndex((c) => c.id === req.params.id);
  next.closures[idx] = { ...next.closures[idx], presidio };
  await writeState(next);
  res.json({ closure: next.closures[idx], state: scopedState(next, publicUser(next, req.user)) });
});

app.post('/api/closures/bulk-assignment', requireUser, async (req, res) => {
  if (req.user.role !== 'ADMIN') return res.status(403).json({ error: 'ADMIN_ONLY', message: 'Solo i manager possono modificare le assegnazioni chiusure' });
  const { updates } = req.body || {};
  if (!Array.isArray(updates)) return res.status(400).json({ error: 'BAD_INPUT', message: 'Array updates obbligatorio' });
  const next = clone(req.state);
  for (const u of updates) {
    const idx = next.closures.findIndex((c) => c.id === u.closureId);
    if (idx >= 0 && Array.isArray(u.presidio)) {
      next.closures[idx] = { ...next.closures[idx], presidio: u.presidio };
    }
  }
  await writeState(next);
  res.json({ state: scopedState(next, publicUser(next, req.user)) });
});

// --- Super Admin: CRUD closures ---
app.get('/api/admin/closures', requireUser, (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo il Super Admin può gestire le chiusure' });
  res.json({ closures: req.state.closures });
});

app.post('/api/admin/closures', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo il Super Admin può creare chiusure' });
  const { date, to, label } = req.body || {};
  if (!date || !label) return res.status(400).json({ error: 'MISSING_FIELDS', message: 'Data e label obbligatorie' });
  if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'INVALID_DATE', message: 'Formato data non valido (YYYY-MM-DD)' });
  const next = clone(req.state);
  const dates = daysBetween(date, to && to >= date ? to : date);
  const created = [];
  for (const d of dates) {
    if (next.closures.some((c) => c.date === d)) continue;
    const entry = { id: id('c'), date: d, label, presidio: [] };
    next.closures.push(entry);
    created.push(entry);
  }
  if (!created.length) return res.status(409).json({ error: 'ALL_DUPLICATES', message: 'Tutte le date esistono già come chiusure' });
  await writeState(next);
  res.json({ closures: created });
});

app.patch('/api/admin/closures/:id', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo il Super Admin può modificare le chiusure' });
  const { label, date } = req.body || {};
  const next = clone(req.state);
  const idx = next.closures.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Chiusura non trovata' });
  if (label) next.closures[idx].label = label;
  if (date) {
    if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) return res.status(400).json({ error: 'INVALID_DATE', message: 'Formato data non valido' });
    next.closures[idx].date = date;
  }
  await writeState(next);
  res.json({ closure: next.closures[idx] });
});

app.delete('/api/admin/closures/:id', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo il Super Admin può eliminare le chiusure' });
  const next = clone(req.state);
  const idx = next.closures.findIndex((c) => c.id === req.params.id);
  if (idx < 0) return res.status(404).json({ error: 'NOT_FOUND', message: 'Chiusura non trovata' });
  next.closures.splice(idx, 1);
  await writeState(next);
  res.json({ ok: true });
});


app.use(express.static('dist'));
app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: 'dist' }));

export { app };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  const HOST = process.env.HOST || '127.0.0.1';
  app.listen(PORT, HOST, () => console.log(`PeoplePlanner app listening on http://${HOST}:${PORT}`));
}
