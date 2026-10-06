# Verificación de los videos

Revisión: 2026-10-05. No se publicaron videos ni se modificó la autenticación.

| Entregable | Duración | Formato | Tamaño |
| --- | --- | --- | --- |
| `01-registro.mp4` | 42,000 s | 1080×1920, 30 fps, H.264 yuv420p + AAC estéreo 48 kHz | 5.082.464 bytes |
| `02-recuperar-clave.mp4` | 39,000 s | 1080×1920, 30 fps, H.264 yuv420p + AAC estéreo 48 kHz | 4.777.887 bytes |

- Ambos controles estrictos de HyperFrames pasan sin errores ni advertencias:
  lint, ejecución, layout, movimiento y contraste. 300 muestras de movimiento
  por composición; 74 controles de contraste de registro y 71 de recuperación.
- Se inspeccionaron los puntos medios de las 12 escenas y 26 imágenes del MP4
  final: entradas, escenas mantenidas y último cuadro. No faltan escenas,
  imágenes, tipografías ni instrucciones; no se observa texto recortado.
- Los archivos completos se decodificaron sin errores. La duración de audio
  coincide con la de video. No se detectaron intervalos negros ni silencios
  internos mayores a 0,4 s a −60 dB. Los fades suaves son intencionales.
- Música final: −24,3 LUFS integrados y pico verdadero de −10,3 dBFS. No hay
  clipping. No hay locución; los pasos están escritos en pantalla.
- Ambos MP4 tienen el índice `moov` antes de `mdat` para iniciar la reproducción
  sin descargar todo el archivo.
- 53 pruebas existentes de formularios, acciones, callback, navegación y
  recuperación de autenticación pasaron. Estas pruebas usan fixtures y mocks;
  no son una prueba de entrega de correo ni de acceso de usuarios reales.
- Se verificaron las pantallas públicas en el navegador del usuario. Los pasos
  protegidos posteriores al email se confirmaron con código y pruebas, y se
  ilustraron sin ejecutar autenticación real.
- Se incorporó la condición verificada por la revisión de acceso: los usuarios
  importados con acceso habilitado deben crear una clave nueva; los perfiles
  sin acceso habilitado necesitan ayuda de administración. La aprobación de la
  primera reseña habilita consultas, no es requisito para iniciar sesión.
- La fuente y marca proceden de la app. La licencia de la fuente se incluye.
  La música es síntesis original local sin archivos de música de terceros.

SHA-256:

```text
01-registro.mp4
7c58d4fdbe925debd5eed0e1e17632fbe67aa38189d9edea9256d4a1c27bffdd

02-recuperar-clave.mp4
b4c4c7babba37d7dd019ccb13a174786b3fde534a3f5467f87bfc5149b1253a9
```

Se utilizó HyperFrames 0.8.117, ya instalado. Studio anunció 0.8.127, pero el
registro npm disponible para este entorno rechazó esa versión por su filtro de
fecha. Se conservó la versión instalada y comprobada. No se editaron el
`package.json`, `package-lock.json` ni `skills-lock.json` de la aplicación.

Los resultados machine-readable están en `registro/check.json`,
`recuperar/check.json` y en `output/videos/auth/qc/report.json` del repositorio.
Las hojas de contacto del MP4 final están en esa carpeta `qc`.
