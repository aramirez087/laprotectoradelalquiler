# Verificación opcional en dos pasos

El perfil sugiere activar 2FA en **Seguridad de su cuenta**. Cada persona decide si la activa. Se usa una aplicación autenticadora TOTP; no se requiere teléfono, SMS ni un nuevo proveedor.

## Publicación

1. En el proyecto existente de Supabase, confirme que Authentication → Multi-Factor Authentication permite registrar y verificar autenticadores TOTP.
2. Aplique la migración aditiva con `npm run db:dos-factores` o mediante el flujo habitual de migraciones de Supabase. No use `db:aplicar` para actualizar una base existente. El archivo `supabase/migrations/20261002171756_dos_factores.sql` coincide con `db/dos-factores.sql`; `schema.sql` lo incorpora para instalaciones nuevas.
3. Despliegue el código junto con esta migración. Si el proyecto ya tiene usuarios con factores verificados, coordine ambos pasos: la migración exige AAL2 a esas cuentas inmediatamente.

Los usuarios sin factores verificados conservan su acceso con AAL1. Un registro de autenticador sin confirmar no activa 2FA. Las políticas restrictivas consultan los factores actuales de Auth e intersectan los permisos existentes; nunca conceden acceso adicional. El control de sesión también protege las funciones que leen mediante `SECURITY DEFINER`. Los clientes de servicio se usan solo después de validar la sesión completa en la DAL.

`mi_acceso_consulta()` no devuelve ninguna fila para una sesión pendiente de 2FA o revocada, incluidos sus contadores y fechas. La página de alta de Facebook valida el segundo factor antes de consultar datos privados aunque una precarga omita el proxy. Los comandos `db:admin-usuarios`, `db:invitaciones-admin` y `db:acceso-consultas` conservan la validación de MFA y aplican sus archivos juntos en una transacción.

## Experiencia

- **Activar:** perfil → Seguridad → Activar → escanear QR o copiar la clave manual → confirmar un código de seis dígitos. La protección se activa únicamente al verificar el primer código.
- **Cancelar:** elimina exclusivamente el factor sin verificar de la propia cuenta. Un intento abandonado se limpia al reiniciar la configuración.
- **Entrar:** después de la clave, Facebook o un enlace de recuperación, una cuenta protegida completa `/login/verificar` antes de acceder a datos privados. Se conserva el destino de navegación.
- **Desactivar:** desde una sesión completa, la persona confirma un código actual antes de quitar el autenticador. La sesión se refresca después; si el refresco falla se cierra la sesión local.

## Invitaciones a cuentas con 2FA

Al aceptar una invitación, primero se verifica su enlace de un solo uso. Si falta el segundo factor, se guarda únicamente el identificador de esa sesión y la hora de verificación en la invitación; nunca se guarda la clave elegida. Después del código, la persona vuelve al formulario y escribe su clave para finalizar. La continuación no lleva el token original en la URL, no consume el enlace otra vez y no pasa por el requisito ordinario de primera reseña.

La continuación vence a los 30 minutos o al vencer/cancelarse/aceptarse la invitación. Solo funciona en la misma sesión de Auth, todavía vigente y perteneciente al destinatario. Cerrar sesión o cambiar de navegador requiere un nuevo enlace. Cambiar la clave y otorgar permisos siguen exigiendo la sesión completa. La migración `db:dos-factores` incorpora las columnas `sesion_enlace_id` y `enlace_verificado_en` necesarias antes de desplegar este flujo.

Los códigos y las claves de configuración no se guardan en almacenamiento del navegador ni se registran. El QR se muestra desde un URI de datos de Supabase; no se transmite a un generador de QR externo. La clave permanece en memoria solo durante la configuración.

## Pérdida del autenticador

Antes de activar, el formulario indica guardar la clave de configuración en un lugar seguro o habilitar el respaldo de la aplicación. Con ella se puede restaurar el autenticador en otro dispositivo. Restablecer la contraseña **no elimina** 2FA. Esta versión no implementa códigos de recuperación de un solo uso.

Si la persona pierde tanto el autenticador como su respaldo, solo un operador autorizado puede eliminar el factor desde Supabase tras verificar su identidad por el procedimiento de soporte. No añada un botón que quite factores con una sesión AAL1 ni considere suficiente conocer la contraseña o acceder al enlace de recuperación.

## Verificación

`npm test` cubre códigos incorrectos, límites de solicitudes, factores ajenos, cancelación, activación, desactivación, destinos seguros, conservación de cookies, precargas de Facebook e invitaciones que continúan tras 2FA. `npm run test:dos-factores` crea un Postgres desechable con Docker y comprueba acceso directo y al RPC, AAL ausente, factores sin verificar, otra cuenta, AAL2, retiro del factor, vigencia de sesiones, idempotencia de la migración y los tres comandos de mantenimiento posteriores a MFA.

Para una prueba manual, use una cuenta de prueba: cancele una configuración, active con un código válido, cierre sesión, compruebe que clave o Facebook conducen a la verificación, pruebe un código inválido y el válido, abra una ruta privada directamente y finalmente desactive. Compruebe también el enlace de recuperación: debe pedir el segundo factor antes de permitir cambiar la clave.

Referencias: [MFA de Supabase](https://supabase.com/docs/guides/auth/auth-mfa), [TOTP](https://supabase.com/docs/guides/auth/auth-mfa/totp).
