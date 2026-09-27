# Guía de migración: legacy MySQL → Supabase (v2)

Esta guía es autocontenida: asume que **no conoces el sistema**. Síguela en orden.

## Qué estamos haciendo

El sistema anterior ("La Protectora del Alquiler") vive en **MySQL** (base
`laprotec_laprotectora`). La nueva versión usa **Next.js + Supabase (Postgres)**.
Esta guía cubre todo lo necesario para:

1. Crear el proyecto nuevo en Supabase (plan gratuito, en la web).
2. Aplicar el esquema nuevo + datos de ejemplo.
3. Importar los datos existentes del MySQL legacy.
4. Verificar que todo quedó bien y dejar la app funcionando.

**Importante:** el MySQL legacy es solo **fuente de lectura**. El script nunca
lo modifica. Puede correrse varias veces sin duplicar datos (es idempotente).

## Antes de empezar — checklist

| Necesitas | Dónde lo consigues |
| --- | --- |
| Node.js 18+ (recomendado 20 o 24) | `node -v` para verificar |
| Acceso de red al MySQL legacy | Pide a quien lo administra: `host`, `puerto`, `usuario` con permisos de `SELECT`, `password` y nombre de la BD (`laprotec_laprotectora`). Debe ser accesible desde tu máquina (no desde la nube). |
| Cuenta de GitHub o Google | Para crear el proyecto en supabase.com |
| ~30 minutos | La parte de Supabase se espera a que se genere la BD |

Clona el repo e instala dependencias:

```bash
git clone <url-del-repo> && cd laprotectoradelalquiler
npm install
```

---

## Paso 1 — Crear el proyecto en Supabase (plan gratuito)

Sí, se hace **en el sitio web**: <https://supabase.com>. No se necesita
nada más que un navegador.

1. Entra a <https://supabase.com> y haz clic en **Start your project** (arriba a la derecha).
2. Elige **Sign up with GitHub** (o Google). Acepta los permisos.
3. En el dashboard, arriba a la derecha, clic en **New project**.
4. Rellena el formulario:
   - **Name**: `laprotectora` (o el que prefieras; es solo un nombre).
   - **Database password**: genera una (clic en el dado) y **guárdala en un gestor de contraseñas** — la usarás al final.
   - **Region**: `South America (São Paulo)` — la más cercana a Costa Rica.
5. Clic en **Create project**. La base de datos tarda **1–5 minutos** en
   generarse; la página se actualiza sola cuando está lista.

### Copia estos valores (los usaremos en el paso 2)

Desde **Project Settings → API**:

1. **Project URL** (ej. `https://abcdefgh.supabase.co`).
2. **Publishable key** (empieza por `sb_publishable_…`) — la clave pública de la app.
3. **Secret key** (empieza por `sb_secret_…`) — ⚠️ clave **secreta** con permisos
   totales: **nunca** la escribas en el chat, en el repo ni en el navegador.
   Solo va en tu `.env.local`.
   > Si tu dashboard muestra las *legacy keys* (`anon` / `service_role`) en vez
   > de las nuevas: cópialas igual. La app soporta ambas y da prioridad a la
   > nueva; ambas funcionan a la vez.

Desde **Project Settings → Database → Connection string → URI**:

4. Elige el botón **"Session"** (pooler Supavisor, puerto 5432) y copia la
   cadena — es tu `DATABASE_URL`:
   `postgresql://postgres.<ref-proyecto>:<tu-clave>@aws-0-sa-east-1.pooler.supabase.com:5432/postgres`

   > ⚠️ **No uses la opción "Direct"** (`db.…supabase.co`): en proyectos
   > nuevos ese host a veces no existe en DNS y la conexión falla con
   > `ENOTFOUND`. El pooler siempre funciona y es el método recomendado.

> Nota: la free tier **pausa proyectos inactivos** tras 1 semana sin uso.
> Visita el dashboard de vez en cuando (o haz un `npm run dev`) para
> mantenerlo activo.

## Paso 2 — Configurar el entorno del proyecto

```bash
cp .env.example .env.local
```

Edita `.env.local` con lo que copiaste:

