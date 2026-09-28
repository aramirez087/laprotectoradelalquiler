# Encender el ingreso con Facebook

El ingreso con Facebook sigue oculto mientras `AUTH_FACEBOOK` no sea `1`. Entrar con correo y clave sigue igual. La página de privacidad (`/privacidad`) y la eliminación firmada sí están visibles: no dependen de ese flag.

Facebook no devuelve un enlace público del perfil. Por eso el alta sigue pidiendo ese enlace: es el que administración abre en Revisión y en Usuarios. Se guarda en `autenticaciones` (`proveedor = facebook`). El id que usa el login vive solo en Supabase Auth (`auth.identities`). No lo escriba en `proveedor_id`.

No corra `npm run db:aplicar`. No hace falta ningún SQL.

## Qué va a pasar cuando esté encendido

Persona nueva:

1. En `/login` o `/registro` elige **Continuar con Facebook**.
2. Facebook la devuelve a la aplicación.
3. Si no tiene cuenta, ve un formulario con cédula, enlace público del perfil y rol. El nombre y el correo vienen de Facebook. Si Facebook no comparte un correo confirmado, el alta se detiene hasta que confirme un correo en Facebook.
4. Después cae en `/registro/resena`. La reseña sigue en revisión hasta que administración la apruebe.

Persona que ya tiene cuenta:

- Si el correo de Facebook es el mismo y ya está confirmado en Supabase, entra a esa cuenta. No crea otra.
- Si el correo es distinto, entra con su clave y en **Mi perfil** usa **Conectar Facebook**.

Eso último necesita la opción **Allow manual linking** de Supabase. Sin ella, el botón del perfil falla.

## 1. App en Meta

