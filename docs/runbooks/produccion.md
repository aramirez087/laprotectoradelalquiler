# Revisión para producción — 30 de septiembre de 2026

## Cambios

- Indicador compartido para navegación, carga de páginas, formularios, consultas de cédula y actualización de permisos. Los formularios bloquean envíos repetidos y conservan sus campos si falla la petición.
- Las búsquedas y filtros usan navegación del cliente con `next/form`. La estructura inicial puede mostrarse mientras se resuelve la sesión. La lectura del perfil y la validación de sesión se ejecutan en paralelo, manteniendo ambos controles de acceso.
- Administración usa los datos guardados: ni las listas ni las ediciones consultan el TSE. El registro y la creación de fichas al enviar reseñas mantienen la consulta del servidor.
- El padrón se descarga por fragmento, nunca completo. Su manifiesto se comparte durante 30 segundos por instancia; los fallos no se guardan en caché. La fecha se valida en cada consulta.
- `app/error.tsx` y `app/global-error.tsx` ofrecen recuperación con el estilo del sitio. Los errores inesperados de operaciones del navegador muestran un aviso y las acciones conservan el formulario.
- `instrumentation.ts` registra errores de render, rutas, acciones y proxy. Los fallos recuperables capturados por la aplicación también se registran. `/api/errores` recibe diagnósticos limitados del navegador, con verificación de origen, tamaño máximo y límite por instancia.

## Diagnóstico

Los registros JSON incluyen `event`, `reference`, fecha, tipo/código de error, ruta sin parámetros ni identificadores y ubicaciones de código cuando están disponibles. Los errores del servidor usan el `digest` de Next como referencia, también visible en la página de recuperación.

Los registros propios excluyen mensajes originales, detalles SQL, cookies, tokens, parámetros de búsqueda, nombres, cédulas y valores del formulario. Los informes del navegador son datos no confiables; solo se aceptan categorías y referencias de formato conocido. Next, Supabase y Vercel pueden generar sus propios registros aparte.

En el proyecto Vercel enlazado:

```sh
vercel logs --environment production --level error --since 1h --json
```

Busque `request_error`, `page_load_error`, `review_save_error`, `padron_lookup_error`, `padron_manifest_error`, `padron_quota_error` o `client_error_*`. Para errores de Supabase, use el código, la ruta y la hora para correlacionar los registros de la plataforma. Los informes del navegador no incluyen mensajes ni mapas de código fuente; tienen menos detalle que un registro del servidor.

## Evidencia y límites

- 237 pruebas pasan, incluyendo caducidad/recuperación de caché, preservación de nombres administrativos, privacidad de registros, validación de origen y páginas de error.
- TypeScript y ESLint pasan. El build de producción con Webpack pasa. Turbopack encontró una restricción local al abrir el puerto de su proceso de CSS; no se cambió el bundler de producción para sortear esa restricción.
- Navegación y envíos demorados muestran el indicador en el navegador. Un fallo simulado conserva correo y clave y ofrece recuperación. La página de error global se verifica por renderizado y compilación; no se provocaron errores en producción.
- Vercel tiene una publicación de producción lista y Node 24. La consulta de registros de las últimas 24 horas no devolvió entradas de error; esto no demuestra que todos los recorridos hayan sido usados.
- Las páginas públicas de inicio y login respondieron HTTP 200. En una medición desde esta máquina, el primer byte tardó aproximadamente 560 ms y 344 ms respectivamente; no son percentiles ni mediciones de carga.
- La fuente configurada del padrón corresponde al 31 de agosto de 2026 y tiene 69 prefijos. La lectura del manifiesto tardó unos 1.100 ms y la descarga de un fragmento unos 480 ms desde esta máquina.
- Los advisors de la base configurada devolvieron un aviso de rendimiento: `auth_rls_initplan` en `usuarios_lectura`, por evaluar `auth.uid()` por fila. No devolvieron avisos de seguridad de nivel WARN/ERROR. No se cambió la política de producción.
- `npm audit --omit=dev` no encontró vulnerabilidades conocidas.

Los cambios de esta revisión están en el código local. No se desplegaron ni se modificaron datos de producción. Tras desplegar, compruebe con cuentas existentes los recorridos de inicio de sesión, búsqueda, creación de reseña, permisos y administración; esta revisión no creó cuentas ni envió correos reales.

La CLI Vercel instalada es 61.0.0. Se recomienda actualizarla para compatibilidad:

```sh
npm i -g vercel@latest
```
