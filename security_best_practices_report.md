# Supabase security review

Reviewed September 29, 2026. Scope: the Supabase database configured in this checkout, its anonymous Data API, public Auth settings, and the application's Supabase access code. The initial audit ran remote queries in READ ONLY transactions and made no changes. The subsequently authorized, additive security migration changed policies, grants, and triggers without deleting records. Credentials and personal records are excluded from this report.

## Remediation status — September 29, 2026

- **Applied and verified in live Supabase:** column allowlists for reviews/reports, no direct person INSERT, report-target visibility in RLS, validation triggers, removal of unused table privileges, and opt-in grants for future application objects created by `postgres`.
- **Applied and verified in live Supabase:** an Auth confirmation trigger creates an ordinary profile and its Facebook reference atomically only after email confirmation; administrative roles are rejected.
- **Implemented in application source:** public `signUp` replaces automatic administrative confirmation and waits for the confirmation email. Registration UI reflects this extra step, and the privileged client is explicitly server-only. **Deployed to production:** Vercel reports READY and has aliased the deployment to https://www.protectoradelalquiler.com. Existing users are not retroactively deverified.
- **Provider limitation:** `postgres` cannot alter defaults owned by the protected `supabase_admin` role. Those defaults still need provider review; application migrations use the secured `postgres` defaults.
- **Upgrade pending availability:** the actual configured project (`lqbsuawemfhqwvomputz`) reports 17.6.1.166 and offers only 17.6.1.171 in the dashboard's upgrade selector. 17.11 is not offered. No unrelated upgrade or database restart was initiated.
- **Additional Advisor warning:** a refreshed Security Advisor run reports zero errors and one warning: leaked-password protection disabled. The Email settings panel says that protection is available only on Pro and above; the current organization is Free. No paid plan was activated.

Validation: all 199 existing tests passed; the isolated database integration test passed, covering unverified/verified signup, forged admin metadata, valid and forged report/review writes, hidden review targets, migration idempotence, and future-object grants. TypeScript passed. ESLint has zero errors and two pre-existing unused-variable warnings. Local production compilation passed using Webpack; the standard Turbopack production build also passed on Vercel. The preview is READY at https://laprotectoradelalquiler-8k4zgejxa.vercel.app. The user subsequently approved production deployment; deployment `dpl_BFrNV1w3eouxAJDXGaXc3qDLrinL` is READY with the production domain assigned. Turbopack's local CSS worker is blocked from binding a port in this execution environment. Live catalog assertions confirmed the new permissions and triggers without creating test users or sending email.

## Executive summary

Four findings need attention: registration bypasses email ownership verification, PostgreSQL is behind the newly announced security release, authenticated INSERT privileges allow clients to supply internal fields, and default grants broadly expose future database objects. No critical anonymous data exposure or publicly executable privileged administrative function was identified in the inspected application schemas.

## High priority

### 1. Registration marks arbitrary email addresses as verified

Evidence: `lib/actions/auth.ts:116–120` calls the privileged `auth.admin.createUser` API with a user-supplied email/password and `email_confirm: true`. Lines 161–167 also force confirmation if password sign-in reports an unconfirmed email. The live `/auth/v1/settings` endpoint returned `mailer_autoconfirm: false`, so the project requires confirmation for ordinary Auth signup, but this application path bypasses it.

Impact: someone can register an available email address belonging to another person and immediately authenticate with their own chosen password. This permits identity impersonation and prevents the email owner from registering normally. It does not by itself take over an existing account or grant an administrative role. The registration path also has no application-level rate limit or CAPTCHA visible in the reviewed code; infrastructure protections were not verified.

Recommendation: use a signup/confirmation flow that proves control of the email before activating the application profile. Do not force confirmation from an unauthenticated registration action. Add abuse controls to that action, especially while it uses the administrative Auth API.

### 2. Live PostgreSQL version predates the current security rollout

Evidence: `current_setting('server_version')` returned **17.6**. Supabase's September 25 announcement describes the rollout from 17.6 to 17.11, bundling five upstream security cycles and fixes for 44 CVEs, including high-severity issues. This is an outstanding patch review, not proof that all 44 vulnerabilities are exploitable through this application.

Recommendation: inspect upgrade availability and the provider's maintenance schedule, then plan the supported upgrade with backup and compatibility checks. Do not run the application's destructive schema reset as an upgrade mechanism.

`pgcrypto` 1.3 is installed; `ltree` and `btree_gist` are not installed. No legacy PGP cipher use was identified in the reviewed application source, but encrypted database contents were not inspected. Review the provider's compatibility guidance before upgrading.

