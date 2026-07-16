import { useState, useEffect, useRef } from 'react';
import { bootstrap, login, setToken, getToken, DEMO_CREDENTIALS, decideRequest, createRequest, saveAssignment, getFaq, getNotifications, getProfile, updateProfile, changePassword, uploadAvatar, createManagerEmployee, updateGlobalTweaks, updateMyTweaks, resetMyTweaks } from './api.js';
import { Icon, Avatar, Pill, Toast, Modal } from './components.jsx';
import { TweaksPanel, TweakSection, TweakRadio, TweakToggle, TweakSlider, TweakColor } from './TweaksPanel.jsx';
import { WeekView, DayView, MonthView } from './Calendar.jsx';
import { RequestsManager, RequestsEmployee } from './Requests.jsx';
import { Dashboard, OnCallView, ShiftsView, ClosuresView, AdminView, IntegrationsView, SuperAdminClosuresView } from './Views.jsx';
import {
  PEOPLE, BUS, REQUESTS, NOTIFS, SHIFTS, ASSIGN, SUPERADMIN,
  TODAY, DOW, MONTHS, iso, parse, addDays, mondayOf,
  person as getPerson, bu as getBU, monthStart,
  holidayName, closure,
} from './data.js';

const TWEAK_DEFAULTS = {
  direzione: 'A',
  densita: 'standard',
  vista: 'settimana',
  mostraConflitti: true,
  sogliaAssenti: 3,
  sogliaRemote: 3,
  accento: '#E03127',
  colFerie: '#E08A1E',
  colSw: '#2D7FF0',
};

function TweakControls({ values, onChange, personal = false, onReset }) {
  return <>
    <div style={{ fontSize: 11.5, color: 'rgba(41,38,27,.6)', lineHeight: 1.45 }}>
      {personal ? 'Queste preferenze valgono solo per il tuo account e sovrascrivono i valori globali.' : 'Questi valori diventano il default per tutti gli utenti.'}
    </div>
    <TweakSection label="Direzione visiva" />
    <TweakRadio label="Layout" value={values.direzione} options={[{value:'A',label:'Arioso'},{value:'B',label:'Denso'}]} onChange={(v) => onChange('direzione', v)} />
    <TweakRadio label="Densità calendario" value={values.densita} options={[{value:'compatta',label:'Compatta'},{value:'standard',label:'Standard'},{value:'comoda',label:'Comoda'}]} onChange={(v) => onChange('densita', v)} />
    <TweakRadio label="Vista di default" value={values.vista} options={[{value:'settimana',label:'Sett.'},{value:'mese',label:'Mese'},{value:'giorno',label:'Giorno'}]} onChange={(v) => onChange('vista', v)} />
    <TweakSection label="Rilevamento conflitti" />
    <TweakToggle label="Mostra alert conflitti" value={values.mostraConflitti} onChange={(v) => onChange('mostraConflitti', v)} />
    <TweakSlider label="Soglia assenti" value={values.sogliaAssenti} min={2} max={5} step={1} onChange={(v) => onChange('sogliaAssenti', v)} />
    <TweakSlider label="Soglia smart working" value={values.sogliaRemote} min={2} max={5} step={1} onChange={(v) => onChange('sogliaRemote', v)} />
    <TweakSection label="Colori" />
    <TweakColor label="Accento brand" value={values.accento} options={['#E03127','#17120F','#C2185B','#B91C1C']} onChange={(v) => onChange('accento', v)} />
    <TweakColor label="Colore Ferie" value={values.colFerie} options={['#E08A1E','#D97706','#CA8A04','#9A3412']} onChange={(v) => onChange('colFerie', v)} />
    <TweakColor label="Colore Smart working" value={values.colSw} options={['#2D7FF0','#0E9D94','#7C5CF0','#0EA5E9']} onChange={(v) => onChange('colSw', v)} />
    {personal && <button className="btn btn-sm" style={{ marginTop: 6 }} onClick={onReset}>Ripristina valori globali</button>}
  </>;
}

const ROLE_LABEL = { manager: 'BU Manager', dipendente: 'Dipendente', admin: 'Super Admin' };

function makeGetEntries(assign, holidays, closures) {
  return (empId, date) => {
    const hn = holidays?.[date] || holidayName(date);
    if (hn) return [{ type: 'festa', label: hn }];
    const cl = (closures || []).find((c) => c.date === date) || closure(date);
    if (cl) return cl.presidio.includes(empId) ? [{ type: 'presidio', label: cl.label }] : [{ type: 'chiusura', label: cl.label }];
    return assign[empId + '|' + date] || [];
  };
}

function PanelState({ loading, error, empty, children }) {
  if (loading) return <div className="empty"><Icon name="clock" size={24} /><div style={{ marginTop: 8, fontWeight: 600 }}>Caricamento…</div></div>;
  if (error) return <div className="alert-banner alert-red" style={{ margin: 14 }}><Icon name="alert" size={16} /><div>{error}</div></div>;
  if (empty) return <div className="empty"><Icon name="inbox" size={26} /><div style={{ marginTop: 8, fontWeight: 600 }}>{empty}</div></div>;
  return children;
}

