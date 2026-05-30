import { useState } from 'react';
import { Icon, Avatar, Pill, Modal, SectionHead } from './components.jsx';
import { STATUS, person as getPerson, bu as getBU, peopleOf, fmtRange, parse, addDays, iso, TODAY, holidayName, closure } from './data.js';

function reqStatusBadge(s) {
  if (s === 'pending')  return <span className="badge badge-amber"><Icon name="clock" size={11} sw={2.4} />In attesa</span>;
  if (s === 'approved') return <span className="badge badge-green"><Icon name="check" size={11} sw={2.6} />Approvata</span>;
  return <span className="badge badge-red"><Icon name="x" size={11} sw={2.6} />Rifiutata</span>;
}

function overlapsFor(req, getEntries) {
  const p = getPerson(req.empId);
  const colleagues = peopleOf(p.bu).filter((x) => x.id !== p.id);
  const from = parse(req.from), to = parse(req.to);
  const names = new Set();
  for (let d = new Date(from); d <= to; d = addDays(d, 1)) {
    const di = iso(d);
    colleagues.forEach((c) => {
      if (getEntries(c.id, di).some((e) => ['ferie','malattia','permesso'].includes(e.type))) names.add(c.name);
    });
  }
  return [...names];
}

function RejectModal({ req, onClose, onConfirm }) {
  const [reason, setReason] = useState('');
  const p = getPerson(req.empId);
  return (
    <Modal title="Rifiuta richiesta" icon={<Icon name="x" size={20} color="var(--red)" />} iconBg="var(--red-tint)" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={reason.trim().length < 4} onClick={() => onConfirm(reason)}>Conferma rifiuto</button>
      </>}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar p={p} size={40} />
        <div>
          <div style={{ fontWeight: 700 }}>{p.name}</div>
          <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{STATUS[req.type].label} · {fmtRange(req.from, req.to)}</div>
        </div>
      </div>
      <div className="field">
        <label>Motivazione del rifiuto <span style={{ color: 'var(--red)' }}>*</span></label>
        <textarea className="input" value={reason} onChange={(e) => setReason(e.target.value)}
          placeholder="La motivazione è obbligatoria e verrà comunicata al dipendente." autoFocus></textarea>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Minimo 4 caratteri.</span>
      </div>
    </Modal>
  );
}

function RequestCard({ req, getEntries, onApprove, onReject, canDecide = true }) {
  const p = getPerson(req.empId);
  const overlaps = req.type === 'ferie' ? overlapsFor(req, getEntries) : [];
  const balance = req.type === 'ferie' ? p.ferie : p.permessi;
  const insufficient = req.type === 'ferie' && (balance - (req.days || 0) < 0);
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 12 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 12 }}>
        <Avatar p={p} size={42} />
        <div style={{ flex: 1, minWidth: 0 }}>
          <div style={{ fontWeight: 700, fontSize: 14.5 }}>{p.name}</div>
          <div style={{ fontSize: 12, color: 'var(--text-faint)' }}>{p.job} · {getBU(p.bu).name}</div>
        </div>
        <Pill type={req.type} />
      </div>

      <div style={{ display: 'flex', gap: 20, flexWrap: 'wrap' }}>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>Periodo</div>
          <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{fmtRange(req.from, req.to)}{req.time ? ' · ' + req.time : ''}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>Quantità</div>
          <div className="mono" style={{ fontWeight: 600, marginTop: 2 }}>{req.type === 'ferie' ? `${req.days} giorni` : `${req.hours} ore`}</div>
        </div>
        <div>
          <div style={{ fontSize: 11, color: 'var(--text-muted)', fontWeight: 700, textTransform: 'uppercase', letterSpacing: '.05em', whiteSpace: 'nowrap' }}>Saldo residuo</div>
          <div className="mono" style={{ fontWeight: 600, marginTop: 2, color: insufficient ? 'var(--red)' : 'inherit' }}>
            {req.type === 'ferie' ? `${balance} gg` : `${balance} h`}
          </div>
        </div>
      </div>

      {req.note && <div style={{ fontSize: 13, color: 'var(--text-muted)', fontStyle: 'italic' }}>"{req.note}"</div>}

      {(req.flagHoliday || overlaps.length >= 2 || insufficient) && (
        <div style={{ display: 'flex', flexDirection: 'column', gap: 7 }}>
          {req.flagHoliday && <div className="alert-banner alert-red" style={{ padding: '9px 12px', fontSize: 12.5 }}><Icon name="alert" size={15} /><div>Il <strong>2 giugno</strong> è festività nazionale: verrà escluso dal conteggio ferie.</div></div>}
          {insufficient && <div className="alert-banner alert-red" style={{ padding: '9px 12px', fontSize: 12.5 }}><Icon name="alert" size={15} /><div>Saldo ferie insufficiente per coprire l&apos;intero periodo.</div></div>}
          {overlaps.length >= 2 && <div className="alert-banner alert-amber" style={{ padding: '9px 12px', fontSize: 12.5 }}><Icon name="users" size={15} /><div>Sovrapposizione con <strong>{overlaps.length} colleghi</strong>: {overlaps.slice(0,3).join(', ')}{overlaps.length>3?'…':''}.</div></div>}
        </div>
      )}

      <div style={{ display: 'flex', gap: 9, marginTop: 2 }}>
        {canDecide ? <>
          <button className="btn btn-primary btn-sm" onClick={() => onApprove(req)}><Icon name="check" size={15} sw={2.4} />Approva</button>
          <button className="btn btn-sm btn-danger" onClick={() => onReject(req)}><Icon name="x" size={15} sw={2.4} />Rifiuta</button>
        </> : <span className="badge badge-gray">Solo consultazione</span>}
        <div className="spacer"></div>
        <span style={{ fontSize: 11.5, color: 'var(--text-faint)', alignSelf: 'center' }}>Inviata {fmtRange(req.submitted, req.submitted)}</span>
      </div>
    </div>
  );
}

