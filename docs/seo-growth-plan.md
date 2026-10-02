# Plan de captación: referencias y reseñas de inquilinos en Costa Rica

Actualizado: 1 de octubre de 2026, hora de Costa Rica. Objetivo: atraer búsquedas pertinentes, ayudar al visitante a evaluar el servicio y aumentar las cuentas que aportan una primera reseña aprobada. El puesto número uno para una consulta concreta es una aspiración, no un resultado garantizado ni el único indicador de éxito.

## Estado y alcance

- El propietario ya agregó el sitio a Google Search Console. El informe del sitemap mostraba un fallo de lectura, última lectura el 1 de octubre y cero URL descubiertas. La prueba en vivo de `https://www.protectoradelalquiler.com/sitemap.xml` indicó rastreo permitido y descarga correcta. Después de publicar y reenviar la URL una vez, el informe cambió a **Success**, con tres páginas descubiertas en ese momento. El sitemap vigente contiene siete URL públicas; la cifra del informe todavía no refleja las cuatro guías nuevas. Este resultado acredita la lectura del sitemap, no la indexación de todas las páginas.
- El código ya integra Statsig y un panel privado de activación. Este plan aprovecha esas herramientas; no requiere instalar otro medidor.
- Las páginas `/guias`, `/guias/referencias-de-inquilinos`, `/guias/preguntas-para-arrendadores` y `/guias/como-escribir-una-resena` están publicadas y verificadas con respuesta 200, metadatos propios y navegación rastreable. La entrega se publicó en el dominio principal desde el despliegue `dpl_5veGd7QPXPUM4cHQATTsM4vgZMGx` el 1 de octubre. El build remoto de Next.js, la verificación de siete páginas públicas y los controles de exclusión de trece rutas privadas pasan.
- Por indicación del propietario, la cabecera conserva exactamente «Proteja su propiedad. Alquile con confianza.» y el subtítulo «Experiencias de otros propietarios para elegir mejor a su inquilino.». El vocabulario de búsqueda se mantiene en el título de la página y en el contenido informativo.
- La identidad pública del operador, el contacto, la firma de una persona autora y las nuevas explicaciones de moderación quedan **aplazadas por decisión del propietario**. No inventar esas identidades, credenciales o procesos.
- No se han enviado mensajes a agencias, editores o comunidades, ni se han modificado perfiles externos. Los textos de difusión de abajo son borradores. Este documento tampoco crea una automatización semanal.

## Primer cierre: sitemap e indexación

1. Verificar la URL exacta enviada: `https://www.protectoradelalquiler.com/sitemap.xml`. Debe corresponder a la propiedad de dominio `protectoradelalquiler.com` o al prefijo HTTPS con `www`.
2. Tras desplegar, ejecutar `node scripts/verificar-seo.mjs` y guardar fecha, versión y resultado. Comprobar que sitemap y robots responden sin sesión, que el XML contiene las páginas públicas vigentes y que no contiene perfiles, fichas, búsquedas privadas ni URL con tokens.
3. En Search Console, abrir el detalle del sitemap, guardar el error literal y la fecha de la última lectura. Usar la inspección de URL y la prueba en vivo para las páginas públicas. Si persiste el fallo, contrastar su hora con los registros de disponibilidad, DNS, reglas de protección y respuestas de servidor. No atribuir el problema a Google ni desactivar controles de acceso basándose solo en el mensaje genérico.
4. Enviar o volver a enviar la URL correcta una vez resuelto el problema observado. Registrar cuándo Search Console pase a «Correcto» y las páginas descubiertas. Solicitar indexación de las páginas públicas que superen la prueba en vivo.
5. Revisar por separado indexación, canonical elegido, acciones manuales y problemas de seguridad. «Sitemap correcto», «URL indexada» y «URL que recibe clics» son estados diferentes.

