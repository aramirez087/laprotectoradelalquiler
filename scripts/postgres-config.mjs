import { readFileSync } from 'node:fs';
import { checkServerIdentity } from 'node:tls';

// pg da prioridad a los parámetros de la URL sobre su opción `ssl`.
// Separarlos evita perder la CA o desactivar la verificación al parsear la URL.
export function configuracionPostgres(connectionString, env = process.env) {
  let url;
  try {
    url = new URL(connectionString);
    if (!['postgres:', 'postgresql:'].includes(url.protocol) || !url.hostname) throw new Error();
  } catch {
    // No propagar el error de URL: puede incluir la contraseña del destino.
    throw new Error('La URL de conexión a Postgres no es válida.');
  }

  // pg acepta un host en la query y usa el último valor si está repetido.
  const parametros = Object.fromEntries(url.searchParams);
  const host = (parametros.host || url.hostname).toLowerCase().replace(/^\[|\]$/g, '');
  const local = ['localhost', '127.0.0.1', '::1'].includes(host);
  const supabase = host.endsWith('.supabase.co') || host.endsWith('.pooler.supabase.com');

  // Incluso sslnegotiation=direct hace que pg sustituya el objeto ssl.
  for (const key of ['ssl', 'sslmode', 'uselibpqcompat', 'sslrootcert', 'sslcert', 'sslkey', 'sslnegotiation']) {
    url.searchParams.delete(key);
  }
  let ssl = false;
  if (env.DATABASE_SSL === 'false') {
    if (!local) throw new Error('DATABASE_SSL=false solo se permite para Postgres local.');
  } else {
    ssl = {
      rejectUnauthorized: true,
      // Verificar el host efectivo también cuando es una IP (pg omite su SNI).
      checkServerIdentity: (_servername, cert) => checkServerIdentity(host, cert),
    };
    if (parametros.sslrootcert) {
      ssl.ca = readFileSync(parametros.sslrootcert, 'utf8');
    } else if (supabase) {
      ssl.ca = readFileSync(new URL('./certs/supabase-prod-ca-2021.crt', import.meta.url), 'utf8');
    }
    if (parametros.sslcert) ssl.cert = readFileSync(parametros.sslcert, 'utf8');
    if (parametros.sslkey) ssl.key = readFileSync(parametros.sslkey, 'utf8');
  }

  return { connectionString: url.toString(), ssl, sslnegotiation: parametros.sslnegotiation };
}
