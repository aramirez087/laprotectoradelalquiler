# User administration review · 29 September 2026

The original audit identified ten defects in user administration and several missing workflows. The corrections below are implemented in the workspace. The findings that follow preserve the original audit as a historical reference; their source line numbers describe the code before these changes.

## Implemented corrections

- Administration is granted through mailbox-verified invitation acceptance for both new and existing accounts. Acceptance verifies the identity and current session, changes the password, closes other sessions, and atomically checks the target's revision and inviting administrator. Generic permission editing cannot elevate an account.
- Database operations serialize privileged changes, recheck the actor, reject stale revisions, prevent self-removal and preserve an active administrator. Historical inquilino roles can be retained during activation changes.
- Revoked sessions cannot inherit the newly linked account's access through the application or direct authenticated database policies. This protection covers both administration and ordinary login invitations.
- Literal searches support punctuation and one-character terms. Out-of-range API responses recover the filtered count before redirecting to a valid page. Role, status, login and account-type filters survive drill-down and return navigation.
- Account details include safe name/document/phone correction, review links and the last 20 immutable administration records, with actor, time and before/after values. Email remains tied to the existing identity and cannot be overwritten by this editor.
- Invitation management shows pending, accepted, expired and revoked links, purpose, sender, expiry and delivery status. Cancellation and renewal are explicit; a mailbox issuance lease prevents competing Auth token generation from overwriting the usable link.
- The UI puts the account list before invitation management, collapses optional summaries and permission editors, confirms consequential changes, disables pending controls, preserves drafts and exposes stale-data recovery. Unsaved drafts survive Back/Forward navigation within administration in memory and are cleared when that administration session ends; they are not retained across a full reload. Feedback survives disappearing rows and restores focus to a stable destination.
- Migration flags are validated before loading credentials or connecting, so misspelled additive options cannot fall through to a schema reset.

## Rollout

For an existing database, run `npm run db:admin-usuarios` against the intended environment before deploying the application. This additive command applies `administrar-usuarios.sql`, `invitaciones-admin.sql` and `sesiones-admin.sql`, in that order, preserving existing data. `schema.sql` contains the same migrations for fresh installations. The database role running migrations must be able to create the session helper that reads `auth.sessions`.

Do not use the full `db:aplicar` command to upgrade an existing database: it installs the complete fresh schema. No production migration, account change, email or deployment was performed during this implementation.

An authenticated staging walkthrough remains necessary to verify the project's actual Supabase Auth token expiry, OTP acceptance and email delivery configuration. The local browser fixture uses the real React components and synthetic actions; provider calls in unit tests are mocked. Account deletion/anonymization, MFA and an ownership-safe email-change workflow remain separate product decisions.

## Implementation verification

- `npm test`: 176 passed, zero failures.
- Disposable PostgreSQL/PostgREST and production trace tests: 79 passed across users (11), invitations (16), literal search/range recovery (4), consultation access (20), review administration (10), legacy import (17) and import bundle (1). Synthetic databases and networks were cleaned up.
- `npm run lint`, `npx tsc --noEmit` and the default `npm run build`: passed. The default build was retried after clearing a cached local sandbox worker failure; Webpack also passed.
- Hydrated browser checks: permission confirmation/cancellation, disabled controls while pending, feedback after active filtering removes a row, stale profile drafts after permission edits, navigation protection, Back/Forward draft restoration and recoverable-error retention. Reflow at 320, 390, 768 and 1440px, light/dark appearance, keyboard focus and invitation purpose were checked with invented accounts; no page-level horizontal overflow was observed.

## Original audit findings

