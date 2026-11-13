import React from 'react';

export function Icon({ name, size = 20 }) {
  const paths = {
    grid: <><rect x="3" y="3" width="7" height="7" rx="1" /><rect x="14" y="3" width="7" height="7" rx="1" /><rect x="3" y="14" width="7" height="7" rx="1" /><rect x="14" y="14" width="7" height="7" rx="1" /></>,
    calendar: <><rect x="3" y="5" width="18" height="16" rx="2" /><path d="M16 3v4M8 3v4M3 10h18" /></>,
    users: <><circle cx="9" cy="8" r="3" /><path d="M3.5 20a5.5 5.5 0 0 1 11 0M16 11a3 3 0 1 0 0-6M16 14a5 5 0 0 1 4.5 6" /></>,
    logout: <><path d="M10 5H5a2 2 0 0 0-2 2v10a2 2 0 0 0 2 2h5M15 16l4-4-4-4M19 12H9" /></>,
    search: <><circle cx="10.8" cy="10.8" r="6.8" /><path d="m16 16 5 5" /></>,
    chevron: <path d="m9 6 6 6-6 6" />,
    refresh: <><path d="M20 11a8 8 0 0 0-14.8-4L3 10" /><path d="M3 5v5h5M4 13a8 8 0 0 0 14.8 4L21 14" /><path d="M21 19v-5h-5" /></>,
    clock: <><circle cx="12" cy="12" r="9" /><path d="M12 7v5l3 2" /></>,
    check: <><circle cx="12" cy="12" r="9" /><path d="m8 12 2.5 2.5L16 9" /></>,
    close: <><circle cx="12" cy="12" r="9" /><path d="m9 9 6 6M15 9l-6 6" /></>,
    menu: <><path d="M4 6h16M4 12h16M4 18h16" /></>
  };
  return <svg className="mt-icon" width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">{paths[name] || paths.grid}</svg>;
}

export function Sidebar({ active, onNavigate, email, onLogout, open, onClose }) {
  const items = [{ id: 'dashboard', label: 'Dashboard', icon: 'grid' }, { id: 'reservations', label: 'Reservas', icon: 'calendar' }];
  return <>
    {open && <button className="mt-sidebar-overlay" aria-label="Cerrar menú" onClick={onClose} />}
    <aside className={`mt-sidebar ${open ? 'is-open' : ''}`}>
      <div className="mt-sidebar-brand"><span className="mt-logo-mark">+</span><span>MediTurno</span></div>
      <p className="mt-sidebar-label">Panel administrativo</p>
      <nav className="mt-sidebar-nav" aria-label="Navegación administrativa">
        {items.map(item => <button className={active === item.id ? 'is-active' : ''} key={item.id} onClick={() => { onNavigate(item.id); onClose(); }}><Icon name={item.icon} /><span>{item.label}</span>{item.id === 'reservations' && <span className="mt-nav-dot" />}</button>)}
      </nav>
      <div className="mt-sidebar-bottom"><div className="mt-account"><span className="mt-avatar">{email?.slice(0, 1).toUpperCase() || 'A'}</span><span><strong>Administrador</strong><small>{email}</small></span></div><button className="mt-logout" onClick={onLogout} aria-label="Cerrar sesión"><Icon name="logout" /></button></div>
    </aside>
  </>;
}

export function StatCard({ label, value, tone, icon }) {
  return <article className={`mt-stat-card ${tone}`}><span className="mt-stat-icon"><Icon name={icon} size={22} /></span><div><span className="mt-stat-label">{label}</span><strong>{value}</strong></div></article>;
}

function chartDays(range) {
  const days = [];
  const today = new Date();
  for (let offset = range - 1; offset >= 0; offset -= 1) {
    const date = new Date(today); date.setHours(12, 0, 0, 0); date.setDate(today.getDate() - offset);
    days.push({ key: date.toISOString().slice(0, 10), label: new Intl.DateTimeFormat('es-PE', { weekday: 'short' }).format(date).replace('.', '') });
  }
  return days;
}

