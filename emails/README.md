# Correos de La Protectora del Alquiler

La plantilla compartida de `lib/plantilla-correo.ts` utiliza los colores del sitio, HTML en español, un botón de acción y un enlace alternativo. Las tablas de presentación y los estilos en línea permiten usarla en clientes de correo sin fuentes web ni CSS externo. No incluye imágenes remotas ni píxeles de seguimiento. Los nombres y textos de usuarios se escapan antes de incluirlos en HTML.

## Supabase Auth

Regenerar las seis plantillas y sus asuntos:

```bash
node --experimental-strip-types scripts/generar-plantillas-correo.mjs
```

Los archivos de `supabase/` corresponden a las seis pantallas de Authentication → Emails → Templates. `config.json` contiene las claves documentadas de configuración para conservar los asuntos y cuerpos juntos; no contiene credenciales. Generar los archivos **no publica cambios**. Copie el asunto y HTML de cada plantilla al proyecto correcto y guarde.

Conserve `{{ .ConfirmationURL }}` en los enlaces y `{{ .Token }}` en el código de reautenticación. No sustituya estos valores por un enlace real ni por `localhost`. El botón y el enlace alternativo deben usar el mismo destino. La recuperación indica abrir el enlace en el navegador de la solicitud para conservar el flujo PKCE.

El diseño no habilita métodos de acceso ni notificaciones adicionales. El proveedor SMTP debe estar configurado antes de editar plantillas en Supabase Free.

## Correos enviados por la aplicación

Las invitaciones de administración/acceso y los avisos de reseñas usan la misma plantilla, conservando también su versión de texto plano. Se publican con el código de la aplicación. Requieren `RESEND_API_KEY` configurada por separado en el servidor; guardar la contraseña SMTP en Supabase no configura esa variable.

La aprobación/publicación, edición y eliminación por administración pueden avisar al autor registrado. Si hay un proveedor configurado, la casilla de aviso está seleccionada por defecto y el administrador puede desmarcarla en cada acción. Rechazar o devolver a revisión no dispara un aviso de aprobación. El correo identifica la reseña por su número y enlaza al perfil; no copia documentos, datos del inquilino, el relato ni notas de moderación al mensaje.

El envío ocurre después de confirmar el cambio en la base de datos. Repetir o aprobar simultáneamente el mismo estado no vuelve a notificar. Una falla del proveedor conserva la acción y muestra una advertencia; un resultado aceptado significa que Resend recibió el mensaje, no garantiza entrega en la bandeja de entrada. Los fallos temporales se reintentan una vez con la misma clave de idempotencia. No se envían avisos retrospectivos ni campañas a reseñas históricas.

El remitente predeterminado es `La Protectora del Alquiler <no-reply@auth.protectoradelalquiler.com>`. `RESEND_FROM_EMAIL` permite cambiarlo a otra dirección verificada. La clave puede tener permiso de envío restringido al dominio de autenticación.

El plan gratuito de Resend comparte sus límites entre los proyectos del equipo. Las pruebas deben solicitarse desde el sitio con una cuenta propia; no use campañas masivas para probar el diseño ni registre enlaces o códigos reales.