function DecidedCard({ req }) {
  const p = getPerson(req.empId);
  const by = req.decidedBy ? getPerson(req.decidedBy) : null;
  return (
    <div className="card card-pad" style={{ display: 'flex', flexDirection: 'column', gap: 10, opacity: .96 }}>
      <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
        <Avatar p={p} size={38} />
        <div style={{ flex: 1 }}>
          <div style={{ fontWeight: 700 }}>{p.name}</div>
          <div className="mono" style={{ fontSize: 12, color: 'var(--text-muted)' }}>{STATUS[req.type].label} · {fmtRange(req.from, req.to)}</div>
        </div>
        {reqStatusBadge(req.status)}
      </div>
      {req.reason && <div className="alert-banner alert-red" style={{ padding: '8px 11px', fontSize: 12.5 }}><Icon name="dot" size={4} /><div><strong>Motivazione:</strong> {req.reason}</div></div>}
      {by && <div style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Decisa da {by.name}</div>}
    </div>
  );
}

export function RequestsManager({ reqs, getEntries, onApprove, onReject, scope, canDecide = true, people, onSubmit }) {
  const [tab, setTab] = useState('pending');
  const [rejectReq, setRejectReq] = useState(null);
  const [showCreate, setShowCreate] = useState(false);
  const list = reqs.filter((r) => r.status === tab);
  const counts = {
    pending: reqs.filter(r=>r.status==='pending').length,
    approved: reqs.filter(r=>r.status==='approved').length,
    rejected: reqs.filter(r=>r.status==='rejected').length,
  };
  return (
    <div className="fade-in">
      <SectionHead title="Richieste ferie e permessi" sub={scope}
        right={<div style={{ display: 'flex', gap: 8, alignItems: 'center' }}>
          {people && onSubmit && <button className="btn btn-primary" onClick={() => setShowCreate(true)}><Icon name="plus" size={16} sw={2.4} />Nuova richiesta</button>}
          <div className="seg">
          {[['pending','In attesa'],['approved','Approvate'],['rejected','Rifiutate']].map(([k,l]) => (
            <button key={k} className={tab === k ? 'on' : ''} onClick={() => setTab(k)}>
              {l}{k==='pending'&&counts.pending?` · ${counts.pending}`:''}
            </button>
          ))}
        </div>
          </div>} />
      {list.length === 0
        ? <div className="card empty"><Icon name="inbox" size={30} /><div style={{ marginTop: 8, fontWeight: 600 }}>Nessuna richiesta {tab==='pending'?'in attesa':tab==='approved'?'approvata':'rifiutata'}.</div></div>
        : <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill,minmax(380px,1fr))', gap: 14 }}>
            {list.map((r) => tab === 'pending'
              ? <RequestCard key={r.id} req={r} getEntries={getEntries} onApprove={onApprove} onReject={setRejectReq} canDecide={canDecide} />
              : <DecidedCard key={r.id} req={r} />)}
          </div>}
      {canDecide && rejectReq && <RejectModal req={rejectReq} onClose={() => setRejectReq(null)} onConfirm={(reason) => { onReject(rejectReq, reason); setRejectReq(null); }} />}
      {showCreate && people && <ManagerCreateRequestModal people={people} onClose={() => setShowCreate(false)} onSubmit={(r) => { onSubmit(r); setShowCreate(false); }} />}
    </div>
  );
}

