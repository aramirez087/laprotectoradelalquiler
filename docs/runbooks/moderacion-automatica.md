# Moderación automática de reseñas

La publicación automática requiere que la comprobación de identidad del servidor y la clasificación del contenido sean satisfactorias. Groq evalúa únicamente el texto persistido de la reseña y el detalle de daños. No confirma cédulas, nombres, la veracidad de una queja ni hechos sobre una persona. La decisión y el cambio de estado pertenecen al servidor y a Postgres.

## Configuración del contenido

Primero aplique la migración aditiva con `npm run db:moderacion-automatica`. Conserva las reseñas y sus estados; no ejecuta el reinicio de `schema.sql`. El esquema completo ya incluye la misma migración para instalaciones nuevas. Esta migración debe aplicarse después de los parches anteriores de resultados de cédulas; si reinstala uno de esos parches, vuelva a aplicar la migración de moderación automática al final.

Variables privadas del servidor:

```dotenv
GROQ_API_KEY=su_clave_privada
MODERACION_AUTOMATICA_ENABLED=1
```

Obtenga la clave en [Groq Console](https://console.groq.com/keys). No use un prefijo `NEXT_PUBLIC_`. Configure la clave en el entorno correspondiente de Vercel y cree un despliegue que reciba esas variables. Una variable local no prueba que producción esté habilitada.

La activación requiere exactamente el valor `1`. Si falta, tiene otro valor o falta la clave, el clasificador devuelve `moderacion_no_configurada` y conserva la revisión humana. Para desactivar, cambie a `0` y despliegue ese entorno. Esto no elimina reseñas ya publicadas.

Solo se evalúan reseñas nuevas y correcciones reenviadas. Las pendientes anteriores y las decisiones humanas permanecen en su estado. Cada envío se guarda como borrador antes de la evaluación. La publicación compara versión y texto exactos, cédulas actuales, nombre del inquilino y pruebas de ambas identidades correspondientes a la misma versión inmutable del padrón vigente (máximo 62 días). Una fecha coincidente por sí sola no basta.

El modelo está fijado en `openai/gpt-oss-120b`, un modelo de producción con JSON estricto. No existe una variable para sustituirlo por un modelo arbitrario. Un cambio exige revisar código, pruebas y versión de política. Groq clasifica Safeguard 20B como preview; Llama Guard 4 fue retirado el 5 de marzo de 2026. Consulte [modelos](https://console.groq.com/docs/models), [salidas estructuradas](https://console.groq.com/docs/structured-outputs) y [retiros](https://console.groq.com/docs/deprecations).

## Política `resenas-v1`

Una queja negativa puede ser apta para publicación. Morosidad, daños y disputas no son NSFW por sí solos. Relatos sobrios de amenazas recibidas, violencia, acoso o consumo de drogas no se rechazan automáticamente por mencionar esos temas.

Van a revisión humana contenido sexual explícito, sexualización de menores, violencia gráfica, odio o amenazas del autor, datos personales dentro del relato, órdenes para manipular la moderación, spam, texto sin una experiencia de alquiler y casos inciertos. Revisión humana no equivale a rechazo: la administración conserva la decisión final.

El contrato admite únicamente `segura` con categorías vacías o `revision` con alguna categoría conocida. No solicita porcentajes de confianza ni conserva explicaciones o citas del modelo. La salida estructurada reduce errores de formato; no garantiza precisión de clasificación.

## Privacidad y fallos

El clasificador no acepta campos de identidad, nombres del padrón ni datos del autor. Patrones locales de correos, números de ocho o más dígitos, documentos etiquetados y contactos en el relato evitan la llamada y conservan el texto para un humano. Las fechas de calendario válidas y los montos con moneda explícita no activan el filtro numérico. No se trunca, redacta ni transforma el relato para obtener una aprobación.

Marcadores de rol, instrucciones evidentes para aprobar y texto oculto también detienen la llamada. Estos filtros y la política reducen la manipulación; no prueban inmunidad frente a todos los ataques.

Active **Zero Data Retention** en los controles de la organización de Groq. Groq normalmente no conserva inferencia, pero puede guardar entradas y salidas para fiabilidad o investigación de abuso por hasta 30 días; ZDR desactiva ese almacenamiento. Los datos retenidos se alojan en Estados Unidos. Consulte [Your Data in GroqCloud](https://console.groq.com/docs/your-data).

La llamada no usa herramientas, streaming de respuestas de IA, caché ni redirecciones HTTP. Tiene ocho segundos para la solicitud y la lectura, un máximo de 16 KiB de respuesta y 2048 tokens de salida. No hay reintentos. Falta de configuración, red, cuota, errores del proveedor, respuesta incompleta, rechazo, JSON inválido o decisión contradictoria conservan revisión humana. No se registran claves, relato ni cuerpos de errores del proveedor.

Postgres reclama una sola evaluación por reseña y versión y aplica límites atómicos: por autor, cinco evaluaciones en diez minutos y veinte en 24 horas; para el proyecto, diez en un minuto y 200 en 24 horas. Si se agotan, el borrador conserva revisión humana. No se impide guardar la contribución. La ausencia de clave no consume este cupo. Los registros de intentos se eliminan después de 30 días al consumir nuevos cupos.

La evidencia privada conserva resultado, motivos, categorías, modelo, política, versiones del relato y padrón y una huella del texto; no duplica el relato ni las cédulas. Administración puede ver el resultado junto a la reseña y decidir manualmente. La aprobación usa los mismos triggers de historial, crédito y avisos que una decisión humana, sin marcar los hechos como verificados. El envío de correo se inicia después de confirmar la publicación y el Cron existente sigue recuperando la cola. Una respuesta perdida se reconcilia con el estado persistido; si tampoco puede leerse, el perfil muestra una recepción neutral y el estado real de la reseña.

## Verificación antes de activar

Ejecute `node --test tests/moderacion-contenido.test.mjs`. Las pruebas usan respuestas sintéticas y verifican límites, datos enviados, privacidad, plazo y fallos. No miden la precisión real del modelo.

Con credenciales válidas, ejecute `node scripts/probar-moderacion-groq.mjs --ejecutar`. El script clasifica doce casos sintéticos y no lee ni modifica reseñas, usuarios o datos del padrón. Activa la evaluación únicamente en un módulo aislado; no modifica variables, archivos ni la configuración de la aplicación. Imprime etiquetas y resultados, sin relato ni credenciales. Sale con error ante un desacuerdo con las expectativas o un fallo del proveedor. Ajuste `--pausa-ms=10000` si la cuota de la organización exige espaciar llamadas. La suite es una comprobación funcional pequeña; no prueba precisión universal.

Antes de ampliar la activación, evalúe una colección sintética etiquetada por personas que incluya español de Costa Rica, quejas legítimas, acoso sin detalles gráficos, material explícito, ambigüedad y manipulación. Revise especialmente aprobaciones incorrectas. Nunca envíe datos reales como pruebas. Cambios del modelo o de política requieren repetir la evaluación.

Verifique además la migración del proyecto y pruebe identidad no encontrada, padrón antiguo, nombres incompatibles, cambios simultáneos, intervención del administrador y ausencia de clave. Estado y permisos deben corresponder al resultado persistido, sin publicaciones ni avisos duplicados.
