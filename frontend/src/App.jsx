import React, { useEffect, useMemo, useState } from 'react';
import { BookingForm, DoctorCard, HeroVisual, PublicIcon, PublicLogo } from './public/components.jsx';
import './public/public.css';
import './public/availability.css';

const emptyValues = { patientName: '', patientEmail: '', startsAt: '' };
const limaDate = () => { const parts = new Intl.DateTimeFormat('en-CA', { timeZone: 'America/Lima', year: 'numeric', month: '2-digit', day: '2-digit' }).formatToParts(new Date()); const values = Object.fromEntries(parts.filter(part => part.type !== 'literal').map(part => [part.type, part.value])); return `${values.year}-${values.month}-${values.day}`; };

function App() {
  const [doctors, setDoctors] = useState([]);
  const [search, setSearch] = useState('');
  const [specialty, setSpecialty] = useState('');
  const [city, setCity] = useState('');
  const [selected, setSelected] = useState(null);
  const [values, setValues] = useState(emptyValues);
  const [bookingDate, setBookingDate] = useState('');
  const [availableSlots, setAvailableSlots] = useState([]);
  const [availabilityLoading, setAvailabilityLoading] = useState(false);
  const [availabilityError, setAvailabilityError] = useState('');
  const [bookingNotice, setBookingNotice] = useState(null);
  const [notice, setNotice] = useState(null);
  const [loading, setLoading] = useState(true);
  const [sending, setSending] = useState(false);
  const [mobileNav, setMobileNav] = useState(false);

  useEffect(() => {
    if (!selected || !bookingDate) { setAvailableSlots([]); return undefined; }
    const controller = new AbortController(); setAvailabilityLoading(true); setAvailabilityError(''); setAvailableSlots([]); setValues(current => ({ ...current, startsAt: '' }));
    fetch(`/api/doctors/${selected.id}/availability?date=${encodeURIComponent(bookingDate)}`, { signal: controller.signal })
      .then(async response => { const result = await response.json().catch(() => ({})); if (!response.ok) throw new Error(result.error || 'No se pudieron cargar los horarios.'); return result; })
      .then(result => setAvailableSlots(result.slots || []))
      .catch(error => { if (error.name !== 'AbortError') setAvailabilityError(error.message); })
      .finally(() => { if (!controller.signal.aborted) setAvailabilityLoading(false); });
    return () => controller.abort();
  }, [bookingDate, selected]);

  useEffect(() => {
    const controller = new AbortController();
    fetch('/api/doctors', { signal: controller.signal })
      .then(async response => { if (!response.ok) { const body = await response.json().catch(() => ({})); throw new Error(body.error || 'No se pudo cargar el catálogo de médicos.'); } return response.json(); })
      .then(data => { setDoctors(data); setLoading(false); })
      .catch(error => { if (error.name !== 'AbortError') { setNotice({ type: 'error', message: error.message }); setLoading(false); } });
    return () => controller.abort();
  }, []);

  const specialties = useMemo(() => [...new Set(doctors.map(doctor => doctor.specialty))].sort(), [doctors]);
  const cities = useMemo(() => [...new Set(doctors.map(doctor => doctor.city))].sort(), [doctors]);
  const filteredDoctors = useMemo(() => {
    const query = search.trim().toLocaleLowerCase('es');
    return doctors.filter(doctor => (!query || `${doctor.full_name} ${doctor.specialty} ${doctor.city}`.toLocaleLowerCase('es').includes(query)) && (!specialty || doctor.specialty === specialty) && (!city || doctor.city === city));
  }, [city, doctors, search, specialty]);

  function openBooking(doctor) {
    setSelected(doctor); setValues(emptyValues); setBookingDate(''); setAvailableSlots([]); setBookingNotice(null); setNotice(null);
    window.setTimeout(() => document.getElementById('reservar')?.scrollIntoView({ behavior: 'smooth', block: 'start' }), 0);
  }
  function handleValueChange(event) { setValues(current => ({ ...current, [event.target.name]: event.target.value })); }
  async function reserve(event) {
    event.preventDefault(); setBookingNotice(null); setSending(true);
    try {
      const response = await fetch('/api/appointments', { method: 'POST', headers: { 'Content-Type': 'application/json' }, body: JSON.stringify({ doctorId: selected.id, patientName: values.patientName, patientEmail: values.patientEmail, startsAt: new Date(values.startsAt).toISOString() }) });
      const result = await response.json().catch(() => ({}));
      if (!response.ok) throw new Error(result.error || 'Error al registrar la cita.');
      setSelected(null); setValues(emptyValues); setNotice({ type: 'success', message: 'Tu solicitud fue registrada correctamente.' });
      document.getElementById('especialistas')?.scrollIntoView({ behavior: 'smooth', block: 'start' });
    } catch (error) { setBookingNotice({ type: 'error', message: error instanceof TypeError ? 'No se pudo conectar con el servidor. Verifica que backend y frontend estén encendidos.' : error.message }); }
    finally { setSending(false); }
  }
  function closeBooking() { setSelected(null); setBookingNotice(null); setAvailableSlots([]); setBookingDate(''); }

  return <div className="public-page">
    <header className="public-navbar"><a href="#inicio" aria-label="MediTurno, inicio"><PublicLogo /></a><nav className={mobileNav ? 'is-open' : ''} aria-label="Navegación principal"><a href="#especialistas" onClick={() => setMobileNav(false)}>Especialistas</a><a href="#como-funciona" onClick={() => setMobileNav(false)}>Cómo funciona</a><a href="/admin" onClick={() => setMobileNav(false)}>Acceso administrativo</a></nav><button className="public-menu-button" onClick={() => setMobileNav(!mobileNav)} aria-label={mobileNav ? 'Cerrar menú' : 'Abrir menú'}><PublicIcon name="menu" /></button></header>
    <main id="inicio">
      <section className="public-hero"><div className="public-hero-copy"><span className="public-kicker public-kicker-soft">Tu salud, más cerca</span><h1>Reserva tu cita médica de forma fácil y rápida.</h1><p>Encuentra al especialista que necesitas, elige un horario conveniente y gestiona tu solicitud desde un solo lugar.</p><a className="public-primary-button hero-cta" href="#especialistas">Buscar especialistas <PublicIcon name="arrow" size={18} /></a><div className="public-trust-row"><span><PublicIcon name="shield" size={17} />Profesionales disponibles</span><span><PublicIcon name="calendar" size={17} />Agenda en línea</span><span><PublicIcon name="bolt" size={17} />Solicitud sencilla</span></div></div><HeroVisual /></section>
      <section className="public-search-card" aria-label="Buscar especialistas"><form onSubmit={event => { event.preventDefault(); document.getElementById('especialistas')?.scrollIntoView({ behavior: 'smooth' }); }}><label><span>Especialidad</span><select value={specialty} onChange={event => setSpecialty(event.target.value)}><option value="">Todas las especialidades</option>{specialties.map(item => <option key={item}>{item}</option>)}</select></label><label><span>Ciudad</span><select value={city} onChange={event => setCity(event.target.value)}><option value="">Todas las ciudades</option>{cities.map(item => <option key={item}>{item}</option>)}</select></label><label className="public-search-name"><span>Nombre o especialidad</span><input value={search} onChange={event => setSearch(event.target.value)} placeholder="Ej. Dermatología" /></label><button className="public-primary-button" type="submit"><PublicIcon name="search" size={17} />Buscar</button></form></section>
      {notice && <div className={`public-global-notice ${notice.type}`} role="status">{notice.message}</div>}
      <section className="public-section public-specialists" id="especialistas"><div className="public-section-heading"><div><span className="public-kicker">NUESTROS PROFESIONALES</span><h2>Especialistas destacados</h2><p>Conoce a los médicos disponibles para atender tu solicitud.</p></div><span className="public-results-count">{filteredDoctors.length} disponibles</span></div>{loading ? <p className="public-state">Cargando especialistas...</p> : filteredDoctors.length === 0 ? <div className="public-empty"><PublicIcon name="search" size={26} /><h3>No encontramos especialistas</h3><p>Prueba con otro nombre, especialidad o ciudad.</p><button onClick={() => { setSearch(''); setSpecialty(''); setCity(''); }}>Limpiar búsqueda</button></div> : <div className="public-doctor-grid">{filteredDoctors.map(doctor => <DoctorCard doctor={doctor} onReserve={openBooking} key={doctor.id} />)}</div>}</section>
      {selected && <BookingForm doctor={selected} values={values} onChange={handleValueChange} onSubmit={reserve} onClose={closeBooking} sending={sending} notice={bookingNotice} bookingDate={bookingDate} onDateChange={event => setBookingDate(event.target.value)} availableSlots={availableSlots} availabilityLoading={availabilityLoading} availabilityError={availabilityError} minDate={limaDate()} />}
      <section className="public-section public-how" id="como-funciona"><div className="public-section-heading centered"><span className="public-kicker">CÓMO FUNCIONA</span><h2>Tu cita en tres pasos.</h2><p>Una experiencia simple para que puedas enfocarte en lo importante: tu salud.</p></div><div className="public-steps"><article><span className="public-step-number">01</span><div className="public-step-icon"><PublicIcon name="search" /></div><h3>Busca un especialista</h3><p>Filtra por especialidad, ciudad o nombre y encuentra una opción disponible.</p></article><article><span className="public-step-number">02</span><div className="public-step-icon"><PublicIcon name="calendar" /></div><h3>Elige un horario</h3><p>Selecciona una fecha y hora futura que se adapte a tu agenda.</p></article><article><span className="public-step-number">03</span><div className="public-step-icon"><PublicIcon name="check" /></div><h3>Solicita tu cita</h3><p>Completa tus datos y recibe la confirmación de tu solicitud.</p></article></div></section>
      <section className="public-benefits"><div><span className="public-kicker">UNA MEJOR EXPERIENCIA</span><h2>Todo lo que necesitas para organizar tu atención.</h2><p>MediTurno reúne la información esencial para que reservar una cita sea claro, rápido y cómodo.</p></div><div className="public-benefit-list"><article><span><PublicIcon name="shield" /></span><div><h3>Información clara</h3><p>Consulta especialidad, ciudad y profesional antes de reservar.</p></div></article><article><span><PublicIcon name="clock" /></span><div><h3>Ahorra tiempo</h3><p>Solicita una cita en línea sin llamadas ni desplazamientos innecesarios.</p></div></article><article><span><PublicIcon name="bolt" /></span><div><h3>Proceso simple</h3><p>Un flujo corto y fácil de entender desde la búsqueda hasta la solicitud.</p></div></article></div></section>
    </main>
    <footer className="public-footer"><div><PublicLogo light /><p>Una forma más sencilla de acercarte a la atención médica.</p></div><div className="public-footer-links"><a href="#especialistas">Especialistas</a><a href="#como-funciona">Cómo funciona</a><a href="/admin">Acceso administrativo</a></div><div className="public-footer-bottom"><span>© {new Date().getFullYear()} MediTurno</span><span>Proyecto personal de aprendizaje</span></div></footer>
  </div>;
}

export default App;
