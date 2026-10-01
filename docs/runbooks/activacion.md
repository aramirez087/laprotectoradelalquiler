# Borradores, avisos y activación

Esta entrega añade borradores privados de reseñas, avisos automáticos al aprobar,
pedir correcciones o rechazar, y el embudo de cuentas nuevas en
`/admin/estadisticas`. La migración es aditiva; no reconstruye el histórico ni
envía correos sobre decisiones anteriores.

## Orden de despliegue

1. Confirme un respaldo y el destino de `DATABASE_URL` (pooler Session, TLS
   verificado). La base debe tener instaladas las migraciones actuales de
   moderación, correcciones y permisos de consulta.
2. Ejecute `npm run db:activacion`. Usa exclusivamente `db/activacion.sql` en una
   transacción y se puede repetir. También existe la misma migración en
   `supabase/migrations/20261001174405_activacion.sql`; use un único mecanismo.
   **No ejecute `db:aplicar` sobre una base existente:** recrea las tablas.
3. Confirme `RESEND_API_KEY` y el remitente verificado de `RESEND_FROM_EMAIL` en
   Production. Sin clave, las decisiones se guardan y los avisos esperan en la
   cola. No hace falta contratar otro proveedor.
4. Genere `CRON_SECRET` con 32 bytes aleatorios en base64url y guárdelo como
   secreto de servidor en Production y en el entorno del script de scheduler.
   No use `NEXT_PUBLIC_`, no lo copie a SQL ni a comandos de cron. El script
   lo envía a Vault mediante parámetros de Postgres.
5. Despliegue el código. Compruebe las pruebas de aceptación siguientes con
   cuentas de prueba propias antes de activar el scheduler.
6. En la integración Supabase, habilite `pg_cron`, `pg_net` y Vault si aún no
   están disponibles. `npm run avisos:cron` comprueba requisitos y muestra el
   job existente sin escribir ni enviar correo. Después ejecute
   `npm run avisos:cron -- --aplicar`: guarda/actualiza el secreto en Vault e
   instala un único job cada cinco minutos. Repetirlo actualiza el mismo job.
   La operación es transaccional; no instala extensiones automáticamente.

