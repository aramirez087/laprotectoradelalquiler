# Búsqueda relevante y resultados útiles

La búsqueda distingue documentos completos, prefijos de documentos, nombres completos,
palabras completas y palabras incompletas. Solo devuelve fichas con reseñas publicadas.
Los nombres se normalizan sin diferencias por mayúsculas, tildes, diéresis o ñ/n;
los documentos omiten espacios, puntos y guiones. La normalización no modifica la identidad
almacenada. No hay corrección automática de errores ni coincidencias difusas de personas.

Los nombres usan un índice GIN con diccionario `simple`, sin derivar raíces de palabras.
Todas las palabras de dos o más caracteres deben coincidir desde su inicio; no se buscan
fragmentos en medio de un nombre. Los documentos requieren al menos cuatro caracteres
y coinciden desde su inicio. Un documento exacto aparece antes de documentos que continúan
con esos caracteres. Los nombres completos aparecen antes de coincidencias de palabras,
y estas antes de palabras incompletas; entre coincidencias equivalentes se priorizan
los nombres con menos palabras. El desempate final incluye el ID para paginar de forma estable.
La RPC fuerza planes personalizados para que cada tipo de búsqueda utilice su índice.
La selección, el conteo y la paginación comparten una única consulta y solo se agregan
las reseñas de las 20 fichas de la página. No se cargan relatos ni catálogos históricos.

## Despliegue

1. Compruebe el destino de `DATABASE_URL` y su respaldo habitual. Deben estar instaladas
   las migraciones de acceso temporal, sesiones y activación.
2. Ejecute `npm run db:busqueda`. Aplica únicamente `db/busqueda-relevante.sql`, en una
   transacción, sin borrar fichas, cuentas ni reseñas. Los índices se crean con la
   migración; planifique una ventana si el registro tiene muchas escrituras.
   Existe el mismo SQL en la migración generada por Supabase
   `20261001205538_busqueda_relevante.sql`: use un solo mecanismo.
   **No use `db:aplicar` sobre una base existente**, porque recrea las tablas.
3. Despliegue el código después de la migración. `schema.sql` incluye la misma entrega
   para instalaciones nuevas. No se añaden servicios, credenciales ni extensiones.
4. Compruebe con una cuenta de prueba con permiso vigente: nombre con/sin tildes,
   nombre incompleto, documento con/sin guiones, búsqueda sin resultados, ficha,
   paginación y regreso desde la ficha. Revise también una sesión sin permiso.
5. Compruebe que el job existente `protectora-avisos-moderacion` sigue ejecutando
   `limpiar_datos_activacion()`. La migración amplía esa limpieza para los resultados
   de búsqueda; no instala otro cron ni envía notificaciones.
6. En administración revise «De la búsqueda a las experiencias». Los eventos del día
   actual aparecen al cerrar el día de Costa Rica. No hay recuperación histórica.

La versión anterior puede ejecutarse con esta migración instalada: conserva los
objetos aditivos. Para revertir la aplicación no elimine las tablas ni los índices.
Si reinstala la migración antigua de activación, vuelva a aplicar `db:busqueda` al final
para conservar la limpieza programada de las métricas nuevas.

## Medición y privacidad

| Señal | Definición | Decisión que informa |
| --- | --- | --- |
| Búsqueda | Página visible con consulta válida, autorización y respuesta sin error | Uso real de búsqueda |
| Sin resultados | La consulta no encontró fichas con reseñas publicadas | Revisar recuperación y cobertura |
| Con apertura | Al menos una ficha publicada se abrió desde esos resultados en 30 minutos | Paso de resultados a experiencias |
| Miembros con apertura | Cuentas con alguna apertura / cuentas que buscaron en el período | Alcance de la utilidad del registro |
| Miembros recurrentes | Cuentas que buscaron en dos o más días de Costa Rica / cuentas que buscaron | Uso en días distintos |

Una apertura no demuestra que sea la identidad buscada ni que se leyó una reseña.
Un cero de resultados no demuestra una mala búsqueda: también puede faltar cobertura.
Las vistas directas de fichas no se atribuyen a una búsqueda. El embudo anterior de
primera búsqueda sigue midiendo actividad; su definición no se reemplaza con aperturas.

