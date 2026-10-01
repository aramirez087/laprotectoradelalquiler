# Consulta de ejemplo antes del registro

La portada pública y `/como-funciona` enlazan a `/ejemplo`. La página permite
comparar una ficha con dos relatos ficticios y una búsqueda sin resultados, sin
crear una cuenta. El contenido inicial se entrega en el HTML; los botones cambian
la situación sin navegación ni solicitudes de datos.

## Alcance

- La persona, los autores, las fechas y los relatos son explícitamente inventados.
  No se usan documentos reales, calificaciones ni puntuaciones de riesgo.
- El ejemplo no tiene formulario de búsqueda, almacenamiento de contenido ni
  acceso a fichas reales. La página comparte la navegación y sesión del sitio.
- Los enlaces «Compartir mi primera experiencia» abren `/registro?origen=ejemplo`.
  Solo ese valor fijo muestra el enlace de regreso y el marcador de llegada.
  No altera los permisos ni se incorpora al registro de la cuenta.
- El registro, la confirmación de correo, el aporte y la aprobación conservan
  sus reglas. No se promete aprobación, un plazo de revisión ni acceso inmediato.
- La página tiene canonical y metadatos para compartir, pero lleva `noindex`
  tanto en HTML como en `X-Robots-Tag` y no aparece en el sitemap.

## Qué medir

La hipótesis es que ver una consulta antes de comprometerse facilita la primera
contribución. El informe de administración añade visitas al ejemplo, interacción
con cada situación, intención de registrarse y llegadas al registro con el origen
fijo. Consulte [Estadísticas](estadisticas.md) para las definiciones y exclusiones.

Estos conteos son señales de interés, no una tasa de conversión ni una atribución
de reseñas aprobadas al ejemplo. Los identificadores de audiencia no se vinculan
con las cuentas. El embudo existente de activación sigue midiendo cuentas,
primeros aportes, aprobaciones y primeras búsquedas por separado.

Tras publicar, revise ambas familias de datos durante un período completo y
observe si aumenta la participación sin empeorar los tiempos de aprobación ni
la proporción de primeras búsquedas. El tráfico, las campañas y la capacidad de
moderación pueden explicar diferencias; una comparación antes/después no prueba
causalidad. Para atribuir un efecto al ejemplo haría falta un experimento y una
decisión explícita sobre cómo medirlo respetando la separación de identidades.

## Despliegue y comprobación

Se publica con el despliegue normal de la aplicación. No requiere migraciones,
servicios, credenciales ni cambios de permisos. Reutiliza Statsig si ya está
configurado; un fallo o bloqueo de medición no impide usar el ejemplo o registrarse.

1. Abra `/` sin sesión y siga «Ver una consulta de ejemplo».
2. Cambie las situaciones con teclado. Verifique la selección visible, el foco y
   el anuncio del cambio. Debe permanecer la etiqueta «Ejemplo ficticio».
3. Compruebe ambos casos y los enlaces a registro en móvil, tableta y escritorio,
   en tema claro y oscuro. El registro muestra «Cree su cuenta», sus requisitos
   habituales y el enlace para volver al ejemplo.
4. Ejecute `node scripts/verificar-seo.mjs URL_DEL_SITIO` para comprobar la ruta
   pública, la exclusión de indexación y las protecciones de las rutas privadas.
5. La medición se habilita solo en producción, excluye administración y respeta
   DNT/GPC. Los informes de Statsig pueden aparecer después de cerrar el día;
   un guion indica falta de informe, no cero interacciones.

## Verificación local · 1 de octubre de 2026

- `npm run lint`, `npm test` (296 pruebas), TypeScript y build de producción con
  webpack pasan. La suite usa permiso de loopback para su servidor TLS temporal.
- Las comprobaciones HTTP de SEO pasan contra el servidor local, incluyendo la
  nueva ruta y las 13 rutas privadas ya cubiertas.
- Se revisó en navegador la navegación inicio → ejemplo → registro → ejemplo,
  Enter/Espacio para cambiar situaciones, los anuncios y la ausencia de campos
  de identidad en el ejemplo. No se enviaron formularios ni se crearon cuentas.
- Se inspeccionaron anchos de 320, 390, 768 y 1440 px sin desbordamiento horizontal,
  y ambos temas. No se registraron errores ni advertencias en la consola durante
  el recorrido. Las capturas están en `output/playwright/ejemplo-*.jpg` (ignorado
  por Git). No se realizó una auditoría formal de lectores de pantalla.
- Los tests de medición verifican categorías permitidas, deduplicación,
  navegación, preferencias de privacidad, administración, pestañas ocultas,
  marcadores de registro tardíos y fallos del SDK sin enviar tráfico a Statsig.

La entrega queda preparada localmente. No se ha publicado ni se ha comprobado
la recepción de estos nuevos eventos en producción.
