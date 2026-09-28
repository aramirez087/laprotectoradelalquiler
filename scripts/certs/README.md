# Certificado raíz de Supabase

`supabase-prod-ca-2021.crt` es la CA pública que entrega el botón **Download
certificate** del dashboard de Supabase. No contiene claves privadas ni datos
del proyecto. Se incluye en el despliegue para verificar la cadena y el nombre
del servidor de Postgres, sin descargar certificados durante una importación.

- Fuente: https://supabase-downloads.s3-ap-southeast-1.amazonaws.com/prod/ssl/prod-ca-2021.crt
- URL confirmada en el código oficial del dashboard: https://github.com/supabase/supabase/blob/master/apps/studio/hooks/custom-content/custom-content.json (`ssl:certificate_url`).
- Descargado: 2026-09-28.
- Válido hasta: 2031-04-26 10:56:53 UTC.
- Huella SHA-256: `80:70:25:AD:50:D4:ED:21:9D:2C:9C:7D:29:9C:00:4F:82:4E:B0:0C:F7:F6:5A:FE:F6:07:D0:7B:72:E6:CA:FA`.

Si Supabase rota su CA, descargue el certificado desde el dashboard o su URL
oficial, compruebe la huella y actualice este archivo y su documentación antes
de desplegar. Nunca use como raíz confiable un certificado obtenido de una
conexión que falló la verificación. Una CA específica puede configurarse con
`sslrootcert` en la URL; la verificación del nombre del servidor sigue activa.
