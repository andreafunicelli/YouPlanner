import { useState, useRef } from 'react';
import { Icon, Avatar, Pill, Popover } from './components.jsx';
import { STATUS, DOW, MONTHS, addDays, iso, parse } from './data.js';

export function dayConflict(people, date, getEntries, th) {
  let absent = 0, remote = 0;
  const absNames = [], remNames = [];
  people.forEach((p) => {
    const ents = getEntries(p.id, date);
    if (ents.some((e) => STATUS[e.type] && STATUS[e.type].absent)) { absent++; absNames.push(p.name); }
    if (ents.some((e) => e.type === 'sw')) { remote++; remNames.push(p.name); }
  });
  return { absent, remote, absNames, remNames, absConf: absent >= th.absent, remConf: remote >= th.remote };
}

const TYPE_CHOICES = [
  { type: 'turno', needsTime: true },
  { type: 'sw' },
  { type: 'ferie' },
  { type: 'permesso', needsTime: true },
  { type: 'malattia' },
  { type: 'reperibilita', needsTime: true },
];

function CellEditor({ anchorRef, person, date, current, onClose, onSave, onClear }) {
  const init = current && current[0] ? current[0].type : null;
  const [type, setType] = useState(init);
  const [time, setTime] = useState(current && current[0] ? current[0].time || '' : '');
  const locked = current && current[0] && ['festa', 'presidio', 'chiusura'].includes(current[0].type);
  const D = parse(date);
  return (
    <Popover anchorRef={anchorRef} onClose={onClose} width={300}>
      <div className="pop-head">
        <Avatar p={person} size={32} />
        <div style={{ lineHeight: 1.2 }}>
          <div style={{ fontWeight: 700, fontSize: 13.5 }}>{person.name}</div>
          <div style={{ fontSize: 11.5, color: 'var(--text-muted)' }}>
            {DOW[(D.getDay()+6)%7]} {D.getDate()} {MONTHS[D.getMonth()].slice(0,3)}
          </div>
        </div>
      </div>
      <div className="pop-body">
        {locked ? (
          <div style={{ fontSize: 13, color: 'var(--text-muted)' }}>
            Giorno bloccato: <strong>{current[0].label}</strong>. Le assegnazioni non sono modificabili.
          </div>
        ) : (
          <>
            <div style={{ fontSize: 11.5, fontWeight: 700, color: 'var(--text-muted)', textTransform: 'uppercase', letterSpacing: '.06em' }}>Stato</div>
            <div className="pop-grid">
              {TYPE_CHOICES.map((c) => (
                <button key={c.type} className={'type-opt' + (type === c.type ? ' sel' : '')} onClick={() => setType(c.type)}>
                  <span className="dot" style={{ width: 9, height: 9, borderRadius: 3, background: `var(--c-${c.type === 'reperibilita' ? 'reper' : c.type})` }}></span>
                  {STATUS[c.type].label}
                </button>
              ))}
            </div>
            {type && TYPE_CHOICES.find((c) => c.type === type && c.needsTime) && (
              <div className="field">
                <label>Fascia oraria</label>
                <input className="input" value={time} placeholder="es. 09:00–18:00" onChange={(e) => setTime(e.target.value)} />
              </div>
            )}
            <div style={{ display: 'flex', gap: 8, marginTop: 2 }}>
              <button className="btn btn-primary btn-sm" style={{ flex: 1 }} disabled={!type}
                onClick={() => { onSave([{ type, time: time || undefined }]); onClose(); }}>
                Salva
              </button>
              {current && current.length > 0 && (
                <button className="btn btn-sm btn-danger" onClick={() => { onClear(); onClose(); }}>Rimuovi</button>
              )}
            </div>
          </>
        )}
      </div>
    </Popover>
  );
}

