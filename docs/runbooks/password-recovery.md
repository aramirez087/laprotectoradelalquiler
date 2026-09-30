# Recuperación de contraseña

## URLs de producción

En Supabase → Authentication → URL Configuration, el proyecto utilizado por la aplicación debe tener:

- **Site URL:** `https://www.protectoradelalquiler.com`
- **Redirect URLs:** `https://www.protectoradelalquiler.com/auth/confirmar?next=/restablecer`

Conserve las otras rutas de retorno que utilice el proyecto. La aplicación solicita el callback anterior desde el origen público de la petición. El dominio sin `www` redirige al dominio con `www` en producción. Autorice por separado las rutas concretas de desarrollo o pruebas que realmente se usen; no amplíe la configuración de producción a dominios ajenos.

Revise también Authentication → Emails → Reset Password. La plantilla debe conservar el enlace de verificación de Supabase (`{{ .ConfirmationURL }}`), o una plantilla de `TokenHash` configurada expresamente para el callback de la aplicación. No construya el enlace de recuperación con una URL `localhost` ni con la página de inicio. Cambiar únicamente el texto visible del enlace no cambia su destino.

Una vez corregida la configuración, solicite **un enlace nuevo desde `/recuperar` en producción** y ábralo en el mismo navegador que hizo la solicitud. El flujo PKCE necesita las cookies de esa solicitud. Verifique que pasa por `/auth/confirmar` y muestra `/restablecer`; no pruebe modificando manualmente un enlace antiguo ni copie códigos de recuperación en registros o tickets.

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
