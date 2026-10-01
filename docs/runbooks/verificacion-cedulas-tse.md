# Verificación de cédulas con el TSE

La consulta usa el [padrón mensual oficial](https://www.tse.go.cr/descarga_padron.html), sin depender de scraping de consultas civiles ni de una API comercial. El indicador confirma que la cédula aparece en ese padrón y muestra su fecha. No acredita la identidad del portador, la vigencia de su documento ni la veracidad de una reseña.

En el registro por correo o Facebook y al enviar una reseña, el servidor consulta el padrón y guarda el resultado confirmado por cédula (encontrada o no encontrada), la fecha del padrón, el nombre oficial y la fecha de consulta. Las consultas de autocompletado no guardan resultados. No se aceptan banderas de validación enviadas por el navegador. Los fallos o fuentes desactualizadas no sustituyen una validación anterior.

Las tarjetas de reseñas administrativas leen esos resultados en una sola consulta por página, en paralelo con los perfiles de Facebook. No consultan el padrón ni descargan fragmentos durante la carga. La marca verde indica una validación histórica guardada y muestra la fecha del padrón consultado, no una comprobación de vigencia actual. Un registro sin resultado guardado muestra «Sin validación guardada del TSE». Cambiar la cédula usa el resultado de la nueva cédula; nunca hereda la marca de la anterior. Una diferencia con el nombre oficial muestra un aviso sin modificar los datos. Guardar una edición administrativa conserva el nombre indicado por quien administra.

DIMEX, documentos jurídicos, registros históricos y cédulas ausentes siguen admitiendo entrada manual. Una ausencia no significa que el documento sea inválido. Si la fuente tiene más de 62 días o falla la consulta, no se muestra una verificación verde.

## Preparación

Con las credenciales de servicio existentes en `.env.local`:

```sh
npm run db:padron-tse
node scripts/aplicar-esquema.mjs --solo-resultados-cedulas
npm run padron:actualizar
```

Si el TSE pide CAPTCHA al descargar, no lo automatice ni lo evada. Puede usar un ZIP oficial descargado normalmente y la fecha que indica la página del TSE:

```sh
npm run padron:actualizar -- --archivo=/ruta/padron_completo.zip --fecha=2026-08-31
```

La migración es aditiva: agrega el manifiesto y los límites de consulta, y permite guardar componentes legales del nombre de una sola letra en las reseñas. El importador crea el bucket privado `padron-tse`, descarga el ZIP oficial, interpreta su CSV de ocho columnas en Windows-1252 y conserva únicamente cédula, nombres y apellidos. No almacena domicilio electoral, sexo, junta ni vencimiento de la cédula.

El padrón de agosto de 2026 tiene 3.760.497 registros y genera 69 fragmentos comprimidos de aproximadamente 41 MB en total. No carga millones de filas en Postgres. La aplicación consulta por cédula exacta, descarga solo el fragmento necesario y conserva hasta ocho fragmentos por instancia. Comparte la lectura del manifiesto durante 30 segundos por instancia; no almacena fallos y comprueba la vigencia del padrón en cada consulta. Nunca entrega los fragmentos o las credenciales al navegador.

La publicación usa una versión inmutable identificada por fecha y SHA-256 del ZIP. El manifiesto cambia después de validar y subir todos los fragmentos. Un fallo deja activa la versión anterior y una publicación atrasada no puede sustituir una más reciente. Las tablas, funciones y archivos solo admiten acceso del servicio. La API limita las consultas por IP mediante una cuota atómica en Postgres; usa un HMAC y no guarda la IP ni las cédulas del autocompletado en la tabla de cuotas. Los resultados confirmados al enviar formularios se guardan en `verificaciones_cedula`, accesible solo por el servicio.

## Actualización mensual

Ejecute `npm run padron:actualizar` después de cada publicación del TSE. El comando detecta la fecha y evita descargar de nuevo una versión ya publicada. La tarea de GitHub Actions en `.github/workflows/actualizar-padron.yml` lo ejecuta el día 8 de cada mes y permite una ejecución manual. Configure los secretos `SUPABASE_URL` y `SUPABASE_SECRET_KEY` en el repositorio antes de activar la tarea. El workflow publica datos, no despliega cambios de la aplicación.

Se conservan la versión activa y la anterior. El importador elimina los fragmentos de otras versiones después de publicar, manteniendo siete días de margen para importaciones simultáneas y peticiones en curso. No elimina cuentas, reseñas ni otros buckets.

## Verificación

```sh
npm test
npm run test:padron-tse # Postgres desechable en Docker, nunca DATABASE_URL
npm run lint
npm run build
```

Abra `/registro`, escriba una cédula que conste en el padrón y compruebe el nombre y la marca verde. Cambie el número para comprobar que desaparecen el nombre automático y el resultado anterior. En `/admin/revision`, compruebe la marca verde junto a las cédulas del inquilino y del autor que consten en el padrón. Las cédulas ausentes y los documentos sin validación guardada deben mostrar un estado explícito sin marca verde. Una diferencia de nombre debe mostrar un aviso sin modificar el nombre guardado. Editar una reseña desde administración debe conservar el nombre indicado por quien administra.

Si el bucket se cambia accidentalmente a público, vuelva a marcarlo como privado en Supabase y revise sus políticas de Storage. El importador rechaza publicar en un bucket público. Las rutas de consulta se ejecutan en Node.js y no consultan la web del TSE durante cada ingreso.

## Recuperar resultados de los últimos dos días

`node --experimental-strip-types scripts/revalidar-cedulas-recientes.mjs` revisa sin escribir las cuentas y fichas creadas en las últimas 48 horas, además de ambas partes de reseñas creadas en esa ventana. `--aplicar` guarda los resultados en una transacción. Solo confirma cédulas encontradas en un padrón vigente. Para todas las cédulas encontradas sustituye el nombre guardado por el nombre oficial, aunque sea diferente, sin dejar diferencias para revisión en este backfill. Conserva los nombres de las cédulas ausentes o no aplicables. Verifica que el registro no haya cambiado antes de actualizarlo. No cambia estados de reseñas ni acredita la identidad del portador. La salida contiene totales, nunca nombres ni cédulas.