export function WeekView({ people, monday, getEntries, onAssign, canEdit, meId, th, showConflicts, todayIso }) {
  const [edit, setEdit] = useState(null);
  const cellRefs = useRef({});
  const days = Array.from({ length: 7 }, (_, i) => addDays(monday, i));
  const isoDays = days.map(iso);
  const confs = isoDays.map((d) => dayConflict(people, d, getEntries, th));

  return (
    <div className="cal-wrap">
      <div style={{ overflowX: 'auto' }}>
        <div className="cal-grid" style={{ gridTemplateColumns: '232px repeat(7, minmax(118px,1fr))' }}>
          <div className="cal-corner" style={{ top: 0, position: 'sticky', zIndex: 7 }}>
            <Icon name="users" size={15} style={{ marginRight: 7 }} /> {people.length} persone
          </div>
          {days.map((d, i) => {
            const di = isoDays[i];
            const wknd = d.getDay() === 0 || d.getDay() === 6;
            const isToday = di === todayIso;
            const c = confs[i];
            const holidayName = getEntries('__holiday__', di)[0]?.label;
            return (
              <div key={di} className={'cal-dayhead' + (wknd ? ' weekend' : '') + (isToday ? ' today' : '') + (holidayName ? ' festa' : '')}>
                <div className="dh-name">{DOW[i]}</div>
                <div className="dh-num">{d.getDate()}</div>
                {holidayName && <div style={{ fontSize: 10, color: 'var(--c-festa-tx)', fontWeight: 700, marginTop: 1 }}>{holidayName}</div>}
                {showConflicts && (c.absConf || c.remConf) && (
                  <div className="dh-conf">
                    <span className="badge badge-red" style={{ padding: '1px 6px' }}>
                      <Icon name="alert" size={11} sw={2.4} />{c.absConf ? c.absent : c.remote}
                    </span>
                  </div>
                )}
              </div>
            );
          })}

          {people.map((p) => (
            <div key={p.id} style={{ display: 'contents' }}>
              <div className={'cal-emp' + (p.id === meId ? ' me' : '')}>
                <Avatar p={p} size={34} />
                <div style={{ minWidth: 0 }}>
                  <div className="emp-name" style={{ whiteSpace: 'nowrap', overflow: 'hidden', textOverflow: 'ellipsis' }}>{p.name}</div>
                  <div className="emp-meta">{p.job}</div>
                </div>
              </div>
              {isoDays.map((di, i) => {
                const ents = getEntries(p.id, di);
                const wknd = days[i].getDay() === 0 || days[i].getDay() === 6;
                const isToday = di === todayIso;
                const key = p.id + '|' + di;
                if (!cellRefs.current[key]) cellRefs.current[key] = { current: null };
                const cellConf = showConflicts && (
                  (confs[i].absConf && ents.some((e) => STATUS[e.type] && STATUS[e.type].absent)) ||
                  (confs[i].remConf && ents.some((e) => e.type === 'sw'))
                );
                return (
                  <div key={di}
                    ref={(el) => { cellRefs.current[key] = { current: el }; }}
                    className={'cal-cell' + (wknd ? ' weekend' : '') + (isToday ? ' today' : '') + (cellConf ? ' conf' : '')}
                    onClick={() => canEdit && setEdit({ empId: p.id, date: di })}
                    style={{ cursor: canEdit ? 'pointer' : 'default' }}>
                    {ents.map((e, j) => <Pill key={j} type={e.type} time={e.time} note={e.note} />)}
                    {canEdit && ents.length === 0 && <span className="add"><Icon name="plus" size={12} sw={2.4} />assegna</span>}
                  </div>
                );
              })}
            </div>
          ))}
        </div>
      </div>
      {edit && (() => {
        const p = people.find((x) => x.id === edit.empId);
        const ref = cellRefs.current[edit.empId + '|' + edit.date] || { current: null };
        return (
          <CellEditor anchorRef={ref} person={p} date={edit.date} current={getEntries(edit.empId, edit.date)}
            onClose={() => setEdit(null)}
            onSave={(ents) => onAssign(edit.empId, edit.date, ents)}
            onClear={() => onAssign(edit.empId, edit.date, [])} />
        );
      })()}
    </div>
  );
}

