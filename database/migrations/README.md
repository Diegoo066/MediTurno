# Migraciones de disponibilidad

Ejecuta desde `backend`:

```powershell
npm.cmd run db:migrate
```

La migracion crea `doctor_availability`, agrega `appointments.slot_key` y una restriccion unica por medico y franja activa. Es no destructiva: conserva las citas existentes y no elimina datos.

En una instalacion nueva, `database/schema.sql` agrega horarios demo de lunes a viernes, de 08:00 a 17:00 en `America/Lima`. Para bases antiguas donde la tabla no existia, `db:migrate` los agrega una sola vez y registra el paso en `schema_migrations`; las ejecuciones posteriores no vuelven a crear horarios que un administrador haya eliminado intencionalmente.

La API publica es `GET /api/doctors/:doctorId/availability?date=YYYY-MM-DD`. La API administrativa protegida permite reemplazar unicamente la configuracion de agenda de un medico con `PUT /api/admin/doctors/:doctorId/availability` y un cuerpo como:

```json
{"slots":[{"weekday":0,"startTime":"08:00","endTime":"17:00"}]}
```

`weekday` va de lunes `0` a domingo `6`. Las citas `scheduled` y `confirmed` bloquean la franja; las `cancelled` la liberan. La creacion usa una transaccion y la clave unica evita duplicados simultaneos.