function NotifBell({ onMarkAll }) {
  const [open, setOpen] = useState(false);
  const [items, setItems] = useState([]);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [panelError, setPanelError] = useState(null);
  const [message, setMessage] = useState('');
  const unread = items.filter((n) => n.unread).length;
  useEffect(() => {
    if (!open) return;
    setLoadingPanel(true); setPanelError(null); setMessage('');
    getNotifications()
      .then((data) => { setItems(data.notifications || []); setMessage(data.message || ''); })
      .catch((err) => setPanelError(err.message))
      .finally(() => setLoadingPanel(false));
  }, [open]);
  return (
    <>
      <button className="iconbtn" title="Notifiche" onClick={() => setOpen((v) => !v)}>
        <Icon name="bell" size={20} />
        {unread > 0 && <span className="dot-ind"></span>}
      </button>
      {open && (
        <>
          <div className="pop-overlay" onClick={() => setOpen(false)}></div>
          <div className="notif-pop">
            <div style={{ padding: '13px 16px', borderBottom: '1px solid var(--line)', display: 'flex', alignItems: 'center' }}>
              <strong style={{ fontSize: 14.5 }}>Notifiche</strong>
              {unread > 0 && <span className="badge badge-red" style={{ marginLeft: 8 }}>{unread} nuove</span>}
              <span className="spacer"></span>
              <button className="btn btn-ghost btn-sm" disabled={!items.length} onClick={() => { setItems((ns) => ns.map((n) => ({ ...n, unread:false }))); onMarkAll?.(); }}>Segna lette</button>
            </div>
            {message && <div className="alert-banner alert-amber" style={{ margin: 12, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{message}</div></div>}
            <div style={{ maxHeight: 420, overflow: 'auto' }}>
              <PanelState loading={loadingPanel} error={panelError} empty={!items.length && !message ? 'Nessuna notifica operativa.' : null}>
                {items.map((n) => (
                  <div key={n.id} className="notif-item" style={{ background: n.unread ? 'var(--surface)' : 'var(--surface-2)' }}>
                    <span className="notif-ic" style={{
                      background: n.kind === 'uncovered' ? 'var(--c-permesso-bg)' : n.kind === 'expiring' ? 'var(--c-ferie-bg)' : n.kind === 'oncall' ? 'var(--c-reper-bg)' : 'var(--red-tint)',
                      color:      n.kind === 'uncovered' ? 'var(--c-permesso-tx)' : n.kind === 'expiring' ? 'var(--c-ferie-tx)' : n.kind === 'oncall' ? 'var(--c-reper-tx)' : 'var(--red-700)',
                    }}><Icon name={n.kind === 'expiring' ? 'clock' : 'alert'} size={16} /></span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontWeight: 700, fontSize: 13.5, display: 'flex', alignItems: 'center', gap: 6 }}>{n.title}{n.unread && <span style={{ width: 6, height: 6, borderRadius: 3, background: 'var(--red)' }}></span>}</div>
                      <div style={{ fontSize: 12.5, color: 'var(--text-muted)' }}>{n.body}</div>
                      <div style={{ fontSize: 11, color: 'var(--text-faint)', marginTop: 3 }}>{n.when}</div>
                    </div>
                  </div>
                ))}
              </PanelState>
            </div>
          </div>
        </>
      )}
    </>
  );
}

function FaqButton() {
  const [open, setOpen] = useState(false);
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [errorPanel, setErrorPanel] = useState(null);
  const [sections, setSections] = useState([]);
  useEffect(() => {
    if (!open) return;
    setLoadingPanel(true); setErrorPanel(null);
    getFaq().then((data) => setSections(data.sections || [])).catch((err) => setErrorPanel(err.message)).finally(() => setLoadingPanel(false));
  }, [open]);
  return <>
    <button className="iconbtn" title="FAQ" onClick={() => setOpen(true)}><Icon name="inbox" size={18} /></button>
    {open && <Modal title="FAQ operative" icon={<Icon name="inbox" size={19} color="var(--red)" />} onClose={() => setOpen(false)}>
      <PanelState loading={loadingPanel} error={errorPanel} empty={!sections.length ? 'Nessuna FAQ disponibile per questo ruolo.' : null}>
        <div style={{ display: 'grid', gap: 14 }}>{sections.map((sec) => <div key={sec.title} className="card card-pad" style={{ boxShadow: 'none' }}><div style={{ fontWeight: 800, marginBottom: 8 }}>{sec.title}</div><ul style={{ margin: 0, paddingLeft: 18, color: 'var(--text-muted)', fontSize: 13 }}>{sec.items.map((i) => <li key={i}>{i}</li>)}</ul></div>)}</div>
      </PanelState>
    </Modal>}
  </>;
}

