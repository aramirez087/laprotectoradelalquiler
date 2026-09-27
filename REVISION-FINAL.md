# Revisión final

## Cambios de interfaz

- Portada con ilustración propia optimizada en WebP, marca y favicon de una casa.
- Selector Claro / Oscuro / Sistema. La preferencia se guarda durante un año en
  una cookie y se lee en el servidor para evitar un destello del tema incorrecto.
- Navegación móvil con devolución del foco al cerrar con Escape, indicación de
  página actual, búsqueda con foco visible y campos de 16 px para evitar zoom móvil.
- Calificación mediante radios nativos, compatibles con teclado y validación.
- Mensajes de error y ausencia de resultados con una acción de recuperación.
- Redirección de inicio de sesión que conserva los filtros incluso si la sesión
  deja de ser válida entre el proxy y la página. Validación de destinos y páginas.

## Bloqueo de publicación: acceso directo a datos personales

El 27 de septiembre de 2026 se comprobó que peticiones sin sesión a la API REST
configurada, usando únicamente la clave pública de la aplicación, pueden leer
`identificacion` de `personas` y `usuarios`. Solo se registró si había acceso;
no se guardaron identificaciones en archivos ni en los resultados de herramientas.

La máscara de la UI no protege el acceso directo. La política de lectura pública
en `schema.sql` coincide con este comportamiento. Se preparó
`db/restringir-acceso-anonimo.sql` como contención independiente: revoca permisos
anónimos sobre las tablas con datos personales, sin borrar registros. No se ha
ejecutado contra la base de datos. Hay que aplicar la restricción con acceso de
administración y comprobar que las consultas anónimas quedan denegadas y que
los flujos autenticados siguen funcionando. La conexión SQL exige TLS y la
validación del certificado falla con `SELF_SIGNED_CERT_IN_CHAIN`; se necesita
la CA del proyecto o ejecutar la corrección desde el SQL Editor de Supabase.
No se desactivó la verificación TLS para cambiar permisos.

La contención anónima no es una revisión completa de autorización. El esquema
incluido también permite lectura amplia a usuarios autenticados y la creación
de perfiles solo comprueba `auth_user_id`, sin restringir el rol. El trigger de
protección de rol compara `session_user`, que no identifica necesariamente el
rol efectivo de la API. Estos caminos deben revisarse con pruebas de permisos
por rol antes de considerar la plataforma lista para producción.

**No ejecutar `npm run db:aplicar` en una base con datos:** `schema.sql` contiene
`DROP TABLE ... CASCADE`. Usar la corrección separada, no recrear el esquema.

Referencia: [seguridad por filas de Supabase](https://supabase.com/docs/guides/database/postgres/row-level-security).

## Verificación reproducible

```sh
npm run lint
npx tsc --noEmit
npm test
npm run build
```

Las pruebas de utilidades requieren Node.js 22.18 o posterior (o Node.js 24).
La verificación de navegador usa los flujos públicos; no crea cuentas ni reseñas
en la base de datos real.

Resultados: lint, TypeScript, las tres pruebas de regresión y la compilación de
producción pasan. En navegador se verificaron los temas tras recargar, cambios
del tema del sistema, preferencia de movimiento reducido, navegación móvil con
Escape, anchos de 320/375/768/1280 px y conservación de la búsqueda al ir al login.
Los flujos que requieren una cuenta aprobada no se verificaron de extremo a extremo.