1. Entre a [developers.facebook.com](https://developers.facebook.com) con la cuenta que va a ser dueña de la app.
2. **My Apps** → **Create App**.
3. Elija el tipo que ofrezca Facebook Login (autenticar usuarios). Complete el nombre y cree la app.
4. La app queda en **Development**. En ese modo solo entran quienes tengan un rol en la app. El resto ve «App not setup». No pase a **Live** todavía.

### Callback de Supabase

1. En el dashboard de Supabase: **Authentication** → **Sign In / Providers** → **Facebook**.
2. Copie el **Callback URL**. Tiene esta forma, sin barra al final:

   `https://<project-ref>.supabase.co/auth/v1/callback`

   `<project-ref>` es el subdominio de `NEXT_PUBLIC_SUPABASE_URL`.

3. En la app de Meta, abra **Facebook Login** → **Settings** (no el quickstart).
4. En **Valid OAuth Redirect URIs** pegue ese callback, exactamente igual.
5. Deje activos **Client OAuth login** y **Web OAuth login**.
6. **Save changes**.

Ese callback es el de Supabase, no el de este sitio. La aplicación vuelve después a `/auth/facebook/retorno`.

### Permiso de correo

Supabase necesita el correo.

1. En la app de Meta, **Use cases**.
2. En **Authentication and account creation**, **Edit** (o agregue ese caso de uso).
3. `public_profile` y `email` tienen que figurar. Si `email` no está, **Add**.
4. Los dos deben quedar en **Ready for testing**.

No pida `user_link` ni otros permisos. No devuelven un enlace estable y alargan la revisión.

### Datos que Meta exige antes de Live

En **App settings** → **Basic**:

- **App ID** y **App Secret** (Show). El App Secret va en dos sitios: en Supabase, como Client Secret del proveedor, y en el hosting, como `FACEBOOK_APP_SECRET`. No lo ponga en el repositorio ni en una variable `NEXT_PUBLIC_`.
- Ícono de la app.
- **Privacy Policy URL**:

  `https://<su-dominio>/privacidad`

  Esa página abre sin iniciar sesión y sin `AUTH_FACEBOOK`.
- **App domains**: el dominio de producción, sin `https://` y sin ruta. Ejemplo: `laprotectoradelalquiler.com`.
- **Data deletion instructions URL**:

  `https://<su-dominio>/auth/facebook/datos`

- **Data deletion callback URL** (la solicitud firmada, no la página):

  `https://<su-dominio>/auth/facebook/eliminacion`

  Sin `FACEBOOK_APP_SECRET` esa ruta responde 404. Facebook envía `signed_request` por POST. La respuesta trae un código y un enlace a `/auth/facebook/eliminacion/estado?codigo=…`.

Category y el resto de campos que Meta marque como obligatorios en esa pantalla.

Antes de probar la eliminación, aplique solo este archivo en la base que ya tiene datos. No use `npm run db:aplicar`: ese comando recarga `schema.sql` y borra las tablas.

```bash
node --input-type=module -e "
import { readFileSync } from 'node:fs';
import pg from 'pg';
for (const f of ['.env.local', '.env']) {
  try { process.loadEnvFile(f); } catch {}
}
const ssl = (process.env.DATABASE_URL ?? '').includes('supabase.co') ? { rejectUnauthorized: false } : undefined;
const pool = new pg.Pool({ connectionString: process.env.DATABASE_URL, ssl });
await pool.query(readFileSync('db/facebook-eliminacion.sql', 'utf8'));
await pool.end();
console.log('eliminacion ok');
"
```

Eso crea `eliminaciones_facebook` y dos funciones que solo puede ejecutar `service_role`. No borra reseñas.

## 2. Supabase

### Proveedor Facebook

1. **Authentication** → **Sign In / Providers** → **Facebook**.
2. **Facebook Enabled**: ON.
3. **Client ID**: el App ID de Meta.
4. **Client Secret**: el App Secret de Meta.
5. **Save**.

El mismo App Secret va también en el hosting, como `FACEBOOK_APP_SECRET`, para verificar la eliminación. No lo marque como `NEXT_PUBLIC`.

### URLs de retorno

**Authentication** → **URL Configuration**.

No cambie el **Site URL** si el correo de restablecer clave ya funciona. Tiene que ser el origen de producción, por ejemplo `https://<su-dominio>`.

En **Redirect URLs** agregue, sin borrar las que ya estén:

- `http://localhost:3000/**`
- `https://<su-dominio>/**`

El `**` cubre `/auth/facebook/retorno` y `/auth/confirmar` con los parámetros que arma el login. Si más adelante Supabase responde que el redirect no está permitido, agregue también estas dos tal cual:

- `http://localhost:3000/auth/facebook/retorno`
- `https://<su-dominio>/auth/facebook/retorno`

### Vincular una cuenta que ya existe

**Authentication** → la configuración general (la misma zona donde está **Allow new users to sign up**).

Active **Allow manual linking**.

Sin eso, **Conectar Facebook** en el perfil no enlaza. Documentación: [Identity Linking](https://supabase.com/docs/guides/auth/auth-identity-linking) y [General configuration](https://supabase.com/docs/guides/auth/general-configuration).

Deje el alta de usuarios nuevos encendida. Las cuentas nuevas de Facebook la necesitan.

Si dos identidades tienen el mismo correo y Supabase ya lo confirmó, Auth las une solo. Las cuentas de este registro se crean con el correo confirmado. Una cuenta migrada cuyo correo siga sin confirmar no se une: esa persona entra con su clave y usa **Conectar Facebook**, o bien confirma el correo antes.

## 3. Probar en local, todavía sin producción

1. En `.env.local` (no se commitea):

   ```bash
   AUTH_FACEBOOK=1
   ```

2. Reinicie `npm run dev`. Next no recarga solo las variables de entorno.
3. En Meta: **App roles** → **Roles**. Agregue su usuario de Facebook como Tester, Developer o Administrator.
4. Acepte la invitación desde las notificaciones de Facebook. Sin eso, el diálogo dice que la app no está configurada.
5. Abra `http://localhost:3000/registro`. Tiene que verse **Continuar con Facebook** arriba del formulario.
6. Entre con la cuenta de prueba:
   - Facebook pide permiso.
   - Vuelve al formulario de cédula, enlace (`facebook.com/su.perfil` o el usuario) y rol.
   - **Continuar a la reseña** abre el formulario corto de siempre.
7. Cierre sesión. En `/login`, **Continuar con Facebook** tiene que entrar directo, sin pedir la cédula otra vez.
8. Con otra cuenta de correo y clave, abra **Mi perfil** y use **Conectar Facebook**. Al volver, el perfil dice que quedó conectado. Vuelva a entrar solo con Facebook: es la misma cuenta.
9. Quite `AUTH_FACEBOOK` o déjelo vacío, reinicie `npm run dev` y confirme que el botón desapareció. `/auth/facebook` vuelve a `/login` y no abre Facebook.

Mientras la app de Meta siga en Development, una cuenta sin rol no puede entrar. Eso es esperado.

## 4. Revisión de Meta y paso a Live

Facebook revisa `email` antes de dejar entrar al público. `public_profile` suele venir aprobado.

1. **App Review** → **Permissions and Features**.
2. Pida **email**. Explique que el correo identifica la cuenta (el mismo correo con el que la persona ya entra, o el de una cuenta nueva). El nombre de `public_profile` rellena el alta. La cédula no viene de Facebook.
3. Grabe el video en local, con `AUTH_FACEBOOK=1`: **Continuar con Facebook**, aceptar, completar cédula y enlace, llegar a la reseña. Muestre también `/auth/facebook/datos`.
4. En las instrucciones para quien revisa, describa esos mismos pasos. Si Meta exige un sitio público, puede encender el flag solo en un ambiente de prueba. En producción déjelo apagado hasta el paso 5: con la app todavía en Development el botón se vería y el resto de la gente recibiría «App not setup».
5. Envíe la revisión. Meta suele tardar unos días.
6. Cuando aprueben, pase la app de **Development** a **Live**. Siga a la sección «Encender producción» y recién ahí ponga el flag en el hosting real.

## 5. Encender producción

Hágalo al final, con la app de Meta en **Live**, el proveedor de Supabase guardado, las Redirect URLs publicadas y **Allow manual linking** activo.

1. En el hosting que ya tiene `NEXT_PUBLIC_SUPABASE_URL` y las demás claves, cree:

   ```bash
   AUTH_FACEBOOK=1
   ```

   En Vercel: **Settings** → **Environment Variables** → Production. No la marque como `NEXT_PUBLIC`.

2. Vuelva a desplegar. El valor se lee al construir el servidor. Cambiar la variable sin un deploy nuevo no alcanza.
3. Abra `/login` en el dominio real. Tiene que aparecer **Continuar con Facebook**.
4. Repita el alta con una cuenta de Facebook que no sea administradora de la app de Meta.
5. Confirme que una cuenta vieja, con el mismo correo, entra a su perfil y no crea un usuario nuevo.
6. Confirme que `/auth/facebook/datos` abre el texto de eliminación y que ese URL es el que quedó en Meta.

Para apagarlo: borre la variable o déjela vacía y vuelva a desplegar. Los botones se van. Quien ya entró con Facebook sigue teniendo sesión hasta que cierre; el alta a medias vuelve a comportarse como una visita sin cuenta.

## Si algo falla

| Qué ve | Dónde mirar |
| --- | --- |
| El botón no está | `AUTH_FACEBOOK` no es exactamente `1`, o no reinició el proceso / no redesplegó. |
| Redirect URI mismatch | El callback de Meta no es idéntico al **Callback URL** de Supabase. Sin barra final, con `https`. |
| App not setup | La app sigue en Development y esa persona no tiene rol, o no aceptó la invitación. |
| Facebook no comparte un correo confirmado | En Use cases, `email` no está en Ready for testing, o esa cuenta de Facebook no tiene correo confirmado. Confirme el correo en Facebook y vuelva a intentar. |
| Redirect URL not allowed | Falta `https://<su-dominio>/**` en **URL Configuration**. El Site URL no reemplaza esa lista. |
| Ese correo ya tiene cuenta | El correo de Facebook ya es otra cuenta y no se pudo unir. Entre con la clave y use **Conectar Facebook**. |
| Conectar Facebook no vuelve al perfil | **Allow manual linking** está apagado. |
| Después de Facebook cae en «Olvidó su clave» | El retorno no trae `origen=facebook`. Tiene que ser `/auth/facebook/retorno`, no `/auth/confirmar` directo. |
| La página de datos da 404 | El flag todavía no está en `1` en ese ambiente. |

La guía de Supabase del proveedor está en [Sign in with Facebook](https://supabase.com/docs/guides/auth/social-login/auth-facebook).
