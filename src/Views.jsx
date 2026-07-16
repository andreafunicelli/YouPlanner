import { useEffect, useState } from 'react';
import { Icon, Avatar, Pill, Modal, SectionHead } from './components.jsx';
import { createOnCall, createShift, deleteOnCall, deleteShift, bulkUpdateClosureAssignments, getAdminUsers, getAdminBus, createAdminUser, updateAdminUser, deleteAdminUser, createAdminBu, updateAdminBu, deleteAdminBu, getAdminClosures, createAdminClosure, updateAdminClosure, deleteAdminClosure, getAuthConfig } from './api.js';
import { dayConflict } from './Calendar.jsx';
import {
  PEOPLE, BUS, SHIFTS, ONCALL, CLOSURES, holidaysFor,
  person as getPerson, bu as getBU,
  TODAY, DOW, MONTHS, fmtRange, parse, addDays, iso, mondayOf,
} from './data.js';

export const shiftStatusBadge = (s) => ({
  attivo:   <span className="badge badge-green"><Icon name="check" size={11} sw={2.6} />Attivo</span>,
  scadenza: <span className="badge badge-amber"><Icon name="clock" size={11} sw={2.4} />In scadenza</span>,
  scaduto:  <span className="badge badge-red"><Icon name="alert" size={11} sw={2.4} />Scaduto</span>,
  scoperto: <span className="badge badge-red"><Icon name="alert" size={11} sw={2.4} />Scoperto</span>,
}[s]);

