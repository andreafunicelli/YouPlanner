import express from 'express';
import cors from 'cors';
import { fileURLToPath } from 'url';
import { readState, writeState, resetState } from './store.mjs';
import { businessDays, clone, getEntries, hasAbsenceOverlap, hasOnCallOverlap, hasFullAbsence, id, scopedState, userScope, daysBetween, todayKey } from './domain.mjs';

const app = express();
const PORT = Number(process.env.PORT || 4174);
app.use(cors());
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

app.post('/api/dev/reset', async (_req, res) => res.json({ ok: true, state: await resetState() }));

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
  if (req.user.role !== 'EMPLOYEE') return res.status(403).json({ error: 'EMPLOYEE_ONLY', message: 'Solo i dipendenti possono inserire richieste personali' });
  const { type, from, to, time, note } = req.body || {};
  if (!['ferie', 'permesso', 'malattia', 'sw'].includes(type)) return res.status(400).json({ error: 'BAD_TYPE', message: 'Tipo richiesta non valido' });
  if (!isRange(from, to)) return res.status(400).json({ error: 'BAD_DATES', message: 'Intervallo date non valido' });
  const empId = req.user.employeeId;
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

app.post('/api/admin/people', requireUser, async (req, res) => {
  if (req.user.role !== 'SUPER_ADMIN') return res.status(403).json({ error: 'SUPERADMIN_ONLY', message: 'Solo Super Admin' });
  const { name, bu, role = 'dipendente', job = 'Dipendente', ferie = 26, permessi = 32 } = req.body || {};
  if (!name || !bu || !req.state.bus.some((b) => b.id === bu)) return res.status(400).json({ error: 'BAD_INPUT', message: 'Nome e BU validi obbligatori' });
  const next = clone(req.state);
  const parts = name.split(' ');
  const emp = { id: id('e'), name, bu, role, job, ferie: Number(ferie), permessi: Number(permessi), ferieTot: 26, permessiTot: 32, initials: ((parts[0]?.[0] || 'P') + (parts.at(-1)?.[0] || 'P')).toUpperCase(), av: '#5B6472' };
  next.people.push(emp);
  await writeState(next);
  res.status(201).json({ person: emp, state: scopedState(next, publicUser(next, req.user)) });
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

app.use(express.static('dist'));
app.get(/.*/, (_req, res) => res.sendFile('index.html', { root: 'dist' }));

export { app };

if (process.argv[1] === fileURLToPath(import.meta.url)) {
  app.listen(PORT, '127.0.0.1', () => console.log(`PeoplePlanner app listening on http://127.0.0.1:${PORT}`));
}
