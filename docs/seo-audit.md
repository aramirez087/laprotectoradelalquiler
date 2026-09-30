# Auditoría y plan SEO de La Protectora del Alquiler

Fecha: 29 de septiembre de 2026, hora de Costa Rica. Alcance: código del sitio, respuestas públicas de producción y documentación vigente de Google Search Central.

## Objetivo y límites de la indexación

El objetivo es atraer propietarios y agencias de Costa Rica que desean conocer experiencias de alquiler y entender cómo funciona la comunidad. El contenido público debe explicar el servicio, sus condiciones y su uso responsable. Las fichas de personas, las búsquedas por nombre o cédula, las reseñas individuales y las cuentas pertenecen al área privada y no deben convertirse en páginas de captación.

Los cambios de esta entrega se preparan en el repositorio. La inspección de producción descrita abajo corresponde a la versión anterior al despliegue. No se ha confirmado un nuevo despliegue, el estado real de indexación en Search Console, tráfico orgánico, posiciones, volumen de palabras clave ni Core Web Vitals. Una respuesta HTTP correcta o unos metadatos completos no garantizan indexación ni posiciones. [Requisitos técnicos de Google Search](https://developers.google.com/search/docs/essentials/technical).

## Evidencia de producción antes de los cambios

Se consultaron las URL sin iniciar sesión mediante peticiones HTTP el 29 de septiembre de 2026, aproximadamente entre las 22:12 y las 22:13 de Costa Rica. No se descargaron fichas privadas ni reseñas de personas.

| Comprobación | Resultado observado | Interpretación |
| --- | --- | --- |
| `https://www.protectoradelalquiler.com/` | HTTP 200, HTML en español | El sitio público está disponible por HTTPS. |
| `https://protectoradelalquiler.com/` | HTTP 308 hacia `https://www.protectoradelalquiler.com/` | `www` es el dominio público preferido que ya usa la infraestructura. |
| `http://www.protectoradelalquiler.com/` | HTTP 308 hacia HTTPS con `www` | La variante HTTP se consolida con la pública. |
| `http://protectoradelalquiler.com/` | HTTP 308 hacia HTTPS sin `www`, seguido del 308 a `www` | Hay dos saltos en esta variante. Es una mejora secundaria; no se observó un bucle. |
| `/robots.txt` | HTTP 404, HTML de página no encontrada | No existía un archivo de descubrimiento/configuración de rastreo en producción. Su ausencia no bloquea por sí sola la indexación. |
| `/sitemap.xml` | HTTP 404, HTML de página no encontrada | No existía un sitemap público. |
| HTML de la portada | Título de marca y descripción genérica; sin canonical, Open Graph, Twitter Card ni JSON-LD | Faltaban señales explícitas del dominio preferido y del contenido compartido. |
| `/login` | HTTP 200; descripción heredada de la portada; sin meta robots/googlebot ni `X-Robots-Tag` | Una página operativa podía ser candidata a indexación. No demuestra que ya estuviera indexada. |
| `/fichas` sin sesión | HTTP 307 hacia `/login?siguiente=%2Ffichas`; sin `X-Robots-Tag` | La autenticación impide ver el contenido privado. Faltaba una directiva adicional en esa respuesta. |

El servidor entrega HSTS y cabeceras de seguridad; la portada tiene idioma y viewport configurados. Estas observaciones no sustituyen una auditoría de seguridad ni una medición de rendimiento.

## Correcciones de esta entrega

| Prioridad | Hallazgo inicial | Cambio preparado | Verificación pendiente en producción |
| --- | --- | --- | --- |
| Alta | URL preferida no explícita en el HTML | Canonical absoluto coherente con el dominio HTTPS `www` para cada página pública | Inspeccionar el canonical declarado y el seleccionado por Google. |
| Alta | Faltaba una lista pública de páginas indexables | `robots.txt` con referencia al sitemap y sitemap limitado a portada, cómo funciona y privacidad | Ambos archivos deben responder 200; sitemap sin rutas privadas, parámetros ni dominios de preview. |
| Alta | Login y otras rutas operativas sin directivas completas | `noindex` y cabecera `X-Robots-Tag` para las rutas privadas, operativas y de acceso; metadatos de ficha sin identidad de personas | Revisar las respuestas normales y las redirecciones sin sesión; verificar la versión renderizada en Search Console. |
| Alta | La portada explicaba poco el producto para visitantes nuevos | Contenido público sobre propietarios/agencias, consulta de experiencias, aprobación y límites; nueva página `/como-funciona` con respuestas visibles | Confirmar HTML y navegación sin sesión y desde móvil. |
| Media | Títulos y descripciones poco diferenciados | Metadatos propios para las páginas públicas, con intención y país claros | Revisar que título, H1 y contenido describan el mismo servicio. Google puede escoger otra presentación. |
| Media | Identidad del sitio poco explícita para buscadores | JSON-LD de organización, sitio y páginas públicas, con navegación estructurada cuando corresponde | Validar el JSON y los tipos admitidos por Google; no asumir que todos generan un resultado enriquecido. |
| Media | Enlaces compartidos sin presentación definida | Open Graph, Twitter Card e imagen de marca | Verificar URL absoluta, respuesta 200 de la imagen y vista previa en los canales usados. |
| Alta | Riesgo de que un preview compita con producción | Directivas de exclusión en entornos de preview | Confirmar `noindex` en un preview y que producción permita indexar sus páginas públicas. |

El `noindex` debe poder ser leído por los rastreadores: bloquear la misma URL en `robots.txt` impide que Google vea esa directiva. La autenticación sigue protegiendo los datos; las directivas de buscadores son un control de indexación, no de acceso. [Guía de Google sobre noindex](https://developers.google.com/search/docs/crawling-indexing/block-indexing).

Canonical, enlaces internos y sitemap deben apuntar a la misma variante HTTPS `www`. Google considera las redirecciones y el canonical señales más fuertes que el sitemap, y decide finalmente qué versión mostrar. [Consolidación de URL duplicadas](https://developers.google.com/search/docs/crawling-indexing/consolidate-duplicate-urls).

## Mapa de intención y páginas

Estas consultas son hipótesis de intención basadas en el servicio y una exploración de resultados de búsqueda. No son estimaciones de demanda ni una lista de posiciones ganadas. Las búsquedas específicas devolvieron plataformas de referencias y servicios inmobiliarios o de evaluación de candidatos, junto con resultados generales. Eso confirma que conviene describir claramente qué ofrece La Protectora; no permite cuantificar el mercado.

| Página | Intención principal | Consultas y vocabulario natural | Acción útil para el visitante |
| --- | --- | --- | --- |
| `/` | Descubrir una comunidad de experiencias de alquiler en Costa Rica | reseñas de inquilinos en Costa Rica; referencias de inquilinos; experiencias de propietarios y agencias; La Protectora del Alquiler | Entender la propuesta y crear una cuenta. |
| `/como-funciona` | Evaluar el servicio antes de registrarse | cómo consultar reseñas de inquilinos; cómo compartir una experiencia de alquiler; acceso a consultas; aprobación de reseñas | Comprender el proceso, requisitos, beneficio inicial y límites de la información. |
| `/privacidad` | Confirmar el tratamiento y la visibilidad de datos | privacidad de La Protectora del Alquiler; datos de cuenta; cédula y reseñas; acceso con Facebook | Entender qué se guarda y quién puede verlo. |
| Guía futura sobre referencias de alquiler | Aprender a contrastar una experiencia antes de decidir | cómo pedir referencias de un inquilino en Costa Rica; preguntas para anteriores arrendadores | Usar una lista práctica redactada por alguien con experiencia, con criterios objetivos y fuentes pertinentes. |
| Guía futura sobre experiencias de alquiler | Aprender a aportar información útil | cómo redactar una reseña de un inquilino; documentar una experiencia de alquiler | Describir hechos relevantes, fechas y contexto sin publicar datos personales. |

La portada y `/como-funciona` tienen funciones distintas. No crear otra landing casi igual para cada provincia o sinónimo. Una página futura debe responder una necesidad adicional y contar con información propia que justifique su publicación. [Contenido útil centrado en las personas](https://developers.google.com/search/docs/fundamentals/creating-helpful-content).

No orientar el sitio como un portal de casas disponibles, un buró de crédito, una certificación de personas o una asesoría legal si esas funciones no existen. No competir por nombres de inquilinos, números de identificación ni listados de personas. Tampoco convertir experiencias de usuarios en valoraciones de la organización mediante `Review` o `AggregateRating`.

Los títulos y descripciones deben ser claros, únicos y concordar con el contenido; no se impone un número de caracteres como requisito de posicionamiento. Google puede generar el título y el fragmento a partir de varias partes de la página. [Enlaces de título](https://developers.google.com/search/docs/appearance/title-link) y [fragmentos y descripciones](https://developers.google.com/search/docs/appearance/snippet).

## Publicación y comprobación

### Validación local

El build de producción y TypeScript pasan. La suite completa pasa con 220 pruebas.
ESLint no presenta errores; quedan dos avisos existentes de variables sin usar en
`tests/integration/accesos-importados.test.mjs`. La comprobación HTTP del build
verifica los metadatos en `<head>` para un rastreador de tarjetas, los canonical,
Open Graph/Twitter, un H1 por página, JSON-LD con el nonce de CSP, robots y sitemap,
13 rutas privadas con `X-Robots-Tag` incluso al redirigir, el PNG de 1200 × 630 y
el estado 404 de una ruta inexistente.

Puede repetirla contra un servidor local con
`node scripts/verificar-seo.mjs http://127.0.0.1:3107`. Después del despliegue,
`node scripts/verificar-seo.mjs` comprueba el dominio de producción sin sesión.
Esta prueba no acredita indexación, posiciones ni Core Web Vitals de usuarios reales.

### Comprobación tras desplegar

1. Desplegar la versión revisada por el flujo habitual del proyecto. Mantener `https://www.protectoradelalquiler.com` como origen público y conservar las redirecciones existentes de dominio.
2. Consultar `/`, `/como-funciona` y `/privacidad` sin sesión: deben devolver 200 y mostrar su contenido principal en el HTML, un título propio y su canonical absoluto. No deben llevar `noindex` en producción.
3. Consultar `/robots.txt` y `/sitemap.xml`: deben responder 200 con el tipo de contenido adecuado. El sitemap debe contener únicamente las tres páginas públicas previstas. No añadir las rutas de fichas, resultados de búsqueda, administración, perfil, acceso o tokens.
4. Consultar login, registro, recuperación, invitaciones, perfil, reseñas y fichas sin sesión: comprobar `X-Robots-Tag` incluso en redirecciones y los metadatos de exclusión cuando se entregue HTML. No eliminar la autenticación para esta prueba.
5. Verificar un preview: las páginas públicas de ese entorno deben estar excluidas. Asegurarse de que esa configuración no se aplica al dominio de producción.
6. Validar el JSON-LD de la portada y las páginas informativas en [Rich Results Test](https://search.google.com/test/rich-results) para los tipos que Google admite. Revisar también la estructura con [Schema Markup Validator](https://validator.schema.org/). Una prueba sintáctica correcta no garantiza la aparición de funciones especiales. [Datos de organización](https://developers.google.com/search/docs/appearance/structured-data/organization).
7. Abrir la vista previa de un enlace compartido y comprobar que usa la imagen y los textos previstos. Las tarjetas sociales ayudan a presentar el sitio fuera de Google; no deben describirse como una mejora directa de posiciones.

## Search Console y seguimiento

La siguiente comprobación necesita la propiedad verificada en Google Search Console. No se ha accedido a una cuenta ni modificado su configuración.

1. Verificar una propiedad de dominio para `protectoradelalquiler.com` por DNS, o usar una propiedad de prefijo de URL para `https://www.protectoradelalquiler.com/` mediante el método admitido. La primera cubre variantes del dominio; la segunda depende del prefijo exacto.
2. Enviar `https://www.protectoradelalquiler.com/sitemap.xml` cuando esté publicado.
3. Inspeccionar las tres URL públicas y usar la prueba de URL publicada. Confirmar que Google puede rastrearlas, que ve el contenido esperado y que el canonical coincide. Solicitar indexación de las páginas públicas después de superar esa revisión.
4. Revisar el informe de indexación para distinguir páginas válidas, redirecciones, errores y exclusiones esperadas. Confirmar que las rutas privadas no aparecen como contenido indexado. Si ya existiera alguna URL sensible en resultados, investigar su fuente y usar el procedimiento de retirada de Google además de corregir el origen.
5. Revisar acciones manuales y problemas de seguridad. La auditoría HTTP no permite afirmar que esos informes estén vacíos.
6. Establecer una línea base del informe de rendimiento: clics, impresiones, CTR y posición media por página, consulta, país Costa Rica y dispositivo. Separar búsquedas de marca de búsquedas del servicio. Comparar periodos completos equivalentes y evitar conclusiones con pocas impresiones.
7. Usar las consultas reales para ajustar el mapa de intención, las preguntas de `/como-funciona` y los próximos contenidos. Registrar la fecha de despliegue para interpretar cualquier cambio.

Search Console permite observar rastreo, indexación y rendimiento sin añadir un medidor de terceros a las páginas del sitio. [Descripción de Search Console](https://support.google.com/webmasters/answer/9128668). La presentación de sitemaps favorece el descubrimiento, pero no garantiza rastreo ni indexación. [Construir y enviar un sitemap](https://developers.google.com/search/docs/crawling-indexing/sitemaps/build-sitemap).

Para la verificación por etiqueta HTML, el repositorio admite las variables opcionales `GOOGLE_SITE_VERIFICATION` y `BING_SITE_VERIFICATION`. Guardar únicamente el valor del atributo `content` que entregue cada herramienta, no la etiqueta HTML completa, y desplegar para que aparezca en el HTML público. Estas variables publican un token de verificación; no son credenciales de API ni completan por sí mismas la verificación de propiedad. Si se usa la verificación DNS de Google, esa etiqueta no es necesaria. Las indicaciones están también en `.env.example`.

Los entornos Vercel `preview` y `development` se excluyen mediante cabeceras y metadatos; su sitemap queda vacío y `robots.txt` bloquea el rastreo. Un preview debe permanecer protegido por los controles del despliegue cuando corresponda: el bloqueo de rastreo no sustituye un control de acceso.

## Trabajo pendiente para sostener el crecimiento

| Prioridad | Acción | Evidencia o criterio de finalización |
| --- | --- | --- |
| Alta | Publicar y verificar los cambios técnicos | Criterios del apartado de publicación cumplidos en el dominio real. |
| Alta | Completar Search Console | Propiedad verificada, sitemap procesado y línea base guardada. |
| Alta | Confirmar identidad y contacto público del responsable | Nombre o entidad y un canal real de soporte publicados y coherentes con privacidad. No inventar dirección, teléfono, experiencia, afiliaciones o datos legales. |
| Alta | Explicar criterios de moderación y corrección con el responsable del servicio | Instrucciones públicas que reflejen el proceso real: qué se acepta, cómo se revisa y cómo se pide una corrección. La guía del producto no debe prometer verificaciones que no ocurren. |
| Media | Medir rendimiento en móvil | PageSpeed Insights para las URL públicas y datos de campo de CrUX/Search Console cuando existan. Diferenciar resultados de laboratorio de datos reales; no se han medido LCP, INP ni CLS en esta auditoría. |
| Media | Publicar la primera guía original de referencias de alquiler | Autor con experiencia identificable, ejemplos útiles sin identidades reales, revisión de exactitud y fuentes primarias para cualquier afirmación normativa. |
| Media | Reforzar la presencia real de la comunidad | Enlaces descriptivos al dominio desde los perfiles y grupos oficiales que administra el negocio; relación real con agencias y comunidades. No se enviaron mensajes ni se modificaron perfiles. |
| Media | Conseguir menciones editoriales relevantes | Colaboraciones auténticas, recursos útiles o historias agregadas que otros quieran citar; sin compra de enlaces ni testimonios inventados. |
| Media | Relacionar captación con resultados del producto | Medir de forma agregada las cuentas y primeras reseñas aprobadas si existe un proceso compatible con la política de privacidad. No enviar nombres, cédulas, relatos, tokens ni consultas privadas a herramientas de marketing. |
| Baja | Reducir los dos saltos desde HTTP sin `www` | Revisar la configuración del dominio para redirigir esa variante directamente a HTTPS con `www` sin afectar el acceso. |

La política pública actual indica que no hay medidores de audiencia de terceros. Una futura integración de analítica debe concordar con el funcionamiento y esa política; no se ha instalado ni provisionado ninguna.

## Búsqueda con IA y datos estructurados

El contenido público sigue las mismas bases para la búsqueda clásica y las funciones de IA de Google: texto útil, enlaces accesibles, indexación permitida y datos estructurados concordantes con lo visible. Google no exige un archivo de texto especial ni un marcado exclusivo para aparecer en AI Overviews o AI Mode. No se atribuye una mejora de posiciones a `llms.txt`. [Funciones de IA y sitios web](https://developers.google.com/search/docs/appearance/ai-features).

Las preguntas frecuentes se publican para ayudar al visitante. No se implementa `FAQPage` como promesa de resultados enriquecidos: Google dejó de mostrar esa función el 7 de mayo de 2026 y retiró su documentación el 15 de junio. [Actualizaciones oficiales de Search Central](https://developers.google.com/search/updates).

Solo se marcan hechos públicos y comprobables de la organización y del sitio. No se añaden estrellas, cifras de usuarios, premios, reseñas privadas o búsquedas autenticadas al JSON-LD. Los datos estructurados deben mantenerse alineados con el producto y su contenido, en cada actualización.

## Criterio de éxito

La entrega técnica termina cuando las páginas públicas y los controles privados se verifican en producción. El éxito de captación se evalúa después con datos reales de Search Console y del proceso de registro. Este documento no declara posiciones, tráfico o rendimiento que no se han medido, ni fija una garantía de resultados.
