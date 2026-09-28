# UI/UX review · 28 September 2026

## Scope

Reviewed all 25 page routes, shared navigation, themes, forms, loading, errors and not-found handling. The work preserves the warm paper, forest-green palette, Instrument Sans and neighborhood artwork described in [design.md](../design.md). No backend actions, database schema, authorization rules or dependencies changed.

| Area | Pages reviewed |
| --- | --- |
| Public | Home, privacy, not found, loading/error |
| Account | Login, registration, recovery, reset, admin invitation, profile |
| Onboarding | First review, Facebook registration and callback |
| Facebook information | Data explanation and deletion status |
| Reviews | Directory/search, record details, new review |
| Administration | Summary, review queue, all reviews, rejected reviews, counts by user, users, reports, migration, configuration |

## Improvements

| Area | Result |
| --- | --- |
| Homepage | Clear benefit-led title, full brand in the header, visible search label, access requirements before searching, readable explanation of the three-step journey. |
| Shared UI | Consistent spacing, focus treatment, control surfaces, footer navigation and semantic theme colors. Mobile navigation has a text label, selected-page treatment, outside-click/focus dismissal and bounded scrolling. |
| Account flows | Consistent access shell, two-step registration progress, clearer required fields and identity guidance, autofill-friendly inputs, separated Facebook/email choices and recovery links. |
| Profile and access | Anchor navigation for permission/reviews/security, readable long identity values and status cards, mobile statistic rows, clearer rejection reasons, useful error recovery. Pending access leads to existing reviews; inactive accounts do not receive review-creation actions. |
| Search and details | Better result hierarchy, deliberate empty/error states, retries, readable identity and rating summaries, explicit distinction between missing reviews and positive history. |
| Writing a review | Three numbered sections: person, rental start and story. Prefilled identity becomes a compact summary. Character requirements and anonymity guidance stay beside the comment. Existing action payload and error retention are preserved. |
| Reporting | A required unselected reason replaces a preselected allegation; clearer optional-detail guidance and comfortable controls. |
| Administration | Reusable headers/result counts/empty states, visible filter labels, reset actions, clearer moderation cards and decisions, persistent completion feedback and accessible field errors. |
| Admin workflows | Counts become mobile cards; author drill-down retains search/page context. Invitations move into a disclosure. Reports show selected periods. Migration actions follow a visible sequence and distinguish test/simulation/import progress. |
| Information and fallbacks | Privacy contents navigation; consistent Facebook information/callback screens; visible loading text and retry feedback. |

## Browser verification

Used the actual local Next.js application and the Codex browser. Protected components were inspected in temporary development-only fixtures containing clearly labeled invented data. Admin mutation controls were disabled; review submission used a fake action that returned a validation error. No accounts were created, emails sent, reviews published, permissions changed or database records modified.

Verified:

- Desktop at 1440px, tablet at 768px, mobile at 390px and 320px, with both light and dark themes.
- No page-level horizontal overflow on inspected public pages or search/review/admin/account fixtures. Long names and emails reflowed, and inspected form controls had associated labels.
- Registration at 320px retained 16px input text and readable two-step progress.
- Mobile menu Escape dismissal returned focus to its trigger.
- The skip link moved focus to `#contenido`.
- Profile anchors positioned their sections below the sticky header.
- Search, new-review, profile and administration authentication redirects retained the intended destination. Disabled Facebook registration returned to ordinary registration.
- A fake review validation response focused the invalid rental-start field and preserved the name, date, comment and anonymity choice.
- The reporting reason started empty and required an explicit selection.
- Missing ratings, long review text, empty results, moderation controls, invitation layout, pending access and inactive access were reviewed through source and/or component fixtures.
- No console warnings/errors were recorded during the inspected public route sweep.

The three temporary routes (`/ux-review-preview`, `/ux-admin-preview`, `/ux-account-preview`) were removed before the production build. The resulting route manifest contains no preview routes.

## Checks

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npx tsc --noEmit` | Passed |
| `npm test` | 81 tests passed |
| `npm run build` | Passed; all production routes compiled |
| `git diff --check` | Passed |

The tests needed local loopback access for their temporary TLS server. Turbopack initially cached a sandbox port-binding failure; its generated build cache was moved to a temporary backup, and a fresh build with the required local process access passed. No build configuration change was needed. The test runner still emits its existing module-type detection warning.

Screenshots are saved in the ignored `output/playwright/` directory:

- `ui-home-desktop.png`
- `ui-login-mobile.png`

## Limits

Authenticated live data and successful backend mutations were not exercised through the browser. Component fixtures verify presentation and selected interactions, not the entire authenticated backend. Reduced-motion rules were reviewed in source; a formal assistive-technology audit and usability study were not performed. This review does not claim full WCAG conformance. Form retention applies while the form remains mounted; it does not save a draft across navigation or reloads. Changes are local and have not been deployed.