```ini
NEXT_PUBLIC_SUPABASE_URL=https://abcdefgh.supabase.co
NEXT_PUBLIC_SUPABASE_PUBLISHABLE_KEY=sb_publishable_...   # o NEXT_PUBLIC_SUPABASE_ANON_KEY (legacy)
SUPABASE_SECRET_KEY=sb_secret_...                        # o SUPABASE_SERVICE_ROLE_KEY (legacy); solo si vas a correr --crear-accounts (paso 6)
DATABASE_URL=postgresql://postgres.abcdefgh:TU_CLAVE@aws-0-sa-east-1.pooler.supabase.com:5432/postgres   # botón "Session" del dashboard

# Credenciales del MySQL legacy (pídalas a quien administra esa BD)
LEGACY_MYSQL_HOST=203.0.113.10
LEGACY_MYSQL_PORT=3306
LEGACY_MYSQL_USER=usuario_lector
LEGACY_MYSQL_PASSWORD=tu_clave
LEGACY_MYSQL_DB=laprotec_laprotectora
```

Reglas:

- **No** hagas `git add` de `.env.local` (ya está en `.gitignore`).
- La conexión al MySQL debe funcionar **desde tu máquina**. Si está en un
  servidor con firewall, pide que te abran el puerto para tu IP.

## Paso 3 — Aplicar el esquema nuevo + datos de ejemplo

```bash
npm run db:aplicar
```

Salida esperada:

```text
▸ Aplicando schema.sql ...
  ✓ schema ok
▸ Aplicando db/seeds.sql ...
  ✓ seeds ok
```

Esto crea en Postgres las tablas nuevas (`personas`, `usuarios`, `resenas`,
`viviendas`, `denuncias`, lookups…) y unos datos demo (lookups de Costa Rica y
3 usuarios de referencia: `admin@laprotec.test`, `propietario@laprotec.test`,
`inquilino@laprotec.test`). ⚠️ Esos 3 **solo existen en la tabla `usuarios`**
(no tienen identidad en Supabase Auth), así que **no pueden iniciar sesión**:
sirven para ver el dato, no para probar login (ver paso 7).

Si ya existe y quieres empezar de cero: en el dashboard, **Table Editor**,
selecciona todas las tablas y elimínalas, y vuelve a correr el paso.

## Paso 4 — Prueba en seco de la migración (no escribe nada)

```bash
npm run db:migrar -- --seco
```

Verás una cuenta de todo lo que **se importaría** sin tocar el destino:

```text
=== Migración legacy MySQL → v2 Postgres ===
Fuente:  usuario_lector@203.0.113.10:3306/laprotec_laprotectora
Destino: SECO (sin escribir)
...
=== Resumen ===
{ "lookups": {...}, "personas": N, "usuarios": N, "resenas": N }
```

Revisa que los números parezcan razonables (los totales deberían acercarse a
los de las tablas legacy). Si arroja errores de conexión, resuelve el paso 2
antes de continuar.

## Paso 5 — Migración real

```bash
npm run db:migrar
```

Corre 4 pasos (en este orden):

| Paso | Qué hace |
| --- | --- |
| `lookups` | Copia tablas de referencia (provincias, cantones, distritos, barrios, calificaciones, etiquetas, daños, procesos, tipos de contrato/alquiler). **Preserva los ids del legacy** para que las referencias de las fichas sigan siendo correctas. Si el legacy no tiene alguna (p. ej. `tb_dano_vivienda`), usa el seed local y lo avisa. |
| `personas` | Crea/actualiza `personas` desde `tb_persona`, `tb_inquilinos_no_nacionales` (las fichas) y `tb_solicitante`, usando la cédula/identificación como clave natural. |
| `usuarios` | Importa la tabla `users` legacy (1 cuenta por email; mapea `access`→rol, `status`→activo) y enlaza cada cuenta con su `persona` por cédula. |
| `resenas` | Importa cada ficha de `tb_inquilinos_no_nacionales` como una reseña (`fuente='legacy'`), con su autor, calificación, etiquetas, daños, procesos y comentario. Si el registrador de una ficha no tiene cuenta, crea una **cuenta fantasma inactiva** para no perder la reseña. |

Al final imprime un `Resumen` JSON. Salidas que verás a menudo y que **no son
errores**:

- `· tb_X no existe en legacy (usa seed local)` → el legacy no tenía esa tabla de lookup; el seed local ya cubre.
- `✗ resena legacy N: ...` → una fila concreta falló (p. ej. FK huérfana); el script continúa con las demás y lo cuenta.
- `importadas: N (sin persona: X, sin autor: Y)` → X fichas sin poder resolver a qué persona pertenecen; Y sin autor resoluble. Revisa que X+Y sea pequeño.

**¿Se puede correr dos veces?** Sí. Es idempotente: la segunda ejecución
actualiza valores y no duplica filas. Útil si el legacy avanzó entre corridas.

### Opcional: crear las cuentas de login (paso 6)

