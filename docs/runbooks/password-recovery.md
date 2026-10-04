# Recuperación de contraseña

## URLs de producción

En Supabase → Authentication → URL Configuration, el proyecto utilizado por la aplicación debe tener:

- **Site URL:** `https://www.protectoradelalquiler.com`
- **Redirect URLs:** `https://www.protectoradelalquiler.com/auth/confirmar?next=/restablecer` y `https://www.protectoradelalquiler.com/auth/confirmar?next=/registro/resena`.

Conserve las otras rutas de retorno que utilice el proyecto. La aplicación solicita el callback anterior desde el origen público de la petición. El dominio sin `www` redirige al dominio con `www` en producción. Autorice por separado las rutas concretas de desarrollo o pruebas que realmente se usen; no amplíe la configuración de producción a dominios ajenos.

En Authentication → Emails, copie las plantillas versionadas:

- **Reset Password:** `emails/supabase/reset-password.html`.
- **Confirm Sign Up:** `emails/supabase/confirm-sign-up.html`.

Estas plantillas usan `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=recovery` y `type=signup`, respectivamente. El servidor valida el token y guarda la sesión antes de mostrar la pantalla siguiente. No dependen de cookies del navegador que solicitó el mensaje, por lo que pueden abrirse desde el teléfono, otro navegador u otro dispositivo. La configuración de **Site URL** debe apuntar al origen HTTPS de la aplicación. No construya el enlace con `localhost` ni con la página de inicio. Cambiar únicamente el texto visible del enlace no cambia su destino.

La aplicación conserva compatibilidad con enlaces anteriores de `{{ .ConfirmationURL }}`: intercepta códigos que llegan al inicio antes de que el perfil redirija a otra pantalla, reconoce el tipo de recuperación PKCE y procesa los tokens del fragmento en el navegador. Un enlace PKCE anterior todavía necesita el navegador que inició la solicitud; si no puede verificarse, se ofrece pedir otro enlace. Un error de confirmación de correo ofrece reenviar esa confirmación en `/login`; no manda al usuario a recuperar una clave.

Una vez desplegado el código y actualizadas las dos plantillas, solicite **un enlace nuevo desde `/recuperar` en producción**. Verifique que pasa por `/auth/confirmar`, muestra `/restablecer` con el correo de la cuenta, permite guardar la clave y ofrece **Continuar con mi cuenta**. Repita abriendo un enlace nuevo en otro navegador. Un enlace vencido o reutilizado debe ofrecer una nueva solicitud. No copie códigos de recuperación en registros o tickets ni modifique manualmente un enlace antiguo.

Para reconstruir los archivos HTML y `emails/supabase/config.json`, ejecute `node --experimental-strip-types scripts/generar-plantillas-correo.mjs`. Generar estos archivos no cambia Supabase ni envía correos; publicar el sitio tampoco instala las plantillas. Al usar la API de administración de Supabase, aplique únicamente las claves `mailer_subjects_recovery`, `mailer_templates_recovery_content`, `mailer_subjects_confirmation` y `mailer_templates_confirmation_content` del archivo generado, conservando las otras plantillas y la configuración SMTP.

## Comprobación de acceso y registro

- En móvil, el inicio ofrece **Crear una cuenta** y **Ya tiene cuenta: iniciar sesión** sin abrir el menú.
- Login, registro y recuperación conservan el correo al cambiar de pantalla. Los retornos internos de login y recuperación rechazan URLs externas.
- Una cuenta existente ofrece iniciar sesión o recuperar la clave; un correo pendiente de confirmar ofrece reenviar la confirmación.
- Tras solicitar recuperación o confirmación se indica revisar la bandeja y el correo no deseado. Un segundo envío al mismo correo espera un minuto.
- Guardar una clave nueva muestra una confirmación explícita y continúa con el perfil: las cuentas que necesitan completar su primera reseña reciben ese paso.
- Facebook pendiente de completar perfil no bloquea recuperar la clave. La verificación en dos pasos sigue siendo necesaria cuando la cuenta la tiene habilitada.

### Validación local — 4 de octubre de 2026

Pasaron 428 pruebas de Node, TypeScript, ESLint sin errores y el build de producción con Webpack. La revisión inicial en navegador pasó 128 comprobaciones con anchos de 320, 390, 768 y 1440 píxeles, incluidas respuestas simuladas de login, registro, recuperación y reenvío de confirmación. Se comprobaron errores, conservación de datos, espera de reenvío, anuncios accesibles y estados de éxito. Las pruebas de callbacks validaron la sesión, el tipo de recuperación, el segundo factor y retornos seguros con clientes de Auth simulados.

La segunda revisión de UX da prioridad al reenvío de confirmación cuando el enlace vence, sin mostrar a la vez el formulario de clave ni la creación de cuenta. Reduce la introducción del registro, coloca los accesos para cuentas existentes antes de los campos y muestra el reenvío posterior al registro dentro de «No recibí el mensaje». También elimina instrucciones repetidas tras solicitar recuperación. Las pruebas automatizadas verifican comportamiento; no sustituyen observar a una persona completar estas tareas.

Esta verificación no envió correos reales, no cambió claves de cuentas ni desplegó el sitio o las plantillas en Supabase. La entrega del correo y la recuperación entre dispositivos deben verificarse después de publicar ambos cambios.

### Publicación y comprobación en producción — 4 de octubre de 2026

Se publicó `dpl_2oEEZVcE4dkebki2wnEZUe3GhMbY` (`https://laprotectoradelalquiler-ggif81de7.vercel.app`) después de verificar un despliegue con dominios sin asignar. El build remoto de Next.js con Turbopack pasó. El despliegue anterior, para referencia de reversión, es `dpl_AcnfVwi5HsEaazn5C3R1NqXdPZXn`.

