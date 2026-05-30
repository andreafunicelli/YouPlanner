import { useState } from 'react';
import { Icon, Avatar, Pill, Modal, SectionHead } from './components.jsx';
import { createOnCall, createShift, createPerson, updateClosureAssignment } from './api.js';
import { dayConflict } from './Calendar.jsx';
import {
  PEOPLE, BUS, SHIFTS, ONCALL, CLOSURES, HOLIDAYS,
  person as getPerson, bu as getBU, peopleOf,
  TODAY, DOW, MONTHS, fmtRange, parse, addDays, iso, mondayOf,
} from './data.js';

export const shiftStatusBadge = (s) => ({
  attivo:   <span className="badge badge-green"><Icon name="check" size={11} sw={2.6} />Attivo</span>,
  scadenza: <span className="badge badge-amber"><Icon name="clock" size={11} sw={2.4} />In scadenza</span>,
  scaduto:  <span className="badge badge-red"><Icon name="alert" size={11} sw={2.4} />Scaduto</span>,
  scoperto: <span className="badge badge-red"><Icon name="alert" size={11} sw={2.4} />Scoperto</span>,
}[s]);

/* ---------- DASHBOARD ---------- */
export function Dashboard({ people, getEntries, th, notifs, reqs, shifts, onGoto, scope }) {
  const today = iso(TODAY);
  const c = dayConflict(people, today, getEntries, th);
  const inService = people.length - c.absent;
  const pending = reqs.filter((r) => r.status === 'pending').length;
  const uncovered = shifts.filter((s) => s.status === 'scoperto');
  const expiring = shifts.filter((s) => s.status === 'scadenza' || s.status === 'scaduto');
  const alerts = notifs.filter((n) => n.kind === 'conflict' || n.kind === 'uncovered' || n.kind === 'expiring');

  const kpi = (val, lbl, color, icon, goto) => (
    <button className="card card-pad" onClick={() => onGoto(goto)}
      style={{ textAlign: 'left', display: 'flex', flexDirection: 'column', gap: 8, border: '1px solid var(--line)', cursor: 'pointer' }}>
      <span style={{ width: 36, height: 36, borderRadius: 10, display: 'grid', placeItems: 'center', background: color + '22', color }}>{icon}</span>
      <div className="kpi"><div className="kpi-val" style={{ color }}>{val}</div><div className="kpi-lbl">{lbl}</div></div>
    </button>
  );

  return (
    <div className="fade-in">
      <SectionHead title="Panoramica operativa" sub={scope + ' · ' + DOW[(TODAY.getDay()+6)%7] + ' ' + TODAY.getDate() + ' ' + MONTHS[TODAY.getMonth()]} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
        {kpi(inService, 'In servizio oggi', '#2E9E5B', <Icon name="users" size={19} />, 'calendario')}
        {kpi(c.absent, 'Assenti oggi', '#E08A1E', <Icon name="calendar" size={19} />, 'calendario')}
        {kpi(pending, 'Richieste in attesa', '#E03127', <Icon name="inbox" size={19} />, 'richieste')}
        {kpi(uncovered.length, 'Turni scoperti', '#7C5CF0', <Icon name="phone" size={19} />, 'turni')}
      </div>

      <div style={{ display: 'grid', gridTemplateColumns: '1.3fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="alert" size={17} color="var(--red)" />Avvisi e conflitti
          </div>
          {alerts.length === 0 && <div className="empty">Nessun avviso attivo.</div>}
          {alerts.map((n) => (
            <div key={n.id} className="notif-item" onClick={() => onGoto(n.kind === 'conflict' ? 'calendario' : 'turni')} style={{ cursor: 'pointer' }}>
              <span className="notif-ic" style={{
                background: n.kind === 'uncovered' ? 'var(--c-permesso-bg)' : n.kind === 'expiring' ? 'var(--c-ferie-bg)' : 'var(--red-tint)',
                color: n.kind === 'uncovered' ? 'var(--c-permesso-tx)' : n.kind === 'expiring' ? 'var(--c-ferie-tx)' : 'var(--red-700)',
              }}>
                <Icon name={n.kind === 'expiring' ? 'clock' : n.kind === 'uncovered' ? 'phone' : 'alert'} size={16} />
              </span>
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700, fontSize: 13.5 }}>{n.title}</div>
                <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{n.body}</div>
              </div>
              <Icon name="chevR" size={16} color="var(--text-faint)" />
            </div>
          ))}
        </div>

        <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>Copertura di oggi</div>
            <div className="card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <CoverageBar people={people} getEntries={getEntries} date={today} />
              <div className="legend" style={{ marginTop: 4 }}>
                <Pill type="turno" showLabel /><Pill type="sw" showLabel /><Pill type="ferie" showLabel /><Pill type="malattia" showLabel />
              </div>
            </div>
          </div>
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>Turni da presidiare</div>
            {expiring.concat(uncovered).slice(0, 4).map((s) => (
              <div key={s.id} className="notif-item" style={{ alignItems: 'center' }}>
                <div style={{ flex: 1 }}>
                  <div style={{ fontWeight: 700, fontSize: 13 }}>{s.title}</div>
                  <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>{s.day} · {s.time}</div>
                </div>
                {shiftStatusBadge(s.status)}
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

function CoverageBar({ people, getEntries, date }) {
  const counts = { turno:0, sw:0, ferie:0, malattia:0, permesso:0, reperibilita:0, disp:0 };
  people.forEach((p) => {
    const e = getEntries(p.id, date);
    if (!e.length) { counts.disp++; return; }
    const t = e[0].type; counts[t] = (counts[t] || 0) + 1;
  });
  const total = people.length;
  const segs = [['turno','var(--c-turno)'],['disp','var(--line-strong)'],['sw','var(--c-sw)'],['reperibilita','var(--c-reper)'],['permesso','var(--c-permesso)'],['ferie','var(--c-ferie)'],['malattia','var(--c-malattia)']];
  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {segs.map(([k, col]) => counts[k] ? <div key={k} title={`${counts[k]} ${k}`} style={{ width: `${counts[k]/total*100}%`, background: col }}></div> : null)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: 'var(--text-muted)' }}>
        <span><strong style={{ color: 'var(--c-turno-tx)' }}>{counts.turno + counts.disp}</strong> disponibili</span>
        <span><strong style={{ color: 'var(--c-ferie-tx)' }}>{counts.ferie + counts.malattia + counts.permesso}</strong> assenti</span>
      </div>
    </div>
  );
}

/* ---------- REPERIBILITÀ ---------- */
export function OnCallView({ scope, buFilter, people = [], bus = BUS, getEntries, onToast, onRefresh, oncall }) {
  const source = Array.isArray(oncall) ? oncall : ONCALL;
  const list = source.filter((o) => !buFilter || o.bu === buFilter);
  const [open, setOpen] = useState(false);
  return (
    <div className="fade-in">
      <SectionHead title="Reperibilità" sub={scope}
        right={<button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} sw={2.4} />Assegna turno</button>} />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Persona</th><th>Periodo</th><th>Fascia</th><th>Note</th><th>Stato</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="5" className="empty">Nessuna reperibilità nello scope corrente.</td></tr>}
            {list.map((o) => {
              const p = people.find((x) => x.id === o.empId) || getPerson(o.empId);
              const onLeave = (() => {
                for (let d = parse(o.from); d <= parse(o.to); d = addDays(d,1)) {
                  if (getEntries(p.id, iso(d)).some(e => e.type && ['ferie','malattia','permesso'].includes(e.type))) return true;
                }
                return false;
              })();
              return (
                <tr key={o.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                    <Avatar p={p} size={32} />
                    <div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{(bus.find((b) => b.id === o.bu) || getBU(o.bu))?.name}</div></div>
                  </div></td>
                  <td className="mono">{fmtRange(o.from, o.to)}</td>
                  <td className="mono">{o.time}</td>
                  <td style={{ color: 'var(--text-muted)', fontSize: 12.5 }}>{o.note || '—'}</td>
                  <td>{onLeave
                    ? <span className="badge badge-red"><Icon name="alert" size={11} sw={2.4} />Conflitto assenza</span>
                    : <span className="badge badge-green"><Icon name="check" size={11} sw={2.6} />Confermato</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <OnCallModal getEntries={getEntries} buFilter={buFilter} people={people} onClose={() => setOpen(false)} onToast={onToast} onRefresh={onRefresh} />}
    </div>
  );
}

function OnCallModal({ getEntries, buFilter, people = [], onClose, onToast, onRefresh }) {
  const pool = people.filter((p) => !buFilter || p.bu === buFilter);
  const [empId, setEmpId] = useState(pool[0]?.id || '');
  const [from, setFrom] = useState(iso(mondayOf(addDays(TODAY, (8 - ((TODAY.getDay() + 6) % 7)) % 7 || 7))));
  const [time, setTime] = useState('18:00–08:00');
  const [note, setNote] = useState('');

  if (!pool.length) return (
    <Modal title="Assegna reperibilità" icon={<Icon name="phone" size={19} color="var(--c-reper)" />} iconBg="var(--c-reper-bg)" onClose={onClose} footer={<button className="btn" onClick={onClose}>Chiudi</button>}>
      <div className="empty">Nessun dipendente disponibile nello scope corrente.</div>
    </Modal>
  );

  const toDate = iso(addDays(parse(from), 7));
  let blocked = null;
  let hasAnyLeave = false;
  let allLeave = true;
  for (let d = parse(from); d < parse(toDate); d = addDays(d,1)) {
    const e = getEntries(empId, iso(d)).find(x => ['ferie','malattia'].includes(x.type));
    if (e) { hasAnyLeave = true; if (!blocked) blocked = e.type; }
    else { allLeave = false; }
  }
  const showWarning = allLeave && hasAnyLeave;

  return (
    <Modal title="Assegna reperibilità" icon={<Icon name="phone" size={19} color="var(--c-reper)" />} iconBg="var(--c-reper-bg)" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={showWarning} onClick={async () => { try { await createOnCall({ empId, from, time, note }); await onRefresh?.(); onToast('Turno di reperibilità assegnato.'); onClose(); } catch (err) { onToast(err.message); } }}>Assegna</button>
      </>}>
      <div className="field"><label>Dipendente</label>
        <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
          {pool.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.job}</option>)}
        </select>
      </div>
      <div className="field"><label>Dal (lunedì)</label><input type="date" className="input mono" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
      <div style={{ fontSize: 12.5, color: 'var(--text-muted)', marginBottom: 10, padding: '8px 12px', background: 'var(--surface-2)', borderRadius: 8 }}>
        La reperibilità dura 7 giorni. Se inizi lunedì, termina lunedì successivo alle 08:00.
      </div>
      <div className="field"><label>Fascia oraria</label><input className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>
      <div className="field"><label>Note (opzionale)</label><input className="input" value={note} onChange={(e) => setNote(e.target.value)} /></div>
      {showWarning
        ? <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Assegnazione bloccata: il dipendente è in <strong>{blocked}</strong> per l'intero periodo selezionato.</div></div>
        : <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px', background: 'var(--c-reper-bg)', borderColor: '#B6E2DE', color: 'var(--c-reper-tx)' }}><Icon name="check" size={15} /><div>Nessun conflitto: il dipendente è disponibile.</div></div>}
    </Modal>
  );
}

/* ---------- TURNI OPERATIVI ---------- */
export function ShiftsView({ scope, buFilter, people = [], bus = BUS, onToast, onRefresh, shifts }) {
  const source = Array.isArray(shifts) ? shifts : SHIFTS;
  const list = source.filter((s) => !buFilter || s.bu === buFilter);
  const attention = list.filter((s) => s.status !== 'attivo');
  const [open, setOpen] = useState(false);
  return (
    <div className="fade-in">
      <SectionHead title="Turni operativi" sub={scope}
        right={<button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} sw={2.4} />Nuovo turno</button>} />
      {attention.length > 0 && (
        <div className="alert-banner alert-red" style={{ marginBottom: 14 }}>
          <Icon name="alert" size={18} />
          <div><strong>{attention.length} turni richiedono attenzione</strong> — {list.filter(s=>s.status==='scoperto').length} scoperti, {list.filter(s=>s.status==='scadenza').length} in scadenza, {list.filter(s=>s.status==='scaduto').length} scaduti.</div>
        </div>
      )}
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Turno</th><th>Assegnato a</th><th>Giorni</th><th>Fascia</th><th>Validità</th><th>Stato</th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="6" className="empty">Nessun turno nello scope corrente.</td></tr>}
            {list.map((s) => {
              const p = s.empId ? (people.find((x) => x.id === s.empId) || getPerson(s.empId)) : null;
              return (
                <tr key={s.id}>
                  <td><div style={{ fontWeight: 700 }}>{s.title}</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{(bus.find((b) => b.id === s.bu) || getBU(s.bu))?.name}</div></td>
                  <td>{p ? <div style={{ display: 'flex', alignItems: 'center', gap: 9 }}><Avatar p={p} size={28} /><span style={{ fontWeight: 600 }}>{p.name}</span></div> : <span className="badge badge-red"><Icon name="alert" size={11} sw={2.4} />Nessuno</span>}</td>
                  <td className="mono">{s.day}</td>
                  <td className="mono">{s.time}</td>
                  <td className="mono" style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{s.end ? `fino al ${fmtRange(s.end, s.end)}` : 'senza scadenza'}</td>
                  <td>{shiftStatusBadge(s.status)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <ShiftModal buFilter={buFilter} people={people} bus={bus} onClose={() => setOpen(false)} onToast={onToast} onRefresh={onRefresh} />}
    </div>
  );
}

const SHIFT_PRESETS = [
  { label: 'Venerdì 11-18', title: 'Presidio Venerdì', time: '11:00–18:00', days: [4] },
  { label: 'Presidio Italo', title: 'Presidio Italo', time: '09:00–18:00', days: [0,1,2,3,4] },
  { label: 'AGN', title: 'AGN', time: '08:00–20:00', days: [0,1,2,3,4] },
  { label: 'Personalizzato', title: '', time: '', days: [] },
];

function ShiftModal({ buFilter, people = [], bus, onClose, onToast, onRefresh }) {
  const pool = people.filter((p) => !buFilter || p.bu === buFilter);
  const [empId, setEmpId] = useState(pool[0]?.id || '');
  const [presetIdx, setPresetIdx] = useState(3);
  const [title, setTitle] = useState(SHIFT_PRESETS[0].title);
  const [time, setTime] = useState(SHIFT_PRESETS[0].time);
  const [selectedDays, setSelectedDays] = useState([0,1,2,3,4]);
  const [weekStart, setWeekStart] = useState(iso(mondayOf(TODAY)));

  const preset = SHIFT_PRESETS[presetIdx];
  const isCustom = presetIdx === 3;

  const applyPreset = (idx) => {
    setPresetIdx(idx);
    const p = SHIFT_PRESETS[idx];
    if (idx !== 3) {
      setTitle(p.title);
      setTime(p.time);
      setSelectedDays([...p.days]);
    }
  };

  const toggleDay = (di) => {
    if (!isCustom) return;
    setSelectedDays(prev => prev.includes(di) ? prev.filter(d => d !== di) : [...prev, di].sort());
  };

  const weekEnd = addDays(parse(weekStart), 6);
  const weekLabel = `Settimana ${parse(weekStart).getDate()}–${weekEnd.getDate()} ${MONTHS[weekEnd.getMonth()]} ${weekEnd.getFullYear()}`;

  const emp = pool.find((p) => p.id === empId) || getPerson(empId);

  if (!pool.length) return (
    <Modal title="Nuovo turno operativo" icon={<Icon name="clock" size={19} color="var(--c-turno)" />} iconBg="var(--c-turno-bg)" onClose={onClose} footer={<button className="btn" onClick={onClose}>Chiudi</button>}>
      <div className="empty">Nessun dipendente disponibile nello scope corrente.</div>
    </Modal>
  );

  return (
    <Modal title="Nuovo turno operativo" icon={<Icon name="clock" size={19} color="var(--c-turno)" />} iconBg="var(--c-turno-bg)" onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={!title || !empId || selectedDays.length === 0}
        onClick={async () => {
          try {
            for (const di of selectedDays) {
              const dayDate = iso(addDays(parse(weekStart), di));
              await createShift({ empId, title, bu: emp.bu, day: DOW[di], time, start: dayDate, end: dayDate });
            }
            await onRefresh?.(); onToast(`${selectedDays.length} turno/i creato/i.`); onClose();
          } catch (err) { onToast(err.message); }
        }}>Crea{selectedDays.length > 1 ? ` (${selectedDays.length} giorni)` : ''}</button></>}>
      <div style={{ display: 'flex', gap: 6, marginBottom: 14, flexWrap: 'wrap' }}>
        {SHIFT_PRESETS.map((p, i) => (
          <button key={i} className={'chip' + (presetIdx === i ? ' on' : '')} onClick={() => applyPreset(i)}>{p.label}</button>
        ))}
      </div>
      <div className="field"><label>Dipendente</label><select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>{pool.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.job}</option>)}</select></div>
      <div className="field"><label>Titolo</label><input className="input" value={title} onChange={(e) => setTitle(e.target.value)} disabled={!isCustom} /></div>
      <div className="field"><label>Fascia</label><input className="input" value={time} onChange={(e) => setTime(e.target.value)} disabled={!isCustom} /></div>
      <div style={{ marginBottom: 10 }}>
        <label style={{ fontSize: 12, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em', marginBottom: 6, display: 'block' }}>Giorni</label>
        <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>
          {DOW.map((d, i) => (
            <label key={i} style={{ display: 'flex', alignItems: 'center', gap: 5, padding: '6px 10px', borderRadius: 8, border: '1px solid var(--line)', background: selectedDays.includes(i) ? 'var(--c-turno-bg)' : 'var(--surface)', cursor: isCustom ? 'pointer' : 'default', opacity: !isCustom && !selectedDays.includes(i) ? 0.4 : 1, fontSize: 13, fontWeight: 600 }}>
              <input type="checkbox" checked={selectedDays.includes(i)} onChange={() => toggleDay(i)} disabled={!isCustom} style={{ accentColor: 'var(--c-turno)' }} />
              {d}
            </label>
          ))}
        </div>
      </div>
      <div className="field">
        <label>Settimana dal (lunedì)</label>
        <input type="date" className="input mono" value={weekStart} onChange={(e) => setWeekStart(e.target.value)} />
        <div style={{ fontSize: 12, color: 'var(--text-muted)', marginTop: 4 }}>{weekLabel}</div>
      </div>
    </Modal>
  );
}

/* ---------- CHIUSURE & FESTIVITÀ ---------- */
export function ClosuresView({ scope, closures = CLOSURES, holidays: holidaysMap = HOLIDAYS, people = PEOPLE }) {
  const [expandedClosure, setExpandedClosure] = useState(null);
  const [editAssignments, setEditAssignments] = useState({});
  const holidays = Object.entries(holidaysMap || {}).filter(([d]) => parse(d) >= new Date(2026,4,1)).sort();

  // Group closures by label for date ranges
  const groupedClosures = [];
  const sortedClosures = [...(closures || [])].sort((a, b) => a.date.localeCompare(b.date));
  let current = null;
  for (const c of sortedClosures) {
    if (current && current.label === c.label) {
      current.dates.push(c.date);
      // merge presidio
      c.presidio.forEach(id => { if (!current.allPresidio.includes(id)) current.allPresidio.push(id); });
    } else {
      if (current) groupedClosures.push(current);
      current = { label: c.label, dates: [c.date], allPresidio: [...c.presidio], items: [c] };
    }
  }
  if (current) groupedClosures.push(current);

  const handleToggleAssignment = (closureItem, empId) => {
    const key = closureItem.date || closureItem.id;
    const current = editAssignments[key] || { presidio: [...(closureItem.presidio || [])] };
    const idx = current.presidio.indexOf(empId);
    if (idx >= 0) current.presidio.splice(idx, 1);
    else current.presidio.push(empId);
    setEditAssignments({ ...editAssignments, [key]: { ...current } });
  };

  const handleSaveAssignment = async (closureItem) => {
    const key = closureItem.date || closureItem.id;
    const assignment = editAssignments[key];
    if (!assignment) return;
    try {
      await updateClosureAssignment(closureItem.id || closureItem.date, { presidio: assignment.presidio });
      setExpandedClosure(null);
    } catch (err) {
      // silently fail for now
    }
  };

  return (
    <div className="fade-in">
      <SectionHead title="Chiusure aziendali e festività" sub={scope} />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>Chiusure aziendali</div>
          <table className="tbl">
            <thead><tr><th>Periodo</th><th>Motivo</th><th>Presidio</th><th>In ferie</th></tr></thead>
            <tbody>{groupedClosures.map((group, gi) => {
              const isExpanded = expandedClosure === gi;
              const fromDate = group.dates[0];
              const toDate = group.dates[group.dates.length - 1];
              const editKey = group.items[0]?.date || group.items[0]?.id;
              const editState = editAssignments[editKey] || { presidio: group.allPresidio };
              const feriePeople = people.filter(p => !editState.presidio.includes(p.id));
              return (
                <tr key={gi} style={{ cursor: 'pointer' }} onClick={() => setExpandedClosure(isExpanded ? null : gi)}>
                  <td className="mono">{fmtRange(fromDate, toDate)}</td>
                  <td style={{ fontWeight: 600 }}>{group.label}</td>
                  <td>{editState.presidio.length
                    ? <div style={{ display: 'flex' }}>{editState.presidio.map((id, i) => <span key={id} style={{ marginLeft: i ? -6 : 0 }}><Avatar p={people.find((p) => p.id === id) || getPerson(id)} size={28} /></span>)}</div>
                    : <span className="badge badge-gray">Nessuno</span>}</td>
                  <td>{feriePeople.length === people.length
                    ? <span className="badge badge-gray">Tutti in ferie</span>
                    : <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{feriePeople.length} persone</span>}</td>
                </tr>
              );
            })}
            {groupedClosures.length === 0 && <tr><td colSpan="4" className="empty">Nessuna chiusura programmata.</td></tr>}
            </tbody>
          </table>
          {expandedClosure !== null && groupedClosures[expandedClosure] && (
            <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
              <div style={{ fontWeight: 700, fontSize: 13.5, marginBottom: 10 }}>Assegna presidio per: {groupedClosures[expandedClosure].label}</div>
              <div style={{ display: 'grid', gap: 8 }}>
                {people.map(p => {
                  const editKey = groupedClosures[expandedClosure].items[0]?.date || groupedClosures[expandedClosure].items[0]?.id;
                  const editState = editAssignments[editKey] || { presidio: groupedClosures[expandedClosure].allPresidio };
                  const isPresidio = editState.presidio.includes(p.id);
                  return (
                    <div key={p.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 10px', borderRadius: 8, background: 'var(--surface)', border: '1px solid var(--line)' }}>
                      <Avatar p={p} size={28} />
                      <span style={{ flex: 1, fontWeight: 600, fontSize: 13 }}>{p.name}</span>
                      <button
                        className={'btn btn-sm' + (isPresidio ? ' btn-primary' : '')}
                        onClick={(e) => { e.stopPropagation(); handleToggleAssignment(groupedClosures[expandedClosure].items[0], p.id); }}
                        style={{ minWidth: 70 }}
                      >
                        {isPresidio ? 'Presidio' : 'Ferie'}
                      </button>
                    </div>
                  );
                })}
              </div>
              <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                <button className="btn" onClick={(e) => { e.stopPropagation(); setExpandedClosure(null); }}>Annulla</button>
                <button className="btn btn-primary" onClick={(e) => { e.stopPropagation(); handleSaveAssignment(groupedClosures[expandedClosure].items[0]); }}>Salva assegnazioni</button>
              </div>
            </div>
          )}
        </div>
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>Festività nazionali 2026</div>
          <table className="tbl">
            <thead><tr><th>Data</th><th>Festività</th></tr></thead>
            <tbody>{holidays.map(([d, name]) => (
              <tr key={d}><td className="mono">{fmtRange(d, d)}</td><td><span className="pill st-festa"><span className="dot"></span>{name}</span></td></tr>
            ))}</tbody>
          </table>
        </div>
      </div>
    </div>
  );
}

/* ---------- ADMIN (Persone) ---------- */
export function AdminView({ onRefresh, people, bus }) {
  const [open, setOpen] = useState(false);
  const peopleList = people && people.length ? people : PEOPLE;
  const busList = bus && bus.length ? bus : BUS;
  return (
    <div className="fade-in">
      <SectionHead title="Persone" sub="Super Admin · Gestione persone e Business Unit" />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        {busList.map((b) => {
          const ppl = peopleList.filter((p) => p.bu === b.id);
          const mgr = getPerson(b.managerId);
          return (
            <div key={b.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
              <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                <span style={{ width: 12, height: 12, borderRadius: 4, background: b.color }}></span>
                <div style={{ fontWeight: 800, fontSize: 15 }}>{b.name}</div>
              </div>
              <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manager: <strong style={{ color: 'var(--text)' }}>{mgr.name}</strong></div>
              <div style={{ display: 'flex', marginTop: 2 }}>
                {ppl.slice(0,6).map((p, i) => <span key={p.id} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: '50%' }}><Avatar p={p} size={30} /></span>)}
              </div>
              <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{ppl.length} collaboratori</div>
            </div>
          );
        })}
      </div>
      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center' }}>
          Persone<span className="spacer"></span>
          <button className="btn btn-sm" onClick={() => setOpen(true)}><Icon name="plus" size={14} sw={2.4} />Aggiungi persona</button>
        </div>
        <table className="tbl">
          <thead><tr><th>Nome</th><th>Ruolo</th><th>Business Unit</th><th>Ferie</th><th>Permessi</th></tr></thead>
          <tbody>
            {peopleList.map((p) => (
              <tr key={p.id}>
                <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Avatar p={p} size={32} />
                  <div><div style={{ fontWeight: 700 }}>{p.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{p.job}</div></div>
                </div></td>
                <td>{p.role === 'manager' ? <span className="badge badge-red">Manager</span> : <span className="badge badge-gray">Dipendente</span>}</td>
                <td>{getBU(p.bu).name}</td>
                <td className="mono">{p.ferie}/{p.ferieTot} gg</td>
                <td className="mono">{p.permessi}/{p.permessiTot} h</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <PersonModal bus={busList} onClose={() => setOpen(false)} onRefresh={onRefresh} />}
    </div>
  );
}

/* ---------- INTEGRAZIONI (placeholder) ---------- */
export function IntegrationsView() {
  return (
    <div className="fade-in">
      <SectionHead title="Integrazioni" sub="Super Admin · Configurazione servizi esterni" />
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--c-sw-bg)', color: 'var(--c-sw-tx)', display: 'grid', placeItems: 'center' }}>
              <Icon name="building" size={22} />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Google Workspace</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Sincronizzazione calendario e directory</div>
            </div>
          </div>
          <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}>
            <Icon name="alert" size={15} />
            <div>Configurazione non attiva. L'integrazione con Google Workspace sarà disponibile in una prossima versione.</div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="field"><label>Client ID</label><input className="input" disabled placeholder="Non configurato" /></div>
            <div className="field"><label>Client Secret</label><input className="input" disabled placeholder="Non configurato" /></div>
            <div className="field"><label>Domain</label><input className="input" disabled placeholder="es. azienda.it" /></div>
          </div>
          <button className="btn" disabled>Configura Google Workspace</button>
        </div>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 44, height: 44, borderRadius: 12, background: 'var(--c-permesso-bg)', color: 'var(--c-permesso-tx)', display: 'grid', placeItems: 'center' }}>
              <Icon name="lock" size={22} />
            </span>
            <div>
              <div style={{ fontWeight: 800, fontSize: 15 }}>LDAP / Active Directory</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Autenticazione centralizzata utenti</div>
            </div>
          </div>
          <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}>
            <Icon name="alert" size={15} />
            <div>Configurazione non attiva. L'integrazione LDAP sarà disponibile in una prossima versione.</div>
          </div>
          <div style={{ display: 'grid', gap: 10 }}>
            <div className="field"><label>Server URL</label><input className="input" disabled placeholder="ldap://server.azienda.it" /></div>
            <div className="field"><label>Base DN</label><input className="input" disabled placeholder="dc=azienda,dc=it" /></div>
            <div className="field"><label>Bind DN</label><input className="input" disabled placeholder="cn=admin,dc=azienda,dc=it" /></div>
          </div>
          <button className="btn" disabled>Configura LDAP</button>
        </div>
      </div>
    </div>
  );
}

function PersonModal({ bus, onClose, onRefresh }) {
  const [name, setName] = useState('Nuova Persona');
  const [buId, setBuId] = useState(bus[0]?.id || '');
  const [job, setJob] = useState('Dipendente');
  const [error, setError] = useState('');
  return (
    <Modal title="Aggiungi persona" icon={<Icon name="users" size={19} color="var(--red)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={!name || !buId} onClick={async () => { try { setError(''); await createPerson({ name, bu: buId, job }); await onRefresh?.(); onClose(); } catch (err) { setError(err.message); } }}>Salva</button></>}>
      {error && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
      <div className="field"><label>Nome</label><input className="input" value={name} onChange={(e) => setName(e.target.value)} /></div>
      <div className="field"><label>Business Unit</label><select className="input" value={buId} onChange={(e) => setBuId(e.target.value)}>{bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div className="field"><label>Mansione</label><input className="input" value={job} onChange={(e) => setJob(e.target.value)} /></div>
    </Modal>
  );
}
