# Estadísticas de audiencia

La misma página incluye un panel independiente de activación basado en Postgres:
cuenta → reseña → aprobación → primera búsqueda. No requiere Statsig ni comparte
identidad o texto con él. Consulte [el runbook de activación](activacion.md) para
la migración, cohortes, límites de observación y operación de avisos.

Administración → Estadísticas (`/admin/estadisticas`) consulta informes reales de la integración
Statsig `laprotectoradelalquiler-analytics`, en su plan gratuito. No muestra datos de ejemplo.

## Configuración

- `NEXT_PUBLIC_STATSIG_CLIENT_KEY`: clave pública provisionada por la integración Vercel.
- `STATSIG_CONSOLE_API_KEY`: Console API Key con `Make Read Only` y sin `Can Access Keys`,
  guardada como Secret de servidor en Production y Preview. Nunca usar `NEXT_PUBLIC_` para ella.
- Solo `VERCEL_ENV=production` activa la recolección. Development y Preview pueden consultar
  informes con una sesión admin válida, pero no añaden visitas a la audiencia de producción.

Los informes se leen en el servidor, después de `requerirRol('admin')`, mediante el
[API de métricas de Statsig](https://docs.statsig.com/api-reference/metrics/list-all-metric-values).
Las consultas usan paginación, cuatro peticiones concurrentes como máximo, timeout de 10 segundos
y caché de 15 minutos. La clave nunca se devuelve al navegador.

## Qué se cuenta

| Evento | Cuándo se envía | Datos |
| --- | --- | --- |
| `site_page_view` | Cada ruta admitida | Ninguna URL ni metadatos de contenido |
| `site_page_<categoría>` | Cada ruta admitida | Nombre fijo de la sección |
| `site_device_<categoría>` | Cada ruta admitida | Celular, tableta o computadora |
| `site_session_start` | Primera visita de una pestaña o tras 30 minutos sin actividad | Sin identidad de cuenta |
| `site_source_<categoría>` | Inicio de visita | Directo, Google, Facebook, Instagram, Bing u otros |

La consulta pública de ejemplo añade estos eventos sin propiedades ni metadatos:

| Evento | Cuándo se envía | Interpretación |
| --- | --- | --- |
| `site_page_ejemplo` | `/ejemplo` está visible | Vista de la página, incluida la llegada directa |
| `site_public_inicio_ejemplo` | Clic en «Ver una consulta de ejemplo» desde `/` | Intención de abrir el ejemplo |
| `site_public_ejemplo_con_resenas` | Clic en el caso con reseñas de `/ejemplo` | Interacción con ese caso |
| `site_public_ejemplo_sin_resultados` | Clic en el caso sin resultados de `/ejemplo` | Interacción con ese caso |
| `site_public_ejemplo_registro` | Clic en el enlace para compartir una experiencia desde `/ejemplo` | Intención de contribuir; no registro completado |
| `site_public_registro_desde_ejemplo` | `/registro` visible contiene el aviso de origen «ejemplo» | Visita al registro contextual; no cuenta creada |

Los enlaces y controles declaran `data-evento-publico` con uno de los cuatro nombres
fijos, sin el prefijo `site_public_`. Un único listener delegado recoge el clic sin impedir
su acción. El aviso de `/registro?origen=ejemplo` declara
`data-visita-publica="registro_desde_ejemplo"`; se cuenta cuando el aviso está renderizado
y el documento visible, incluso si llega después del layout. No se interpreta un clic
como llegada. El observador solo lee ese marcador; nunca lee valores de formularios.
El código de audiencia usa exclusivamente el pathname y no lee parámetros de URL.

Cada interacción se admite solo en su ruta y con su disparador permitido. Los nombres
desconocidos se descartan. Cada evento se envía como máximo una vez por visita a la ruta;
salir y volver inicia otra visita. Un cambio de pestaña, un clic repetido o el remonte de
efectos de React no añade otra cuenta. Los eventos esperan a que el documento esté visible.
Los fallos o bloqueos del SDK no detienen la navegación ni producen rechazos sin manejar.

Las categorías están en `lib/audiencia.ts`. Las fichas se agrupan como «Detalle de ficha»;
no se envía su ID. Los parámetros de búsqueda, documentos, tokens y formularios quedan fuera.
No se instalan autocapture ni session replay. `includeCurrentPageUrlWithEvents: false`
impide que el SDK agregue automáticamente la URL a los eventos. CSP permite únicamente
`https://api.statsig.com` para la recolección y se configuran sus endpoints explícitamente.

Un UUID aleatorio en localStorage identifica un navegador, sin vincularlo con la cuenta.
No se habilitan cookies de Statsig. Se respetan Do Not Track y Global Privacy Control.
Los administradores, las rutas de acceso con tokens y los entornos no productivos quedan fuera.
Los bloqueadores y el almacenamiento restringido pueden reducir la precisión.
Estos mismos controles se aplican a las vistas, clics y llegadas del ejemplo. No se carga
el SDK mientras el documento está oculto o el navegador solicita no ser rastreado.

## Interpretación

Statsig genera `event_count` para cada evento durante las primeras 24 horas y procesa sus
informes diariamente. La configuración predeterminada cierra los días a GMT−8, es decir,
2 a. m. de Costa Rica; el período termina en el último día cerrado. Si cambia la zona del
proyecto Statsig, ajuste `fechasAudiencia` y la explicación de la página juntos.

Visitantes únicos usa `wau` (7 días) o `mau_28d` (28 días) del
último día, con `metricType: user` y `userID` como unidad. Nuevos visitantes usa `new_wau` o `new_mau_28d`.
No se suman visitantes diarios ni variantes de unidad para calcular visitantes del período.
La tabla diaria consulta `dau`. Estos son los nombres que devuelve la Console API;
la guía de métricas usa los nombres descriptivos `daily_active_user`, `weekly_active_user`
y `monthly_active_user`. Los conteos de eventos usan `overall`, o
`userID` cuando `overall` no está presente; no se suman entre sí.

Un guion significa «informe pendiente». Un error de servicio se muestra aparte. Los totales
parciales indican que hay días sin informe; no se convierten en ceros. No hay histórico previo
a la activación. Los informes vacíos iniciales son normales.

El panel «Uso de la consulta de ejemplo» muestra el total disponible y los días con informe
de **cada métrica**. Un evento nuevo sin informe aparece como «—», incluso si ya existen
informes de páginas vistas. Solo un valor explícito de cero se muestra como cero. No se
infieren ceros para los días anteriores al lanzamiento ni para eventos no procesados.

La decisión que informa este panel es si los visitantes exploran los casos y continúan al
registro. No es un embudo individual ni un experimento causal: una persona puede aparecer
en varios dispositivos o visitas, un enlace de registro puede compartirse y Statsig no se
vincula con la identidad de la cuenta. Los hitos de activación siguen siendo generales;
no se atribuyen aprobaciones o búsquedas al ejemplo. Antes de valorar un cambio, espere
días cerrados con informes comparables y contraste el recorrido general de activación.

El [plan Developer](https://www.statsig.com/pricing) incluye 2 millones de eventos por mes.
Esta implementación envía tres eventos por página y dos al comenzar una visita, más hasta
un evento por cada interacción predefinida o llegada al registro contextual, sin dimensiones
adicionales. No convierte esa cuota en una promesa de 2 millones de páginas vistas.