El proyecto de Supabase de producción es `lqbsuawemfhqwvomputz`, recurso `supabase-byzantine-ocean` de la integración de Vercel. No debe confundirse con el proyecto inactivo que aparece en la sesión independiente del CLI de Supabase. Se comprobaron y guardaron las dos plantillas HTML anteriores mediante el dashboard de ese proyecto, conservando los asuntos existentes. Una lectura posterior a recargar confirmó las tres apariciones de `type=recovery` y `type=signup` en sus respectivas plantillas. El Site URL ya era correcto; se conservó el retorno de recuperación y se añadió el retorno exacto de registro indicado al principio del documento.

La comprobación pública confirmó la nueva navegación y respuestas HTTP 307 desde el inicio con un código ficticio hacia `/auth/confirmar`. Los tokens ficticios de recuperación y registro terminaron en `/recuperar?error=enlace` y `/login?error=confirmacion`, respectivamente, con `no-store` y `no-referrer`. Las pantallas de error devolvieron 200 con sus acciones de nuevo enlace. La consulta de errores del nuevo despliegue no devolvió entradas durante la comprobación inicial.

Se solicitó un único correo de recuperación real para la dirección de prueba autorizada por el propietario. La interfaz confirmó la recepción de la solicitud. Queda pendiente que el propietario confirme la entrega, abra el enlace en otro navegador o dispositivo y complete personalmente el cambio de contraseña. La respuesta pública de solicitud recibida no acredita entrega del correo ni la existencia de una cuenta.

## Cuando el correo no llega

1. Compruebe en Administración → Usuarios que el perfil tiene un inicio de sesión creado. Un perfil migrado sin `auth_user_id` no tiene una contraseña que recuperar. Para varios perfiles, use la revisión por lotes descrita a continuación. Para una excepción verificada, **Crear inicio de sesión** conserva su rol; no use una invitación de administración para resolver un acceso ordinario.
2. Compruebe que la identidad de Supabase Auth existe y coincide con el correo registrado. Si hay un conflicto de identidad, reconcilie la cuenta antes de provisionar otro acceso.
3. Revise Auth Logs y la configuración SMTP de **ese mismo proyecto**. La recuperación utiliza Supabase Auth; configurar `RESEND_API_KEY` para las notificaciones de la aplicación no configura SMTP de Auth.
4. Compruebe límites de envío, restricciones de destinatarios del proveedor, spam y entrega. Una respuesta sin error no acredita entrega ni confirma que el correo tenga cuenta; la respuesta pública evita revelar cuentas existentes.

La acción registra `recuperacion_clave_error` con código y estado HTTP, sin correo, contraseña, token ni texto original del proveedor. Los fallos de envío/conexión producen un error recuperable en el formulario; los límites de frecuencia indican esperar antes de solicitar otro enlace.

El SMTP predeterminado de Supabase solo entrega a direcciones autorizadas del equipo del proyecto y tiene límites reducidos. Para usuarios reales, configure un proveedor SMTP y un remitente verificado en Authentication → Emails → SMTP Settings. La existencia de un perfil o una URL correcta no soluciona esa restricción de entrega.

## Completar accesos por lotes

Configure una conexión de lectura al MySQL original mediante `LEGACY_MYSQL_*`, además de la conexión Postgres al destino. `legacy/schema.sql` contiene solo estructura; no aporta los usuarios ni sus claves. Las credenciales introducidas en el formulario de importación no se guardan.

```bash
npm run db:migrar -- --solo-accesos --seco
```

Este modo usa una transacción Postgres de **solo lectura**, no llama a Auth y no importa perfiles ni avanza secuencias. No debe confundirse con `--seco` sin `--solo-accesos`, que simula la importación completa dentro de una transacción. Revise los accesos elegibles, las exclusiones, los roles (incluidos administradores), las identidades existentes por enlazar y la previsión de conservación de claves.

Tras aprobar esos resultados, ejecute lotes acotados:

```bash
npm run db:migrar -- --solo-accesos --crear-accounts --limite-auth=100 --tiempo-auth=150
```

Si se informa `siguienteId`, continúe con `--despues-auth=<siguienteId>` hasta llegar a cero. Revise los conflictos y fallos restantes; no los fuerce. La operación conserva ids, roles, estado activo y claves de identidades ya existentes. Crea identidades con el correo confirmado sin enviar mensajes; las claves heredadas incompatibles requieren recuperación. Los recuentos de claves de la vista previa son una previsión: Auth puede rechazar una clave y exigir restablecerla.

Antes de indicar a los usuarios que recuperen su clave, confirme las URLs y SMTP de producción. No envíe una campaña masiva como parte de la provisión de accesos.

## Si un despliegue vuelve al login

La versión que incorpora administración de usuarios requiere aplicar `npm run db:admin-usuarios` **antes de desplegar el código**. La migración es aditiva; `db:aplicar` instala el esquema completo y no debe usarse para actualizar una base existente.

Compruebe que `public.sesion_administracion_vigente(uuid,uuid)` existe y es ejecutable por `service_role`, que su propietario puede leer `auth.sessions`, y que una sesión vigente devuelve `true`. Una sesión inexistente debe devolver `false`. No elimine esta comprobación para ocultar una migración pendiente.

## Referencias

- [URLs de retorno de Supabase](https://supabase.com/docs/guides/auth/redirect-urls)
- [Autenticación con contraseña y recuperación](https://supabase.com/docs/guides/auth/passwords)
- [SMTP de Supabase Auth](https://supabase.com/docs/guides/auth/auth-smtp)
- [Códigos de error de Auth](https://supabase.com/docs/guides/auth/debugging/error-codes)