export function BookingTrend({ appointments, range }) {
  const days = chartDays(range);
  const counts = days.map(day => appointments.filter(item => String(item.starts_at).slice(0, 10) === day.key).length);
  const max = Math.max(...counts, 1);
  const points = counts.map((count, index) => `${35 + (index * 650) / Math.max(days.length - 1, 1)},${190 - (count / max) * 145}`).join(' ');
  return <section className="mt-card mt-trend-card"><div className="mt-card-heading"><div><h2>Reservas por día</h2><p>Actividad registrada en el periodo seleccionado</p></div><span className="mt-chart-total">{counts.reduce((sum, count) => sum + count, 0)} reservas</span></div><div className="mt-chart-wrap"><svg viewBox="0 0 720 230" role="img" aria-label="Gráfico de reservas por día"><defs><linearGradient id="mt-area" x1="0" x2="0" y1="0" y2="1"><stop offset="0" stopColor="#10b8a5" stopOpacity=".25" /><stop offset="1" stopColor="#10b8a5" stopOpacity="0" /></linearGradient></defs>{[45, 93, 141, 189].map(y => <line key={y} x1="35" x2="685" y1={y} y2={y} className="mt-chart-grid" />)}<polygon points={`35,190 ${points} 685,190`} fill="url(#mt-area)" /><polyline points={points} fill="none" className="mt-chart-line" />{counts.map((count, index) => { const [x, y] = points.split(' ')[index].split(','); return <g key={days[index].key}><circle cx={x} cy={y} r="4.5" className="mt-chart-point"><title>{`${days[index].label}: ${count} reservas`}</title></circle><text x={x} y="216" textAnchor="middle" className="mt-chart-label">{days[index].label}</text></g>; })}</svg></div></section>;
}

export function StatusDonut({ stats }) {
  const total = stats?.total || 0;
  const segments = [{ key: 'confirmed', label: 'Confirmadas', value: stats?.confirmed || 0, color: '#11ad98' }, { key: 'scheduled', label: 'Pendientes', value: stats?.scheduled || 0, color: '#f2b33f' }, { key: 'cancelled', label: 'Canceladas', value: stats?.cancelled || 0, color: '#f15b60' }];
  let cursor = 0;
  const gradient = total ? segments.map(segment => { const start = cursor; cursor += (segment.value / total) * 100; return `${segment.color} ${start}% ${cursor}%`; }).join(', ') : '#e9eff0 0 100%';
  return <section className="mt-card mt-donut-card"><div className="mt-card-heading"><div><h2>Estado de reservas</h2><p>Distribución actual</p></div></div><div className="mt-donut-content"><div className="mt-donut" style={{ background: `conic-gradient(${gradient})` }}><div><strong>{total}</strong><span>Total</span></div></div><div className="mt-legend">{segments.map(segment => <div key={segment.key}><span className="mt-legend-dot" style={{ background: segment.color }} /><span>{segment.label}</span><strong>{segment.value}</strong></div>)}</div></div></section>;
}

export function Filters({ filters, doctors, onChange, onClear }) {
  return <div className="mt-filters"><label className="mt-search-field"><Icon name="search" size={18} /><input value={filters.search} onChange={event => onChange('search', event.target.value)} placeholder="Buscar paciente o correo" /></label><label><span>Médico</span><select value={filters.doctorId} onChange={event => onChange('doctorId', event.target.value)}><option value="">Todos los médicos</option>{doctors.map(doctor => <option value={doctor.id} key={doctor.id}>{doctor.full_name}</option>)}</select></label><label><span>Fecha</span><input type="date" value={filters.date} onChange={event => onChange('date', event.target.value)} /></label><label><span>Estado</span><select value={filters.status} onChange={event => onChange('status', event.target.value)}><option value="">Todos</option><option value="scheduled">Pendientes</option><option value="confirmed">Confirmadas</option><option value="cancelled">Canceladas</option></select></label><button className="mt-clear-filter" onClick={onClear}>Limpiar</button></div>;
}

export function ReservationsTable({ appointments, changingId, onChangeStatus, formatDate, formatTime }) {
  const labels = { scheduled: 'Pendiente', confirmed: 'Confirmada', cancelled: 'Cancelada' };
  return <div className="mt-table-wrap"><table className="mt-table"><thead><tr><th>Paciente</th><th>Médico</th><th>Fecha y hora</th><th>Estado</th><th><span className="sr-only">Acciones</span></th></tr></thead><tbody>{appointments.map(appointment => <tr key={appointment.id}><td><div className="mt-patient"><span className="mt-patient-avatar">{appointment.patient_name.slice(0, 1).toUpperCase()}</span><span><strong>{appointment.patient_name}</strong><small>{appointment.patient_email}</small></span></div></td><td><strong>{appointment.doctor_name}</strong><small>{appointment.specialty}</small></td><td><strong>{formatDate(appointment.starts_at)}</strong><small>{formatTime(appointment.starts_at)}</small></td><td><span className={`mt-status ${appointment.status}`}><span />{labels[appointment.status]}</span></td><td><button className="mt-row-action" onClick={() => onChangeStatus(appointment)} disabled={changingId === appointment.id}>{changingId === appointment.id ? 'Guardando...' : appointment.status === 'scheduled' ? 'Confirmar' : appointment.status === 'confirmed' ? 'Cancelar' : 'Reactivar'}</button></td></tr>)}</tbody></table></div>;
}