1. **P1 — Elevating an existing account does not establish email ownership.** `lib/actions/auth.ts:116` creates public signup identities with `email_confirm: true`. `lib/admin.ts:515` then grants administration directly to the existing account, and `lib/invitaciones-admin.ts:25` tells administrators to take this path when an email already exists. A person can register with somebody else's email; if an administrator later promotes that record based on its email, the original registrant receives administrative access. This requires an administrator's mistaken promotion; it is not an unauthenticated self-promotion bug. Require a secure acceptance/ownership-verification step for existing-user elevation. The current confirmation flag is not independent evidence of mailbox ownership. Supabase documents [automatic confirmation through createUser](https://supabase.com/docs/reference/javascript/auth-admin-createuser).

2. **P1 — Stale permission edits can restore revoked access.** `lib/admin.ts:513` updates both role and activation with only an ID predicate. If administrator A suspends a user while administrator B has the old form open, B's later role change submits the old `activo: true` and reactivates the user. The reverse can restore a revoked administrator role. Reproduced using the actual function and installed query builder in an isolated harness. Require an expected revision/original state and reject conflicting edits. Prefer explicit operations over resubmitting unrelated permission fields.

3. **P1 — Concurrent administrator changes can leave no active administrator.** `lib/admin.ts:510` prevents self-demotion, but the privileged write has no atomic last-administrator invariant or authorization recheck inside the write transaction. Two administrators can pass authorization and demote one another concurrently. An isolated harness executing the actual function allowed both operations and ended with zero active administrators. Serialize privileged account changes, recheck the actor and preserve at least one active administrator in the database operation.

4. **P2 — Successful edits lose their confirmation and focus target.** `app/admin/usuarios/page.tsx:170` keys `FormUsuario` by role and activation. `lib/actions/admin.ts:166` revalidates the route, replacing that keyed form after a real change. Its local success state is discarded; filtering to active users can remove the entire changed card. `components/admin-formularios.tsx:234` does not use the persistent `AvisosAdmin` mechanism already used elsewhere. Publish a named confirmation outside the edited row and restore focus predictably. This finding is based on source and the installed Next.js single-response revalidation behavior; a successful authenticated browser mutation was not exercised.

5. **P2 — Pagination recovery fails when the API rejects an out-of-range page.** `lib/admin.ts:478` requests an exact count and range, then throws on the API error at line 481. `app/admin/usuarios/page.tsx:52` only redirects if no error occurred. On a real disposable PostgREST 14.2 server with 25 synthetic rows, offset 160 returned HTTP 416 / `PGRST103`; the installed client returned `data: null` and `count: null`. An old bookmark or removing the last matching row on a filtered page therefore produces an error rather than a valid page. Recover the filtered count and clamp/refetch the page. Existing page tests mock a successful response and miss this branch. See the [PostgREST error reference](https://docs.postgrest.org/en/v14/references/errors.html).

6. **P2 — Email matching has two distinct correctness bugs.** `lib/admin.ts:134` replaces underscores with spaces, so searching `ana_maria@example.com` sends a query for `ana maria@example.com`. Separately, `lib/invitaciones-admin.ts:23` uses unescaped `ilike` for an exact email check. On the disposable REST server, an existing `axb@example.com` falsely blocked an invitation for `a_b@example.com`; the actual invitation function returned “Ese correo ya tiene cuenta.” Preserve literal punctuation in search and use a normalized exact email comparison for identity checks.

7. **P2 — Legacy activation changes require an unrelated role conversion.** `components/admin-formularios.tsx:244` renders a required empty role selection for `inquilino`; `lib/actions/admin.ts:19` also rejects that current role. An administrator cannot deactivate such a profile while preserving its role. The browser fixture confirmed the untouched role control is invalid. Allow activation-only changes independently of role migration, or explicitly offer a separate migration flow.

8. **P2 — Consequential changes lack a clear review step.** `components/admin-formularios.tsx:244` and line 254 allow elevation, administrator removal and suspension through the generic “Guardar permisos” action. There is no recipient-specific before/after confirmation or explanation of the resulting access. The inputs also remain editable while saving, although the submit button is disabled; edits made during a slow request can disappear on revalidation. Confirm consequential changes with the person's name and exact effect, disable the relevant controls while pending, and provide clear success/error recovery.

9. **P2 — One-character searches are displayed as applied but ignored.** `app/admin/usuarios/page.tsx:103` accepts any search length and shows the term in the active-filter summary. `lib/admin.ts:469` silently skips searches shorter than two characters. Either support those queries or explain and enforce the minimum without claiming the query was applied.

10. **P3 — The invitation disclosure does not look expandable.** `app/admin/usuarios/page.tsx:96` uses `.denuncia summary`, whose styling at `app/globals.css:461` removes the marker without adding a replacement indicator. Browser inspection confirmed that it resembles ordinary muted text in a large card. Keep a visible expansion indicator and a clearer invitation action. Keyboard expansion and focus styling do work.

## Completeness

| Workflow | Current behavior | Remaining work |
| --- | --- | --- |
| Find accounts | Search, account type, activation and login filters; server pagination | Fix literal email search and range recovery; add a role filter so administrators can be enumerated directly. |
| Understand access | Separate account, login and consultation states with explanatory text | Make unresolved states actionable and distinguish unavailable checks from denied permission. |
| Provision missing login | Users shows “Sin crear”; registration and admin invitation reject existing profile emails | Link to the existing repair workflow and provide appropriate per-user guidance. A bulk provisioning operation already exists (`npm run db:migrar -- --solo-accesos --crear-accounts`, `scripts/migrar-legacy.mjs`), requiring the original MySQL connection; this is not a claim that no provisioning tool exists. |
| Manage invitations | Generate/renew, optional email, secure single-use acceptance | Add pending/accepted/expired/revoked visibility, cancellation, sender/time/expiry information and a renewal action. Pending invitations are absent from the user list because the profile is created on acceptance. |
| Change permissions | Active-admin checks, self-demotion guard, role/activation editing | Fix stale updates and concurrency, verify elevation, explain consequences and persist feedback. |
| Review a user's activity | Separate “Por usuario” screen already supports author drill-down | Add a direct “Ver reseñas” link from each account to `/admin/conteo?autor=<id>`, preserving return context. |
| Investigate changes | Latest role, activation and modification timestamp | Add actor, target, before/after, time and reason for privileged changes. `schema.sql:277` defines a session log, not a permission audit log. |
| Correct account details | Name/email/identification/phone shown on cards | Decide which fields administrators may correct and implement validated changes; email changes need an ownership-safe Auth/profile synchronization flow. |

Session revocation, elevated authentication for sensitive operations, and a governed account removal/anonymization workflow are additional product decisions. They were not classified as existing defects merely because their controls are absent. Bulk permission editing should follow, not precede, reliable single-account safeguards.

## UI/UX direction

Preserve the existing warm background, green accents, Spanish copy, readable controls and three distinct access states. A visual redesign alone would not resolve the workflow problems.

- Put search and the account list closer to the top. In the 390px component preview, the first account began approximately 1,442px below the top, excluding the global site header. The first sample card was about 633px tall. Summary explanations, tabs and the invitation block consume nearly two screens before the core task. These measurements used the actual page markup and current CSS with invented data and fallback system typography; deployed dimensions may differ.
- Make the summary compact or expandable, especially on mobile. Consider useful count shortcuts to filtered results while keeping global counts clearly labeled.
- Use a compact desktop table or rows for comparison, with a deliberate edit action. Keep mobile cards, but summarize status before expanding account details and controls.
- Give invitations a visible action and a manageable list. Display the applicable expiry information and state explicitly when regenerating a link invalidates the previous one.
- Give repeated account actions an accessible association with the account's name. Add changed-state indication and cancel/reset for edits; retain values after recoverable errors.
- After a mutation, announce what changed and for whom even if a filter removes the row. Move focus to a stable result or next relevant action.

The review used the [Web Interface Guidelines](https://raw.githubusercontent.com/vercel-labs/web-interface-guidelines/main/command.md), the local accessibility skill and the project's `design.md`.

## Original audit verification and limits

| Check | Result |
| --- | --- |
| `npm test` | 141 passed, 0 failed. |
| `npm run test:invitaciones-admin` | 7 passed, 0 failed, using disposable PostgreSQL. |
| `npm run lint` | Passed. |
| `npx tsc --noEmit` | Passed. |
| Concurrency/stale-edit harnesses | Executed actual functions with isolated synthetic state; exposed permission races. |
| PostgREST 14.2 + PostgreSQL 16 probes | Real local HTTP reproduction of pagination 416 and invitation wildcard collision; containers/network cleaned up. |
| Component browser inspection | Actual source-rendered page/components and freshly generated CSS; invented accounts; submission disabled; 1440px and 390px light, 320px light/dark; invitation keyboard expansion and visible focus verified. |

The inspected controls had associated labels and text inputs/selects used 16px text. Long sample names/emails reflowed; no page-level horizontal overflow was observed in the 320px/390px measurements. Native controls, status labels, URL-preserved filters, stable sorting, empty states and the existing focus/theme/reduced-motion styles are strengths.

The browser preview was a static component fixture, not a logged-in production session. It did not verify hydration, live form mutation success, deployment configuration, production Auth settings, every screen-reader interaction or full WCAG conformance. No production data was used in the preview or test probes. The preview server was stopped and its browser viewport restored.

Acceptance should include regression coverage for concurrent permission edits, stale suspensions, last-administrator preservation, existing-account elevation, literal email matching, real out-of-range API responses, legacy activation-only changes, invitation revocation and success feedback after the edited row disappears. Complete an authenticated staging walkthrough on desktop and mobile after implementing those changes.