export function DayView({ people, date, getEntries, th, showConflicts }) {
  const D = parse(date);
  const c = dayConflict(people, date, getEntries, th);
  const holidayEntry = getEntries('__holiday__', date)[0];
  const present = people.filter((p) => {
    const e = getEntries(p.id, date);
    return e.length === 0 || e.every((x) => !STATUS[x.type] || !STATUS[x.type].absent);
  });
  return (
    <div style={{ display: 'grid', gap: 14 }}>
      {showConflicts && c.absConf && (
        <div className="alert-banner alert-red">
          <Icon name="alert" size={18} />
          <div><strong>{c.absent} persone assenti</strong> — soglia ({th.absent}) superata. {c.absNames.join(', ')}.</div>
        </div>
      )}
      {showConflicts && c.remConf && (
        <div className="alert-banner alert-amber">
          <Icon name="alert" size={18} />
          <div><strong>{c.remote} persone in smart working</strong> — copertura in sede ridotta. {c.remNames.join(', ')}.</div>
        </div>
      )}
      {holidayEntry && (
        <div className="alert-banner alert-amber">
          <Icon name="calendar" size={18} />
          <div><strong>{holidayEntry.label}</strong> — festività nazionale, conteggiata come ferie per tutti.</div>
        </div>
      )}
      <div className="card">
        <div style={{ display: 'flex', gap: 18, padding: '16px 20px', borderBottom: '1px solid var(--line)', alignItems: 'center' }}>
          <div className="kpi"><div className="kpi-val" style={{ color: 'var(--c-turno)' }}>{present.length}</div><div className="kpi-lbl">In servizio</div></div>
          <div className="kpi"><div className="kpi-val" style={{ color: 'var(--c-ferie)' }}>{c.absent}</div><div className="kpi-lbl">Assenti</div></div>
          <div className="kpi"><div className="kpi-val" style={{ color: 'var(--c-sw)' }}>{c.remote}</div><div className="kpi-lbl">Smart working</div></div>
        </div>
        <table className="tbl">
          <tbody>
            {people.map((p) => {
              const ents = getEntries(p.id, date);
              return (
                <tr key={p.id}>
                  <td style={{ width: 280 }}>
                    <div style={{ display: 'flex', alignItems: 'center', gap: 11 }}>
                      <Avatar p={p} size={34} />
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontWeight: 700, whiteSpace: 'nowrap' }}>{p.name}</div>
                        <div style={{ fontSize: 12, color: 'var(--text-faint)', whiteSpace: 'nowrap' }}>{p.job}</div>
                      </div>
                    </div>
                  </td>
                  <td>
                    {ents.length
                      ? <div style={{ display: 'flex', gap: 6, flexWrap: 'wrap' }}>{ents.map((e, j) => <Pill key={j} type={e.type} time={e.time} note={e.note} />)}</div>
                      : <span className="badge badge-green"><Icon name="check" size={12} sw={2.6} />Disponibile</span>}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

export function MonthView({ people, anchor, getEntries, th, showConflicts, onPickDay, todayIso }) {
  const first = new Date(anchor.getFullYear(), anchor.getMonth(), 1);
  const startWd = (first.getDay() + 6) % 7;
  const gridStart = addDays(first, -startWd);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(gridStart, i));
  return (
    <div className="month-grid">
      {DOW.map((d) => <div key={d} className="mhead">{d}</div>)}
      {cells.map((d, i) => {
        const di = iso(d);
        const out = d.getMonth() !== anchor.getMonth();
        const isToday = di === todayIso;
        const c = dayConflict(people, di, getEntries, th);
        const holidayEntry = getEntries('__holiday__', di)[0];
        return (
          <div key={i} className={'mcell' + (out ? ' out' : '') + (isToday ? ' today' : '') + (holidayEntry ? ' festa' : '')}
            onClick={() => onPickDay && onPickDay(d)} style={{ cursor: 'pointer' }}>
            <div style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
              <span className="mnum">{d.getDate()}</span>
              {showConflicts && (c.absConf || c.remConf) && !out && (
                <span className="badge badge-red" style={{ padding: '1px 6px' }}>
                  <Icon name="alert" size={10} sw={2.6} />{c.absConf ? c.absent : c.remote}
                </span>
              )}
            </div>
            {holidayEntry
              ? <span className="mtag st-festa" style={{ background: 'var(--c-festa-bg)', color: 'var(--c-festa-tx)' }}>{holidayEntry.label}</span>
              : !out && (
                <>
                  {c.absent > 0 && <span className="mtag st-ferie" style={{ background: 'var(--c-ferie-bg)', color: 'var(--c-ferie-tx)' }}><span className="dot" style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--c-ferie)' }}></span>{c.absent} assenti</span>}
                  {c.remote > 0 && <span className="mtag st-sw" style={{ background: 'var(--c-sw-bg)', color: 'var(--c-sw-tx)' }}><span className="dot" style={{ width: 6, height: 6, borderRadius: 2, background: 'var(--c-sw)' }}></span>{c.remote} smart</span>}
                </>
              )}
          </div>
        );
      })}
    </div>
  );
}
