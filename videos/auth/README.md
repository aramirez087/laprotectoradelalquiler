# Videos de ayuda · La Protectora del Alquiler

Dos videos verticales en español de Costa Rica, con textos grandes y música
original. Registro: **42 s**. Recuperación: **39 s**. 1080×1920, 30 fps.

## Editar

Los textos, tiempos y escenas están en `stories.mjs`. La presentación y las
réplicas de los controles están en `scripts/build.mjs`. Cada escena se genera
como HTML independiente en `registro/compositions` y `recuperar/compositions`.
También puede editar esos HTML directamente desde HyperFrames Studio; **no
vuelva a ejecutar el generador después de una edición en Studio**, porque el
generador reconstruye los HTML desde los textos originales.

Desde esta carpeta:

```sh
node scripts/build.mjs
python3 scripts/music.py
cd registro
npm run dev
```

Abra la URL de Studio que imprime el comando. Para el otro video, ejecute
`npm run dev` dentro de `recuperar`. `npm run check` verifica el proyecto y
`npm run render` crea el MP4 en su propia carpeta `renders`. No hace falta
modificar ni instalar dependencias en la aplicación Next.js; los comandos
usan HyperFrames **0.8.117**. Los assets necesarios son locales.

## Qué representa cada video

Las pantallas son réplicas ampliadas para explicar los controles reales, con
datos ficticios. Los correos son ilustraciones; no se inventan botones de un
proveedor de email. No se realizó ningún registro ni envío de email, y no se
cambió ninguna clave.

El flujo y los textos se revisaron en `components/registro-form.tsx`,
`components/campos-identidad.tsx`, `components/recuperar-form.tsx`,
`components/form-clave.tsx`, `lib/actions/auth.ts`, `app/restablecer/page.tsx`,
`app/registro/resena/page.tsx` y en las pantallas públicas del sitio. El logo,
colores y fuente se tomaron de `components/marca.tsx`, `app/globals.css` y
`app/layout.tsx`. La última pantalla aclara que entrar a la cuenta y tener
permiso para consultar reseñas son condiciones distintas.

Recuperar una clave requiere una cuenta con acceso ya habilitado. Algunos
perfiles antiguos pueden necesitar intervención de administración; cambiar
la clave no provisiona ese acceso. No se afirma ni simula el éxito de una
operación real. Una cuenta con dos factores sigue necesitando su código.

## Música y assets

`scripts/music.py` crea un acompañamiento original y reproducible a 96 BPM,
con osciladores y una melodía sencilla. No contiene canciones, grabaciones,
loops ni muestras de terceros. Los WAV generados se ofrecen con dedicación
CC0 para su reutilización y adaptación en estos materiales. Los fades están
incluidos en el audio; no hay locución. Cambie los WAV para usar otra música.

Instrument Sans se conserva bajo su [SIL Open Font License](https://github.com/google/fonts/blob/main/ofl/instrumentsans/OFL.txt),
incluida en cada carpeta de assets. El archivo de fuente proviene de la
compilación local de la aplicación, sin modificarlo. GSAP conserva su cabecera
y [licencia original](https://gsap.com/standard-license/). El logo pertenece
a La Protectora del Alquiler y conserva la geometría del SVG de la app.

## Verificación

`VERIFICATION.md` registra las comprobaciones y las características de los
MP4 finales. `registro/check.json` y `recuperar/check.json` contienen los
resultados de HyperFrames. Los captions principales están incrustados en el
video; `captions.json` conserva los textos y tiempos para adaptar el material.
