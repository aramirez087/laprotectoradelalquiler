# La Protectora del Alquiler

Plataforma comunitaria de confianza para el alquiler en Costa Rica:

- **Propietarios y agencias** publican reseñas de inquilinos (calificación, etiquetas, daños, procesos, comentario, fotos).
- **Cualquier usuario** busca e inspecciona fichas antes de alquilar.
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
   ```

   El módulo **Importar datos** también ofrece **Simular importación**.
   Tanto la simulación como la importación requieren `DATABASE_URL` (o las
   variables de la integración `POSTGRES_URL_NON_POOLING` / `POSTGRES_URL`).
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
   La web interrumpe el proceso a los cuatro minutos para poder responder;
   para volúmenes mayores use `npm run db:migrar` desde un servidor con acceso
   a ambas bases. No vuelva a ejecutar `db:aplicar` sobre datos existentes:
   ese comando recrea las tablas.

   Pruebas de integración aisladas (Docker, imágenes `mysql:8` y
   `postgres:16-alpine`; nunca usan las bases de `.env.local`):

   ```bash
   npm run test:importacion
   npm run test:importacion:bundle
   ```

5. Desarrolle:

   ```bash
   npm run dev
   ```

## Decisiones del modelo de datos

- `personas` es la persona natural (cédula única); `usuarios` es la cuenta
  (1:1 opcional vía `persona_id`); `resenas` une autor → persona.
- `resenas.fuente/id_fuente` trazan el origen de la migración (idempotencia).
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
