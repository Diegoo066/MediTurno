# MediTurno

MediTurno es una aplicación full stack para consultar médicos y solicitar citas médicas. Incluye una landing pública con disponibilidad real de horarios y un panel administrativo protegido para gestionar reservas.

> Proyecto personal de aprendizaje. No incluye datos de pacientes, credenciales ni secretos. Los médicos incluidos en el esquema son registros de demostración.

## Tecnologías

- React 18 y Vite 6 para la interfaz web.
- Node.js y Express 4 para la API REST.
- MySQL/MariaDB mediante `mysql2`.
- Cookies `HttpOnly` firmadas para la sesión administrativa.
- Consultas parametrizadas y transacciones para las operaciones de reservas.

## Arquitectura

```text
frontend/        React + Vite, landing pública y panel /admin
backend/         Express, autenticación, médicos, citas y disponibilidad
database/        esquema y migraciones SQL no destructivas
```

La interfaz pública consume únicamente médicos y disponibilidad. La información de pacientes está restringida a las rutas administrativas autenticadas.

## Funcionalidades

- Búsqueda de médicos por nombre, especialidad y ciudad.
- Formulario de reserva con validación y selección de franjas de 30 minutos.
- Disponibilidad configurable por médico en `America/Lima`.
- Bloqueo de horarios con citas `scheduled` o `confirmed`.
- Liberación de horarios al cancelar una cita.
- Prevención de duplicados mediante transacciones y una restricción única por médico y franja.
- Panel administrativo con inicio de sesión, estadísticas, filtros y acciones para confirmar, cancelar o reactivar citas.
- Estados de carga, errores y resultados vacíos en las interfaces.

## Requisitos

- Node.js 20.19+ o 22.12+.
- MySQL 8+ o MariaDB compatible.
- Una base de datos local para desarrollo.

## Instalación local en Windows

Desde PowerShell:

```powershell
cd C:\ruta\a\MediTurno\mediturno-starter

cd backend
npm.cmd install
Copy-Item .env.example .env

cd ..\frontend
npm.cmd install
```

Configura `backend\.env` localmente. Ese archivo está excluido por Git y no debe subirse.

## Configuración segura del administrador

En `backend\.env` define valores propios:

```dotenv
ADMIN_EMAIL=tu-correo-administrativo
ADMIN_PASSWORD_HASH=hash-generado-localmente
AUTH_SECRET=secreto-largo-y-aleatorio
COOKIE_SECURE=false
```

Genera el hash sin guardar la contraseña en el código:

```powershell
cd backend
npm.cmd run admin:hash
```

No uses credenciales predeterminadas ni compartas `.env`. `COOKIE_SECURE=false` es solamente para HTTP local; en HTTPS debe activarse la cookie segura.

## Base de datos y migraciones

Para una instalación nueva, ejecuta `database\schema.sql` una sola vez. Si la base ya existe, no la recrees: aplica las migraciones desde `backend`:

```powershell
npm.cmd run db:migrate
```

Las migraciones conservan médicos y reservas. La migración de disponibilidad:

- crea `doctor_availability`;
- agrega `appointments.slot_key` y su índice único;
- carga solo una agenda inicial de lunes a viernes, 08:00–17:00, para los médicos existentes;
- mantiene el historial de citas canceladas.

La configuración de agenda se expresa con `weekday` de lunes `0` a domingo `6`, horas `HH:MM` en múltiplos de 30 minutos y zona `America/Lima`.

## Ejecución

Terminal 1, API:

```powershell
cd backend
npm.cmd run dev
```

Terminal 2, frontend:

```powershell
cd frontend
npm.cmd run dev
```

Abre:

- Landing: http://127.0.0.1:5173/
- Panel administrativo: http://127.0.0.1:5173/admin
- API de salud: http://127.0.0.1:3001/api/health

## Endpoints principales

```text
GET  /api/doctors
GET  /api/doctors/:doctorId/availability?date=YYYY-MM-DD
POST /api/appointments
POST /api/admin/login
GET  /api/admin/dashboard
GET  /api/admin/appointments
PATCH /api/admin/appointments/:id/status
GET  /api/admin/doctors/:doctorId/availability
PUT  /api/admin/doctors/:doctorId/availability
```

Las rutas administrativas requieren la cookie de sesión `HttpOnly`. No se expone la lista de pacientes mediante endpoints públicos.

## Verificación

Build del frontend:

```powershell
cd frontend
npm.cmd run build
```

Comprobaciones recomendadas:

1. Consultar `/api/doctors` y comprobar los médicos de demostración.
2. Consultar disponibilidad para una fecha futura.
3. Crear una cita usando datos ficticios.
4. Repetir la misma franja y confirmar el error de conflicto.
5. Cancelar la cita desde `/admin` y comprobar que la franja vuelve a estar disponible.
6. Confirmar que `/api/admin/appointments` responde `401` sin sesión.

## Capturas

Las capturas deben generarse localmente con datos ficticios y sin mostrar correos, nombres de pacientes, cookies, tokens ni valores de `.env`. Se recomienda guardar únicamente imágenes sanitizadas en `docs/screenshots/`; esa carpeta no forma parte de la lógica de la aplicación.

No se publican estadísticas de usuarios, valoraciones, certificaciones ni métricas de negocio porque no existen datos verificables para ellas.

## Seguridad y publicación

Antes de hacer commit revisa:

```powershell
git status --short --ignored
git check-ignore -v backend\.env
git log --all -- backend\.env
```

No subas `.env`, `node_modules`, `dist`, logs, volcados de bases de datos ni datos reales. Revisa también cualquier captura o archivo nuevo antes de añadirlo.
