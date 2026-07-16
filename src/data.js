const MS = 86400000; // eslint-disable-line no-unused-vars
const pad = (n) => String(n).padStart(2, '0');
export const iso = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
export const parse = (s) => { const [y, m, dd] = s.split('-').map(Number); return new Date(y, m - 1, dd); };
export const addDays = (d, n) => new Date(d.getFullYear(), d.getMonth(), d.getDate() + n);
export const mondayOf = (d) => { const x = new Date(d.getFullYear(), d.getMonth(), d.getDate()); const wd = (x.getDay() + 6) % 7; return addDays(x, -wd); };

export const TODAY = new Date();
export const monthStart = (date = TODAY) => new Date(date.getFullYear(), date.getMonth(), 1);
export const defaultRequestDates = (date = TODAY) => ({
  from: iso(date),
  to: iso(addDays(date, 2)),
});

export const DOW = ['Lun', 'Mar', 'Mer', 'Gio', 'Ven', 'Sab', 'Dom'];
export const MONTHS = ['gennaio','febbraio','marzo','aprile','maggio','giugno','luglio','agosto','settembre','ottobre','novembre','dicembre'];

export const fmtRange = (a, b) => {
  const A = parse(a), B = parse(b);
  if (a === b) return `${A.getDate()} ${MONTHS[A.getMonth()]}`;
  if (A.getMonth() === B.getMonth()) return `${A.getDate()}–${B.getDate()} ${MONTHS[A.getMonth()]}`;
  return `${A.getDate()} ${MONTHS[A.getMonth()].slice(0,3)} – ${B.getDate()} ${MONTHS[B.getMonth()].slice(0,3)}`;
};

function easter(year) {
  const a = year % 19, b = Math.floor(year / 100), c = year % 100;
  const d = Math.floor(b / 4), e = b % 4, f = Math.floor((b + 8) / 25);
  const g = Math.floor((b - f + 1) / 3), h = (19 * a + b - d - g + 15) % 30;
  const i = Math.floor(c / 4), k = c % 4, l = (32 + 2 * e + 2 * i - h - k) % 7;
  const m = Math.floor((a + 11 * h + 22 * l) / 451);
  const month = Math.floor((h + l - 7 * m + 114) / 31);
  const day = ((h + l - 7 * m + 114) % 31) + 1;
  return new Date(year, month - 1, day);
}