Source: [Supabase PostgreSQL security release announcement](https://supabase.com/changelog/postgres-15-19-17-11-breaking-changes).

## Medium priority

### 3. Direct authenticated inserts bypass application field restrictions

Evidence: the live database grants table-wide INSERT to `authenticated` on `personas`, `resenas`, and `denuncias`. Corresponding source: `schema.sql:435–439`, `schema.sql:462–480`, and `schema.sql:487–494`. The deployed policies verify session/ownership/access and restrict ordinary reviews to `borrador`, but do not validate all submitted fields.

- Reviews: clients can supply `verificada`, `detalle_verificacion`, `fuente`, `id_fuente`, timestamps, and arbitrary comment lengths. An ordinary user cannot directly publish through this policy, but can submit forged verification/provenance values in a draft; these can survive a later approval. The first-approval timestamp has its own protective trigger.
- Reports: a user with consultation access can supply `estado = 'aceptada'` or `'rechazada'` and `resuelta_en` on their own new report. They can also reference a review without the application's visibility check. No report-validation trigger exists in the live database. This fabricates resolution metadata; it does not directly change the review's moderation state.
- People: any active session can create person records independently of a review and bypass the application's document/name validation. The only non-internal live trigger on this table builds its search vector.

Impact: calling Supabase directly bypasses the validation in `lib/actions/resenas.ts` and `lib/actions/denuncias.ts`, allowing data poisoning, forged internal metadata, and unbounded submissions. Findings are established from deployed grants, policy expressions, and trigger definitions; no exploit inserts were performed.

Recommendation: replace table-wide INSERT with explicit allowed-column grants, revoke existing table and column privileges carefully, and enforce moderation/provenance defaults in the database. Consider revoking direct person/review INSERT if the intended path is exclusively through the checked server implementation. Retain narrowly scoped report insertion and validate that the target review is accessible. Add database constraints for required content and size limits.

### 4. Future public objects inherit broad API-role grants

Evidence: live `pg_default_acl` entries for objects created by `postgres` and `supabase_admin` in `public` grant `anon` and `authenticated` broad table privileges and function EXECUTE. Existing application objects have been explicitly restricted, but future objects will inherit these defaults unless their creation scripts revoke them. Several existing catalog/core tables also retain unnecessary REFERENCES/TRIGGER grants for `authenticated`; neither API role has CREATE on `public` or `privado`, and no immediate exploit through those privileges was demonstrated.

Impact: a new table without RLS or a new privileged function without an explicit EXECUTE revocation could become publicly reachable. This is a deployment guardrail gap, not evidence of a current anonymous leak.

Recommendation: make new public-object access opt-in through default-privilege changes for relevant creator roles, and bundle explicit grants and RLS with each migration. Revoke unused privileges on application tables. Avoid altering provider-managed schemas indiscriminately.

Source: [Supabase Data API security guidance](https://supabase.com/docs/guides/api/securing-your-api).

## Confirmed protections

- Every inspected application table in `public` and `privado` has RLS enabled. Inspected Storage tables also have RLS enabled.
- No application table/column privileges for `anon` were found in `public` or `privado`.
- Anonymous requests selecting `personas.identificacion`, `usuarios.email`, and `resenas.autor_id` with `limit=0` returned HTTP 401 / PostgreSQL code `42501`. No personal rows were retrieved.
- No application function in the inspected schemas grants EXECUTE to `anon`. Administrative review/user/invitation functions deny EXECUTE to `authenticated` as well.
- Sensitive identity/email columns and review authorship are excluded from authenticated SELECT grants.
- Consultation access is enforced in deployed RLS, and deployed session helpers check membership in `auth.sessions` to reject revoked sessions.
- Neither `anon` nor `authenticated` can CREATE objects in `public` or `privado`.
- Storage currently contains no buckets.
- Secret/service credentials use server environment variables; the browser client uses the public key. `.env.local` is ignored and is not tracked in the current Git index. The privileged client module lacks an explicit `server-only` import; adding one is useful defense in depth, although no current client import was identified.
- Database connection configuration verifies TLS certificates and hostnames (`scripts/postgres-config.mjs:29–40`).

## Limits and suggested next checks

This was a live catalog/API and source review with a subsequent refreshed Supabase Security Advisor run, not a penetration test. No authenticated exploit writes were made. Leaked-password protection was subsequently checked in the dashboard, as recorded above. Auth CAPTCHA configuration, MFA requirements, network restrictions, SSL enforcement for other clients, JWT lifetime, backup restore readiness, and Edge Functions configuration remain unverified. Public Auth settings confirmed that anonymous sign-ins are disabled, email confirmation is normally required, and ordinary signup is enabled.

Git history, deployed JavaScript bundles, dependency advisories, WAF rules, and provider-managed SQL internals were not exhaustively audited. Run Security Advisor and review these management settings before treating this as a comprehensive security clearance.
