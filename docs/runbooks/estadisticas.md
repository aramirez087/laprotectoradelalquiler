# Estadísticas de audiencia

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

Las categorías están en `lib/audiencia.ts`. Las fichas se agrupan como «Detalle de ficha»;
no se envía su ID. Los parámetros de búsqueda, documentos, tokens y formularios quedan fuera.
No se instalan autocapture ni session replay. `includeCurrentPageUrlWithEvents: false`
impide que el SDK agregue automáticamente la URL a los eventos. CSP permite únicamente
`https://api.statsig.com` para la recolección y se configuran sus endpoints explícitamente.

Un UUID aleatorio en localStorage identifica un navegador, sin vincularlo con la cuenta.
No se habilitan cookies de Statsig. Se respetan Do Not Track y Global Privacy Control.
Los administradores, las rutas de acceso con tokens y los entornos no productivos quedan fuera.
Los bloqueadores y el almacenamiento restringido pueden reducir la precisión.

## Interpretación

Statsig genera `event_count` para cada evento durante las primeras 24 horas y procesa sus
informes diariamente. La configuración predeterminada cierra los días a GMT−8, es decir,
2 a. m. de Costa Rica; el período termina en el último día cerrado. Si cambia la zona del
proyecto Statsig, ajuste `fechasAudiencia` y la explicación de la página juntos.

Visitantes únicos usa `weekly_active_user` (7 días) o `monthly_active_user` (28 días) del
último día, con `userID` como unidad. Nuevos visitantes usa `new_wau` o `new_mau_28d`.
No se suman visitantes diarios ni variantes de unidad para calcular visitantes del período.
La tabla diaria consulta `daily_active_user`. Los conteos de eventos usan `overall`, o
`userID` cuando `overall` no está presente; no se suman entre sí.

Un guion significa «informe pendiente». Un error de servicio se muestra aparte. Los totales
parciales indican que hay días sin informe; no se convierten en ceros. No hay histórico previo
a la activación. Los informes vacíos iniciales son normales.

El [plan Developer](https://www.statsig.com/pricing) incluye 2 millones de eventos por mes.
Esta implementación envía tres eventos por página y dos al comenzar una visita, sin
dimensiones adicionales. No convierte esa cuota en una promesa de 2 millones de páginas vistas.
