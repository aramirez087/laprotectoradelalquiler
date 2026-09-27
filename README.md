# La Protectora del Alquiler

Plataforma comunitaria de confianza para el alquiler en Costa Rica:

- **Propietarios y agencias** publican reseñas de inquilinos (calificación, etiquetas, daños, procesos, comentario, fotos).
- **Cualquier usuario** busca e inspecciona fichas antes de alquilar.
- Las reseñas pueden **denunciarse** para moderación.
- PII protegida: la cédula se muestra enmascarada salvo para su autor o admin.

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
   # primero pruebe en seco (solo cuenta filas, no escribe):
   npm run db:migrar -- --seco
   # luego la importación real:
   npm run db:migrar
   # opcional: crea las identidades en Supabase Auth (contraseña aleatoria):
   npm run db:migrar -- --crear-accounts
   ```

   El script es idempotente: puede reejecutarse. Los lookups legacy se
   importan preservando ids; las FK huérfanas pasan a `NULL`.

5. Desarrolle:

   ```bash
   npm run dev
   ```

## Decisiones del modelo de datos

- `personas` es la persona natural (cédula única); `usuarios` es la cuenta
  (1:1 opcional vía `persona_id`); `resenas` une autor → persona.
- `resenas.fuente/id_fuente` trazan el origen de la migración (idempotencia).
- Los ids de lookups del legacy se conservan para que las FK de las ~6.500
  fichas importadas sigan correctas; `setval` reajusta las secuencias.
- RLS: lectura pública solo para `resenas` publicas y `personas` (ver
  `schema.sql`); la app siempre valida sesión y rol en el DAL.
- Facebook login: el esquema ya incluye `autenticaciones`
  (proveedor/proveedor_id) para conectarlo después sin migración.
