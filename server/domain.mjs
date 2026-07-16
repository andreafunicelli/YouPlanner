import { randomUUID } from 'crypto';

const MS = 86400000;
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parseDate = (s) => {
  const [y, m, d] = String(s).split('-').map(Number);
  return new Date(y, m - 1, d);
};
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const todayKey = () => iso(new Date());

export function easter(year) {
  const a = year % 19;
  const b = Math.floor(year / 100);
  const c = year % 100;
  const d = Math.floor(b / 4);
  const e = b % 4;
  const f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3);
  const h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4);
  const k = c % 4;
  const l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

export function holidaysFor(year) {
  const e = easter(year);
  const em = addDays(e, 1);
  return {
    [`${year}-01-01`]: 'Capodanno',
    [`${year}-01-06`]: 'Epifania',
    [iso(e)]: 'Pasqua',
    [iso(em)]: "Lunedì dell'Angelo",
    [`${year}-04-25`]: 'Festa della Liberazione',
    [`${year}-05-01`]: 'Festa del Lavoro',
    [`${year}-06-02`]: 'Festa della Repubblica',
    [`${year}-08-15`]: 'Ferragosto',
    [`${year}-11-01`]: 'Ognissanti',
    [`${year}-12-08`]: 'Immacolata',
    [`${year}-12-25`]: 'Natale',
    [`${year}-12-26`]: 'Santo Stefano',
  };
}

export const STATUS = {
  ferie: { absent: true },
  malattia: { absent: true },
  permesso: { absent: true, partial: true },
  sw: { remote: true },
  festa: { absent: true },
  chiusura: { absent: true },
  presidio: {},
  turno: {},
  reperibilita: {},
};

export const clone = (obj) => JSON.parse(JSON.stringify(obj));
export const id = (prefix) => `${prefix}${randomUUID().slice(0, 8)}`;

export function daysBetween(from, to) {
  const out = [];
  for (let d = parseDate(from); d <= parseDate(to); d = addDays(d, 1)) out.push(iso(d));
  return out;
}

export function isWeekend(dateKey) {
  const d = parseDate(dateKey);
  return d.getDay() === 0 || d.getDay() === 6;
}

export function businessDays(state, from, to) {
  return daysBetween(from, to).filter((date) => !isWeekend(date) && !state.holidays[date] && !state.closures.some((c) => c.date === date)).length;
}

export function userScope(state, user) {
  if (!user) return { role: 'ANON', teamIds: [], employeeIds: [] };
  if (user.role === 'SUPER_ADMIN') return { role: user.role, teamIds: state.bus.map((b) => b.id), employeeIds: state.people.map((p) => p.id), all: true };
  if (user.role === 'ADMIN') {
    const managed = state.bus.filter((b) => b.managerId === user.employeeId).map((b) => b.id);
    return { role: user.role, teamIds: managed, employeeIds: state.people.filter((p) => managed.includes(p.bu)).map((p) => p.id) };
  }
  // Employee: include all BU colleagues so the calendar shows the full team
  const myBu = user.employeeId ? state.people.find((p) => p.id === user.employeeId)?.bu : null;
  const buColleagues = myBu ? state.people.filter((p) => p.bu === myBu).map((p) => p.id) : (user.employeeId ? [user.employeeId] : []);
  return { role: user.role, teamIds: myBu ? [myBu] : [], employeeIds: buColleagues };
}

export function scopedState(state, user) {
  const scope = userScope(state, user);
  if (scope.role === 'SUPER_ADMIN') {
    return {
      user,
      people: state.people,
      bus: state.bus,
      requests: [],
      shifts: [],
      oncall: [],
      closures: [],
      holidays: state.holidays,
      assign: {},
      notifications: [],
      globalTweaks: state.settings?.globalTweaks || {},
    };
  }
  const people = scope.all ? state.people : state.people.filter((p) => scope.employeeIds.includes(p.id));
  const empIds = new Set(people.map((p) => p.id));
  const teamIds = new Set(scope.teamIds);
  return {
    user,
    people,
    bus: scope.all ? state.bus : state.bus.filter((b) => teamIds.has(b.id)),
    requests: state.requests.filter((r) => empIds.has(r.empId)),
    shifts: scope.all ? state.shifts : state.shifts.filter((s) => empIds.has(s.empId) || teamIds.has(s.bu)),
    oncall: state.oncall.filter((o) => empIds.has(o.empId)),
    closures: state.closures,
    holidays: state.holidays,
    assign: Object.fromEntries(Object.entries(state.assign).filter(([key]) => empIds.has(key.split('|')[0]))),
    notifications: notificationsFor(state, user),
    globalTweaks: state.settings?.globalTweaks || {},
  };
}

