# La Protectora del Alquiler

Plataforma comunitaria de confianza para el alquiler en Costa Rica:

- **Propietarios y agencias** publican reseñas de inquilinos (calificación, etiquetas, daños, procesos, comentario, fotos).
- **Usuarios con permiso vigente** buscan e inspeccionan fichas antes de alquilar.
- Las reseñas pueden **denunciarse** para moderación.
- PII protegida: la cédula se muestra enmascarada salvo para su autor o admin.

## Diseño y experiencia

La dirección visual y las reglas de interacción están en [design.md](design.md). El alcance, los cambios y las verificaciones de la revisión de UX están en [docs/ux-review.md](docs/ux-review.md).

## Stack

- [Next.js 16](https://nextjs.org) (App Router, TypeScript, Tailwind v4)
- [Supabase](https://supabase.com): PostgreSQL + Auth + Storage + RLS
- UI 100% en español

## Estructura

| Ruta | Contenido |
| --- | --- |
| `MIGRACION.md` | Guía paso a paso (autocontenida) para la puesta en marcha y migración |
| `schema.sql` | Esquema v2 (Postgres, canónico) |
| `legacy/schema.sql` | Dump del sistema legacy MySQL (referencia) |
| `db/seeds.sql` | Lookups + datos demo |
| `scripts/aplicar-esquema.mjs` | Aplica schema + seeds al Postgres destino |
| `scripts/migrar-legacy.mjs` | Migra datos del MySQL legacy al nuevo |
| `lib/` | Supabase clients, DAL, acciones del servidor, tipos |
| `app/` | Páginas (landing, login, registro, fichas, reseñas, perfil) |

## Puesta en marcha

### Permiso temporal de consulta

Antes de desplegar esta versión sobre una base existente, ejecute
`npm run db:acceso-consultas`. Aplica `db/resenas-unicas.sql` y
`db/acceso-temporal-consultas.sql`, cada una en una transacción y sin borrar datos.
Requiere las políticas de seguridad del esquema actual
(`db/seguridad-acceso.sql` en instalaciones antiguas). En bases nuevas,
`schema.sql` ya incluye ambas migraciones.

Cada propietario puede tener una sola reseña por persona, sea pendiente, publicada
o rechazada. Otros propietarios pueden reseñar a esa persona. Un índice único sobre
`(autor_id, persona_id)` aplica la regla incluso en envíos simultáneos, importaciones
y cambios de persona desde administración. Si ya hay duplicados, la migración se
detiene e indica cómo listarlos; deben revisarse antes de reintentar. No los borra
ni elige automáticamente qué relato conservar.

Solo cuentan los pares autor–inquilino con al menos una reseña actualmente publicada.
La primera aprobación de cada par suma 3 meses al vencimiento vigente. Si
el permiso ya venció, los 3 meses comienzan en la nueva aprobación. El tiempo
no utilizado se acumula, pero el vencimiento nunca puede superar 12 meses desde
la primera aprobación del par autor–inquilino más reciente. Se suman meses naturales
en UTC, ajustando al último día del mes cuando corresponda. Al llegar al instante
de vencimiento se deniega la consulta. Administración activa está exenta;
las cuentas inactivas no consultan.

El trigger registra la primera aprobación y un recibo privado inmutable.
Un aporte se identifica por autor y persona, independientemente del tipo de
reseña o la fecha de inicio. Varias reseñas del mismo autor sobre un inquilino
cuentan una sola vez, desde su primera
aprobación, incluso al borrar la original y reenviarla. Editar datos o rechazar
y aprobar de nuevo tampoco reinicia el plazo. Al rechazar o eliminar la última
reseña publicada de un par autor–inquilino, se recalcula el permiso sin ese aporte.
Los recibos no guardan el relato y se eliminan al borrar la cuenta del autor.

El formulario no pide fecha de inicio. Administración verifica la experiencia,
independientemente de si el relato es positivo o negativo. Otro alquiler con el
mismo inquilino no genera una segunda recompensa para ese autor. La migración
aplica esta regla también a las reseñas históricas, con o sin fecha, y conserva
las fechas registradas. Al agrupar aportes antes separados por fecha o tipo,
el saldo de acceso existente puede reducirse o vencer; no se reinicia el plazo.
Las reseñas publicadas existentes y las importaciones legacy usan su fecha
de creación, porque no existe un historial anterior de aprobación. La
migración no concede un período nuevo a reseñas antiguas.

El mismo cálculo SQL sirve a RLS, al DAL y a la interfaz. El servidor consulta
el estado por petición; no se guarda autorización en cookies ni cachés
persistentes y no hace falta una tarea programada. Los fallos de consulta
deniegan acceso. Los usuarios sin permiso pueden seguir viendo sus reseñas
en el perfil y enviar nuevas experiencias a revisión.

Validación: `npm run test:acceso-consultas` usa Postgres desechable en Docker
para probar migración, acumulación, límite de 12 meses, fin de mes, años
bisiestos, duplicados, aprobaciones simultáneas, moderación, renovación,
cuentas inactivas y acceso directo con RLS.

### Edición administrativa de reseñas

Para actualizar una base existente con la edición y eliminación administrativa
de reseñas, ejecute `npm run db:admin-resenas` antes de desplegar estos cambios.
Este comando instala únicamente las funciones de `db/administrar-resenas.sql`;
conserva los datos. **No use `db:aplicar` para actualizar una base existente**:
el esquema inicial recrea las tablas.

Las funciones comprueban que quien actúa sea un administrador activo y solo
permiten ejecución al servidor (`service_role`). La edición guarda los cambios
de inquilino y reseña en una sola transacción. Las cédulas legacy sin modificar
se admiten al corregir otros datos. Puede verificarlo con
`npm run test:admin-resenas` (requiere Docker; crea una base desechable).

### Correos opcionales de administración

No es necesario contratar un plan ni configurar Resend para editar o eliminar
reseñas. Mientras `RESEND_API_KEY` esté vacío, la casilla «Notificar por correo»
aparece deshabilitada con un aviso. Cada acción requiere que el administrador
marque esa casilla; está desmarcada de forma predeterminada.

Para habilitarla más adelante:

1. Verifique `protectoradelalquiler.com` en Resend y cree una API key con permiso
   de envío. Si utiliza otro dominio, configure también `RESEND_FROM_EMAIL` con
   un remitente de ese dominio verificado. El valor predeterminado es
   `La Protectora del Alquiler <notificaciones@protectoradelalquiler.com>`.
2. Configure `RESEND_API_KEY` en el entorno del servidor (`.env.local` en local;
   `vercel env add RESEND_API_KEY production` en Vercel). No use `NEXT_PUBLIC_`
   para esta clave. Reinicie el servidor local o vuelva a desplegar en Vercel.

Los avisos se envían por la [API de Resend](https://resend.com/docs/api-reference/emails/send-email)
al autor obtenido de la base de datos, únicamente después de confirmar el cambio.
El correo contiene el número de reseña y un enlace al perfil; no incluye la cédula
ni el relato. Los errores transitorios tienen un reintento con la misma clave de
idempotencia. Si no se puede confirmar el envío, el cambio se conserva y aparece
un aviso persistente para administración, incluso si la reseña desapareció de la
lista. No vuelva a modificar o eliminar para reintentar el correo: primero revise
los registros en Resend. Las cuentas legacy sin correo real y las eliminadas no
reciben notificaciones.

### Instalación inicial

1. Cree un proyecto en [supabase.com](https://supabase.com) (plan gratuito).
   En **Authentication → Providers**, para desarrollo puede desactivar la
   confirmación de correo. En **Settings → API** copie la *Project URL*, la
   *publishable key* (`sb_publishable_…`, la legacy `anon` también sirve) y la
   *secret key* (`sb_secret_…`, solo servidor; la legacy `service_role` también
   sirve). Para `DATABASE_URL` use **Settings → Database → Connection string →
   URI → "Session"** (pooler, puerto 5432; el host "direct" de proyectos
   nuevos a veces no resuelve en DNS).
2. Configure el entorno:

   ```bash
   cp .env.example .env.local
   # rellene los valores copiados
   ```

3. Aplique el esquema y los seeds:

   ```bash
   npm run db:aplicar
   ```

4. (Opcional) Importe los datos del sistema legacy:

   ```bash
   # primero simule contra un destino de staging (valida SQL y revierte el lote):
   npm run db:migrar -- --seco
   # luego la importación real:
   npm run db:migrar
   # crea las identidades en Supabase Auth y conserva la clave cuando se puede:
   npm run db:migrar -- --crear-accounts
   # si los perfiles ya se importaron, complete solo los accesos pendientes:
   npm run db:migrar -- --solo-accesos --crear-accounts
   ```

    La simulación (`--seco`) y la importación requieren `DATABASE_URL` (o las
    variables de la integración `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL`).
    `--solo-accesos --crear-accounts` revisa todos los perfiles actuales y
    procesa los accesos pendientes por lotes (`--limite-auth`, por defecto
    1000 cuentas), sin volver a importar datos. Necesita la conexión MySQL para
    comprobar identidades y recuperar las claves compatibles.
   Conserva los accesos existentes, las cuentas inactivas y los autores sin
   correo. Muestra por separado las coincidencias ausentes, los conflictos y
   los fallos. Repita el botón mientras haya pendientes: continúa después del
   último intento y vuelve al inicio al terminar el recorrido para reintentar
   los fallos. Recargar la página reinicia el recorrido, pero omite los accesos
   ya completados. Si una clave anterior no es compatible o Auth la rechaza
   por su política de contraseñas, esa cuenta debe usar **¿Olvidó su clave?**.
   Los conteos de claves conservadas y restablecimientos corresponden al lote
   actual; las cuentas previamente enlazadas conservan su clave de Auth.

   Si MySQL ya no está disponible, `scripts/provisionar-accesos-importados.mjs`
   permite completar el acceso de los perfiles activos existentes usando solo
   Postgres y Supabase Auth. Primero ejecute la vista previa:

   ```bash
   node scripts/provisionar-accesos-importados.mjs
   node scripts/provisionar-accesos-importados.mjs --aplicar --limite=50 --tiempo=120
   ```

   Repita los lotes hasta que la vista previa muestre cero perfiles elegibles.
   Cada cuenta recibe una clave aleatoria privada y se enlaza a su perfil
   existente. La persona debe usar `/recuperar` con su correo anterior para
   elegir su clave; no debe volver a registrarse. La provisión no envía correos
   y conserva roles, actividad y reseñas. Omite cuentas inactivas,
   administradores, correos inválidos o duplicados, cédulas compartidas con
   otro perfil activo o enlazado, identidades Auth ya existentes e invitaciones
   pendientes. Una cédula repetida solo en perfiles inactivos sin acceso no
   bloquea el perfil activo; los registros históricos se conservan. Si un lote indica
   `requiere_revision`, revise el marcador de ese lote y su identidad antes de
   continuar: una llamada a Auth puede haber creado la cuenta aunque el enlace
   en Postgres no se haya confirmado.

   El importador y `db:aplicar` verifican la cadena TLS y el nombre del servidor.
   La CA pública de Supabase se incluye en el despliegue: no necesita una nueva
   variable ni descargarla en cada ejecución. Las URLs con `sslmode=require`
   se normalizan a `verify-full`, conservando una CA explícita en `sslrootcert`
   si existe. Para Postgres local sin TLS use `DATABASE_SSL=false`; esta opción
   solo se acepta para `localhost`, `127.0.0.1` o `::1`.
   Consulte [la procedencia y renovación de la CA](scripts/certs/README.md).
   La simulación ejecuta las mismas escrituras y restricciones dentro de una
   transacción y termina con `ROLLBACK`; no crea accesos en Supabase Auth.
   Las secuencias de Postgres pueden avanzar aunque se reviertan las filas.

   La importación de datos es atómica y tiene un bloqueo de base de datos:
   un error revierte el lote completo y dos importadores no pueden escribir
   a la vez. Puede reejecutarse sin duplicar personas, cuentas o reseñas.
   Los catálogos se emparejan por significado y ubicación superior, sin
   reutilizar los ids de los seeds como si fueran ids legacy. Las etiquetas
   y conductas de reseñas importadas se sincronizan con el origen al repetir.
   `--pasos=resenas` incluye automáticamente catálogos, personas y usuarios.

   Se mantiene una sola reseña por propietario y persona. Cuando varias fichas
   legacy corresponden al mismo par, se elige la de fecha válida más reciente;
   las fechas desconocidas quedan detrás de las conocidas y, en caso de empate,
   gana el identificador de origen más alto. Sus etiquetas y conductas también
   corresponden a esa ficha. Si el par ya tiene una reseña creada en la app,
   se conserva sin reemplazarla por el contenido legacy.

   Todas las fichas originales se archivan completas en un esquema privado,
   vinculadas a la reseña correspondiente, incluso las que se consolidan o
   coinciden con una reseña de la app. Las nuevas versiones del origen se
   conservan sin sobrescribir las anteriores; repetir el mismo contenido no
   duplica el archivo. Este archivo contiene únicamente las filas de
   `tb_inquilinos_no_nacionales`, nunca credenciales de conexión ni las tablas
   de claves o accesos. No está disponible para visitantes ni usuarios de la app.
   El importador prepara el archivo dentro de su propia transacción: al
   desplegar este cambio no hace falta ejecutar una migración manual. Una
   simulación o un fallo revierte también el archivo.

   El resultado distingue **fichas leídas**, **originales archivados**,
   **fichas consolidadas** (las adicionales de cada par), **reseñas importadas**
   y **actuales conservadas** (reseñas de la app que no se reemplazan).
   En una simulación las cifras describen lo que se haría; no se guarda nada.

   La tabla de fichas `tb_inquilinos_no_nacionales` es obligatoria. Si el origen
   no contiene `tb_persona`, el importador obtiene las personas de las fichas y
   de `tb_solicitante`, si existe, e informa esta limitación en las observaciones.
   Los accesos de `tb_login` que dependan de esa tabla no se vinculan por una
   coincidencia de ids: quedan inactivos, al igual que los autores sin identidad
   comprobable. **Probar conexión** avisa de esta situación antes de importar;
   revise primero una simulación. Una tabla sin permiso de lectura produce un
   error de permisos, no se trata como una tabla ausente.

   Revise las **observaciones** de la simulación. Los nombres faltantes se
   indican expresamente, las fechas inválidas quedan vacías y los autores
   ausentes o ambiguos usan perfiles inactivos. Las cuentas con una cédula
   compartida permanecen separadas y sin un enlace arbitrario a una persona.
   Los estados de reseña desconocidos quedan como borradores. El esquema
   legacy no incluye tablas para varios códigos (calificación, contrato,
   duración, daños y procesos judiciales): sin un catálogo verificable se
   dejan vacíos y se reportan; **no se inventan equivalencias con los seeds**.
   Conserve el respaldo original para reconciliar esos códigos.

   Supabase Auth se procesa después de confirmar los datos y solo para las
   cuentas importadas. Un fallo de Auth se informa como resultado parcial
   (código de salida `2`); repetir con `--crear-accounts` completa los accesos
   pendientes sin restablecer las claves de cuentas ya enlazadas. Los fallos
   de datos usan código `1`; éxito y simulación válida usan `0`.

   Use una copia estable del MySQL legacy o detenga las escrituras durante la
   migración: sus tablas MyISAM no ofrecen una instantánea transaccional.
   Las fechas sin zona se interpretan como Costa Rica (`-06:00`); configure
   `LEGACY_MYSQL_TIMEZONE` si el servidor anterior usaba otra zona fija.
    Para volúmenes mayores use `npm run db:migrar` desde un servidor con acceso
    a ambas bases. No vuelva a ejecutar `db:aplicar` sobre datos existentes:
   ese comando recrea las tablas.

   Pruebas de integración aisladas (Docker, imágenes `mysql:8` y
   `postgres:16-alpine`; nunca usan las bases de `.env.local`):

   ```bash
    npm run test:importacion
    ```

5. Desarrolle:

   ```bash
   npm run dev
   ```

## Decisiones del modelo de datos

- `personas` es la persona natural (cédula única); `usuarios` es la cuenta
  (1:1 opcional vía `persona_id`); `resenas` une autor → persona.
- `resenas.fuente/id_fuente` identifican la ficha legacy elegida; el archivo
  privado conserva todas las fichas originales y sus versiones.
- Las FK de las fichas se traducen mediante equivalencias de catálogos;
  los ids y las relaciones existentes en destino se conservan.
- RLS: lectura pública solo para `resenas` publicas y `personas` (ver
  `schema.sql`); la app siempre valida sesión y rol en el DAL.
- Facebook login está implementado y oculto. `autenticaciones.proveedor_id`
  sigue siendo el enlace público del perfil (el que abre administración), no
  el id de Facebook. Para encenderlo en producción, siga
  `docs/runbooks/facebook-signin.md` y al final ponga `AUTH_FACEBOOK=1`.

### Registro e invitaciones de administración

El registro público tiene dos pasos: crear la cuenta y enviar la primera reseña. Si una persona abandona el segundo paso, su cuenta existe pero no puede consultar el registro hasta tener una reseña aprobada. Al volver a iniciar sesión se retoma ese paso. En Usuarios se distingue entre cuentas sin reseña, pendientes de aprobación y con acceso. Las cuentas inactivas no pueden consultar.

Las cuentas de administración están exentas de la primera reseña. Desde **Administración → Usuarios → Invitar administrador**, un administrador activo puede generar un enlace de invitación por nombre y correo para una persona nueva, copiarlo y enviarlo desde su propio correo. Este flujo no requiere Resend ni un servicio de pago. Si ya existe una cuenta, se debe cambiar su rol desde la lista de usuarios. El envío automático por correo es una opción adicional, desmarcada por defecto: usa la misma configuración de Resend y permanece deshabilitado mientras falte `RESEND_API_KEY`.

Antes de desplegar esta funcionalidad en una base existente, aplique la migración aditiva:

```bash
npm run db:invitaciones-admin
```

El enlace apunta al dominio de producción `https://www.protectoradelalquiler.com/invitacion/admin`. La invitación no otorga acceso hasta que el destinatario verifica el enlace y establece una clave. No consume el enlace al abrir la página (evita que un escáner de correo lo acepte). El token vence según la configuración de Auth y la invitación tiene un máximo de 24 horas. Generar otra invitación para el mismo correo reemplaza el enlace anterior. Comparta el enlace solo con el destinatario indicado: permite activar una cuenta de administración. Si falla el envío o la aceptación, se puede reenviar con el mismo formulario. Las cuentas ya existentes nunca se promueven ni reactivan por este flujo; la persona que invitó debe seguir siendo administrador activo al aceptar. La tabla de invitaciones registra quién invitó y cuándo se aceptó; solo el servidor tiene acceso.

## Actualización de seguridad de Supabase

Para una base existente, `npm run db:seguridad` aplica únicamente
`db/seguridad-supabase.sql`; conserva los datos. El mismo contenido se incluye
en `schema.sql` para instalaciones nuevas y en la migración de Supabase
`20260930033313_seguridad_supabase.sql`. No use `db:aplicar` para una actualización.

La actualización limita las columnas de INSERT, impide crear fichas directamente
con la sesión de usuario y provisiona el perfil cuando Supabase Auth confirma
el correo. Despliegue conjuntamente el cambio de registro: ahora usa `signUp`,
manda la confirmación mediante Supabase y no fuerza la verificación del correo.
Mantenga **Confirm email** habilitado y permita la URL
`https://www.protectoradelalquiler.com/auth/confirmar` en Authentication → URL
Configuration. El perfil y su enlace público de Facebook se crean atómicamente
al confirmar; una cédula o enlace ya ocupado requiere corregir el registro.

Los roles elegibles para autoalta son únicamente propietario/agencia. No se
crean perfiles administrativos desde metadata de usuario. Cuentas existentes,
invitaciones e importaciones sin la marca `registro_correo` se conservan.

`npm run test:seguridad-supabase` prueba la actualización en Postgres desechable
con Docker. No carga credenciales ni escribe en el proyecto real. Las nuevas
migraciones deben conceder permisos de forma explícita: los objetos creados por
`postgres` ya no reciben permisos automáticos para anon/authenticated.
Los defaults del rol interno `supabase_admin` requieren revisión de Supabase.

La versión de PostgreSQL se actualiza mediante la plataforma, no mediante SQL.
Al 29 de septiembre de 2026, el proyecto aún no ofrece 17.11: la única opción
del panel es 17.6.1.171. Antes de actualizar, revise copias de seguridad,
compatibilidad y la ventana de mantenimiento; el panel advierte hasta una hora
de indisponibilidad. La protección de claves filtradas requiere Pro en este
proyecto y sigue pendiente.

## Verificación automática de cédulas

El registro, las reseñas y las ediciones administrativas consultan el padrón mensual oficial del TSE para completar los nombres. Administración ve una marca verde con la fecha de la fuente y un aviso si un nombre histórico difiere. Documentos extranjeros, ausencias y fallos permiten revisión manual.

Para preparar una instalación existente use `npm run db:padron-tse` y `npm run padron:actualizar`. La [guía de verificación de cédulas](docs/runbooks/verificacion-cedulas-tse.md) explica el almacenamiento privado, la actualización mensual, los límites y la validación.
