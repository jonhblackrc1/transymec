# CRM de viajes TRANSYMEC — guía

Sistema para controlar los viajes, sin módulo de finanzas. Tiene tres accesos:

| Quién | Dónde entra | Qué puede hacer |
|---|---|---|
| **Administración** | `login.html` → `admin.html` | Todo: viajes, agenda, clientes, conductores, flota, nómina, bitácora y claves de pasajero |
| **Conductor** | `login.html` → `conductor.html` | Ver **solo sus viajes**, iniciar/finalizar, marcar abordaje, avisar llegada, compartir ubicación, reportar retrasos e incidencias |
| **Pasajero** | `viaje.html?c=CÓDIGO` + clave | Sin cuenta. Ve estado, horario, bus (patente), conductor, novedades y la última ubicación; completa la nómina de pasajeros |

## Modo demostración

Mientras `auth-config.js` no tenga los datos de Supabase, el sistema funciona en **modo demostración**: usa datos de ejemplo guardados solo en el navegador de quien lo abre. Sirve para probarlo y capacitar al equipo.

- Admin: `admin` / `admin123`
- Conductor: `jperez` / `1234` (también `mrojas` y `lsoto`, misma clave)
- Pasajero: código `TX-DEMO24`, clave `DEMO24`

El botón **Restablecer datos** de la franja amarilla vuelve a los datos de ejemplo.

## Pasar a datos reales (Supabase, plan gratuito)

1. Crea un proyecto en [supabase.com](https://supabase.com).
2. **SQL Editor → New query**: pega todo el archivo `supabase/schema.sql` y presiona **Run**.
3. **Authentication → Sign In / Providers → Email**: desactiva **Confirm email**.
   Los usuarios entran con un nombre (ej. `jperez`) que el sistema convierte en `jperez@transymec.cl`; ese correo no existe, así que no se puede confirmar.
4. **Authentication → Users → Add user → Create new user**:
   email `root@transymec.cl`, una contraseña segura y marca **Auto Confirm User**.
5. Vuelve al **SQL Editor** y ejecuta otra vez solo el bloque final de `schema.sql` (el `insert into public.profiles …` de "PRIMER ADMINISTRADOR"). Eso convierte a `root` en administrador.
6. **Project Settings → API**: copia la **Project URL** y la **anon public key** en `auth-config.js` y sube el cambio.
7. Entra a `login.html` con usuario `root`. Desde **Conductores → Nuevo usuario** crea al resto del equipo.

> La *anon key* es pública por diseño. La seguridad la dan las reglas de la base de datos (RLS): un conductor no puede ver viajes ajenos, y un pasajero solo ve su viaje si tiene la clave correcta.

## Cómo se usa un viaje, paso a paso

1. **Administración crea el viaje** (`Nuevo viaje`). El sistema genera un **código** (ej. `TX-K7P2QM`) y una **clave** de 6 caracteres. La clave se muestra **una sola vez**, junto con un mensaje listo para enviar por WhatsApp al cliente.
2. Al guardar, el formulario avisa si hay **choques de horario** (mismo conductor o bus), si el bus tiene **menos asientos** que pasajeros, o si la **licencia o revisión técnica** vence antes del viaje.
3. El cliente abre el link, ingresa la clave y **completa la nómina**. También se puede pegar una lista desde Excel en el detalle del viaje.
4. Administración **confirma** el viaje. El pasajero lo ve como confirmado.
5. El día del viaje, el conductor avisa **"Llegué al punto de encuentro"**, marca a cada pasajero **a bordo** e **inicia el viaje**. El pasajero ve el aviso y la ubicación del bus.
6. Durante el viaje el conductor puede **compartir ubicación** o **reportar un retraso o incidencia** (y elegir si lo ve el pasajero).
7. Al llegar, el conductor **finaliza el viaje**.
8. **Hoja de ruta**: en el detalle del viaje, imprime o guarda en PDF la hoja con los datos y la nómina, con espacio para las firmas.

Si el cliente pierde la clave, usa **Generar nueva clave** en el detalle del viaje. La anterior deja de funcionar.

## Seguridad incluida

- Las claves de pasajero se guardan **cifradas** (solo el hash). Ni el admin puede volver a verlas.
- Después de **8 intentos fallidos** en 15 minutos, el código queda bloqueado 15 minutos.
- El pasajero no ve notas internas, ni la ubicación del bus cuando el viaje no está en curso.
- Si alguien se registra por su cuenta en Supabase, queda **inactivo** y sin acceso. Solo entran los usuarios creados por administración.
- Para **desactivar** a un conductor: Conductores → Editar → desmarcar "Cuenta activa".
- Para **cambiar la contraseña** de un usuario: Supabase → Authentication → Users.

## Archivos

| Archivo | Para qué |
|---|---|
| `supabase/schema.sql` | Tablas, reglas de seguridad y funciones de la base de datos |
| `js/crm-data.js` | Conexión a datos (Supabase o demostración) |
| `js/crm-ui.js` | Utilidades compartidas de la interfaz |
| `js/admin.js`, `admin.html` | Vista de administración |
| `js/conductor.js`, `conductor.html` | Vista del conductor (pensada para el celular) |
| `js/portal.js`, `viaje.html` | Portal del pasajero |
| `crm.css` | Estilos del CRM |