Las páginas crean una prueba firmada vinculada a la cuenta, el tipo de consulta,
el resultado, una referencia aleatoria y un instante. Un HMAC vincula el contexto
con la búsqueda sin guardar su texto. Los enlaces de ficha vinculan temporalmente
esa prueba con la ficha. El ID de la ficha solo se usa para validar la apertura;
no se persiste en las métricas. Una consulta cambiada no puede reutilizar la prueba
anterior. Las pruebas vencen a los 30 minutos, con hasta cinco segundos de tolerancia
para diferencias de reloj. Los parámetros no se envían a Statsig.

El componente solo llama la acción cuando se monta en una pestaña visible; las
precargas y renders del servidor no registran eventos. Respeta DNT y GPC; no guarda
consultas ni pruebas en localStorage. La acción vuelve a comprobar sesión, permiso
y, para una apertura, la presencia de reseñas publicadas. El registro SQL también
comprueba cuenta, rol y permiso actual. Solo `service_role` puede invocar las RPC;
las tablas privadas tienen RLS y no son accesibles a anon/authenticated.

La referencia se conserva al paginar y volver desde una ficha, y el servidor evita
duplicados incluso con peticiones simultáneas. Abrir varias fichas desde los mismos
resultados cuenta una búsqueda con apertura. Volver a enviar el formulario inicia otra referencia. La recarga conserva la
referencia durante su vigencia mediante la API nativa de historial de Next.js. Un enlace abierto después de vencer la prueba no registra
la apertura; la lectura de la ficha conserva sus comprobaciones normales de permiso.

Cada recibo guarda solamente referencia aleatoria, cuenta, instante, tipo,
presencia de resultados y presencia de apertura. Vence a los 90 días y se elimina
al borrar la cuenta. La limpieza usa el worker existente y también se ejecuta al
registrar o consultar informes. Administración ve agregados de 7 o 28 días cerrados
según Costa Rica, sin listas de miembros ni de consultas. Un fallo de medición
no impide buscar; un fallo de informes se muestra como no disponible, nunca como cero.
Bloqueadores, falta de JavaScript y preferencias de privacidad reducen las cifras.

## Validación

- `npm test`: contratos de la RPC, documentos/nombres/entradas inválidas, pruebas
  firmadas, expiración, tampering, cambios de consulta, autorización, DNT/GPC,
  pestañas ocultas, rutas, vínculos, paginación y denominadores de informes.
- `npm run test:busqueda`: Postgres y PostgREST desechables con datos inventados;
  ranking, normalización, totales, permisos SQL, RLS, reintentos, concurrencia,
  días cerrados, retención y borrado de cuenta. Comprueba índices en las consultas
  reales con un registro de más de 3.000 fichas mediante `auto_explain`.
- `npm run test:activacion` y `npm run test:acceso-consultas`: regresiones de borradores,
  avisos, activación y reglas de autorización.
- `npm run lint`, `npx tsc --noEmit`, `npm run build -- --webpack`.

Las suites desechables no cargan `.env.local`, no usan conexiones de producción
ni envían correos. El build con webpack evita la limitación de puertos del sandbox;
no se cambia el comando normal de build.

### Verificación local del 1 de octubre de 2026

Pasaron 286 pruebas unitarias, 9 pruebas de búsqueda/PostgREST, 10 de activación
y 20 de acceso temporal. El advisor de seguridad de Supabase no reportó errores
en la base desechable (`--type security --level error`); esto no es una auditoría
del proyecto de producción.

Se ejecutó la aplicación Next.js real con Postgres/PostgREST aislados y un servidor
de autenticación con cuentas y credenciales inventadas. Se comprobaron envío del
buscador, orden de documentos, apertura de ficha, vuelta, paginación, recarga,
estados vacíos, dashboard con datos de días cerrados, DNT y GPC.
Los conteos de la base confirmaron una única búsqueda por referencia y su actualización
al abrir una ficha. No se guardaron búsquedas bajo DNT/GPC. Se inspeccionaron anchos
320, 390 y 1440 px y ambos temas, sin desbordamiento horizontal en los estados revisados.
Los avisos de desarrollo de Next.js sobre precargas y una petición de favicon no
forman parte de la medición. No se crearon rutas temporales en el repositorio.

Las capturas se conservan en `output/playwright/search-*.png` (ignorado por Git).
El harness local, sus servidores y sus bases se eliminan al terminar. No se modificó
producción, no se enviaron correos y no se enviaron eventos a Statsig.