Google utiliza sitemaps para descubrir URL; presentarlos no garantiza rastreo ni indexación. Search Console permite examinar indexación y rendimiento sin incorporar otro script al sitio. [Sitemaps](https://developers.google.com/search/docs/crawling-indexing/sitemaps/overview), [Search Console](https://developers.google.com/search/docs/monitor-debug/search-console-start).

## Mapa de contenido y decisiones

Las consultas siguientes son hipótesis de intención, no cifras de demanda. Validarlas con impresiones y consultas reales en Search Console.

| URL | Necesidad que resuelve | Consultas iniciales | Qué observar |
| --- | --- | --- | --- |
| `/` | Entender el registro y sus requisitos de acceso | reseñas de inquilinos Costa Rica; referencias de inquilinos Costa Rica | Impresiones y clics sin marca; avance hacia cómo funciona y registro. |
| `/como-funciona` | Comprender el recorrido y los límites del servicio | cómo consultar reseñas de inquilinos | Clics pertinentes y dudas recurrentes antes del registro. |
| `/guias` | Encontrar el recurso práctico adecuado | guías para arrendadores Costa Rica | Descubrimiento y navegación hacia las tres guías. |
| `/guias/referencias-de-inquilinos` | Solicitar y contrastar referencias | cómo pedir referencias de un inquilino | Consultas que encajan con la guía y llegada al registro. |
| `/guias/preguntas-para-arrendadores` | Preparar una conversación con el arrendador anterior | preguntas para referencias de alquiler | Uso editorial del recurso y tráfico hacia la guía. |
| `/guias/como-escribir-una-resena` | Organizar una experiencia útil basada en hechos | cómo escribir una reseña de un inquilino | Interés por contribuir y avance al registro. |

Mejorar una página existente cuando varias consultas expresen la misma necesidad. Crear otra solo cuando aporte una respuesta distinta. No convertir nombres, documentos o reseñas privadas en páginas de captación.

## Qué podemos medir hoy

Esta línea base se verificó en el código y en los runbooks, sin consultar datos de cuentas ni exportar reportes privados.

| Fuente | Datos disponibles en la implementación | Límite de interpretación |
| --- | --- | --- |
| Search Console | Clics, impresiones, CTR y posición por consulta, página, país y dispositivo, cuando Google disponga de datos | Se comprobó la prueba en vivo del sitemap, pero no se ha guardado una línea base de rendimiento. La posición media depende del conjunto de consultas; no es una posición fija para todo Google. |
| Statsig / Administración → Estadísticas | Vistas por categoría de página, dispositivos, sesiones por referente Google/Bing/Facebook/etc. y visitantes estimados por navegador | La categoría Google significa referente de Google, no una clasificación garantizada de búsqueda orgánica. No distingue búsquedas pagadas, otras superficies o consultas concretas. Un referente ausente puede contarse como directo. |
| Interacciones del ejemplo | Vistas, clics de casos, clic al registro y llegada contextual a `/registro` | Indican uso e intención; no significan que se creó una cuenta. |
| Activación en la base propia | Cuenta nueva → primera reseña enviada → primera aprobación → primera búsqueda, por cohorte | No está vinculada con el UUID de Statsig ni con la fuente de captación. No permite afirmar cuántas aprobaciones llegaron de Google. |

Fuentes internas: [audiencia](../lib/audiencia.ts), [recolección](../components/audiencia.tsx), [runbook de estadísticas](runbooks/estadisticas.md), [runbook de activación](runbooks/activacion.md) y [política pública](../app/privacidad/page.tsx).

Statsig usa categorías fijas y un identificador aleatorio de navegador que no se vincula con la cuenta. La recolección está limitada a producción, respeta Do Not Track y Global Privacy Control y excluye administración. No envía nombres, cédulas, texto de formularios, búsquedas ni identificadores de fichas. Mantener esas garantías al ampliar las métricas.

### Ampliación publicada en esta entrega

La revisión inicial encontró que las rutas nuevas de guías no estaban en la lista permitida de `paginaAudiencia`. La entrega incorpora las cuatro categorías de página, tres eventos fijos de clic al registro y su presentación en administración:

| Evento | Significado |
| --- | --- |
| `site_page_guias` | Vista del índice de guías. |
| `site_page_guia_referencias` | Vista de la guía de referencias. |
| `site_page_guia_preguntas` | Vista de la lista de preguntas. |
| `site_page_guia_resena` | Vista de la guía para escribir una reseña. |
| `site_public_guia_referencias_registro` | Clic al registro desde la guía de referencias. |
| `site_public_guia_preguntas_registro` | Clic al registro desde la lista de preguntas. |
| `site_public_guia_resena_registro` | Clic al registro desde la guía de reseñas. |

Los eventos de clic solo se admiten en su página y usan el mecanismo existente de deduplicación y privacidad. Un informe ausente es «pendiente», no cero. El clic expresa intención; no acredita llegada al registro, cuenta creada ni aprobación. La implementación está publicada; el procesamiento de los primeros informes queda pendiente de tráfico y de Statsig. Consultar el [runbook de estadísticas](runbooks/estadisticas.md).

Una mejora futura acotada sería añadir marcadores permitidos de llegada al registro, con el patrón ya usado para el ejemplo. Si luego se necesita distinguir llegadas desde Google/Bing durante la misma sesión, conservar únicamente la categoría validada de origen y su caducidad, nunca el referente completo ni parámetros. Esa atribución no forma parte de esta entrega. No instalar GA4, capturar parámetros arbitrarios o unir cuentas a identificadores de terceros solo para completar un embudo.

La atribución de primeras aprobaciones a una fuente requeriría un cambio explícito adicional: una categoría de captación validada en la cohorte de la base propia, tratamiento consistente del registro por correo y Facebook, retención definida, agregados con permisos y explicación pública. No puede reconstruirse para las cuentas históricas ni deducirse dividiendo aprobaciones totales entre sesiones de Google.

## Rutina semanal y plantilla

Una revisión breve semanal sirve para detectar fallos; las decisiones editoriales se toman con períodos comparables de 28 días cuando haya datos suficientes. Usar fechas completas, no el día aún abierto. Statsig cierra sus días a las 2 a. m. de Costa Rica según la configuración documentada; la cohorte de activación usa sus propias fechas. Registrar esa diferencia y no forzar igualdad entre herramientas.

En Search Console, usar búsqueda web, país Costa Rica y separar móvil/escritorio cuando el volumen lo permita. Exportar una vista de marca y otra sin marca; empezar con una expresión de marca como `protectora|protectoradelalquiler` y revisar falsos positivos. Las consultas y algunos datos pueden omitirse por privacidad o ser preliminares; conservar el total del informe y no tratar la suma de filas como un censo completo. [Informe de rendimiento](https://support.google.com/webmasters/answer/7576553).

Copiar esta tabla para cada revisión. «Pendiente» significa dato no disponible, nunca cero.

| Indicador | Período actual: ___ a ___ | Período comparable: ___ a ___ | Fuente / filtro | Decisión |
| --- | --- | --- | --- | --- |
| Sitemap: estado y última lectura | Pendiente | Pendiente | Search Console, URL exacta | Resolver primero errores de lectura. |
| URL públicas indexadas / previstas | Pendiente | Pendiente | Inspección e indexación | Investigar exclusiones concretas. |
| Clics sin marca | Pendiente | Pendiente | Search Console, Costa Rica | Revisar qué páginas atraen necesidades pertinentes. |
| Impresiones sin marca | Pendiente | Pendiente | Mismos filtros | Identificar temas en los que ya hay visibilidad. |
| CTR sin marca | Pendiente | Pendiente | Clics ÷ impresiones | Revisar título y promesa si hay suficientes impresiones comparables. |
| Consultas principales y URL correspondiente | Pendiente | Pendiente | Search Console | Mejorar respuesta y evitar páginas duplicadas. |
| Visitas con referente Google / Bing | Pendiente | Pendiente | Statsig, días cerrados | Contrastar tendencia; no exigir que coincida con clics de Search Console. |
| Vistas de cada guía | Pendiente | Pendiente | Statsig, una vez desplegada la categoría | Decidir qué guía mejorar primero. |
| Clics al registro desde cada guía | Pendiente | Pendiente | Eventos tras desplegar y procesar | Evaluar si el recurso despierta interés por contribuir; no cuenta llegadas. |
| Cuentas nuevas / primera reseña enviada | Pendiente | Pendiente | Activación, misma cohorte | Revisar el recorrido general; no atribuir a SEO. |
| Primera aprobación / primera búsqueda | Pendiente | Pendiente | Misma cohorte, edad comparable | Considerar el tiempo de moderación y maduración. |
| Enlaces editoriales relevantes nuevos | Pendiente | Pendiente | URL verificada de la publicación | Registrar relevancia y visitas; no sumar enlaces irrelevantes. |
| Cambios publicados / incidencias | Pendiente | Pendiente | Fecha, versión, páginas afectadas | Evitar atribuir toda variación a un solo cambio. |

Al cierre, escribir solo: observación respaldada por datos, una hipótesis, un cambio prioritario y la fecha de revisión. No fijar un porcentaje de crecimiento antes de conocer la línea base.

## Rendimiento móvil

La medición de laboratorio ayuda a localizar problemas; CrUX y Core Web Vitals reflejan experiencias reales y pueden no tener muestras suficientes. Registrar URL, fecha, dispositivo y versión en cada comparación. No presentar un puntaje de Lighthouse como una garantía de ranking. [Cómo interpretar PageSpeed Insights](https://developers.google.com/speed/docs/insights/v5/about).

El 1 de octubre de 2026 a las 17:49 de Costa Rica se completó una medición de la portada pública, anterior a estos cambios. La API pública respondió 429 por cuota agotada, pero la interfaz de PageSpeed sí completó el análisis. [Informe móvil de la portada](https://pagespeed.web.dev/analysis/https-www-protectoradelalquiler-com/l7pdeyq82v?form_factor=mobile).

| Métrica de laboratorio | Resultado |
| --- | --- |
| Rendimiento | 89/100 |
| Accesibilidad / buenas prácticas / SEO automatizados | 100/100 en cada categoría |
| FCP / LCP | 0,9 s / 2,4 s |
| Tiempo total de bloqueo (TBT) | 10 ms |
| CLS | 0,177 |
| Speed Index | 3,0 s |
| Condiciones | Moto G Power emulado; Lighthouse 13.5.0; Slow 4G; carga inicial de una página |
| Datos de campo CrUX | «No Data»: no se dispone de una evaluación de usuarios reales en este informe |

El diagnóstico atribuye el desplazamiento de 0,177 al elemento `footer.pie-pagina`. Una hipótesis a verificar en el código y en una traza es que el contenido corto de carga de la sesión se sustituye por la portada completa, desplazando el pie; el informe identifica el elemento afectado, no demuestra por sí solo la causa. También señala que la ilustración LCP (`barrio.webp`) carece de prioridad alta de descarga y que dos archivos CSS bloquean el renderizado (13,9 KiB en total). Las estimaciones de ahorro del informe no son mejoras ya conseguidas.

La entrega mueve el pie de página dentro del límite de Suspense de sesión para que aparezca junto al contenido y da prioridad alta a la ilustración principal. Una comprobación independiente del streaming de React confirma que el pie ya no se muestra antes de resolver la sesión; la medición posterior de portada registró CLS 0. Los resultados 100/100 corresponden a comprobaciones automáticas y no sustituyen revisiones completas de accesibilidad o SEO.

Después de publicar, medir portada y una guía representativa; si aparecen problemas, verificar las demás. Priorizar un recurso o interacción concretos señalados por el informe y comparar bajo condiciones equivalentes. Para datos de campo, registrar los percentiles 75 de LCP, INP y CLS cuando existan, indicando si corresponden a la URL o al origen. Los umbrales «buenos» actuales son LCP ≤ 2,5 s, INP ≤ 200 ms y CLS ≤ 0,1. [Criterios de PSI](https://developers.google.com/speed/docs/insights/v5/about).

## Difusión preparada, todavía sin enviar

Seleccionar personas con una relación real con propietarios o agencias de Costa Rica y una publicación donde el recurso encaje. Registrar organización, página pertinente, contacto público confirmado, motivo de relevancia, fecha, respuesta y enlace publicado. Evitar envíos masivos y listas compradas. No pagar por enlaces que transfieran señales de clasificación ni exigir enlaces recíprocos. [Políticas de Google sobre enlaces](https://developers.google.com/search/docs/essentials/spam-policies#link-spam).

Antes de usar un borrador: comprobar que el enlace ya funciona, adaptar el motivo al destinatario, completar la firma real y obtener autorización explícita para enviarlo. No presentar ejemplos inventados como testimonios ni compartir casos identificables de la base.

### Para una agencia o administradora de propiedades

**Asunto:** Una guía práctica para pedir referencias de alquiler

> Hola, [nombre]:
>
> Vi [recurso o actividad real de la agencia] y pensé que esta guía puede servirle a su equipo: https://www.protectoradelalquiler.com/guias/referencias-de-inquilinos
>
> Explica cómo preparar una solicitud de referencias, contrastar lo que se recibe y distinguir hechos de opiniones. Incluye un ejemplo para iniciar la conversación.
>
> También preparamos una lista de preguntas para el arrendador anterior: https://www.protectoradelalquiler.com/guias/preguntas-para-arrendadores
>
> Si encuentra algún paso poco claro desde su experiencia, agradecería su comentario. Si el material le resulta útil, puede compartir el enlace con los propietarios a quienes acompaña.
>
> [Nombre y función reales]
> La Protectora del Alquiler

### Para quien administra una comunidad de propietarios

**Asunto:** Recurso para conversar sobre referencias de alquiler

> Hola, [nombre]:
>
> En [comunidad] vi una conversación sobre [tema real, sin identificar a un inquilino]. Tenemos una lista pública de preguntas para pedir referencias a un arrendador anterior: https://www.protectoradelalquiler.com/guias/preguntas-para-arrendadores
>
> La guía ayuda a organizar la conversación y a pedir contexto. Se puede leer sin crear una cuenta. ¿Encaja como recurso para su comunidad? Con gusto adaptamos una introducción breve a sus reglas de publicación.
>
> [Nombre y función reales]
> La Protectora del Alquiler

### Para una persona editora de un medio o boletín

**Asunto:** Recurso para una nota sobre referencias de alquiler

> Hola, [nombre]:
>
> Su publicación sobre [título real] aborda una pregunta práctica: qué información pedir y cómo valorar una referencia de alquiler.
>
> En La Protectora del Alquiler preparamos dos recursos públicos: una guía para pedir referencias (https://www.protectoradelalquiler.com/guias/referencias-de-inquilinos) y otra para escribir una reseña con hechos, fechas y contexto (https://www.protectoradelalquiler.com/guias/como-escribir-una-resena).
>
> Si está preparando una nota relacionada, puede revisarlos como material práctico para sus lectores. Agradecemos observaciones sobre claridad o información que falte. No compartimos datos identificables de inquilinos ni cifras de impacto que no hayamos medido.
>
> [Nombre y función reales]
> La Protectora del Alquiler

No enviar seguimientos automáticos. Si hay una relación pertinente y se autoriza el contacto, como máximo preparar un recordatorio útil; dejar de insistir ante una negativa o ausencia de interés.

## Hitos de 90 días

Las fechas organizan el trabajo; no prometen una posición determinada. Día 1 es el 1 de octubre de 2026; si el despliegue ocurre más tarde, registrar la fecha efectiva para las comparaciones.

| Plazo | Entrega | Responsable | Criterio de cierre |
| --- | --- | --- | --- |
| Días 1–7, 1–7 de octubre | Resolver o acotar «Couldn't fetch», desplegar contenido, comprobar enlaces/canonical y privacidad | Desarrollo + propietario en Search Console | Verificaciones HTTP y estado real de Search Console documentados por separado; ninguna URL privada añadida. |
| Días 1–7 | Incorporar categorías de guías y su recorrido al registro | Desarrollo | Eventos permitidos, sin datos personales, visibles tras procesamiento; pruebas y runbook actualizados. |
| Días 8–30, 8–30 de octubre | Guardar línea base, revisar consultas, medir móvil y preparar selección de contactos | Propietario/editor + desarrollo | Exportaciones con fechas/filtros, un informe móvil y borradores personalizados listos. Identidad y moderación siguen aplazadas. |
| Días 31–60, 31 de octubre–29 de noviembre | Mejorar la guía con mayor evidencia de demanda y ejecutar difusión autorizada | Propietario/editor | Cambio basado en consultas observadas; registro de respuestas y enlaces reales. Sin envíos sin autorización. |
| Días 61–90, 30 de noviembre–29 de diciembre | Comparar períodos maduros, corregir fricciones y decidir siguiente recurso | Propietario + desarrollo | Informe con clics pertinentes, uso de guías y activación general, límites de atribución explícitos y siguiente prioridad. |

Si Search Console sigue sin datos suficientes, mantener el diagnóstico como «sin evidencia aún» y verificar descubrimiento y pertinencia antes de publicar más páginas. Si llegan visitas y el recorrido se interrumpe, mejorar el paso identificado con las métricas disponibles. Retomar operador, contacto y firma solo cuando el propietario facilite los datos y solicite hacerlo.

## Verificación posterior a la publicación

Search Console confirmó «Indexing requested» para `/guias`; esto acredita la solicitud, no la indexación.

El [informe móvil de portada posterior](https://pagespeed.web.dev/analysis/https-www-protectoradelalquiler-com/3qjeqxkz4j?form_factor=mobile), del 1 de octubre a las 18:08, registró rendimiento 94, CLS 0 y LCP 2,9 s. El [informe móvil de la guía de referencias](https://pagespeed.web.dev/analysis/https-www-protectoradelalquiler-com-guias-referencias-de-inquilinos/6vtnw1d0eo?form_factor=mobile), a las 18:09, registró rendimiento 87, CLS 0,236 y LCP 2,1 s. Ambos dieron 100 en las comprobaciones automáticas de accesibilidad, buenas prácticas y SEO, sin datos de campo. La guía todavía requiere investigar el desplazamiento atribuido al pie de página, incluyendo el límite de carga de ruta; el resultado de portada no acredita que todas las rutas estén libres de desplazamientos. LCP de portada permanece como oportunidad de mejora.
