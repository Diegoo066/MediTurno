# Migraciones de disponibilidad

Ejecuta desde `backend`:

```powershell
npm.cmd run db:migrate
```

La migración `002_add_doctor_availability_and_slot_key.sql` crea `doctor_availability`, agrega `appointments.slot_key` y una restricción única por médico y franja activa. Es no destructiva: conserva las citas existentes y solo carga una agenda inicial de lunes a viernes, de 08:00 a 17:00, para los médicos ya registrados. La agenda usa franjas de 30 minutos y `America/Lima`.

La API pública es `GET /api/doctors/:doctorId/availability?date=YYYY-MM-DD`. La API administrativa protegida permite reemplazar únicamente la configuración de agenda de un médico con `PUT /api/admin/doctors/:doctorId/availability` y un cuerpo como:

```json
{"slots":[{"weekday":0,"startTime":"08:00","endTime":"17:00"}]}
```

`weekday` va de lunes `0` a domingo `6`. Las citas `scheduled` y `confirmed` bloquean la franja; las `cancelled` la liberan. La creación se ejecuta dentro de una transacción y la clave única evita duplicados simultáneos.