export function getEntries(state, empId, date) {
  if (state.holidays[date]) return [{ type: 'festa', label: state.holidays[date] }];
  const closure = state.closures.find((c) => c.date === date);
  if (closure) return closure.presidio.includes(empId) ? [{ type: 'presidio', label: closure.label }] : [{ type: 'chiusura', label: closure.label }];
  return state.assign[`${empId}|${date}`] || [];
}

export function hasAbsenceOverlap(state, empId, from, to, includePending = true) {
  const dates = daysBetween(from, to);
  return state.requests.find((r) => {
    if (r.empId !== empId) return false;
    if (!includePending && r.status !== 'approved') return false;
    if (!['pending', 'approved'].includes(r.status)) return false;
    if (!['ferie', 'permesso', 'malattia'].includes(r.type)) return false;
    return dates.some((d) => d >= r.from && d <= r.to);
  }) || null;
}

export function hasOnCallOverlap(state, empId, from, to) {
  const dates = daysBetween(from, to);
  return state.oncall.find((o) => o.empId === empId && dates.some((d) => d >= o.from && d <= o.to)) || null;
}

export function hasFullAbsence(state, empId, from, to) {
  const dates = daysBetween(from, to);
  if (dates.length === 0) return false;
  return dates.every((d) => {
    const entries = getEntries(state, empId, d);
    if (entries.some((e) => e.type === 'ferie' || e.type === 'malattia')) return true;
    const hasRequest = state.requests.some((r) => {
      if (r.empId !== empId) return false;
      if (!['pending', 'approved'].includes(r.status)) return false;
      if (r.type !== 'ferie' && r.type !== 'malattia') return false;
      return d >= r.from && d <= r.to;
    });
    return hasRequest;
  });
}

export function dayConflict(state, people, date, thresholds = { absent: 3, remote: 3 }) {
  let absent = 0;
  let remote = 0;
  const absNames = [];
  const remNames = [];
  for (const p of people) {
    const entries = getEntries(state, p.id, date);
    if (entries.some((e) => STATUS[e.type]?.absent)) { absent++; absNames.push(p.name); }
    if (entries.some((e) => e.type === 'sw')) { remote++; remNames.push(p.name); }
  }
  return { absent, remote, absNames, remNames, absConf: absent >= thresholds.absent, remConf: remote >= thresholds.remote };
}

export function notificationsFor(state, user) {
  if (user.role === 'SUPER_ADMIN') return [];
  const scoped = userScope(state, user);
  const people = state.people.filter((p) => scoped.employeeIds.includes(p.id));
  const empIds = new Set(people.map((p) => p.id));
  const notifications = [];
  const pending = state.requests.filter((r) => empIds.has(r.empId) && r.status === 'pending');
  pending.forEach((r) => notifications.push({ id: `req-${r.id}`, kind: 'request', bu: state.people.find((p) => p.id === r.empId)?.bu, title: 'Richiesta in attesa', body: `${state.people.find((p) => p.id === r.empId)?.name}: ${r.type} ${r.from} → ${r.to}`, when: 'ora', unread: true }));
  const today = todayKey();
  const c = dayConflict(state, people, today);
  if (c.absConf) notifications.push({ id: 'conflict-today', kind: 'conflict', title: 'Soglia assenti superata oggi', body: `${c.absent} assenti: ${c.absNames.join(', ')}`, when: 'oggi', unread: true });
  const teamIds = new Set(scoped.teamIds);
  state.shifts.filter((s) => teamIds.has(s.bu) && (!s.empId || empIds.has(s.empId)) && s.status !== 'attivo').forEach((s) => notifications.push({ id: `shift-${s.id}`, kind: s.status === 'scoperto' ? 'uncovered' : 'expiring', bu: s.bu, title: s.status === 'scoperto' ? 'Turno scoperto' : 'Turno in scadenza/scaduto', body: `${s.title} · ${s.day} · ${s.time}`, when: 'oggi', unread: s.status !== 'attivo' }));
  return notifications;
}
