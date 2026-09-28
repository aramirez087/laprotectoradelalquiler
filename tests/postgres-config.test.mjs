import assert from 'node:assert/strict';
import { execFile } from 'node:child_process';
import { X509Certificate } from 'node:crypto';
import { once } from 'node:events';
import { mkdtemp, readFile, rm } from 'node:fs/promises';
import os from 'node:os';
import path from 'node:path';
import tls from 'node:tls';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';
import test from 'node:test';
import pg from 'pg';
import { configuracionPostgres } from '../scripts/postgres-config.mjs';

const exec = promisify(execFile);
const caPath = fileURLToPath(new URL('../scripts/certs/supabase-prod-ca-2021.crt', import.meta.url));
const ca = await readFile(caPath, 'utf8');
const parametros = (url, env = {}) => new pg.Client(configuracionPostgres(url, env)).connectionParameters;

test('Supabase URLs use the bundled CA and full verification in the actual pg driver', () => {
  for (const host of ['db.example.supabase.co', 'aws-0-example.pooler.supabase.com']) {
    for (const query of ['', '?sslmode=require', '?sslmode=verify-ca', '?sslmode=no-verify', '?sslmode=disable&ssl=0', '?sslmode=require&uselibpqcompat=true']) {
      const config = parametros(`postgres://test:dummy@${host}:5432/postgres${query}`);
      assert.equal(config.ssl.ca, ca);
      assert.equal(config.ssl.rejectUnauthorized, true);
      assert.equal(typeof config.ssl.checkServerIdentity, 'function', 'Node must verify the server hostname');
    }
  }
  const cert = new X509Certificate(ca);
  assert.equal(cert.ca, true);
  assert.equal(cert.verify(cert.publicKey), true);
  assert.ok(Date.parse(cert.validTo) > Date.now(), 'renew the bundled CA before it expires');
});

test('normalization preserves encoded credentials, database, port and non-TLS options', () => {
  const password = 'p@ss:/?#%&+= word';
  const url = new URL(`postgresql://test:${encodeURIComponent(password)}@db.example.supabase.co:6543/postgres`);
  url.searchParams.set('application_name', 'legacy import');
  url.searchParams.set('options', '-c statement_timeout=60000');
  url.searchParams.set('sslmode', 'require');
  const config = parametros(url.toString());
  assert.equal(config.password, password);
  assert.equal(config.user, 'test');
  assert.equal(config.database, 'postgres');
  assert.equal(config.port, 6543);
  assert.equal(config.application_name, 'legacy import');
  assert.equal(config.options, '-c statement_timeout=60000');
});

test('trust is scoped to the effective Supabase hostname, never a substring of credentials or URLs', () => {
  for (const url of [
    'postgres://supabase.co:dummy@db.example.test/postgres',
    'postgres://test:dummy@db.supabase.co.example.test/postgres',
    'postgres://test:dummy@db.example.supabase.co/postgres?host=db.example.test',
    'postgres://test:dummy@db.example.test/postgres?host=db.example.supabase.co&host=db.example.test',
  ]) {
    const config = parametros(url);
    assert.equal(config.ssl.ca, undefined, 'other providers retain the system trust store');
    assert.notEqual(config.ssl.rejectUnauthorized, false);
  }
  assert.equal(parametros('postgres://test:dummy@db.example.test/postgres?host=aws-0-example.pooler.supabase.com').ssl.ca, ca);
});

test('local Postgres can explicitly disable TLS, even when the URL asks for require', () => {
  for (const host of ['localhost', '127.0.0.1', '[::1]']) {
    assert.equal(parametros(`postgres://test:dummy@${host}/postgres?sslmode=require`, { DATABASE_SSL: 'false' }).ssl, false);
  }
  for (const url of [
    'postgres://test:dummy@db.example.supabase.co/postgres',
    'postgres://test:dummy@localhost/postgres?host=db.example.test',
  ]) {
    assert.throws(() => parametros(url, { DATABASE_SSL: 'false' }), /solo se permite para Postgres local/);
  }
});

test('invalid connection URLs do not expose credentials', () => {
  const password = 'do-not-print-this';
  for (const url of [`postgres://user:${password}@host:invalid/db`, `https://user:${password}@example.test/db`]) {
    assert.throws(() => configuracionPostgres(url), (error) => {
      assert.match(error.message, /no es válida/);
      assert.equal(error.message.includes(password), false);
      assert.equal(error.input, undefined);
      return true;
    });
  }
});

test('pg connects with a trusted CA and rejects untrusted certificates and wrong hostnames', { timeout: 15000 }, async (t) => {
  const dir = await mkdtemp(path.join(os.tmpdir(), 'postgres-tls-test-'));
  t.after(() => rm(dir, { recursive: true, force: true }));
  const keyFile = path.join(dir, 'server.key');
  const certFile = path.join(dir, 'server.crt');
  // Only synthetic, disposable credentials; no .env or live database is used.
  await exec('openssl', ['req', '-x509', '-newkey', 'rsa:2048', '-nodes', '-days', '1',
    '-subj', '/CN=localhost', '-addext', 'subjectAltName=DNS:localhost', '-addext', 'basicConstraints=critical,CA:TRUE',
    '-keyout', keyFile, '-out', certFile]);
  const key = await readFile(keyFile);
  const cert = await readFile(certFile);
  const sockets = new Set();
  const server = tls.createServer({ key, cert }, (socket) => {
    socket.once('data', () => {
      // Minimal Postgres startup response: AuthenticationOk + ReadyForQuery.
      socket.write(Buffer.from('5200000008000000005a0000000549', 'hex'));
      socket.once('data', () => socket.end());
    });
  });
  server.on('connection', (socket) => {
    sockets.add(socket);
    socket.on('error', () => {});
    socket.on('close', () => sockets.delete(socket));
  });
  t.after(async () => {
    for (const socket of sockets) socket.destroy();
    await new Promise((resolve) => server.close(resolve));
  });
  server.listen(0, '127.0.0.1');
  await once(server, 'listening');
  const port = server.address().port;
  const client = (host, trusted) => {
    const url = new URL(`postgres://test:dummy@${host}:${port}/postgres?sslmode=require&uselibpqcompat=true&sslnegotiation=direct`);
    if (trusted) url.searchParams.set('sslrootcert', certFile);
    return new pg.Client({ ...configuracionPostgres(url.toString(), {}), connectionTimeoutMillis: 2000 });
  };
  await t.test('an explicit CA survives URL normalization and completes the TLS handshake', async () => {
    const db = client('localhost', true);
    try {
      await db.connect();
      assert.equal(db.connection.stream.authorized, true);
    } finally { await db.end(); }
  });
  await t.test('an unknown CA is rejected even with libpq compatibility requested', async () => {
    const db = client('localhost', false);
    try { await assert.rejects(db.connect(), { code: 'DEPTH_ZERO_SELF_SIGNED_CERT' }); }
    finally { await db.end(); }
  });
  await t.test('a trusted certificate for a different hostname is rejected', async () => {
    const db = client('127.0.0.1', true);
    try { await assert.rejects(db.connect(), { code: 'ERR_TLS_CERT_ALTNAME_INVALID' }); }
    finally { await db.end(); }
  });
});
