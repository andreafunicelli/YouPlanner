import { promises as fs } from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';
import { holidaysFor, clone } from './domain.mjs';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
export const DB_PATH = path.join(__dirname, 'peopleplanner-db.json');

const av = ['#E03127','#2D7FF0','#0E9D94','#7C5CF0','#E08A1E','#2E9E5B','#C2456B','#5B6472','#0F766E','#B45309','#1559BD','#6D28D9','#9A1B30'];
const withAvatar = (p, i) => {
  const parts = p.name.split(' ');
  return { initials: (parts[0][0] + parts[parts.length - 1][0]).toUpperCase(), av: av[i % av.length], ferieTot: 26, permessiTot: 32, ...p };
};

export function seedState() {
  const people = [
    { id:'e1', name:'Elena Conti', bu:'bu1', role:'manager', job:'BU Manager', ferie:14, permessi:22 },
    { id:'e2', name:'Luca Ferrari', bu:'bu1', role:'dipendente', job:'Senior Dev', ferie:18, permessi:16 },
    { id:'e3', name:'Giulia Romano', bu:'bu1', role:'dipendente', job:'Frontend Dev', ferie:9, permessi:8 },
    { id:'e4', name:'Matteo Bruno', bu:'bu1', role:'dipendente', job:'Backend Dev', ferie:21, permessi:20 },
    { id:'e5', name:'Sara Gallo', bu:'bu1', role:'dipendente', job:'QA Engineer', ferie:6, permessi:4 },
    { id:'e6', name:'Marco Riva', bu:'bu2', role:'manager', job:'BU Manager', ferie:11, permessi:18 },
    { id:'e7', name:'Francesca Costa', bu:'bu2', role:'dipendente', job:'Support Lead', ferie:16, permessi:12 },
    { id:'e8', name:'Alessandro Rizzo', bu:'bu2', role:'dipendente', job:'Support Agent', ferie:20, permessi:24 },
    { id:'e9', name:'Chiara De Luca', bu:'bu2', role:'dipendente', job:'Support Agent', ferie:13, permessi:10 },
    { id:'e10', name:'Davide Greco', bu:'bu3', role:'manager', job:'BU Manager', ferie:9, permessi:15 },
    { id:'e11', name:'Paolo Marino', bu:'bu3', role:'dipendente', job:'SysAdmin', ferie:17, permessi:20 },
    { id:'e12', name:'Valentina Esposito', bu:'bu3', role:'dipendente', job:'Cloud Engineer', ferie:22, permessi:18 },
    { id:'e13', name:'Simone Ricci', bu:'bu3', role:'dipendente', job:'DevOps', ferie:8, permessi:6 },
  ].map(withAvatar);
  const assign = {};
  const set = (emp, date, entries) => { assign[`${emp}|${date}`] = entries; };
  const E = (type, extra = {}) => ({ type, ...extra });
  set('e2','2026-05-25',[E('ferie')]); set('e3','2026-05-25',[E('ferie')]); set('e4','2026-05-25',[E('sw')]); set('e5','2026-05-25',[E('turno',{time:'11:00–18:00'})]);
  set('e2','2026-05-26',[E('ferie')]); set('e3','2026-05-26',[E('ferie')]); set('e5','2026-05-26',[E('ferie')]); set('e4','2026-05-26',[E('sw')]);
  set('e2','2026-05-27',[E('sw')]); set('e4','2026-05-27',[E('sw')]); set('e5','2026-05-27',[E('sw')]); set('e3','2026-05-27',[E('turno',{time:'09:00–17:00'})]);
  set('e3','2026-05-28',[E('permesso',{time:'14:00–18:00', note:'4h'})]); set('e4','2026-05-28',[E('ferie')]); set('e1','2026-05-28',[E('reperibilita',{time:'18:00–08:00'})]);
  set('e5','2026-05-29',[E('ferie')]); set('e2','2026-05-29',[E('malattia')]); set('e3','2026-05-29',[E('sw')]); set('e4','2026-05-29',[E('turno',{time:'11:00–18:00'})]); set('e1','2026-05-29',[E('reperibilita',{time:'18:00–08:00'})]);
  set('e7','2026-05-25',[E('turno',{time:'08:00–16:00'})]); set('e8','2026-05-25',[E('turno',{time:'14:00–22:00'})]); set('e9','2026-05-25',[E('sw')]);
  set('e11','2026-05-25',[E('turno',{time:'09:00–18:00'})]); set('e12','2026-05-25',[E('sw')]); set('e13','2026-05-26',[E('ferie')]);
  return {
    users: [
      { id:'u-super', email:'superadmin@peopleplanner.local', password:'demo123', role:'SUPER_ADMIN', employeeId:null, name:'Anna Vitali', job:'Super Admin', initials:'AV', av:'#17120F' },
      { id:'u-admin1', email:'manager@peopleplanner.local', password:'demo123', role:'ADMIN', employeeId:'e1' },
      { id:'u-admin-empty', email:'manager-empty@peopleplanner.local', password:'demo123', role:'ADMIN', employeeId:null, name:'Manager Senza BU', job:'BU Manager', initials:'MB', av:'#5B6472' },
      { id:'u-employee', email:'employee@peopleplanner.local', password:'demo123', role:'EMPLOYEE', employeeId:'e3' },
    ],
    bus: [
      { id:'bu1', name:'Sviluppo Software', managerId:'e1', color:'#E03127' },
      { id:'bu2', name:'Customer Support', managerId:'e6', color:'#2D7FF0' },
      { id:'bu3', name:'Infrastruttura & Cloud', managerId:'e10', color:'#0E9D94' },
    ],
    people,
    holidays: { ...holidaysFor(2025), ...holidaysFor(2026), ...holidaysFor(2027) },
    closures: [
      // Chiusura Capodanno
      { id:'c1',  date:'2026-01-02', label:'Chiusura Capodanno', presidio:[] },
      { id:'c2',  date:'2026-01-03', label:'Chiusura Capodanno', presidio:[] },
      { id:'c3',  date:'2026-01-04', label:'Chiusura Capodanno', presidio:[] },
      { id:'c4',  date:'2026-01-05', label:'Chiusura Capodanno', presidio:[] },
      // Carnevale
      { id:'c5',  date:'2026-02-20', label:'Carnevale', presidio:[] },
      // Ponte Pasqua
      { id:'c6',  date:'2026-04-03', label:'Ponte Pasqua', presidio:[] },
      { id:'c7',  date:'2026-04-07', label:'Ponte Pasqua', presidio:[] },
      // Ponte Festa della Repubblica
      { id:'c8',  date:'2026-06-01', label:'Ponte Festa della Repubblica', presidio:[] },
      // Chiusura estiva
      { id:'c9',  date:'2026-08-10', label:'Chiusura estiva', presidio:['e10'] },
      { id:'c10', date:'2026-08-11', label:'Chiusura estiva', presidio:['e10'] },
      { id:'c11', date:'2026-08-12', label:'Chiusura estiva', presidio:['e10'] },
      { id:'c12', date:'2026-08-13', label:'Chiusura estiva', presidio:['e10'] },
      { id:'c13', date:'2026-08-14', label:'Chiusura estiva', presidio:[] },
      { id:'c14', date:'2026-08-17', label:'Chiusura estiva', presidio:[] },
      { id:'c15', date:'2026-08-18', label:'Chiusura estiva', presidio:[] },
      { id:'c16', date:'2026-08-19', label:'Chiusura estiva', presidio:[] },
      { id:'c17', date:'2026-08-20', label:'Chiusura estiva', presidio:[] },
      { id:'c18', date:'2026-08-21', label:'Chiusura estiva', presidio:[] },
      { id:'c19', date:'2026-08-24', label:'Chiusura estiva', presidio:[] },
      { id:'c20', date:'2026-08-25', label:'Chiusura estiva', presidio:[] },
      // Chiusura Natalizia
      { id:'c21', date:'2026-12-24', label:'Chiusura Natalizia', presidio:['e11'] },
      { id:'c22', date:'2026-12-25', label:'Chiusura Natalizia', presidio:[] },
      { id:'c23', date:'2026-12-26', label:'Chiusura Natalizia', presidio:[] },
      { id:'c24', date:'2026-12-27', label:'Chiusura Natalizia', presidio:['e11'] },
      { id:'c25', date:'2026-12-28', label:'Chiusura Natalizia', presidio:[] },
      { id:'c26', date:'2026-12-29', label:'Chiusura Natalizia', presidio:['e11'] },
      { id:'c27', date:'2026-12-30', label:'Chiusura Natalizia', presidio:[] },
      { id:'c28', date:'2026-12-31', label:'Chiusura Natalizia', presidio:[] },
      // Chiusura Epifania 2027
      { id:'c29', date:'2027-01-04', label:'Chiusura Epifania', presidio:[] },
      { id:'c30', date:'2027-01-05', label:'Chiusura Epifania', presidio:[] },
    ],
    assign,
    requests: [
      { id:'r1', empId:'e2', type:'ferie', from:'2026-06-08', to:'2026-06-12', days:5, status:'pending', submitted:'2026-05-26', note:'Vacanza famiglia' },
      { id:'r2', empId:'e5', type:'permesso', from:'2026-06-03', to:'2026-06-03', hours:4, time:'14:00–18:00', status:'pending', submitted:'2026-05-27', note:'Visita medica' },
      { id:'r3', empId:'e4', type:'ferie', from:'2026-06-01', to:'2026-06-02', days:1, status:'pending', submitted:'2026-05-28', note:'Ponte' },
      { id:'r4', empId:'e3', type:'ferie', from:'2026-06-09', to:'2026-06-10', days:2, status:'pending', submitted:'2026-05-28', note:'' },
      { id:'r6', empId:'e3', type:'ferie', from:'2026-05-25', to:'2026-05-26', days:2, status:'approved', submitted:'2026-05-12', decidedBy:'e1' },
      { id:'r7', empId:'e2', type:'permesso', from:'2026-05-19', to:'2026-05-19', hours:2, time:'16:00–18:00', status:'rejected', submitted:'2026-05-14', decidedBy:'e1', reason:'Copertura insufficiente quel giorno' },
      { id:'r8', empId:'e13', type:'ferie', from:'2026-06-22', to:'2026-06-26', days:5, status:'pending', submitted:'2026-05-29', note:'' },
    ],
    shifts: [
      { id:'s1', empId:'e5', title:'Presidio QA', bu:'bu1', day:'Ven', time:'11:00–18:00', start:'2026-01-10', end:'2026-06-12', status:'scadenza' },
      { id:'s2', empId:'e7', title:'Support mattina', bu:'bu2', day:'Lun–Ven', time:'08:00–16:00', start:'2026-03-01', end:null, status:'attivo' },
      { id:'s3', empId:null, title:'Support serale', bu:'bu2', day:'Ven', time:'18:00–24:00', start:'2026-05-01', end:null, status:'scoperto' },
      { id:'s4', empId:'e11', title:'Presidio Cloud', bu:'bu3', day:'Lun, Mer, Ven', time:'09:00–18:00', start:'2026-02-01', end:'2026-06-10', status:'scadenza' },
    ],
    oncall: [
      { id:'o1', empId:'e1', bu:'bu1', from:'2026-05-28', to:'2026-05-29', time:'18:00–08:00', note:'Notturna infrasettimanale' },
      { id:'o2', empId:'e4', bu:'bu1', from:'2026-05-30', to:'2026-05-31', time:'09:00–21:00', note:'Weekend' },
      { id:'o3', empId:'e10', bu:'bu3', from:'2026-05-27', to:'2026-05-27', time:'H24', note:'Manutenzione programmata' },
    ],
  };
}

export async function readState() {
  try {
    return JSON.parse(await fs.readFile(DB_PATH, 'utf8'));
  } catch {
    const seed = seedState();
    await writeState(seed);
    return seed;
  }
}

export async function writeState(state) {
  await fs.writeFile(DB_PATH, JSON.stringify(state, null, 2));
}

export async function resetState() {
  const seed = seedState();
  await writeState(seed);
  return clone(seed);
}
