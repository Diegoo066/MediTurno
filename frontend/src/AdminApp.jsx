import React, { useEffect, useMemo, useState } from 'react';
import { BookingTrend, Filters, Icon, ReservationsTable, Sidebar, StatCard, StatusDonut } from './admin/components.jsx';
import './admin/admin.css';

const api = (path, options = {}) => fetch(path, { credentials: 'include', ...options, headers: { 'Content-Type': 'application/json', ...(options.headers || {}) } });
const emptyFilters = { search: '', doctorId: '', date: '', status: '' };
const formatDate = value => new Intl.DateTimeFormat('es-PE', { dateStyle: 'medium' }).format(new Date(value));
const formatTime = value => new Intl.DateTimeFormat('es-PE', { timeStyle: 'short' }).format(new Date(value));

function LoginScreen({ onLogin }) {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [error, setError] = useState('');
  const [sending, setSending] = useState(false);
  async function submit(event) {
    event.preventDefault(); setError(''); setSending(true);
    try { await onLogin(email, password); } catch (loginError) { setError(loginError.message); } finally { setSending(false); }
  }
  return <main className="mt-login-page"><div className="mt-login-brand"><span className="mt-logo-mark">+</span><strong>MediTurno</strong></div><div className="mt-login-card"><div className="mt-eyebrow">ÁREA PRIVADA</div><h1>Bienvenido al panel</h1><p>Administra las reservas de tu equipo médico desde un solo lugar.</p><form onSubmit={submit}><label>Correo administrativo<input type="email" required value={email} onChange={event => setEmail(event.target.value)} autoComplete="username" /></label><label>Contraseña<input type="password" required value={password} onChange={event => setPassword(event.target.value)} autoComplete="current-password" /></label>{error && <p className="mt-error" role="alert">{error}</p>}<button className="mt-primary-button" type="submit" disabled={sending}>{sending ? 'Validando...' : 'Iniciar sesión'}</button></form><a className="mt-login-back" href="/">← Volver a la página principal</a></div></main>;
}