/* ---------- DASHBOARD ---------- */
export function Dashboard({ role, meId, people, getEntries, th, notifs, reqs, shifts, oncall, onGoto, scope }) {
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

  if (role === 'dipendente' && meId) {
    const me = people.find((p) => p.id === meId);
    const myToday = getEntries(meId, today);
    const myReqs = reqs.filter((r) => r.empId === meId);
    const pendingMine = myReqs.filter((r) => r.status === 'pending').length;
    const oncallToday = (oncall || []).filter((o) => o.from <= today && o.to >= today);
    const oncallNow = oncallToday.find((o) => o.empId === meId);
    const todayShifts = shifts.filter((s) => {
      if (s.status === 'scaduto') return false;
      if (!s.start || s.start > today) return false;
      if (s.end && s.end < today) return false;
      return true;
    });
    const myShifts = todayShifts.filter((s) => s.empId === meId);
    const otherShifts = todayShifts.filter((s) => s.empId !== meId).slice(0, 4);
    const upcoming = [];
    Object.entries(reqs.reduce((acc, r) => { if (['pending', 'approved'].includes(r.status)) acc.push(r); return acc; }, [])).forEach(([, r]) => upcoming.push(r));
    upcoming.sort((a, b) => (a.from > b.from ? 1 : -1));
    const short = upcoming.filter((r) => r.empId === meId).slice(0, 4);

    return (
      <div className="fade-in">
        <SectionHead title="Panoramica" sub={`Ciao ${me?.name?.split(' ')[0] || 'utente'} · ${DOW[(TODAY.getDay()+6)%7]} ${TODAY.getDate()} ${MONTHS[TODAY.getMonth()]}`} />
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(4,1fr)', gap: 14, marginBottom: 16 }}>
          {kpi(pendingMine, 'Richieste in attesa', '#E03127', <Icon name="inbox" size={19} />, 'richieste')}
          {kpi(myToday.some((e) => ['ferie', 'malattia', 'festa', 'chiusura'].includes(e.type)) ? 'Sì' : 'No', 'Assente oggi', '#E08A1E', <Icon name="calendar" size={19} />, 'calendario')}
          {kpi(oncallNow ? 'Attiva' : 'No', 'Reperibilità oggi', '#0E9D94', <Icon name="phone" size={19} />, 'calendario')}
          {kpi(myShifts.length, 'Turni attivi oggi', '#7C5CF0', <Icon name="clock" size={19} />, 'calendario')}
        </div>

        <div style={{ display: 'grid', gridTemplateColumns: '1.2fr 1fr', gap: 16, alignItems: 'start' }}>
          <div className="card">
            <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
              <Icon name="calendar" size={17} color="var(--red)" />Il mio stato oggi
            </div>
            <div className="card-pad" style={{ display: 'grid', gap: 10 }}>
              {myToday.length === 0 && <div className="empty" style={{ padding: 0 }}>Nessuna assegnazione oggi.</div>}
              {myToday.map((e, i) => (
                <div key={i} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <Pill type={e.type} time={e.time} note={e.note} />
                  {e.label && <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{e.label}</span>}
                </div>
              ))}
              <div style={{ display: 'flex', gap: 8, marginTop: 6 }}>
                <button className="btn btn-sm" onClick={() => onGoto('richieste')}>Nuova richiesta</button>
                <button className="btn btn-sm btn-ghost" onClick={() => onGoto('calendario')}>Apri calendario</button>
              </div>
            </div>
          </div>

          <div style={{ display: 'flex', flexDirection: 'column', gap: 16 }}>
            <div className="card">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="phone" size={17} color="var(--c-reper)" />Reperibilità oggi
              </div>
              {!oncallToday.length && <div className="empty">Nessuna reperibilità attiva oggi.</div>}
              {oncallToday.length > 0 && (
                <div className="card-pad" style={{ display: 'grid', gap: 10 }}>
                  {oncallToday.map((o) => {
                    const p = people.find((x) => x.id === o.empId) || getPerson(o.empId);
                    const isMe = o.empId === meId;
                    return (
                      <div key={o.id} style={{ display: 'flex', alignItems: 'center', gap: 10, padding: '6px 8px', borderRadius: 8, border: `1px solid ${isMe ? 'var(--c-reper)' : 'var(--line)'}`, background: isMe ? 'var(--c-reper-bg)' : 'var(--surface)' }}>
                        <Avatar p={p} size={28} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{p.name}{isMe ? ' · Tu' : ''}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{o.time}{o.note ? ` · ${o.note}` : ''}</div>
                        </div>
                        <span className={`badge ${isMe ? 'badge-green' : 'badge-gray'}`}>{isMe ? 'Attiva' : 'Team'}</span>
                      </div>
                    );
                  })}
                </div>
              )}
            </div>

            <div className="card">
              <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
                <Icon name="clock" size={17} color="var(--c-turno)" />Turni oggi
              </div>
              {!todayShifts.length && <div className="empty">Nessun turno attivo oggi.</div>}
              {todayShifts.length > 0 && (
                <div className="card-pad" style={{ display: 'grid', gap: 8 }}>
                  {myShifts.concat(otherShifts).slice(0, 5).map((s) => {
                    const p = s.empId ? (people.find((x) => x.id === s.empId) || getPerson(s.empId)) : null;
                    const isMe = s.empId === meId;
                    return (
                      <div key={s.id} style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                        <Avatar p={p} size={26} />
                        <div style={{ flex: 1 }}>
                          <div style={{ fontWeight: 700, fontSize: 13 }}>{s.title}{isMe ? ' · Tu' : ''}</div>
                          <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{s.day} · {s.time}</div>
                        </div>
                        {shiftStatusBadge(s.status)}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          </div>
        </div>

        <div className="card" style={{ marginTop: 16 }}>
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5, display: 'flex', alignItems: 'center', gap: 8 }}>
            <Icon name="inbox" size={17} color="var(--red)" />Le mie prossime scadenze
          </div>
          {short.length === 0 && <div className="empty">Nessuna richiesta recente.</div>}
          {short.length > 0 && (
            <div style={{ padding: '12px 18px', display: 'grid', gridTemplateColumns: 'repeat(2,1fr)', gap: 10 }}>
              {short.map((r) => (
                <button key={r.id} className="card card-pad" onClick={() => onGoto('richieste')} style={{ textAlign: 'left', display: 'flex', gap: 10, alignItems: 'center' }}>
                  <Pill type={r.type} />
                  <div>
                    <div style={{ fontWeight: 700 }}>{fmtRange(r.from, r.to)}</div>
                    <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{r.status === 'pending' ? 'In attesa' : r.status === 'approved' ? 'Approvata' : 'Rifiutata'}</div>
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
      </div>
    );
  }

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
  const counts = { turno:0, sw:0, ferie:0, malattia:0, permesso:0, reperibilita:0, festa:0, chiusura:0, presidio:0, disp:0 };
  people.forEach((p) => {
    const e = getEntries(p.id, date);
    if (!e.length) { counts.disp++; return; }
    const t = e[0].type; counts[t] = (counts[t] || 0) + 1;
  });
  const total = people.length || 1;
  const absent = counts.ferie + counts.malattia + counts.permesso + counts.festa + counts.chiusura;
  const active = counts.turno + counts.sw + counts.presidio;
  const oncall = counts.reperibilita;
  const segs = [['turno','var(--c-turno)'],['sw','var(--c-sw)'],['presidio','var(--c-turno)'],['reperibilita','var(--c-reper)'],['disp','var(--line-strong)'],['permesso','var(--c-permesso)'],['ferie','var(--c-ferie)'],['malattia','var(--c-malattia)'],['festa','var(--c-ferie)'],['chiusura','var(--c-ferie)']];
  return (
    <div>
      <div style={{ display: 'flex', height: 28, borderRadius: 8, overflow: 'hidden', border: '1px solid var(--line)' }}>
        {segs.map(([k, col]) => counts[k] ? <div key={k} title={`${counts[k]} ${k}`} style={{ width: `${counts[k]/total*100}%`, background: col }}></div> : null)}
      </div>
      <div style={{ display: 'flex', justifyContent: 'space-between', marginTop: 7, fontSize: 12, color: 'var(--text-muted)' }}>
        <span><strong style={{ color: 'var(--c-turno-tx)' }}>{active}</strong> in servizio</span>
        {oncall > 0 && <span><strong style={{ color: 'var(--c-reper-tx)' }}>{oncall}</strong> reperibilità</span>}
        {counts.disp > 0 && <span><strong>{counts.disp}</strong> non assegnati</span>}
        <span><strong style={{ color: 'var(--c-ferie-tx)' }}>{absent}</strong> assenti</span>
      </div>
    </div>
  );
}

/* ---------- REPERIBILITÀ ---------- */
function DeleteOperationModal({ title, message, details, onClose, onConfirm }) {
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const close = () => { if (!saving) onClose(); };
  const confirm = async () => {
    setSaving(true); setError('');
    try { await onConfirm(); onClose(); }
    catch (err) { setError(err.message); setSaving(false); }
  };
  return (
    <Modal title={title} width={460} icon={<Icon name="alert" size={19} color="var(--red)" />} iconBg="var(--red-tint)" onClose={close}
      footer={<><button className="btn" disabled={saving} onClick={close}>Annulla</button><button className="btn btn-primary" disabled={saving} onClick={confirm}>{saving ? 'Eliminazione…' : 'Elimina definitivamente'}</button></>}>
      <div style={{ color: 'var(--text-muted)', fontSize: 13.5, lineHeight: 1.55 }}>{message}</div>
      <div className="card card-pad" style={{ padding: 13, boxShadow: 'none', background: 'var(--surface-2)', display: 'grid', gap: 7 }}>
        {details.map(([label, value]) => <div key={label} style={{ display: 'grid', gridTemplateColumns: '105px 1fr', gap: 10, fontSize: 12.5 }}><span style={{ color: 'var(--text-faint)', fontWeight: 700 }}>{label}</span><strong>{value}</strong></div>)}
      </div>
      <div className="alert-banner alert-red" style={{ padding: '9px 12px', fontSize: 12 }}><Icon name="alert" size={14} /><div>L’operazione rimuoverà anche l’assegnazione collegata dal calendario e non può essere annullata.</div></div>
      {error && <div className="alert-banner alert-red" style={{ padding: '9px 12px', fontSize: 12 }}><Icon name="alert" size={14} /><div>{error}</div></div>}
    </Modal>
  );
}

export function OnCallView({ scope, buFilter, people = [], bus = BUS, getEntries, onToast, onRefresh, oncall }) {
  const source = Array.isArray(oncall) ? oncall : ONCALL;
  const list = source.filter((o) => !buFilter || o.bu === buFilter);
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
  return (
    <div className="fade-in">
      <SectionHead title="Reperibilità" sub={scope}
        right={<button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} sw={2.4} />Assegna turno</button>} />
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Linea</th><th>Persona</th><th>Periodo</th><th>Fascia</th><th>Note</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="7" className="empty">Nessuna reperibilità nello scope corrente.</td></tr>}
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
                  <td><span className="badge badge-gray">{o.line || 'Base'}</span></td>
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
                  <td><button className="btn btn-sm btn-danger" title="Elimina reperibilità" onClick={() => setDeleteTarget({ row: o, person: p })}><Icon name="x" size={14} />Elimina</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <OnCallModal getEntries={getEntries} buFilter={buFilter} people={people} oncall={list} onClose={() => setOpen(false)} onToast={onToast} onRefresh={onRefresh} />}
      {deleteTarget && <DeleteOperationModal title="Elimina reperibilità" message={<>Stai per eliminare la reperibilità di <strong style={{ color: 'var(--text)' }}>{deleteTarget.person.name}</strong>.</>}
        details={[["Linea", deleteTarget.row.line || 'Base'], ['Periodo', fmtRange(deleteTarget.row.from, deleteTarget.row.to)], ['Fascia', deleteTarget.row.time]]}
        onClose={() => setDeleteTarget(null)} onConfirm={async () => { await deleteOnCall(deleteTarget.row.id); await onRefresh?.(); onToast('Reperibilità eliminata.'); }} />}
    </div>
  );
}

function OnCallModal({ getEntries, buFilter, people = [], oncall = [], onClose, onToast, onRefresh }) {
  const pool = people.filter((p) => !buFilter || p.bu === buFilter);
  const [empId, setEmpId] = useState(pool[0]?.id || '');
  const [from, setFrom] = useState(iso(mondayOf(addDays(TODAY, (8 - ((TODAY.getDay() + 6) % 7)) % 7 || 7))));
  const [time, setTime] = useState('18:00–08:00');
  const [note, setNote] = useState('');
  const [line, setLine] = useState('Base');

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
  const selectedWeek = iso(mondayOf(parse(from)));
  const emp = pool.find((person) => person.id === empId);
  const occupied = oncall.find((item) => item.bu === emp?.bu && (item.line || 'Base') === line && iso(mondayOf(parse(item.from))) === selectedWeek);

  return (
    <Modal title="Assegna reperibilità" icon={<Icon name="phone" size={19} color="var(--c-reper)" />} iconBg="var(--c-reper-bg)" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={showWarning || !!occupied} onClick={async () => { try { await createOnCall({ empId, from, time, note, line }); await onRefresh?.(); onToast(`Reperibilità ${line} assegnata.`); onClose(); } catch (err) { onToast(err.message); } }}>Assegna</button>
      </>}>
      <div className="field"><label>Linea di reperibilità</label><select className="input" value={line} onChange={(e) => setLine(e.target.value)}><option value="Base">Base</option><option value="Garofalo">Garofalo</option></select></div>
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
      {occupied
        ? <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Linea <strong>{line}</strong> già assegnata a <strong>{people.find((person) => person.id === occupied.empId)?.name || 'un altro dipendente'}</strong> per questa settimana. Puoi usare l’altra linea o eliminare prima l’assegnazione esistente.</div></div>
        : showWarning
        ? <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Assegnazione bloccata: il dipendente è in <strong>{blocked}</strong> per l’intero periodo selezionato.</div></div>
        : <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px', background: 'var(--c-reper-bg)', borderColor: '#B6E2DE', color: 'var(--c-reper-tx)' }}><Icon name="check" size={15} /><div>Linea {line} disponibile. Lo stesso dipendente può essere assegnato anche all’altra linea.</div></div>}
    </Modal>
  );
}

/* ---------- TURNI OPERATIVI ---------- */
export function ShiftsView({ scope, buFilter, people = [], bus = BUS, onToast, onRefresh, shifts }) {
  const source = Array.isArray(shifts) ? shifts : SHIFTS;
  const list = source.filter((s) => !buFilter || s.bu === buFilter);
  const attention = list.filter((s) => s.status !== 'attivo');
  const [open, setOpen] = useState(false);
  const [deleteTarget, setDeleteTarget] = useState(null);
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
          <thead><tr><th>Turno</th><th>Assegnato a</th><th>Giorni</th><th>Fascia</th><th>Validità</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {list.length === 0 && <tr><td colSpan="7" className="empty">Nessun turno nello scope corrente.</td></tr>}
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
                  <td><button className="btn btn-sm btn-danger" title="Elimina turno" onClick={() => setDeleteTarget({ row: s, person: p })}><Icon name="x" size={14} />Elimina</button></td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {open && <ShiftModal buFilter={buFilter} people={people} onClose={() => setOpen(false)} onToast={onToast} onRefresh={onRefresh} />}
      {deleteTarget && <DeleteOperationModal title="Elimina turno operativo" message={<>Stai per eliminare il turno <strong style={{ color: 'var(--text)' }}>{deleteTarget.row.title}</strong>.</>}
        details={[["Assegnato a", deleteTarget.person?.name || 'Nessuno'], ['Giorno', deleteTarget.row.day], ['Fascia', deleteTarget.row.time]]}
        onClose={() => setDeleteTarget(null)} onConfirm={async () => { await deleteShift(deleteTarget.row.id); await onRefresh?.(); onToast('Turno operativo eliminato.'); }} />}
    </div>
  );
}

const SHIFT_PRESETS = [
  { label: 'Venerdì 11-18', title: 'Presidio Venerdì', time: '11:00–18:00', days: [4] },
  { label: 'Presidio Italo', title: 'Presidio Italo', time: '09:00–18:00', days: [0,1,2,3,4] },
  { label: 'AGN', title: 'AGN', time: '08:00–20:00', days: [0,1,2,3,4] },
  { label: 'Personalizzato', title: '', time: '', days: [] },
];

function ShiftModal({ buFilter, people = [], onClose, onToast, onRefresh }) {
  const pool = people.filter((p) => !buFilter || p.bu === buFilter);
  const [empId, setEmpId] = useState(pool[0]?.id || '');
  const [presetIdx, setPresetIdx] = useState(3);
  const [title, setTitle] = useState(SHIFT_PRESETS[0].title);
  const [time, setTime] = useState(SHIFT_PRESETS[0].time);
  const [selectedDays, setSelectedDays] = useState([0,1,2,3,4]);
  const [weekStart, setWeekStart] = useState(iso(mondayOf(TODAY)));

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
export function ClosuresView({ scope, closures = CLOSURES, people = PEOPLE, onToast, onRefresh, canEdit = true }) {
  const [expandedGi, setExpandedGi] = useState(null);
  const [gridEdits, setGridEdits] = useState({});
  const [saving, setSaving] = useState(false);

  // Year selector — derive available years from closures + current
  const allClosureYears = [...new Set((closures || []).map(c => Number(c.date.slice(0, 4))))].sort();
  const currentYear = new Date().getFullYear();
  const minYear = allClosureYears.length ? Math.min(allClosureYears[0], currentYear) : currentYear;
  const maxYear = allClosureYears.length ? Math.max(allClosureYears[allClosureYears.length - 1], currentYear + 1) : currentYear + 1;
  const [selectedYear, setSelectedYear] = useState(currentYear);

  // Filter closures for selected year
  const yearPrefix = String(selectedYear);
  const sorted = [...(closures || [])].filter(c => c.date.startsWith(yearPrefix)).sort((a, b) => a.date.localeCompare(b.date));

  // Compute national holidays for selected year
  const yearHolidays = holidaysFor(selectedYear);
  const holidays = Object.entries(yearHolidays).sort();

  // Group closures by label
  const grouped = [];
  let cur = null;
  for (const c of sorted) {
    if (cur && cur.label === c.label) {
      cur.dates.push(c.date);
      cur.items.push(c);
    } else {
      if (cur) grouped.push(cur);
      cur = { label: c.label, dates: [c.date], items: [c] };
    }
  }
  if (cur) grouped.push(cur);

  const getEdit = (closureId) => gridEdits[closureId] ?? null;
  const isPresidio = (closureId, empId) => {
    const e = getEdit(closureId);
    if (e) return e.includes(empId);
    const item = sorted.find(c => c.id === closureId);
    return item ? item.presidio.includes(empId) : false;
  };

  const toggleCell = (closureId, empId) => {
    const current = getEdit(closureId) ?? (sorted.find(c => c.id === closureId)?.presidio || []);
    const idx = current.indexOf(empId);
    const next = idx >= 0 ? current.filter(id => id !== empId) : [...current, empId];
    setGridEdits(prev => ({ ...prev, [closureId]: next }));
  };

  const setAllFerie = (group) => {
    const edits = {};
    for (const item of group.items) edits[item.id] = [];
    setGridEdits(prev => ({ ...prev, ...edits }));
  };

  const setAllPresidio = (group) => {
    const edits = {};
    for (const item of group.items) edits[item.id] = people.map(p => p.id);
    setGridEdits(prev => ({ ...prev, ...edits }));
  };

  const handleSave = async (group) => {
    setSaving(true);
    try {
      const updates = group.items.map(item => ({
        closureId: item.id,
        presidio: getEdit(item.id) ?? item.presidio,
      }));
      await bulkUpdateClosureAssignments(updates);
      setGridEdits({});
      setExpandedGi(null);
      onToast?.('Assegnazioni chiusure salvate.');
      onRefresh?.();
    } catch (err) {
      onToast?.(err.message);
    } finally {
      setSaving(false);
    }
  };

  const DOW6 = ['Lun','Mar','Mer','Gio','Ven','Sab','Dom'];

  return (
    <div className="fade-in">
      <SectionHead title="Chiusure aziendali e festività" sub={scope} />
      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 16px' }}>
        <button className="btn btn-sm" disabled={selectedYear <= minYear} onClick={() => { setSelectedYear(y => y - 1); setExpandedGi(null); setGridEdits({}); }}>←</button>
        <span style={{ fontWeight: 800, fontSize: 17, minWidth: 60, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{selectedYear}</span>
        <button className="btn btn-sm" disabled={selectedYear >= maxYear} onClick={() => { setSelectedYear(y => y + 1); setExpandedGi(null); setGridEdits({}); }}>→</button>
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16, alignItems: 'start' }}>
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>Chiusure aziendali</div>
          <table className="tbl">
            <thead><tr><th>Periodo</th><th>Motivo</th><th>Presidio</th></tr></thead>
            <tbody>{grouped.map((g, gi) => {
              const from = g.dates[0], to = g.dates[g.dates.length - 1];
              const samplePresidio = g.items[0]?.presidio || [];
              return (
                <tr key={gi} style={{ cursor: canEdit ? 'pointer' : 'default' }} onClick={() => { if (canEdit) { setGridEdits({}); setExpandedGi(expandedGi === gi ? null : gi); } }}>
                  <td className="mono">{fmtRange(from, to)}</td>
                  <td style={{ fontWeight: 600 }}>{g.label}</td>
                  <td>{samplePresidio.length
                    ? <div style={{ display: 'flex' }}>{samplePresidio.slice(0,4).map((id, i) => <span key={id} style={{ marginLeft: i ? -6 : 0 }}><Avatar p={people.find((p) => p.id === id) || getPerson(id)} size={26} /></span>)}{samplePresidio.length > 4 && <span style={{ fontSize: 11, color: 'var(--text-faint)', marginLeft: 4 }}>+{samplePresidio.length - 4}</span>}</div>
                    : <span className="badge badge-gray">Tutti in ferie</span>}</td>
                </tr>
              );
            })}
            {grouped.length === 0 && <tr><td colSpan="3" className="empty">Nessuna chiusura programmata.</td></tr>}
            </tbody>
          </table>

          {expandedGi !== null && grouped[expandedGi] && (() => {
            const g = grouped[expandedGi];
            return (
              <div style={{ padding: '14px 18px', borderTop: '1px solid var(--line)', background: 'var(--surface-2)' }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10, marginBottom: 12 }}>
                  <strong style={{ fontSize: 14 }}>{g.label}</strong>
                  <span className="spacer" />
                  {canEdit && <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setAllFerie(g); }}>Tutti in ferie</button>
                    <button className="btn btn-sm" onClick={(e) => { e.stopPropagation(); setAllPresidio(g); }}>Tutti in presidio</button>
                  </div>}
                </div>
                <div style={{ overflowX: 'auto' }}>
                  <table className="tbl" style={{ minWidth: 60 + g.dates.length * 52 }}>
                    <thead>
                      <tr>
                        <th style={{ minWidth: 140, position: 'sticky', left: 0, background: 'var(--surface-2)', zIndex: 2 }}>Persona</th>
                        {g.dates.map(d => {
                          const D = parse(d);
                          return <th key={d} style={{ textAlign: 'center', minWidth: 50, fontSize: 11 }}>
                            <div>{DOW6[(D.getDay()+6)%7]}</div>
                            <div style={{ fontWeight: 800 }}>{D.getDate()}</div>
                          </th>;
                        })}
                      </tr>
                    </thead>
                    <tbody>
                      {people.map(p => (
                        <tr key={p.id}>
                          <td style={{ position: 'sticky', left: 0, background: 'var(--surface)', zIndex: 1 }}>
                            <div style={{ display: 'flex', alignItems: 'center', gap: 8 }}>
                              <Avatar p={p} size={24} />
                              <span style={{ fontWeight: 600, fontSize: 12.5, whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis', maxWidth: 100 }}>{p.name}</span>
                            </div>
                          </td>
                          {g.items.map(item => {
                            const on = isPresidio(item.id, p.id);
                            return (
                              <td key={item.id} style={{ textAlign: 'center', padding: 4 }}>
                                {canEdit ? (
                                  <button
                                    onClick={(e) => { e.stopPropagation(); toggleCell(item.id, p.id); }}
                                    style={{
                                      width: 36, height: 28, borderRadius: 6, border: '1px solid ' + (on ? 'var(--c-turno)' : 'var(--line)'),
                                      background: on ? 'var(--c-turno-bg)' : 'var(--surface)', color: on ? 'var(--c-turno-tx)' : 'var(--text-faint)',
                                      cursor: 'pointer', fontSize: 11, fontWeight: 700,
                                    }}
                                  >{on ? '✓' : '—'}</button>
                                ) : (
                                  <span style={{ fontSize: 11, color: on ? 'var(--c-turno-tx)' : 'var(--text-faint)' }}>{on ? '✓' : '—'}</span>
                                )}
                              </td>
                            );
                          })}
                        </tr>
                      ))}
                    </tbody>
                  </table>
                </div>
                {canEdit && <div style={{ display: 'flex', gap: 8, marginTop: 12 }}>
                  <button className="btn" onClick={(e) => { e.stopPropagation(); setGridEdits({}); setExpandedGi(null); }}>Annulla</button>
                  <button className="btn btn-primary" disabled={saving} onClick={(e) => { e.stopPropagation(); handleSave(g); }}>{saving ? 'Salvataggio…' : 'Salva assegnazioni'}</button>
                </div>}
              </div>
            );
          })()}
        </div>
        <div className="card">
          <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>Festività nazionali</div>
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
  const [tab, setTab] = useState('people');
  const [buFilter, setBuFilter] = useState('');
  const [users, setUsers] = useState([]);
  const [busData, setBusData] = useState(bus || []);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);
  const [createOpen, setCreateOpen] = useState(false);
  const [editUser, setEditUser] = useState(null);
  const [editBu, setEditBu] = useState(null);
  const [createBuOpen, setCreateBuOpen] = useState(false);
  const [deleteConfirm, setDeleteConfirm] = useState(null);
  const [deleteBuConfirm, setDeleteBuConfirm] = useState(null);

  const loadData = async () => {
    setLoading(true); setError(null);
    try {
      const [usersRes, busRes] = await Promise.all([getAdminUsers(), getAdminBus()]);
      setUsers(usersRes.users || []);
      setBusData(busRes.bus || []);
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  useState(() => { loadData(); }, []);

  const filteredUsers = buFilter ? users.filter((u) => u.bu === buFilter) : users;
  const superAdmin = users.find((u) => u.role === 'SUPER_ADMIN');
  const managers = filteredUsers.filter((u) => u.role === 'ADMIN');
  const employees = filteredUsers.filter((u) => u.role === 'EMPLOYEE');

  const handleCreateUser = async (data) => {
    await createAdminUser(data);
    setCreateOpen(false);
    await loadData();
    onRefresh?.();
  };

  const handleEditUser = async (id, data) => {
    await updateAdminUser(id, data);
    setEditUser(null);
    await loadData();
    onRefresh?.();
  };

  const handleDeleteUser = async (id) => {
    await deleteAdminUser(id);
    setDeleteConfirm(null);
    await loadData();
    onRefresh?.();
  };

  const handleCreateBu = async (data) => {
    await createAdminBu(data);
    setCreateBuOpen(false);
    await loadData();
    onRefresh?.();
  };

  const handleEditBu = async (id, data) => {
    await updateAdminBu(id, data);
    setEditBu(null);
    await loadData();
    onRefresh?.();
  };

  const handleDeleteBu = async (id) => {
    await deleteAdminBu(id);
    setDeleteBuConfirm(null);
    await loadData();
    onRefresh?.();
  };

  const buById = (id) => busData.find((b) => b.id === id);

  if (loading) return <div className="fade-in"><SectionHead title="Gestione" sub="Super Admin" /><div className="card empty"><Icon name="clock" size={24} /><div style={{ marginTop: 8, fontWeight: 600 }}>Caricamento…</div></div></div>;
  if (error) return <div className="fade-in"><SectionHead title="Gestione" sub="Super Admin" /><div className="alert-banner alert-red" style={{ margin: 14 }}><Icon name="alert" size={16} /><div>{error}</div></div></div>;

  return (
    <div className="fade-in">
      <SectionHead title="Gestione" sub="Super Admin · Persone e Business Unit"
        right={<div className="seg">
          <button className={tab === 'people' ? 'on' : ''} onClick={() => setTab('people')}>Persone</button>
          <button className={tab === 'bus' ? 'on' : ''} onClick={() => setTab('bus')}>Business Unit</button>
        </div>} />

      {tab === 'people' && <>
        <div style={{ display: 'flex', gap: 8, marginBottom: 14, alignItems: 'center', flexWrap: 'wrap' }}>
          <select className="input" style={{ width: 200 }} value={buFilter} onChange={(e) => setBuFilter(e.target.value)}>
            <option value="">Tutte le BU</option>
            {busData.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}
          </select>
          <span className="spacer" />
          <span style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{filteredUsers.length} utenti</span>
          <button className="btn btn-primary btn-sm" onClick={() => setCreateOpen(true)}><Icon name="plus" size={14} sw={2.4} />Crea utente</button>
        </div>

        {superAdmin && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 13.5 }}>Super Admin</div>
            <div style={{ padding: '12px 16px', display: 'flex', alignItems: 'center', gap: 12 }}>
              <Avatar p={superAdmin} size={36} />
              <div style={{ flex: 1 }}>
                <div style={{ fontWeight: 700 }}>{superAdmin.name}</div>
                <div style={{ fontSize: 12, color: 'var(--text-muted)' }}>{superAdmin.email}</div>
              </div>
              <span className="badge badge-red">Super Admin</span>
            </div>
          </div>
        )}

        {managers.length > 0 && (
          <div className="card" style={{ marginBottom: 14 }}>
            <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 13.5 }}>Manager ({managers.length})</div>
            <table className="tbl">
              <thead><tr><th>Nome</th><th>Email</th><th>Business Unit</th><th></th></tr></thead>
              <tbody>{managers.map((u) => (
                <tr key={u.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar p={u} size={30} /><div><div style={{ fontWeight: 700 }}>{u.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{u.job}</div></div></div></td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{u.email}</td>
                  <td>{u.bu ? <span className="badge badge-gray">{buById(u.bu)?.name || u.bu}</span> : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>Nessuna BU</span>}</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" title="Modifica" onClick={() => setEditUser(u)}><Icon name="sliders" size={15} /></button>
                    <button className="iconbtn" title="Elimina" onClick={() => setDeleteConfirm(u)}><Icon name="x" size={15} /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          </div>
        )}

        <div className="card">
          <div style={{ padding: '12px 16px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 13.5 }}>Dipendenti ({employees.length})</div>
          {employees.length === 0 ? <div className="empty">Nessun dipendente{buFilter ? ' in questa BU' : ''}.</div> : (
            <table className="tbl">
              <thead><tr><th>Nome</th><th>Email</th><th>Business Unit</th><th>Ferie</th><th>Permessi</th><th></th></tr></thead>
              <tbody>{employees.map((u) => (
                <tr key={u.id}>
                  <td><div style={{ display: 'flex', alignItems: 'center', gap: 10 }}><Avatar p={u} size={30} /><div><div style={{ fontWeight: 700 }}>{u.name}</div><div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>{u.job}</div></div></div></td>
                  <td className="mono" style={{ fontSize: 12.5 }}>{u.email}</td>
                  <td>{u.bu ? <span className="badge badge-gray">{buById(u.bu)?.name || u.bu}</span> : <span style={{ color: 'var(--text-faint)', fontSize: 12 }}>—</span>}</td>
                  <td className="mono" style={{ fontSize: 12 }}>{u.ferie ?? '—'}/{u.ferieTot ?? 26} gg</td>
                  <td className="mono" style={{ fontSize: 12 }}>{u.permessi ?? '—'}/{u.permessiTot ?? 32} h</td>
                  <td style={{ textAlign: 'right' }}>
                    <button className="iconbtn" title="Modifica" onClick={() => setEditUser(u)}><Icon name="sliders" size={15} /></button>
                    <button className="iconbtn" title="Elimina" onClick={() => setDeleteConfirm(u)}><Icon name="x" size={15} /></button>
                  </td>
                </tr>
              ))}</tbody>
            </table>
          )}
        </div>
      </>}

      {tab === 'bus' && <>
        <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 14 }}>
          <button className="btn btn-primary btn-sm" onClick={() => setCreateBuOpen(true)}><Icon name="plus" size={14} sw={2.4} />Crea Business Unit</button>
        </div>
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(300px, 1fr))', gap: 14 }}>
          {busData.map((b) => {
            const mgr = b.managerId ? people.find((p) => p.id === b.managerId) || users.find((u) => u.employeeId === b.managerId) : null;
            const ppl = people.filter((p) => p.bu === b.id);
            return (
              <div key={b.id} className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 11 }}>
                <div style={{ display: 'flex', alignItems: 'center', gap: 10 }}>
                  <span style={{ width: 12, height: 12, borderRadius: 4, background: b.color }}></span>
                  <div style={{ fontWeight: 800, fontSize: 15, flex: 1 }}>{b.name}</div>
                  <button className="iconbtn" title="Modifica" onClick={() => setEditBu(b)}><Icon name="sliders" size={15} /></button>
                  <button className="iconbtn" title="Elimina" onClick={() => setDeleteBuConfirm(b)}><Icon name="x" size={15} /></button>
                </div>
                <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>Manager: <strong style={{ color: 'var(--text)' }}>{mgr?.name || 'Non assegnato'}</strong></div>
                <div style={{ display: 'flex', marginTop: 2 }}>
                  {ppl.slice(0, 6).map((p, i) => <span key={p.id} style={{ marginLeft: i ? -8 : 0, border: '2px solid var(--surface)', borderRadius: '50%' }}><Avatar p={p} size={28} /></span>)}
                </div>
                <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{ppl.length} collaboratori</div>
              </div>
            );
          })}
        </div>
      </>}

      {createOpen && <UserCreateModal bus={busData} onClose={() => setCreateOpen(false)} onSubmit={handleCreateUser} />}
      {editUser && <UserEditModal user={editUser} bus={busData} onClose={() => setEditUser(null)} onSubmit={handleEditUser} />}
      {createBuOpen && <BuCreateModal managers={users.filter((u) => u.role === 'ADMIN')} onClose={() => setCreateBuOpen(false)} onSubmit={handleCreateBu} />}
      {editBu && <BuEditModal bu={editBu} managers={users.filter((u) => u.role === 'ADMIN')} onClose={() => setEditBu(null)} onSubmit={handleEditBu} />}
      {deleteConfirm && <Modal title="Elimina utente" icon={<Icon name="alert" size={19} color="var(--red)" />} onClose={() => setDeleteConfirm(null)}
        footer={<><button className="btn" onClick={() => setDeleteConfirm(null)}>Annulla</button><button className="btn btn-danger" onClick={() => handleDeleteUser(deleteConfirm.id)}>Elimina</button></>}>
        <p style={{ fontSize: 13.5 }}>Eliminare <strong>{deleteConfirm.name}</strong> ({deleteConfirm.email})?</p>
        {deleteConfirm.role === 'ADMIN' && <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Se il manager ha una BU assegnata, verrà rimossa come responsabile.</div></div>}
      </Modal>}
      {deleteBuConfirm && <Modal title="Elimina Business Unit" icon={<Icon name="alert" size={19} color="var(--red)" />} onClose={() => setDeleteBuConfirm(null)}
        footer={<><button className="btn" onClick={() => setDeleteBuConfirm(null)}>Annulla</button><button className="btn btn-danger" onClick={() => handleDeleteBu(deleteBuConfirm.id)}>Elimina</button></>}>
        <p style={{ fontSize: 13.5 }}>Eliminare <strong>{deleteBuConfirm.name}</strong>?</p>
        <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>I dipendenti assegnati perderanno la BU ma non verranno eliminati.</div></div>
      </Modal>}
    </div>
  );
}

function UserCreateModal({ bus, onClose, onSubmit }) {
  const [form, setForm] = useState({ role: 'EMPLOYEE', name: '', email: '', password: '', bu: bus[0]?.id || '', job: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true); setError('');
    try { await onSubmit(form); } catch (err) { setError(err.message); setSaving(false); }
  };
  return (
    <Modal title="Crea utente" icon={<Icon name="plus" size={19} color="var(--red)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={saving || !form.name || !form.email || !form.password} onClick={submit}>{saving ? 'Creazione…' : 'Crea utente'}</button></>}>
      {error && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        <button className={form.role === 'EMPLOYEE' ? 'on' : ''} onClick={() => set('role', 'EMPLOYEE')}>Dipendente</button>
        <button className={form.role === 'ADMIN' ? 'on' : ''} onClick={() => set('role', 'ADMIN')}>Manager</button>
      </div>
      <div className="field"><label>Nome completo</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="es. Mario Rossi" /></div>
      <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="mario@azienda.it" /></div>
      <div className="field"><label>Password</label><input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 6 caratteri" /></div>
      <div className="field"><label>Business Unit</label><select className="input" value={form.bu} onChange={(e) => set('bu', e.target.value)}><option value="">Nessuna</option>{bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div className="field"><label>Mansione</label><input className="input" value={form.job} onChange={(e) => set('job', e.target.value)} placeholder={form.role === 'ADMIN' ? 'BU Manager' : 'Dipendente'} /></div>
    </Modal>
  );
}

function UserEditModal({ user, bus, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: user.name || '', email: user.email || '', job: user.job || '', bu: user.bu || '', password: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true); setError('');
    try { await onSubmit(user.id, form); } catch (err) { setError(err.message); setSaving(false); }
  };
  return (
    <Modal title="Modifica utente" icon={<Icon name="sliders" size={19} color="var(--red)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Salvataggio…' : 'Salva'}</button></>}>
      {error && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
      <div className="field"><label>Nome</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} /></div>
      <div className="field"><label>Mansione</label><input className="input" value={form.job} onChange={(e) => set('job', e.target.value)} /></div>
      <div className="field"><label>Business Unit</label><select className="input" value={form.bu} onChange={(e) => set('bu', e.target.value)}><option value="">Nessuna</option>{bus.map((b) => <option key={b.id} value={b.id}>{b.name}</option>)}</select></div>
      <div className="field"><label>Nuova password (lascia vuoto per non cambiare)</label><input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} /></div>
    </Modal>
  );
}

function BuCreateModal({ managers, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: '', color: '#E03127', managerId: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true); setError('');
    try { await onSubmit(form); } catch (err) { setError(err.message); setSaving(false); }
  };
  return (
    <Modal title="Crea Business Unit" icon={<Icon name="plus" size={19} color="var(--red)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={saving || !form.name} onClick={submit}>{saving ? 'Creazione…' : 'Crea BU'}</button></>}>
      {error && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
      <div className="field"><label>Nome</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="es. Sviluppo Software" /></div>
      <div className="field"><label>Colore</label><input className="input" type="color" value={form.color} onChange={(e) => set('color', e.target.value)} /></div>
      <div className="field"><label>Manager responsabile</label><select className="input" value={form.managerId} onChange={(e) => set('managerId', e.target.value)}><option value="">Non assegnato</option>{managers.map((m) => <option key={m.id} value={m.employeeId}>{m.name}</option>)}</select></div>
    </Modal>
  );
}

function BuEditModal({ bu, managers, onClose, onSubmit }) {
  const [form, setForm] = useState({ name: bu.name, color: bu.color || '#5B6472', managerId: bu.managerId || '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true); setError('');
    try { await onSubmit(bu.id, form); } catch (err) { setError(err.message); setSaving(false); }
  };
  return (
    <Modal title="Modifica Business Unit" icon={<Icon name="sliders" size={19} color="var(--red)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={saving} onClick={submit}>{saving ? 'Salvataggio…' : 'Salva'}</button></>}>
      {error && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
      <div className="field"><label>Nome</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} /></div>
      <div className="field"><label>Colore</label><input className="input" type="color" value={form.color} onChange={(e) => set('color', e.target.value)} /></div>
      <div className="field"><label>Manager responsabile</label><select className="input" value={form.managerId} onChange={(e) => set('managerId', e.target.value)}><option value="">Non assegnato</option>{managers.map((m) => <option key={m.id} value={m.employeeId}>{m.name}</option>)}</select></div>
    </Modal>
  );
}

/* ---------- INTEGRAZIONI ---------- */
export function IntegrationsView() {
  const [config, setConfig] = useState(null);
  const [error, setError] = useState('');
  const [tested, setTested] = useState('');
  useEffect(() => {
    getAuthConfig().then(setConfig).catch((err) => setError(err.message));
  }, []);
  if (error) return <div className="alert-banner alert-red"><Icon name="alert" size={16} /><div>{error}</div></div>;
  if (!config) return <div className="card empty">Caricamento integrazioni…</div>;
  const { ldap, google } = config.providers;
  const test = (provider) => {
    setTested(provider);
    window.setTimeout(() => setTested(''), 2500);
  };
  return (
    <div className="fade-in">
      <SectionHead title="Integrazioni" sub="Super Admin · Connessioni esterne e servizi" />
      <div className="alert-banner alert-amber" style={{ marginBottom: 16, fontSize: 12.5 }}><Icon name="alert" size={15} /><div><strong>Modalità demo attiva.</strong> I flussi di accesso sono completi, ma usano identità fittizie e non contattano servizi esterni.</div></div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 16 }}>
        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--c-permesso-bg)', display: 'grid', placeItems: 'center' }}><Icon name="building" size={20} color="var(--c-permesso-tx)" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>LDAP / Active Directory</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Autenticazione directory aziendale</div>
            </div>
            <span className={ldap.enabled ? 'badge badge-green' : 'badge badge-gray'}>{ldap.enabled ? 'Attiva' : 'Disattiva'}</span>
          </div>
          <div style={{ display: 'grid', gap: 9, fontSize: 12.5 }}>
            <div className="card card-pad" style={{ padding: 12, boxShadow: 'none' }}><div style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>Server</div><div className="mono" style={{ marginTop: 3 }}>{ldap.server}</div></div>
            <div className="card card-pad" style={{ padding: 12, boxShadow: 'none' }}><div style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>Base DN</div><div className="mono" style={{ marginTop: 3 }}>{ldap.baseDn}</div></div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}><strong style={{ color: 'var(--text)' }}>{ldap.identities.length} identità demo</strong> · mapping ruoli e scope BU attivo.</div>
          <button className="btn" onClick={() => test('ldap')}><Icon name="check" size={15} />Verifica connessione</button>
          {tested === 'ldap' && <div className="alert-banner" style={{ padding: '8px 11px', borderColor: '#b8dfc5', background: 'var(--c-turno-bg)', color: 'var(--c-turno-tx)', fontSize: 12 }}><Icon name="check" size={14} /><div>Directory demo raggiungibile. Bind e ricerca utenti riusciti.</div></div>}
        </div>

        <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 14 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
            <span style={{ width: 42, height: 42, borderRadius: 10, background: 'var(--c-sw-bg)', display: 'grid', placeItems: 'center' }}><Icon name="settings" size={20} color="var(--c-sw-tx)" /></span>
            <div style={{ flex: 1 }}>
              <div style={{ fontWeight: 800, fontSize: 15 }}>Google Workspace</div>
              <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>Single Sign-On aziendale</div>
            </div>
            <span className={google.enabled ? 'badge badge-green' : 'badge badge-gray'}>{google.enabled ? 'Attiva' : 'Disattiva'}</span>
          </div>
          <div style={{ display: 'grid', gap: 9, fontSize: 12.5 }}>
            <div className="card card-pad" style={{ padding: 12, boxShadow: 'none' }}><div style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>Dominio autorizzato</div><div className="mono" style={{ marginTop: 3 }}>{google.domain}</div></div>
            <div className="card card-pad" style={{ padding: 12, boxShadow: 'none' }}><div style={{ color: 'var(--text-faint)', fontSize: 10.5, textTransform: 'uppercase', fontWeight: 800 }}>Scopes simulati</div><div className="mono" style={{ marginTop: 3 }}>openid · email · profile</div></div>
          </div>
          <div style={{ color: 'var(--text-muted)', fontSize: 12.5 }}><strong style={{ color: 'var(--text)' }}>{google.identities.length} account demo</strong> · controllo dominio e mapping profilo attivi.</div>
          <button className="btn" onClick={() => test('google')}><Icon name="check" size={15} />Verifica configurazione OAuth</button>
          {tested === 'google' && <div className="alert-banner" style={{ padding: '8px 11px', borderColor: '#b8dfc5', background: 'var(--c-turno-bg)', color: 'var(--c-turno-tx)', fontSize: 12 }}><Icon name="check" size={14} /><div>Configurazione demo valida. Redirect e dominio consentiti.</div></div>}
        </div>
      </div>
    </div>
  );
}

export function SuperAdminClosuresView({ onToast }) {
  const [closures, setClosures] = useState(null);
  const [selectedYear, setSelectedYear] = useState(new Date().getFullYear());
  const [showCreate, setShowCreate] = useState(false);
  const [editItem, setEditItem] = useState(null);
  const [editLabel, setEditLabel] = useState('');
  const [editDate, setEditDate] = useState('');
  const [formFrom, setFormFrom] = useState('');
  const [formTo, setFormTo] = useState('');
  const [formLabel, setFormLabel] = useState('');
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');

  const load = async () => {
    try {
      const data = await getAdminClosures();
      setClosures(data.closures || []);
    } catch (e) { setError(e.message); }
  };

  if (closures === null) { load(); return <div className="card empty">Caricamento…</div>; }

  const currentYear = new Date().getFullYear();
  const allYears = [...new Set(closures.map(c => Number(c.date.slice(0, 4))))].sort();
  const minYear = allYears.length ? Math.min(allYears[0], currentYear) : currentYear;
  const maxYear = allYears.length ? Math.max(allYears[allYears.length - 1], currentYear + 2) : currentYear + 2;

  const filtered = closures.filter(c => c.date.startsWith(String(selectedYear))).sort((a, b) => a.date.localeCompare(b.date));

  // Group by label for display
  const grouped = [];
  let cur = null;
  for (const c of filtered) {
    if (cur && cur.label === c.label) { cur.dates.push(c.date); cur.items.push(c); }
    else { if (cur) grouped.push(cur); cur = { label: c.label, dates: [c.date], items: [c] }; }
  }
  if (cur) grouped.push(cur);

  const handleCreate = async () => {
    if (!formFrom || !formLabel) { setError('Data inizio e motivo obbligatori'); return; }
    setSaving(true); setError('');
    try {
      const res = await createAdminClosure({ date: formFrom, to: formTo || undefined, label: formLabel });
      onToast?.(`${res.closures.length} chiusura/e create.`);
      setShowCreate(false); setFormFrom(''); setFormTo(''); setFormLabel('');
      setClosures(null);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleEdit = async () => {
    if (!editItem) return;
    setSaving(true); setError('');
    try {
      await updateAdminClosure(editItem.id, { label: editLabel || undefined, date: editDate || undefined });
      onToast?.('Chiusura aggiornata.');
      setEditItem(null); setClosures(null);
    } catch (e) { setError(e.message); } finally { setSaving(false); }
  };

  const handleDeleteGroup = async (group) => {
    if (!confirm(`Eliminare tutte le ${group.items.length} chiusure "${group.label}" (${fmtRange(group.dates[0], group.dates[group.dates.length - 1])})?`)) return;
    try {
      for (const item of group.items) await deleteAdminClosure(item.id);
      onToast?.(`${group.items.length} chiusure eliminate.`);
      setClosures(null);
    } catch (e) { onToast?.(e.message); }
  };

  return (
    <div className="fade-in">
      <SectionHead title="Gestione chiusure aziendali" sub="Super Admin" />
      {error && <div className="alert-banner alert-red" style={{ marginBottom: 12, fontSize: 13 }}><Icon name="alert" size={15} /><div>{error}</div></div>}

      <div style={{ display: 'flex', alignItems: 'center', justifyContent: 'center', gap: 16, margin: '8px 0 16px' }}>
        <button className="btn btn-sm" disabled={selectedYear <= minYear} onClick={() => setSelectedYear(y => y - 1)}>←</button>
        <span style={{ fontWeight: 800, fontSize: 17, minWidth: 60, textAlign: 'center', fontVariantNumeric: 'tabular-nums' }}>{selectedYear}</span>
        <button className="btn btn-sm" disabled={selectedYear >= maxYear} onClick={() => setSelectedYear(y => y + 1)}>→</button>
      </div>

      <div style={{ display: 'flex', justifyContent: 'flex-end', marginBottom: 12 }}>
        <button className="btn btn-primary" onClick={() => { setShowCreate(true); setError(''); }}>+ Nuova chiusura</button>
      </div>

      {showCreate && (
        <div className="card" style={{ marginBottom: 16, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 12 }}>Crea chiusura</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr 2fr', gap: 12, alignItems: 'end' }}>
            <div className="field">
              <label>Data inizio *</label>
              <input className="input" type="date" value={formFrom} onChange={e => setFormFrom(e.target.value)} />
            </div>
            <div className="field">
              <label>Data fine (opzionale)</label>
              <input className="input" type="date" value={formTo} onChange={e => setFormTo(e.target.value)} />
              <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 4 }}>Se vuoto, crea 1 giorno</div>
            </div>
            <div className="field">
              <label>Motivo *</label>
              <input className="input" value={formLabel} onChange={e => setFormLabel(e.target.value)} placeholder="es. Chiusura estiva" />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn" onClick={() => setShowCreate(false)}>Annulla</button>
            <button className="btn btn-primary" disabled={saving} onClick={handleCreate}>{saving ? 'Creazione…' : 'Crea'}</button>
          </div>
        </div>
      )}

      {editItem && (
        <div className="card" style={{ marginBottom: 16, padding: 18 }}>
          <div style={{ fontWeight: 800, fontSize: 14.5, marginBottom: 12 }}>Modifica chiusura — {fmtRange(editItem.date, editItem.date)}</div>
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 2fr', gap: 12, alignItems: 'end' }}>
            <div className="field">
              <label>Data</label>
              <input className="input" type="date" value={editDate} onChange={e => setEditDate(e.target.value)} />
            </div>
            <div className="field">
              <label>Motivo</label>
              <input className="input" value={editLabel} onChange={e => setEditLabel(e.target.value)} />
            </div>
          </div>
          <div style={{ display: 'flex', gap: 8, marginTop: 14 }}>
            <button className="btn" onClick={() => setEditItem(null)}>Annulla</button>
            <button className="btn btn-primary" disabled={saving} onClick={handleEdit}>{saving ? 'Salvataggio…' : 'Salva'}</button>
          </div>
        </div>
      )}

      <div className="card">
        <div style={{ padding: '14px 18px', borderBottom: '1px solid var(--line)', fontWeight: 800, fontSize: 14.5 }}>
          Chiusure {selectedYear}
          <span style={{ fontWeight: 400, color: 'var(--text-muted)', marginLeft: 8, fontSize: 12.5 }}>({filtered.length} giorni, {grouped.length} gruppi)</span>
        </div>
        <table className="tbl">
          <thead><tr><th>Periodo</th><th>Motivo</th><th>Giorni</th><th style={{ width: 120 }}>Azioni</th></tr></thead>
          <tbody>
            {grouped.map((g, gi) => (
              <tr key={gi}>
                <td className="mono">{fmtRange(g.dates[0], g.dates[g.dates.length - 1])}</td>
                <td style={{ fontWeight: 600 }}>{g.label}</td>
                <td>{g.items.length}</td>
                <td>
                  <div style={{ display: 'flex', gap: 6 }}>
                    <button className="btn btn-sm" onClick={() => { setEditItem(g.items[0]); setEditLabel(g.label); setEditDate(g.items[0].date); }}>Modifica</button>
                    <button className="btn btn-sm btn-danger" onClick={() => handleDeleteGroup(g)}>Elimina</button>
                  </div>
                </td>
              </tr>
            ))}
            {grouped.length === 0 && <tr><td colSpan="4" className="empty">Nessuna chiusura per il {selectedYear}.</td></tr>}
          </tbody>
        </table>
      </div>
    </div>
  );
}