function LoginScreen({ error, onLogin }) {
  return (
    <div className="app" style={{ display: 'grid', placeItems: 'center', minHeight: '100vh', background: 'var(--bg)' }}>
      <div className="card card-pad" style={{ width: 'min(460px, calc(100vw - 32px))', display: 'flex', flexDirection: 'column', gap: 14 }}>
        <div className="brand" style={{ padding: 0 }}>
          <div className="brand-mark">P</div>
          <div><div className="brand-name">People Planner</div><div className="brand-sub">Accesso role-based</div></div>
        </div>
        <div style={{ color: 'var(--text-muted)', fontSize: 13 }}>
          Seleziona un profilo di verifica. Le chiamate passano dal backend locale e applicano scope/validazioni reali.
        </div>
        {error && <div className="alert-banner alert-red" style={{ padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
        <button className="btn btn-primary" onClick={() => onLogin('admin')}>Super Admin · superadmin@peopleplanner.local</button>
        <button className="btn" onClick={() => onLogin('manager')}>Manager BU · manager@peopleplanner.local</button>
        <button className="btn" onClick={() => onLogin('dipendente')}>Dipendente · employee@peopleplanner.local</button>
        <button className="btn btn-ghost" onClick={() => onLogin('managerEmpty')}>Manager senza BU · verifica scope zero</button>
        <div className="mono" style={{ fontSize: 11.5, color: 'var(--text-faint)' }}>Password ambiente locale: demo123</div>
      </div>
    </div>
  );
}

function CalendarPage({ people, getEntries, onAssign, canEdit, meId, th, showConflicts, vista }) {
  const [view, setView] = useState(vista);
  const [monday, setMonday] = useState(mondayOf(TODAY));
  const [monthAnchor, setMonthAnchor] = useState(monthStart(TODAY));
  const [dayAnchor, setDayAnchor] = useState(iso(TODAY));
  const todayIso = iso(TODAY);

  useEffect(() => { setView(vista); }, [vista]);

  const weekLabel = `${monday.getDate()} – ${addDays(monday,6).getDate()} ${MONTHS[addDays(monday,6).getMonth()]} ${monday.getFullYear()}`;
  const navWeek  = (n) => setMonday(addDays(monday, n * 7));
  const navMonth = (n) => setMonthAnchor(new Date(monthAnchor.getFullYear(), monthAnchor.getMonth() + n, 1));
  const navDay   = (n) => setDayAnchor(iso(addDays(parse(dayAnchor), n)));
  const dayD = parse(dayAnchor);

  let label, nav;
  if (view === 'settimana') { label = weekLabel; nav = navWeek; }
  else if (view === 'mese') { label = `${MONTHS[monthAnchor.getMonth()]} ${monthAnchor.getFullYear()}`; nav = navMonth; }
  else { label = `${DOW[(dayD.getDay()+6)%7]} ${dayD.getDate()} ${MONTHS[dayD.getMonth()]} ${dayD.getFullYear()}`; nav = navDay; }

  return (
    <div className="fade-in">
      <div style={{ display: 'flex', alignItems: 'center', gap: 12, marginBottom: 14, flexWrap: 'wrap' }}>
        <div className="seg">
          {[['settimana','Settimana'],['mese','Mese'],['giorno','Giorno']].map(([k,l]) => (
            <button key={k} className={view===k?'on':''} onClick={() => setView(k)}>{l}</button>
          ))}
        </div>
        <div style={{ display: 'flex', alignItems: 'center', gap: 4 }}>
          <button className="iconbtn" onClick={() => nav(-1)}><Icon name="chevL" size={18} /></button>
          <div style={{ fontWeight: 700, fontSize: 15, minWidth: 200, textAlign: 'center', textTransform: 'capitalize' }}>{label}</div>
          <button className="iconbtn" onClick={() => nav(1)}><Icon name="chevR" size={18} /></button>
        </div>
        <button className="btn btn-sm" onClick={() => { setMonday(mondayOf(TODAY)); setMonthAnchor(monthStart(TODAY)); setDayAnchor(iso(TODAY)); }}>Oggi</button>
        <div className="spacer"></div>
        <div className="legend" style={{ fontSize: 11 }}>
          <Pill type="ferie" /><Pill type="sw" /><Pill type="reperibilita" /><Pill type="turno" />
        </div>
      </div>
      {view === 'settimana' && <WeekView people={people} monday={monday} getEntries={getEntries} onAssign={onAssign} canEdit={canEdit} meId={meId} th={th} showConflicts={showConflicts} todayIso={todayIso} />}
      {view === 'mese' && <MonthView people={people} anchor={monthAnchor} getEntries={getEntries} th={th} showConflicts={showConflicts} todayIso={todayIso} onPickDay={(d) => { setDayAnchor(iso(d)); setView('giorno'); }} />}
      {view === 'giorno' && <DayView people={people} date={dayAnchor} getEntries={getEntries} th={th} showConflicts={showConflicts} />}
    </div>
  );
}

function UserMenu({ user, role, onProfile, onLogout }) {
  const [open, setOpen] = useState(false);
  const ref = useRef(null);
  const cur = role === 'admin' ? SUPERADMIN : user;

  useEffect(() => {
    if (!open) return;
    const handler = (e) => {
      if (ref.current && !ref.current.contains(e.target)) setOpen(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [open]);

  return (
    <div style={{ position: 'relative' }} ref={ref}>
      <button className="btn" onClick={() => setOpen((v) => !v)} style={{ paddingLeft: 6 }}>
        <Avatar p={cur} size={26} />
        <span style={{ textAlign: 'left', lineHeight: 1.1 }}>
          <span style={{ display: 'block', fontSize: 13 }}>{cur.name}</span>
          <span style={{ display: 'block', fontSize: 10.5, color: 'var(--text-faint)', fontWeight: 600 }}>{ROLE_LABEL[role]}</span>
        </span>
        <Icon name="chevD" size={15} />
      </button>
      {open && (
        <div className="pop" style={{ position: 'absolute', right: 0, top: 'calc(100% + 6px)', width: 220, zIndex: 100 }}>
          <div style={{ padding: 7 }}>
            <button className="nav-item" style={{ color: 'var(--text)', borderRadius: 9 }} onClick={() => { onProfile(); setOpen(false); }}>
              <Icon name="settings" size={18} />
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Profilo e account</span>
            </button>
            <button className="nav-item" style={{ color: 'var(--text)', borderRadius: 9 }} onClick={() => { onLogout(); setOpen(false); }}>
              <Icon name="logout" size={18} />
              <span style={{ flex: 1, textAlign: 'left', fontWeight: 600, fontSize: 13 }}>Logout</span>
            </button>
          </div>
        </div>
      )}
    </div>
  );
}

function ProfileModal({ onClose, onUserUpdate, onToast }) {
  const [loadingPanel, setLoadingPanel] = useState(false);
  const [errorPanel, setErrorPanel] = useState(null);
  const [success, setSuccess] = useState('');
  const [profile, setProfile] = useState(null);
  const [passwords, setPasswords] = useState({ currentPassword: '', newPassword: '' });
  const [uploadingAvatar, setUploadingAvatar] = useState(false);
  const fileInputRef = useRef(null);
  useEffect(() => {
    setLoadingPanel(true); setErrorPanel(null); setSuccess('');
    getProfile().then((data) => setProfile(data.user)).catch((err) => setErrorPanel(err.message)).finally(() => setLoadingPanel(false));
  }, []);
  const save = async () => {
    try { const data = await updateProfile({ name: profile.name, job: profile.job, av: profile.av }); setProfile(data.user); onUserUpdate?.(data); setSuccess('Profilo aggiornato.'); onToast?.('Profilo aggiornato.'); }
    catch (err) { setErrorPanel(err.message); }
  };
  const savePassword = async () => {
    try { await changePassword(passwords); setPasswords({ currentPassword: '', newPassword: '' }); setSuccess('Password aggiornata.'); onToast?.('Password aggiornata.'); }
    catch (err) { setErrorPanel(err.message); }
  };
  const handleAvatarUpload = async (e) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setUploadingAvatar(true);
    const reader = new FileReader();
    reader.onload = async () => {
      const dataUrl = reader.result;
      try {
        const data = await uploadAvatar({ avatar: dataUrl });
        setProfile(prev => ({ ...prev, avatar: dataUrl }));
        onUserUpdate?.(data);
        setSuccess('Avatar aggiornato.');
        onToast?.('Avatar aggiornato.');
      } catch (err) { setErrorPanel(err.message); }
      setUploadingAvatar(false);
    };
    reader.readAsDataURL(file);
  };
  return (
    <Modal title="Profilo e account" icon={<Icon name="settings" size={19} color="var(--red)" />} onClose={onClose} footer={profile && <><button className="btn" onClick={onClose}>Chiudi</button><button className="btn btn-primary" onClick={save}>Salva profilo</button></>}>
      <PanelState loading={loadingPanel} error={errorPanel} empty={!profile ? 'Profilo non disponibile.' : null}>
        {success && <div className="alert-banner alert-amber" style={{ padding: '9px 12px', background: 'var(--c-turno-bg)', borderColor: '#BEE7CC', color: 'var(--c-turno-tx)' }}><Icon name="check" size={15} /><div>{success}</div></div>}
        {profile && <div style={{ display: 'grid', gap: 12 }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: 16, marginBottom: 4 }}>
            {profile.avatar
              ? <span className="avatar" style={{ width: 64, height: 64, fontSize: 24, borderRadius: '50%', overflow: 'hidden', display: 'grid', placeItems: 'center' }}><img src={profile.avatar} alt="Avatar" style={{ width: '100%', height: '100%', objectFit: 'cover' }} /></span>
              : <Avatar p={{ name: profile.name, av: profile.av, initials: profile.name?.split(' ').map(w => w[0]).join('').slice(0,2).toUpperCase() }} size={64} />
            }
            <div>
              <input ref={fileInputRef} type="file" accept="image/*" style={{ display: 'none' }} onChange={handleAvatarUpload} />
              <button className="btn btn-sm" onClick={() => fileInputRef.current?.click()} disabled={uploadingAvatar}>
                <Icon name="plus" size={14} sw={2.4} />{uploadingAvatar ? 'Caricamento…' : 'Carica immagine'}
              </button>
              <div style={{ fontSize: 11.5, color: 'var(--text-faint)', marginTop: 4 }}>JPG, PNG. Max 2MB.</div>
            </div>
          </div>
          <div className="field"><label>Nome</label><input className="input" value={profile.name || ''} onChange={(e) => setProfile({ ...profile, name: e.target.value })} /></div>
          <div className="field"><label>Ruolo / mansione</label><input className="input" value={profile.job || ''} onChange={(e) => setProfile({ ...profile, job: e.target.value })} /></div>
          <div className="field"><label>Colore avatar</label><input className="input" value={profile.av || ''} onChange={(e) => setProfile({ ...profile, av: e.target.value })} /></div>
          <div className="card card-pad" style={{ boxShadow: 'none', display: 'grid', gap: 10 }}>
            <strong>Cambio password</strong>
            <div className="field"><label>Password attuale</label><input type="password" className="input" value={passwords.currentPassword} onChange={(e) => setPasswords({ ...passwords, currentPassword: e.target.value })} /></div>
            <div className="field"><label>Nuova password</label><input type="password" className="input" value={passwords.newPassword} onChange={(e) => setPasswords({ ...passwords, newPassword: e.target.value })} /></div>
            <button className="btn btn-sm" disabled={passwords.newPassword.length < 6 || !passwords.currentPassword} onClick={savePassword}>Aggiorna password</button>
          </div>
        </div>}
      </PanelState>
    </Modal>
  );
}

export default function App() {
  const [globalTweaks, setGlobalTweaks] = useState({ ...TWEAK_DEFAULTS });
  const [personalTweaks, setPersonalTweaks] = useState({});
  const [globalTweaksOpen, setGlobalTweaksOpen] = useState(false);
  const [personalTweaksOpen, setPersonalTweaksOpen] = useState(false);
  const [apiUser, setApiUser] = useState(null);
  const [loading, setLoading] = useState(!!getToken());
  const [error, setError] = useState(null);
  const [page, setPage] = useState('dashboard');
  const [assign, setAssign] = useState(() => ({ ...ASSIGN }));
  const [reqs, setReqs] = useState(() => REQUESTS.map((r) => ({ ...r })));
  const [notifs, setNotifs] = useState(() => NOTIFS.map((n) => ({ ...n })));
  const [peopleData, setPeopleData] = useState(() => PEOPLE.map((p) => ({ ...p })));
  const [busData, setBusData] = useState(() => BUS.map((b) => ({ ...b })));
  const [shiftsData, setShiftsData] = useState(() => SHIFTS.map((s) => ({ ...s })));
  const [oncallData, setOncallData] = useState([]);
  const [closuresData, setClosuresData] = useState([]);
  const [holidaysData, setHolidaysData] = useState({});
  const [adminBu, setAdminBu] = useState(null);
  const [toast, setToast] = useState(null);
  const [createEmpOpen, setCreateEmpOpen] = useState(false);
  const [profileOpen, setProfileOpen] = useState(false);
  const t = { ...globalTweaks, ...personalTweaks };

  const applyBootstrap = (data) => {
    setApiUser(data.user);
    setGlobalTweaks({ ...TWEAK_DEFAULTS, ...(data.globalTweaks || {}) });
    setPersonalTweaks({ ...(data.user?.tweaks || {}) });
    setPeopleData(data.people || []);
    setBusData(data.allBus || data.bus || []);
    setReqs((data.requests || []).map((r) => ({ ...r })));
    setAssign({ ...(data.assign || {}) });
    setNotifs((data.notifications || []).map((n) => ({ ...n })));
    setShiftsData((data.shifts || []).map((s) => ({ ...s })));
    setOncallData((data.oncall || []).map((o) => ({ ...o })));
    setClosuresData((data.closures || []).map((c) => ({ ...c })));
    setHolidaysData({ ...(data.holidays || {}) });
  };

  const refresh = async () => {
    const data = await bootstrap();
    applyBootstrap(data);
  };

  useEffect(() => {
    if (!getToken()) { setLoading(false); return; }
    bootstrap().then(applyBootstrap).catch((err) => { setError(err.message); setToken(''); }).finally(() => setLoading(false));
  }, []);

  const handleLogin = async (kind) => {
    setLoading(true); setError(null);
    try {
      const cred = DEMO_CREDENTIALS[kind];
      await login(cred.email, cred.password);
      const data = await bootstrap();
      applyBootstrap(data);
      setPage(kind === 'dipendente' ? 'dashboard' : 'dashboard');
    } catch (err) { setError(err.message); }
    finally { setLoading(false); }
  };

  const logout = () => {
    setToken(''); setApiUser(null); setPage('dashboard');
    setGlobalTweaks({ ...TWEAK_DEFAULTS }); setPersonalTweaks({});
    setGlobalTweaksOpen(false); setPersonalTweaksOpen(false);
  };

  const setGlobalTweak = (key, value) => {
    const previous = globalTweaks[key];
    setGlobalTweaks((current) => ({ ...current, [key]: value }));
    updateGlobalTweaks({ [key]: value }).catch((err) => {
      setGlobalTweaks((current) => ({ ...current, [key]: previous }));
      setToast(err.message);
    });
  };

  const setPersonalTweak = (key, value) => {
    const hadPrevious = Object.prototype.hasOwnProperty.call(personalTweaks, key);
    const previous = personalTweaks[key];
    setPersonalTweaks((current) => ({ ...current, [key]: value }));
    updateMyTweaks({ [key]: value }).catch((err) => {
      setPersonalTweaks((current) => {
        const next = { ...current };
        if (hadPrevious) next[key] = previous;
        else delete next[key];
        return next;
      });
      setToast(err.message);
    });
  };

  const resetPersonalTweaks = async () => {
    const previous = personalTweaks;
    setPersonalTweaks({});
    try { await resetMyTweaks(); setToast('Preferenze personali ripristinate.'); }
    catch (err) { setPersonalTweaks(previous); setToast(err.message); }
  };

  useEffect(() => {
    const r = document.documentElement;
    r.dataset.direzione = t.direzione;
    r.dataset.densita   = t.densita;
    r.style.setProperty('--red', t.accento);
    r.style.setProperty('--c-ferie', t.colFerie);
    r.style.setProperty('--c-sw', t.colSw);
  }, [t.direzione, t.densita, t.accento, t.colFerie, t.colSw]);

  if (loading) return <div className="app"><main className="content"><div className="card empty">Caricamento PeoplePlanner…</div></main></div>;
  if (!apiUser) return <LoginScreen error={error} onLogin={handleLogin} />;

  const getEntries = makeGetEntries(assign, holidaysData, closuresData);
  const th = { absent: t.sogliaAssenti, remote: t.sogliaRemote };

  const role = apiUser.role === 'SUPER_ADMIN' ? 'admin' : apiUser.role === 'EMPLOYEE' ? 'dipendente' : 'manager';
  const user = apiUser;
  const myBu = role === 'admin' ? null : user.bu;
  const viewBu = role === 'admin' ? adminBu : myBu;
  const personById = (id) => peopleData.find((p) => p.id === id) || getPerson(id);
  const buById = (id) => busData.find((b) => b.id === id) || getBU(id);
  const people = viewBu ? peopleData.filter((p) => p.bu === viewBu) : peopleData;
  const scope = role === 'admin' ? (adminBu ? buById(adminBu).name : 'Tutte le Business Unit') : (myBu ? buById(myBu).name : 'Nessuna Business Unit assegnata');
  const canManageOps = role === 'manager';
  const canEdit = canManageOps;

  const buReqs = reqs.filter((r) => { const p = personById(r.empId); return role==='admin' ? (!adminBu||p?.bu===adminBu) : p?.bu===myBu; });
  const buNotifs = notifs.filter((n) => role==='admin' ? (!adminBu||n.bu===adminBu || !n.bu) : n.bu===myBu || !n.bu);
  const buShifts = shiftsData.filter((s) => role==='admin' ? (!adminBu||s.bu===adminBu) : s.bu===myBu);
  const pendingCount = buReqs.filter((r) => r.status==='pending').length;

  const NAV = {
    manager:    [['dashboard','Panoramica','home'],['calendario','Calendario team','calendar'],['richieste','Richieste','inbox',pendingCount],['reperibilita','Reperibilità','phone'],['turni','Turni operativi','clock'],['chiusure','Chiusure & festività','building']],
    dipendente: [['dashboard','Panoramica','home'],['calendario','Calendario team','calendar'],['richieste','Le mie richieste','inbox'],['chiusure','Chiusure & festività','building']],
    admin:      [['persone','Persone','users'],['chiusure','Chiusure','building'],['integrazioni','Integrazioni','settings']],
  };
  const nav = NAV[role];

  // If superadmin and page not in their nav, redirect to persone
  const adminPages = ['persone', 'chiusure', 'integrazioni'];
  const effectivePage = role === 'admin' && !adminPages.includes(page) ? 'persone' : page;

  const doAssign = async (empId, date, entries) => {
    try {
      const data = await saveAssignment({ empId, date, entries });
      applyBootstrap(data);
      setToast(entries.length ? 'Assegnazione salvata.' : 'Assegnazione rimossa.');
    } catch (err) { setToast(err.message); }
  };

  const approve = async (req) => {
    try { const data = await decideRequest(req.id, 'approved'); applyBootstrap(data.state); setToast(`Richiesta di ${personById(req.empId)?.name || 'dipendente'} approvata.`); }
    catch (err) { setToast(err.message); }
  };

  const doReject = async (req, reason) => {
    try { const data = await decideRequest(req.id, 'rejected', reason); applyBootstrap(data.state); setToast('Richiesta rifiutata.'); }
    catch (err) { setToast(err.message); }
  };

  const submitReq = async (r) => {
    try { const data = await createRequest(r); applyBootstrap(data.state); setToast('Richiesta inviata al tuo manager.'); }
    catch (err) { setToast(err.message); }
  };

  const pageTitle = (nav.find((n) => n[0] === effectivePage) || [null, 'People Planner'])[1];

  const NavList = () => nav.map(([id, label, icon, badge]) => (
    <button key={id} className={'nav-item' + (effectivePage===id?' active':'') + (badge?' alert':'')} onClick={() => setPage(id)}>
      <Icon name={icon} size={18} />
      <span>{label}</span>
      {badge ? <span className="ni-badge">{badge}</span> : null}
    </button>
  ));

  return (
    <div className="app">
      {/* Sidebar – variation A */}
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">P</div>
          <div><div className="brand-name">People Planner</div><div className="brand-sub">Pianificazione team</div></div>
        </div>
        <nav className="nav"><div className="nav-label">Operatività</div><NavList /></nav>
        <div className="nav-foot">
          {role === 'manager' && (
            <button className="btn btn-sm" style={{ width: '100%', marginBottom: 8 }} onClick={() => setCreateEmpOpen(true)}>
              <Icon name="plus" size={14} sw={2.4} />Crea dipendente
            </button>
          )}
          <div style={{ display:'flex', alignItems:'center', gap:9, color:'#C9C2BC', fontSize:12 }}>
            <Icon name="building" size={15} />
            <span style={{ flex:1 }}>{role==='admin' ? `${busData.length} Business Unit` : (myBu ? buById(myBu).name : 'Nessuna Business Unit')}</span>
          </div>
        </div>
      </aside>

      <div className="main">
        <header className="topbar">
          {/* Top-nav – variation B */}
          <div className="topnav">
            <div className="topnav-brand">
              <div className="brand-mark" style={{ width:28, height:28, fontSize:15, borderRadius:7 }}>P</div>
              <strong style={{ fontSize:14.5, letterSpacing:'-.02em' }}>People&nbsp;Planner</strong>
            </div>
            <NavList />
          </div>

          <div className="pt-title">
            <div className="page-title">{pageTitle}</div>
          </div>
          <div className="spacer"></div>

          {/* BU filter chips — hidden for superadmin */}
          {role==='admin' && !adminPages.includes(effectivePage) && (
            <div style={{ display:'flex', gap:6 }}>
              <button className={'chip'+(!adminBu?' on':'')} onClick={() => setAdminBu(null)}>Tutte</button>
              {busData.map((b) => <button key={b.id} className={'chip'+(adminBu===b.id?' on':'')} onClick={() => setAdminBu(b.id)}>{b.name.split(' ')[0]}</button>)}
            </div>
          )}

          {role === 'admin' && <button className="iconbtn" title="Tweaks globali" onClick={() => { setGlobalTweaksOpen((v) => !v); setPersonalTweaksOpen(false); }}
            style={{ color: globalTweaksOpen ? 'var(--red)' : undefined }}>
            <Icon name="sliders" size={18} />
          </button>}
          <button className="iconbtn" title="Tweaks personali" onClick={() => { setPersonalTweaksOpen((v) => !v); setGlobalTweaksOpen(false); }}
            style={{ color: personalTweaksOpen ? 'var(--red)' : undefined }}>
            <Icon name="settings" size={18} />
          </button>

          <FaqButton />
          <NotifBell onMarkAll={() => setNotifs((ns) => ns.map((n) => ({ ...n, unread:false })))} />
          <UserMenu user={user} role={role} onProfile={() => setProfileOpen(true)} onLogout={logout} />
        </header>

        <main className="content">
          {role === 'admin' && effectivePage === 'persone' && <AdminView onRefresh={refresh} onToast={setToast} people={peopleData} bus={busData} />}
          {role === 'admin' && effectivePage === 'chiusure' && <SuperAdminClosuresView onToast={setToast} />}
          {role === 'admin' && effectivePage === 'integrazioni' && <IntegrationsView />}
          {role !== 'admin' && effectivePage==='dashboard'    && <Dashboard role={role} meId={role==='dipendente'?user.employeeId:null} people={people} getEntries={getEntries} th={th} notifs={buNotifs} reqs={role==='dipendente'?reqs:buReqs} shifts={role==='dipendente'?shiftsData:buShifts} oncall={role==='dipendente'?oncallData:(oncallData||[]).filter((o)=>people.some((p)=>p.id===o.empId))} onGoto={setPage} scope={scope} />}
          {role !== 'admin' && effectivePage==='calendario'   && <CalendarPage people={people} getEntries={getEntries} onAssign={doAssign} canEdit={canEdit} meId={role==='dipendente'?user.employeeId:null} th={th} showConflicts={t.mostraConflitti} vista={t.vista} />}
          {role !== 'admin' && effectivePage==='richieste'    && (role === 'dipendente'
            ? <RequestsEmployee me={user} reqs={reqs} onSubmit={submitReq} />
            : <RequestsManager reqs={buReqs} getEntries={getEntries} onApprove={approve} onReject={doReject} scope={scope} canDecide={canManageOps} people={people} onSubmit={submitReq} />)}
          {role !== 'admin' && effectivePage==='reperibilita' && <OnCallView scope={scope} buFilter={viewBu} people={people} bus={busData} getEntries={getEntries} onToast={setToast} onRefresh={refresh} oncall={oncallData} />}
          {role !== 'admin' && effectivePage==='turni'        && <ShiftsView scope={scope} buFilter={viewBu} people={people} bus={busData} onToast={setToast} onRefresh={refresh} shifts={shiftsData} />}
          {role !== 'admin' && effectivePage==='chiusure'     && <ClosuresView scope={scope} closures={closuresData} holidays={holidaysData} people={peopleData} bus={busData} onToast={setToast} onRefresh={refresh} canEdit={canManageOps} />}
        </main>
      </div>

      {role === 'admin' && <TweaksPanel title="Tweaks globali" open={globalTweaksOpen} onClose={() => setGlobalTweaksOpen(false)}>
        <TweakControls values={globalTweaks} onChange={setGlobalTweak} />
      </TweaksPanel>}
      <TweaksPanel title="Tweaks personali" open={personalTweaksOpen} onClose={() => setPersonalTweaksOpen(false)}>
        <TweakControls values={t} onChange={setPersonalTweak} personal onReset={resetPersonalTweaks} />
      </TweaksPanel>

      {/* Profile modal rendered at app level, opened from UserMenu */}
      {profileOpen && <ProfileModal onClose={() => setProfileOpen(false)} onToast={setToast} onUserUpdate={(data) => { if (data.state) applyBootstrap(data.state); else if (data.user) setApiUser(data.user); }} />}
      {createEmpOpen && <ManagerCreateEmployeeModal onClose={() => setCreateEmpOpen(false)} onToast={setToast} onRefresh={refresh} />}

      {toast && <Toast msg={toast} onDone={() => setToast(null)} />}
    </div>
  );
}

function ManagerCreateEmployeeModal({ onClose, onToast, onRefresh }) {
  const [form, setForm] = useState({ name: '', email: '', password: '', job: '' });
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const set = (k, v) => setForm((f) => ({ ...f, [k]: v }));
  const submit = async () => {
    setSaving(true); setError('');
    try {
      await createManagerEmployee(form);
      onToast?.('Dipendente creato con successo.');
      onRefresh?.();
      onClose();
    } catch (err) { setError(err.message); setSaving(false); }
  };
  return (
    <Modal title="Crea dipendente" icon={<Icon name="plus" size={19} color="var(--red)" />} onClose={onClose}
      footer={<><button className="btn" onClick={onClose}>Annulla</button><button className="btn btn-primary" disabled={saving || !form.name || !form.email || !form.password} onClick={submit}>{saving ? 'Creazione…' : 'Crea dipendente'}</button></>}>
      {error && <div className="alert-banner alert-red" style={{ fontSize: 12.5, padding: '9px 12px' }}><Icon name="alert" size={15} /><div>{error}</div></div>}
      <div className="field"><label>Nome completo</label><input className="input" value={form.name} onChange={(e) => set('name', e.target.value)} placeholder="es. Mario Rossi" /></div>
      <div className="field"><label>Email</label><input className="input" type="email" value={form.email} onChange={(e) => set('email', e.target.value)} placeholder="mario@azienda.it" /></div>
      <div className="field"><label>Password</label><input className="input" type="password" value={form.password} onChange={(e) => set('password', e.target.value)} placeholder="Min 6 caratteri" /></div>
      <div className="field"><label>Mansione</label><input className="input" value={form.job} onChange={(e) => set('job', e.target.value)} placeholder="Dipendente" /></div>
      <div className="alert-banner alert-amber" style={{ fontSize: 12, padding: '8px 11px' }}><Icon name="alert" size={14} /><div>Il dipendente verrà assegnato automaticamente alla tua Business Unit.</div></div>
    </Modal>
  );
}