El proyecto está en Vercel Hobby. Su cron admite una ejecución diaria; la
recuperación de avisos usa [Supabase Cron](https://supabase.com/docs/guides/cron/quickstart)
y [Vault](https://supabase.com/docs/guides/database/vault) para ejecutarse cada
cinco minutos sin cambiar de plan. El job llama solo al dominio de producción.
No active este scheduler en una base de Preview con avisos de prueba.

`db/avisos-cron.sql` deja el HTTP fuera de la transacción de moderación mediante
[pg_net](https://supabase.com/docs/guides/database/extensions/pg_net). Intenta
revocar acceso a las tablas de solicitudes cuando el rol tiene permiso para ello.
En Supabase los objetos administrados por `supabase_admin` pueden conservar
permisos a `PUBLIC`; un `REVOKE` sin autoridad no confirma su eliminación.
La protección documentada por Supabase depende de que `net` no esté expuesto
por Data API y de que `anon` y `authenticated` sean roles `NOLOGIN`.
Verifique ambas condiciones: una petición con clave publicable y
`Accept-Profile: net` debe devolver `PGRST106`, y `pg_roles.rolcanlogin` debe
ser falso para ambos roles. No añada `net` a los esquemas expuestos ni otorgue
`LOGIN` a esos roles.
El secreto no aparece en `cron.job.command`. El scheduler también limpia
borradores vencidos y siete días de historial de su propio job.

## Pruebas de aceptación

- Con una cuenta activa sin reseñas, escriba identidad, relato y anonimato.
  Espere «Borrador guardado en su cuenta», recargue y compruebe todos los campos.
  Inicie sesión en otro dispositivo para confirmar que puede retomarlo allí.
- Abra el mismo borrador en dos pestañas. Guarde en una y cambie la otra: debe
  avisar del conflicto y conservar el texto de la segunda, sin sobrescribir.
- Envíe una reseña válida. Debe aparecer en el perfil y desaparecer el contenido
  del borrador. Una respuesta recuperable debe conservar el formulario.
- Pida correcciones con una nota, corrija y reenvíe la misma reseña como autor,
  y apruébela. Debe llegar un aviso con enlace al perfil por cada decisión
  vigente, sin cédula, relato ni nota de moderación en el correo.
- Realice una búsqueda con una cuenta nueva que tenga su primera aprobación.
  Confirme el hito en la base y, desde administración, la cohorte correcta.
  Las cuentas de hoy aparecen cuando cierre el día de Costa Rica.
- Verifique una ejecución exitosa del job en Supabase Cron y una aceptación en
  Resend. Un HTTP 200 del worker con `configurado:false` no confirma envío.
  Resend «aceptado» tampoco confirma entrega; revise eventos de entrega/rebote.

## Comportamiento y privacidad

Los borradores se separan por cuenta y contexto (reseña nueva o ficha elegida).
Guardan únicamente los siete campos del formulario; nunca usan localStorage.
Una cuenta inactiva no puede leer ni guardar. La ficha elegida vuelve a comprobar
el permiso de consulta. Un UUID de versión impide sobrescrituras entre dispositivos.
El envío invalida el borrador en la misma transacción que inserta la reseña.
El contenido vence a los 30 días del último guardado; se conserva un marcador de
versión sin contenido para bloquear escrituras tardías. El scheduler elimina
contenido vencido aunque nadie vuelva a abrir el formulario.

La decisión y su aviso se confirman juntos en Postgres. Next.js `after` intenta
procesar la cola después de responder; Cron recupera caídas y tiempos de espera.
Cada lote reclama hasta tres avisos con una reserva de cinco minutos. Los
workers concurrentes usan `SKIP LOCKED` y un token de reserva. Una decisión
reemplazada, cuenta inactiva o correo cambiado se omite antes de enviar.
Se omiten administración, direcciones legacy y cuentas eliminadas.

El primer intento congela el remitente, destinatario y cuerpo, con la clave
`moderacion/<UUID>`. Las siguientes ejecuciones reutilizan ambos incluso tras
un despliegue. Resend [conserva la idempotencia durante 24 horas](https://resend.com/docs/dashboard/emails/idempotency-keys).
Por prudencia no se reintenta automáticamente después de 23 horas del primer
intento ni de cinco intentos. Errores permanentes y respuestas de aceptación
sin ID requieren revisión. Errores de red, 429, 5xx y solicitudes concurrentes
con la misma clave admiten reintento. Los reintentos tienen espera progresiva.

El correo no incluye la identidad del inquilino ni notas. Las copias de avisos
enviados/omitidos se eliminan a los 30 días de creación; los que necesitan
revisión se conservan hasta resolverlos. Eliminar la cuenta elimina sus
borradores, hitos y copias de destinatario. No se envía ninguno de estos datos
a Statsig; la audiencia y la activación se leen independientemente.

## Operación y recuperación

`/admin/estadisticas` muestra la cola y los diez avisos más antiguos que necesitan
revisión, con referencia `moderacion/<UUID>` y número de reseña. «Procesar avisos
pendientes» respeta la espera y la reserva; no reabre envíos en revisión.
Antes de reenviar, busque la referencia en Resend y determine si ya fue aceptado.
No repita una decisión de moderación para recuperar un correo.

Si Resend confirmó aceptación, un operador puede marcar el aviso como `enviada`
y guardar su ID de proveedor. Si el envío debe descartarse, puede marcarlo
`omitida`. En ambos casos limpie `cuerpo` y `token` mediante una transacción
privilegiada que compruebe el UUID y `estado='revision'`. No borre ni reemplace
la clave/cuerpo para reintentar un envío incierto después de la ventana de
idempotencia: podría duplicar el correo. Un nuevo envío requiere confirmar que
el anterior no fue aceptado y revisar que la decisión siga vigente.

Para detener el scheduler, desactive únicamente el job
`protectora-avisos-moderacion` en Supabase Cron. Para rotar el secreto, actualice
Production, despliegue y vuelva a ejecutar `avisos:cron -- --aplicar`. La cola
conserva avisos durante un 401 temporal. Para revertir el código, conserve las
tablas aditivas y desactive el job; no elimine datos ni reconstruya el esquema.

## Definición de métricas

- **Embudo:** cuentas activas de tipo propietario/agencia con Auth real creadas
  después de instalar la migración, durante los últimos 7 o 28 días completos
  de Costa Rica. Los pasos muestran el avance acumulado hasta ahora de esa
  misma cohorte: primera reseña enviada, primera aprobación y primera búsqueda
  completada después de esa aprobación. Cada paso cuenta la cuenta una vez.
- **Primera búsqueda en 7 días:** cohorte del mismo tamaño desplazada siete días
  hacia atrás, para dar a todas las cuentas siete días completos de observación.
  Cuenta la búsqueda dentro de siete días de crear la cuenta; no usa el embudo
  reciente como denominador.
- **Tiempo de aprobación:** mediana entre envío y primera aprobación de reseñas
  medidas cuya primera aprobación ocurrió en el período; incluye correcciones.
  Una republicación no reinicia ni suma otro tiempo.

La búsqueda solo se registra cuando la consulta autorizada terminó sin error y
la página se montó en el navegador. Una prueba firmada, vinculada a la cuenta y
válida diez minutos, evita registrar búsquedas sin consulta previa. El servidor
comprueba de nuevo sesión y permiso. Prefetch, búsquedas vacías, fallos y
administración quedan fuera; la señal del navegador respeta DNT/GPC. No se
conserva el texto buscado. Bloqueadores, ausencia de JavaScript o errores de red
pueden reducir este paso; la métrica no pretende contar lecturas de fichas.

## Validación automatizada

`npm test`, `npm run lint`, `npx tsc --noEmit`, `npm run build` y
`npm run test:activacion`. Esta última usa Postgres desechable en Docker; nunca
lee credenciales de producción. Verifica privacidad, autorización, versiones,
concurrencia, rollback, caducidad, cohortes, cola y recuperación. La prueba del
scheduler usa contratos SQL de las extensiones, sin peticiones HTTP: instalar
las extensiones y confirmar una ejecución real son verificaciones de rollout.

Verificación local del 1 de octubre de 2026: 274 pruebas unitarias pasaron, más
las suites de activación, correcciones, acceso y seguridad Supabase. Se verificó
en navegador el guardado/restauración, conflictos entre pestañas, protección de
navegación, corrección, aprobación, primera búsqueda y el panel a 320 y 1440 px,
usando PostgREST y Postgres aislados. No se enviaron correos ni se cambió producción.
Lint, TypeScript y el build de producción con `--webpack` pasaron. Turbopack
falló por una restricción del entorno al abrir un puerto; no se modificó el
comando normal de build. El envío real y la ejecución de las extensiones siguen
siendo parte de la verificación de rollout.

## Despliegue de producción del 1 de octubre de 2026

La versión quedó activa en [el sitio](https://www.protectoradelalquiler.com),
con deployment `dpl_AXSbfAky4nFvspYRQJxC6uSASkeT`
([URL de la versión](https://laprotectoradelalquiler-48d88mp8u.vercel.app)).
El build normal con Turbopack pasó en Vercel. La migración aditiva se aplicó
una vez: se conservaron los 6.447 usuarios, 5.235 personas y 4.795 reseñas.
Las cinco tablas privadas nuevas tienen RLS y no permiten lectura directa
a `anon` ni `authenticated`; el advisor de seguridad reportó cero hallazgos.

Se habilitaron `pg_cron` 1.6.4 y `pg_net` 0.20.4, con Vault 0.3.1 disponible.
Hay un único job activo cada cinco minutos; sus ejecuciones de las 19:00 y
19:05 UTC terminaron correctamente. Una solicitud de verificación enviada
por `pg_net` al worker autenticado devolvió HTTP 200, `configurado:true` y
cero avisos enviados, pendientes o en revisión. La cola estaba vacía antes
de la prueba; no se crearon reseñas ni se enviaron correos de prueba.
Esto confirma el transporte y la configuración del worker, pero la aceptación
y entrega de correos reales siguen pendientes de una decisión de moderación.

Inicio, privacidad y login respondieron HTTP 200; administración y registro
de reseñas redirigieron a login sin sesión. El worker devolvió HTTP 401 sin
credencial. Data API rechazó el esquema `net` con `PGRST106` y ambos roles
de cliente mantienen `NOLOGIN`. No se exportaron logs de solicitudes.
Las métricas agregadas de errores no están disponibles en el plan actual.

Se guardó un respaldo local únicamente del esquema, sin filas ni esquema Auth,
en `/private/tmp/protectora-rollout-backup-20261001/pre-activacion-schema.dump`.
La revisión automática de aprobación rechazó exportar datos de usuarios y
logs de producción; la verificación usó conteos, advisors y checks de salud.
Para revertir el código, desactive el job y promueva la versión anterior
`https://laprotectoradelalquiler-lu5kfz7ht.vercel.app`; conserve las tablas
aditivas. No restaure el esquema ni borre datos para una reversión de código.