function ManagerCreateRequestModal({ people, onClose, onSubmit }) {
  const [empId, setEmpId] = useState(people[0]?.id || '');
  const [type, setType] = useState('ferie');
  const [from, setFrom] = useState('2026-06-15');
  const [to, setTo] = useState('2026-06-17');
  const [time, setTime] = useState('14:00–18:00');
  const [note, setNote] = useState('');

  const me = people.find((p) => p.id === empId);
  const fromD = parse(from), toD = parse(to);
  const valid = toD >= fromD;
  let days = 0, blockHoliday = null;
  if (valid) {
    for (let d = new Date(fromD); d <= toD; d = addDays(d, 1)) {
      const di = iso(d);
      const hn = holidayName(di);
      if (hn) blockHoliday = blockHoliday || hn + ' (' + d.getDate() + '/' + (d.getMonth() + 1) + ')';
      else if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
  }
  const overBalance = me && type === 'ferie' && days > me.ferie;
  const canSubmit = empId && valid && !overBalance && (type !== 'ferie' || days > 0);

  return (
    <Modal title="Crea richiesta per dipendente" icon={<Icon name="plus" size={20} color="var(--red)" />} iconBg="var(--red-tint)" onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={!canSubmit} onClick={() => onSubmit({
          empId, type, from, to,
          days: type === 'ferie' ? days : undefined,
          hours: type !== 'ferie' ? 4 : undefined,
          time: type !== 'ferie' ? time : undefined,
          note,
        })}>Crea richiesta</button>
      </>}>
      <div className="field">
        <label>Dipendente *</label>
        <select className="input" value={empId} onChange={(e) => setEmpId(e.target.value)}>
          {people.map((p) => <option key={p.id} value={p.id}>{p.name} — {p.job}</option>)}
        </select>
      </div>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        {[['ferie','Ferie'],['permesso','Permesso'],['malattia','Malattia'],['sw','Smart working']].map(([k,l]) => (
          <button key={k} className={type===k?'on':''} onClick={() => setType(k)}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field"><label>Dal</label><input type="date" className="input mono" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>Al</label><input type="date" className="input mono" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {type === 'permesso' && <div className="field"><label>Fascia oraria</label><input className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
      <div className="field"><label>Note (facoltative)</label><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo o dettagli…"></textarea></div>
      {me && valid && type === 'ferie' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span className="badge badge-gray">{days} giorni lavorativi</span>
          <span style={{ color: 'var(--text-muted)' }}>saldo dopo: <strong style={{ color: overBalance ? 'var(--red)' : 'var(--c-turno-tx)' }}>{me.ferie - days} gg</strong></span>
        </div>
      )}
      {blockHoliday && <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Include <strong>{blockHoliday}</strong>: la festività è esclusa automaticamente dal conteggio.</div></div>}
      {overBalance && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Saldo ferie insufficiente ({me.ferie} gg disponibili). Riduci il periodo.</div></div>}
      {!valid && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>La data finale deve essere successiva a quella iniziale.</div></div>}
    </Modal>
  );
}

export function RequestsEmployee({ me, reqs, onSubmit }) {
  const [open, setOpen] = useState(false);
  const employeeId = me.employeeId || me.id;
  const mine = reqs.filter((r) => r.empId === employeeId);
  return (
    <div className="fade-in">
      <SectionHead title="Le mie richieste" sub={`${me.ferie} giorni di ferie e ${me.permessi} ore di permesso residue`}
        right={<button className="btn btn-primary" onClick={() => setOpen(true)}><Icon name="plus" size={16} sw={2.4} />Nuova richiesta</button>} />
      <div style={{ display: 'grid', gridTemplateColumns: 'repeat(3,1fr)', gap: 14, marginBottom: 16 }}>
        <div className="card card-pad kpi">
          <div className="kpi-val">{me.ferie}<span style={{ fontSize: 15, color: 'var(--text-faint)' }}> / {me.ferieTot}</span></div>
          <div className="kpi-lbl">Giorni di ferie residui</div>
        </div>
        <div className="card card-pad kpi">
          <div className="kpi-val">{me.permessi}<span style={{ fontSize: 15, color: 'var(--text-faint)' }}> / {me.permessiTot}</span></div>
          <div className="kpi-lbl">Ore di permesso residue</div>
        </div>
        <div className="card card-pad kpi">
          <div className="kpi-val">{mine.filter(r=>r.status==='pending').length}</div>
          <div className="kpi-lbl">Richieste in attesa</div>
        </div>
      </div>
      <div className="card">
        <table className="tbl">
          <thead><tr><th>Tipo</th><th>Periodo</th><th>Quantità</th><th>Stato</th><th></th></tr></thead>
          <tbody>
            {mine.length === 0 && <tr><td colSpan="5" className="empty">Nessuna richiesta inviata.</td></tr>}
            {mine.map((r) => (
              <tr key={r.id}>
                <td><Pill type={r.type} /></td>
                <td className="mono">{fmtRange(r.from, r.to)}{r.time ? ' · ' + r.time : ''}</td>
                <td className="mono">{r.type === 'ferie' ? `${r.days} gg` : `${r.hours} h`}</td>
                <td>{reqStatusBadge(r.status)}</td>
                <td style={{ fontSize: 12, color: 'var(--text-faint)', maxWidth: 200 }}>{r.reason ? `Motivo: ${r.reason}` : ''}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {open && <NewRequestModal me={me} onClose={() => setOpen(false)} onSubmit={(r) => { onSubmit(r); setOpen(false); }} />}
    </div>
  );
}

function NewRequestModal({ me, onClose, onSubmit }) {
  const [type, setType] = useState('ferie');
  const [from, setFrom] = useState('2026-06-15');
  const [to, setTo]     = useState('2026-06-17');
  const [time, setTime] = useState('14:00–18:00');
  const [note, setNote] = useState('');

  const fromD = parse(from), toD = parse(to);
  const valid = toD >= fromD;
  let days = 0, blockHoliday = null, blockClosure = null;
  if (valid) {
    for (let d = new Date(fromD); d <= toD; d = addDays(d, 1)) {
      const di = iso(d);
      const hn = holidayName(di);
      const cl = closure(di);
      if (hn) blockHoliday = blockHoliday || hn + ' (' + d.getDate() + '/' + (d.getMonth()+1) + ')';
      else if (cl) blockClosure = blockClosure || cl.label;
      else if (d.getDay() !== 0 && d.getDay() !== 6) days++;
    }
  }
  const overBalance = type === 'ferie' && days > me.ferie;
  const canSubmit = valid && !overBalance && (type !== 'ferie' || days > 0);

  return (
    <Modal title="Nuova richiesta" icon={<Icon name="calendar" size={20} color="var(--red)" />} onClose={onClose}
      footer={<>
        <button className="btn" onClick={onClose}>Annulla</button>
        <button className="btn btn-primary" disabled={!canSubmit} onClick={() => onSubmit({
          type, from, to,
          days: type === 'ferie' ? days : undefined,
          hours: type !== 'ferie' ? 4 : undefined,
          time: type !== 'ferie' ? time : undefined,
          status: 'pending', submitted: iso(TODAY), note,
        })}>Invia richiesta</button>
      </>}>
      <div className="seg" style={{ alignSelf: 'flex-start' }}>
        {[['ferie','Ferie'],['permesso','Permesso']].map(([k,l]) => (
          <button key={k} className={type===k?'on':''} onClick={() => setType(k)}>{l}</button>
        ))}
      </div>
      <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 12 }}>
        <div className="field"><label>Dal</label><input type="date" className="input mono" value={from} onChange={(e) => setFrom(e.target.value)} /></div>
        <div className="field"><label>Al</label><input type="date" className="input mono" value={to} onChange={(e) => setTo(e.target.value)} /></div>
      </div>
      {type === 'permesso' && <div className="field"><label>Fascia oraria</label><input className="input" value={time} onChange={(e) => setTime(e.target.value)} /></div>}
      <div className="field"><label>Note (facoltative)</label><textarea className="input" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Motivo o dettagli…"></textarea></div>
      {valid && type === 'ferie' && (
        <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 13 }}>
          <span className="badge badge-gray">{days} giorni lavorativi</span>
          <span style={{ color: 'var(--text-muted)' }}>saldo dopo: <strong style={{ color: overBalance ? 'var(--red)' : 'var(--c-turno-tx)' }}>{me.ferie - days} gg</strong></span>
        </div>
      )}
      {blockHoliday && <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Include <strong>{blockHoliday}</strong>: la festività è esclusa automaticamente dal conteggio.</div></div>}
      {blockClosure && <div className="alert-banner alert-amber" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Include una <strong>chiusura aziendale</strong> ({blockClosure}): non scala dalle ferie.</div></div>}
      {overBalance && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>Saldo ferie insufficiente ({me.ferie} gg disponibili). Riduci il periodo.</div></div>}
      {!valid && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>La data finale deve essere successiva a quella iniziale.</div></div>}
    </Modal>
  );
}