export default function AdminApp() {
  const [session, setSession] = useState(null);
  const [checking, setChecking] = useState(true);
  const [stats, setStats] = useState(null);
  const [appointments, setAppointments] = useState([]);
  const [doctors, setDoctors] = useState([]);
  const [filters, setFilters] = useState(emptyFilters);
  const [period, setPeriod] = useState(7);
  const [activeSection, setActiveSection] = useState('dashboard');
  const [mobileMenu, setMobileMenu] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [changingId, setChangingId] = useState(null);

  useEffect(() => { api('/api/admin/session').then(async response => { if (response.ok) setSession(await response.json()); }).catch(() => {}).finally(() => setChecking(false)); }, []);

  async function login(email, password) {
    const response = await api('/api/admin/login', { method: 'POST', body: JSON.stringify({ email, password }) });
    const result = await response.json().catch(() => ({}));
    if (!response.ok) throw new Error(result.error || 'No se pudo iniciar sesión.');
    setSession(result);
  }

  async function loadData() {
    setLoading(true); setError('');
    try {
      const query = new URLSearchParams(Object.entries(filters).filter(([, value]) => value));
      const responses = await Promise.all([api('/api/admin/dashboard'), api(`/api/admin/appointments?${query}`), api('/api/admin/doctors')]);
      if (responses.some(response => response.status === 401)) { setSession(null); return; }
      if (responses.some(response => !response.ok)) throw new Error('No se pudo cargar la información administrativa.');
      setStats(await responses[0].json()); setAppointments(await responses[1].json()); setDoctors(await responses[2].json());
    } catch (loadError) { setError(loadError.message); } finally { setLoading(false); }
  }
  useEffect(() => { if (session) loadData(); }, [session, filters]);

  async function logout() { await api('/api/admin/logout', { method: 'POST' }).catch(() => {}); setSession(null); setStats(null); setAppointments([]); }
  async function changeStatus(appointment) {
    const nextStatus = appointment.status === 'scheduled' ? 'confirmed' : appointment.status === 'confirmed' ? 'cancelled' : 'scheduled';
    const action = nextStatus === 'confirmed' ? 'confirmar' : nextStatus === 'cancelled' ? 'cancelar' : 'reactivar';
    if (!window.confirm(`¿Quieres ${action} esta cita de ${appointment.patient_name}?`)) return;
    setChangingId(appointment.id); setError('');
    try { const response = await api(`/api/admin/appointments/${appointment.id}/status`, { method: 'PATCH', body: JSON.stringify({ status: nextStatus }) }); const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'No se pudo actualizar la cita.'); await loadData(); }
    catch (statusError) { setError(statusError.message); } finally { setChangingId(null); }
  }
  const updateFilter = (key, value) => setFilters(current => ({ ...current, [key]: value }));
  const visibleAppointments = useMemo(() => activeSection === 'dashboard' ? appointments.slice(0, 6) : appointments, [activeSection, appointments]);

  if (checking) return <main className="mt-loading-page"><p>Comprobando sesión...</p></main>;
  if (!session) return <LoginScreen onLogin={login} />;
  const cards = [['Reservas totales', stats?.total || 0, 'total', 'calendar'], ['Confirmadas', stats?.confirmed || 0, 'confirmed', 'check'], ['Pendientes', stats?.scheduled || 0, 'scheduled', 'clock'], ['Canceladas', stats?.cancelled || 0, 'cancelled', 'close']];

  return <div className="mt-admin-layout"><Sidebar active={activeSection} onNavigate={setActiveSection} email={session.email} onLogout={logout} open={mobileMenu} onClose={() => setMobileMenu(false)} /><main className="mt-main-content"><header className="mt-main-header"><button className="mt-menu-button" onClick={() => setMobileMenu(true)} aria-label="Abrir menú"><Icon name="menu" /></button><div><div className="mt-eyebrow">RESUMEN GENERAL</div><h1>Dashboard</h1><p>Gestiona la agenda y las reservas de tu centro médico.</p></div><div className="mt-header-controls"><label className="mt-period-select"><Icon name="calendar" size={18} /><select value={period} onChange={event => setPeriod(Number(event.target.value))} aria-label="Periodo del gráfico"><option value="7">Últimos 7 días</option><option value="14">Últimos 14 días</option><option value="30">Últimos 30 días</option></select><Icon name="chevron" size={16} /></label><button className="mt-refresh-button" onClick={loadData} disabled={loading} aria-label="Actualizar datos"><Icon name="refresh" size={18} /></button></div></header><section className="mt-stats-grid">{cards.map(([label, value, tone, icon]) => <StatCard key={label} label={label} value={value} tone={tone} icon={icon} />)}</section><section className="mt-charts-grid"><BookingTrend appointments={appointments} range={period} /><StatusDonut stats={stats} /></section><section className="mt-reservations-card mt-card"><div className="mt-section-heading"><div><div className="mt-eyebrow">AGENDA</div><h2>{activeSection === 'reservations' ? 'Todas las reservas' : 'Últimas reservas'}</h2></div><button className="mt-link-button" onClick={() => setActiveSection('reservations')}>Ver todas <span>→</span></button></div><Filters filters={filters} doctors={doctors} onChange={updateFilter} onClear={() => setFilters(emptyFilters)} />{error && <p className="mt-error" role="alert">{error}</p>}{loading ? <p className="mt-empty-state">Cargando reservas...</p> : visibleAppointments.length === 0 ? <p className="mt-empty-state">No hay reservas que coincidan con los filtros.</p> : <ReservationsTable appointments={visibleAppointments} changingId={changingId} onChangeStatus={changeStatus} formatDate={formatDate} formatTime={formatTime} />}</section></main></div>;
}