```bash
npm run db:migrar -- --crear-accounts
```

Crea en **Supabase Auth** una identidad para cada usuario migrado que esté
activo, con una **contraseña aleatoria** (la guarda en memoria durante la
ejecución; no se imprime). Los usuarios legados entrarían con
*Reset password* (en el paso de login): Supabase les manda un correo con el
enlace. Requiere `SUPABASE_SERVICE_ROLE_KEY` en `.env.local`.

> Consejo: si la BD legacy tiene miles de usuarios, este paso tarda (una
> llamada por cuenta). Es opcional: la app funciona sin él; solo esos
> usuarios no podrán iniciar sesión hasta que se cree su identidad.

## Paso 7 — Verificar

### En Supabase (dashboard → SQL Editor)

```sql
SELECT (SELECT count(*) FROM personas) AS personas,
       (SELECT count(*) FROM usuarios) AS usuarios,
       (SELECT count(*) FROM resenas)  AS resenas,
       (SELECT count(*) FROM resena_etiquetas) AS resena_etiquetas;
```

Compara contra el resumen del paso 5. También en **Table Editor** puedes
hojear `resenas` y `personas` a ojo (verifica que acentos y ñ se lean bien —
si ves `Ã¡`, el charset de la fuente legacy estaba corrupto; dilo, se trata).

### En la app

```bash
npm run dev
```

> Para poder **iniciar sesión** sin fricción: en el dashboard de Supabase,
> **Authentication → Providers → Email**, desactiva el toggle
> *"Confirm email"* (solo para desarrollo; así el login es inmediato tras
> registrar). Los 3 usuarios de los seeds **no** sirven para login (no tienen
> identidad en Auth); regístrate de cero.

1. Abre <http://localhost:3000> → la landing.
2. Clic en **Crear cuenta** → rellena el formulario con un correo tuyo y
   contraseña → te lleva a `/perfil`. (Eso crea tu identidad en Auth y tu
   perfil en `usuarios`.)
3. Busca en **Fichas** un nombre de un inquilino legacy → la ficha debe
   aparecer con su reseña importada; la cédula se ve enmascarada (`8-123-****`).
4. Crea una reseña nueva (como propietario) → aparece en la ficha.

Si Supabase no está configurado (falta `.env.local`), la app muestra un
aviso en pantalla en vez de romper — no se ve un servidor caído.

## Solución de problemas

| Síntoma | Causa probable / acción |
| --- | --- |
| `Falta DATABASE_URL` | No creaste `.env.local` (paso 2) o quedó vacío. |
| `getaddrinfo ENOTFOUND db.xxx.supabase.co` | El proyecto de Supabase está **pausado** (free tier). Ábrelo en el dashboard; tarda ~1 min en despertar. |
| Error de conexión al MySQL en `db:migrar` | Firewall/VPN: prueba `mysql -h <host> -P <puerto> -u <usuario> -p` desde tu terminal. El usuario solo necesita `SELECT`. |
| `relation "personas" does not exist` | No corriste `npm run db:aplicar` (paso 3). |
| Acentos como `Ã³` / `Ã±` en los datos | La tabla legacy guarda bytes latin1 interpretados como utf8. Revisa el charset de **esa tabla** en el legacy (`SHOW CREATE TABLE`); si está corrupto en el origen, la migración no puede inventar datos — reportalo. |
| Muchos `✗` en el resumen | Mira el mensaje: suele ser una FK cuyo lookup no existe. El resto importa igual; decide después si se limpia. |
| `npm run dev` sin cambios | Recargó en caliente; para cambios de `.env.local` hay que **reiniciar** `npm run dev`. |

## Notas de diseño (por si quieres profundizar)

- Esquema canónico: [`schema.sql`](schema.sql). Referencia del legacy: [`legacy/schema.sql`](legacy/schema.sql).
- `personas` = persona natural (cédula única). `usuarios` = cuenta de login
  (opcionalmente enlazada 1:1 a una persona). `resenas` une autor → persona.
- PII: la cédula se muestra enmascarada en la UI (a todo el mundo excepto al
  autor de la reseña o un admin). RLS en `schema.sql`: `personas` y `resenas`
  publicadas son de lectura pública (diseño v1: el enmascaramiento es de capa
  de app); en `usuarios` cada cuenta solo crea/edita/elimina la suya y los
  campos `rol`/`activo` van protegidos contra auto-elevación.
- Facebook login queda preparado (`autenticaciones`) pero **desactivado** de
  momento: la app solo usa email/contraseña.