function holidaysFor(year) {
  const e = easter(year), em = addDays(e, 1);
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

export { holidaysFor };
export const HOLIDAYS = { ...holidaysFor(2026) };

export const CLOSURES = [
  { date: '2026-01-02', label: 'Chiusura Capodanno', presidio: [] },
  { date: '2026-01-03', label: 'Chiusura Capodanno', presidio: [] },
  { date: '2026-01-04', label: 'Chiusura Capodanno', presidio: [] },
  { date: '2026-01-05', label: 'Chiusura Capodanno', presidio: [] },
  { date: '2026-02-20', label: 'Carnevale', presidio: [] },
  { date: '2026-04-03', label: 'Ponte Pasqua', presidio: [] },
  { date: '2026-04-07', label: 'Ponte Pasqua', presidio: [] },
  { date: '2026-06-01', label: 'Ponte Festa della Repubblica', presidio: [] },
  { date: '2026-08-10', label: 'Chiusura estiva', presidio: ['e10'] },
  { date: '2026-08-11', label: 'Chiusura estiva', presidio: ['e10'] },
  { date: '2026-08-12', label: 'Chiusura estiva', presidio: ['e10'] },
  { date: '2026-08-13', label: 'Chiusura estiva', presidio: ['e10'] },
  { date: '2026-08-14', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-17', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-18', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-19', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-20', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-21', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-24', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-08-25', label: 'Chiusura estiva', presidio: [] },
  { date: '2026-12-24', label: 'Chiusura Natalizia', presidio: ['e11'] },
  { date: '2026-12-25', label: 'Chiusura Natalizia', presidio: [] },
  { date: '2026-12-26', label: 'Chiusura Natalizia', presidio: [] },
  { date: '2026-12-27', label: 'Chiusura Natalizia', presidio: ['e11'] },
  { date: '2026-12-28', label: 'Chiusura Natalizia', presidio: [] },
  { date: '2026-12-29', label: 'Chiusura Natalizia', presidio: ['e11'] },
  { date: '2026-12-30', label: 'Chiusura Natalizia', presidio: [] },
  { date: '2026-12-31', label: 'Chiusura Natalizia', presidio: [] },
  { date: '2027-01-04', label: 'Chiusura Epifania', presidio: [] },
  { date: '2027-01-05', label: 'Chiusura Epifania', presidio: [] },
];

export const BUS = [
  { id: 'bu1', name: 'Sviluppo Software', managerId: 'e1', color: '#E03127' },
  { id: 'bu2', name: 'Customer Support', managerId: 'e6', color: '#2D7FF0' },
  { id: 'bu3', name: 'Infrastruttura & Cloud', managerId: 'e10', color: '#0E9D94' },
];

const AV = ['#E03127','#2D7FF0','#0E9D94','#7C5CF0','#E08A1E','#2E9E5B','#C2456B','#5B6472','#0F766E','#B45309','#1559BD','#6D28D9','#9A1B30'];

export const PEOPLE = [
  { id:'e1',  name:'Elena Conti',        bu:'bu1', role:'manager',    job:'BU Manager',      ferie:14, permessi:22 },
  { id:'e2',  name:'Luca Ferrari',       bu:'bu1', role:'dipendente', job:'Senior Dev',       ferie:18, permessi:16 },
  { id:'e3',  name:'Giulia Romano',      bu:'bu1', role:'dipendente', job:'Frontend Dev',     ferie:9,  permessi:8  },
  { id:'e4',  name:'Matteo Bruno',       bu:'bu1', role:'dipendente', job:'Backend Dev',      ferie:21, permessi:20 },
  { id:'e5',  name:'Sara Gallo',         bu:'bu1', role:'dipendente', job:'QA Engineer',      ferie:6,  permessi:4  },
  { id:'e6',  name:'Marco Riva',         bu:'bu2', role:'manager',    job:'BU Manager',       ferie:11, permessi:18 },
  { id:'e7',  name:'Francesca Costa',    bu:'bu2', role:'dipendente', job:'Support Lead',     ferie:16, permessi:12 },
  { id:'e8',  name:'Alessandro Rizzo',   bu:'bu2', role:'dipendente', job:'Support Agent',    ferie:20, permessi:24 },
  { id:'e9',  name:'Chiara De Luca',     bu:'bu2', role:'dipendente', job:'Support Agent',    ferie:13, permessi:10 },
  { id:'e10', name:'Davide Greco',       bu:'bu3', role:'manager',    job:'BU Manager',       ferie:9,  permessi:15 },
  { id:'e11', name:'Paolo Marino',       bu:'bu3', role:'dipendente', job:'SysAdmin',         ferie:17, permessi:20 },
  { id:'e12', name:'Valentina Esposito', bu:'bu3', role:'dipendente', job:'Cloud Engineer',   ferie:22, permessi:18 },
  { id:'e13', name:'Simone Ricci',       bu:'bu3', role:'dipendente', job:'DevOps',           ferie:8,  permessi:6  },
];

PEOPLE.forEach((p, i) => {
  const parts = p.name.split(' ');
  p.initials = (parts[0][0] + parts[parts.length - 1][0]).toUpperCase();
  p.av = AV[i % AV.length];
  p.ferieTot = 26; p.permessiTot = 32;
});

export const SUPERADMIN = { id:'admin', name:'Anna Vitali', job:'Super Admin', initials:'AV', av:'#17120F' };

const ASSIGN_BASE = {};
const set = (emp, date, entries) => { ASSIGN_BASE[`${emp}|${date}`] = entries; };
const E = (type, extra = {}) => ({ type, ...extra });

set('e2','2026-05-25',[E('ferie')]);
set('e3','2026-05-25',[E('ferie')]);
set('e4','2026-05-25',[E('sw')]);
set('e5','2026-05-25',[E('turno',{time:'11:00–18:00'})]);
set('e2','2026-05-26',[E('ferie')]);
set('e3','2026-05-26',[E('ferie')]);
set('e5','2026-05-26',[E('ferie')]);
set('e4','2026-05-26',[E('sw')]);
set('e2','2026-05-27',[E('sw')]);
set('e4','2026-05-27',[E('sw')]);
set('e5','2026-05-27',[E('sw')]);
set('e3','2026-05-27',[E('turno',{time:'09:00–17:00'})]);
set('e3','2026-05-28',[E('permesso',{time:'14:00–18:00', note:'4h'})]);
set('e4','2026-05-28',[E('ferie')]);
set('e1','2026-05-28',[E('reperibilita',{time:'18:00–08:00'})]);
set('e5','2026-05-29',[E('ferie')]);
set('e2','2026-05-29',[E('malattia')]);
set('e3','2026-05-29',[E('sw')]);
set('e4','2026-05-29',[E('turno',{time:'11:00–18:00'})]);
set('e1','2026-05-29',[E('reperibilita',{time:'18:00–08:00'})]);
set('e4','2026-05-30',[E('reperibilita',{time:'09:00–21:00'})]);
set('e4','2026-05-31',[E('reperibilita',{time:'09:00–21:00'})]);

set('e7','2026-05-25',[E('turno',{time:'08:00–16:00'})]);
set('e8','2026-05-25',[E('turno',{time:'14:00–22:00'})]);
set('e9','2026-05-25',[E('sw')]);
set('e7','2026-05-26',[E('turno',{time:'08:00–16:00'})]);
set('e8','2026-05-26',[E('ferie')]);
set('e9','2026-05-26',[E('turno',{time:'14:00–22:00'})]);
set('e7','2026-05-27',[E('sw')]);
set('e9','2026-05-27',[E('permesso',{time:'09:00–13:00',note:'4h'})]);
set('e8','2026-05-28',[E('turno',{time:'14:00–22:00'})]);
set('e7','2026-05-29',[E('turno',{time:'08:00–16:00'})]);
set('e8','2026-05-29',[E('ferie')]);
set('e6','2026-05-29',[E('reperibilita',{time:'16:00–24:00'})]);

set('e11','2026-05-25',[E('turno',{time:'09:00–18:00'})]);
set('e12','2026-05-25',[E('sw')]);
set('e13','2026-05-26',[E('ferie')]);
set('e11','2026-05-26',[E('sw')]);
set('e12','2026-05-27',[E('turno',{time:'09:00–18:00'})]);
set('e10','2026-05-27',[E('reperibilita',{time:'00:00–24:00',note:'H24'})]);
set('e13','2026-05-28',[E('sw')]);
set('e11','2026-05-29',[E('turno',{time:'09:00–18:00'})]);
set('e12','2026-05-29',[E('ferie')]);

export const ASSIGN = ASSIGN_BASE;

export const REQUESTS = [
  { id:'r1', empId:'e2', type:'ferie',    from:'2026-06-08', to:'2026-06-12', days:5, status:'pending', submitted:'2026-05-26', note:'Vacanza famiglia' },
  { id:'r2', empId:'e5', type:'permesso', from:'2026-06-03', to:'2026-06-03', hours:4, time:'14:00–18:00', status:'pending', submitted:'2026-05-27', note:'Visita medica' },
  { id:'r3', empId:'e4', type:'ferie',    from:'2026-06-01', to:'2026-06-02', days:2, status:'pending', submitted:'2026-05-28', note:'', flagHoliday:true },
  { id:'r4', empId:'e3', type:'ferie',    from:'2026-06-09', to:'2026-06-10', days:2, status:'pending', submitted:'2026-05-28', note:'' },
  { id:'r5', empId:'e8', type:'ferie',    from:'2026-06-15', to:'2026-06-19', days:5, status:'pending', submitted:'2026-05-25', note:'' },
  { id:'r6', empId:'e3', type:'ferie',    from:'2026-05-25', to:'2026-05-26', days:2, status:'approved', submitted:'2026-05-12', decidedBy:'e1' },
  { id:'r7', empId:'e2', type:'permesso', from:'2026-05-19', to:'2026-05-19', hours:2, time:'16:00–18:00', status:'rejected', submitted:'2026-05-14', decidedBy:'e1', reason:'Copertura insufficiente quel giorno' },
  { id:'r8', empId:'e13',type:'ferie',    from:'2026-06-22', to:'2026-06-26', days:5, status:'pending', submitted:'2026-05-29', note:'' },
];

export const SHIFTS = [
  { id:'s1', empId:'e5',  title:'Presidio QA',         bu:'bu1', day:'Ven',         time:'11:00–18:00', start:'2026-01-10', end:'2026-06-12', status:'scadenza' },
  { id:'s2', empId:'e7',  title:'Support mattina',     bu:'bu2', day:'Lun–Ven',     time:'08:00–16:00', start:'2026-03-01', end:null,         status:'attivo'   },
  { id:'s3', empId:null,  title:'Support serale',      bu:'bu2', day:'Ven',         time:'18:00–24:00', start:'2026-05-01', end:null,         status:'scoperto' },
  { id:'s4', empId:'e11', title:'Presidio Cloud',      bu:'bu3', day:'Lun, Mer, Ven',time:'09:00–18:00', start:'2026-02-01', end:'2026-06-10', status:'scadenza' },
  { id:'s5', empId:'e8',  title:'Support pomeriggio',  bu:'bu2', day:'Lun–Ven',     time:'14:00–22:00', start:'2025-11-01', end:'2026-04-30', status:'scaduto'  },
  { id:'s6', empId:null,  title:'Reperibilità weekend',bu:'bu3', day:'Sab–Dom',     time:'09:00–21:00', start:'2026-05-01', end:null,         status:'scoperto' },
];

export const ONCALL = [
  { id:'o1', empId:'e1',  bu:'bu1', from:'2026-05-28', to:'2026-05-29', time:'18:00–08:00', note:'Notturna infrasettimanale' },
  { id:'o2', empId:'e4',  bu:'bu1', from:'2026-05-30', to:'2026-05-31', time:'09:00–21:00', note:'Weekend' },
  { id:'o3', empId:'e10', bu:'bu3', from:'2026-05-27', to:'2026-05-27', time:'H24',         note:'Manutenzione programmata' },
  { id:'o4', empId:'e6',  bu:'bu2', from:'2026-05-29', to:'2026-05-29', time:'16:00–24:00', note:'' },
];

export const NOTIFS = [
  { id:'n1', kind:'conflict',  bu:'bu1', title:'Soglia assenti superata',     body:'Sviluppo Software · martedì 26/05: 3 persone in ferie (soglia 3).',       when:'2 ore fa',    unread:true  },
  { id:'n2', kind:'uncovered', bu:'bu2', title:'Turno scoperto',              body:'«Support serale» del venerdì non ha nessun assegnatario.',                  when:'5 ore fa',    unread:true  },
  { id:'n3', kind:'expiring',  bu:'bu1', title:'Turno in scadenza',           body:'«Presidio QA» (Sara Gallo) scade il 12/06 — tra 14 giorni.',               when:'ieri',        unread:true  },
  { id:'n4', kind:'oncall',    bu:'bu1', title:'Reperibilità in corso',       body:'Elena Conti è di reperibilità stanotte (18:00–08:00).',                     when:'ieri',        unread:false },
  { id:'n5', kind:'expiring',  bu:'bu3', title:'Turno in scadenza',           body:'«Presidio Cloud» (Paolo Marino) scade il 10/06 — tra 12 giorni.',           when:'2 giorni fa', unread:false },
  { id:'n6', kind:'conflict',  bu:'bu1', title:'Troppi in smart working',     body:'Sviluppo Software · mercoledì 27/05: 3 persone in smart working.',          when:'2 giorni fa', unread:false },
];

export const STATUS = {
  ferie:        { label:'Ferie',         cls:'st-ferie',        absent:true },
  malattia:     { label:'Malattia',      cls:'st-malattia',     absent:true },
  permesso:     { label:'Permesso',      cls:'st-permesso',     absent:true, partial:true },
  sw:           { label:'Smart working', cls:'st-sw',           remote:true },
  reperibilita: { label:'Reperibilità',  cls:'st-reperibilita' },
  turno:        { label:'Turno',         cls:'st-turno' },
  presidio:     { label:'Presidio',      cls:'st-presidio' },
  festa:        { label:'Festività',     cls:'st-festa',        absent:true },
  chiusura:     { label:'Chiusura',      cls:'st-festa',        absent:true },
};

export const person = (id) => PEOPLE.find((p) => p.id === id);
export const bu = (id) => BUS.find((b) => b.id === id);
export const peopleOf = (buId) => PEOPLE.filter((p) => p.bu === buId);

export function dayEntries(assign, empId, date) {
  if (HOLIDAYS[date]) return [{ type:'festa', label:HOLIDAYS[date] }];
  const cl = CLOSURES.find((c) => c.date === date);
  if (cl) {
    if (cl.presidio.includes(empId)) return [{ type:'presidio', label:cl.label }];
    return [{ type:'chiusura', label:cl.label }];
  }
  return (assign[`${empId}|${date}`] || []).slice();
}

export const holidayName = (date) => HOLIDAYS[date] || null;
export const closure = (date) => CLOSURES.find((c) => c.date === date) || null;
