# UI/UX review · September 2026

## Scope

Reviewed the source for the homepage, navigation and themes, sign-in, registration, recovery, password reset, directory/search, record details, review creation, profile, access states, reporting, all administration screens, pagination, loading, errors, and not-found handling. The work focuses on interface behavior, accessibility, and visual consistency. It retains the existing minimalist identity and data-access model.

## Findings and changes

| Finding | Change |
| --- | --- |
| Server-side authentication fallbacks on some protected pages defaulted to the directory | Review creation, record details, and profile supply their actual return destinations. Record filters and page survive sign-in. |
| Recoverable server-action responses reset uncontrolled fields | Shared submission hook retains entered data, includes the clicked decision, announces feedback, and focuses errors. Password changes reset only after success. |
| The long review form presented every detail at once | Three numbered sections, clear required/optional fields, labeled rating endpoints, optional-details disclosure, comment counter, explicit submission outcome. |
| A pending contributor was encouraged to write another review | Distinct first-review, pending, rejected, and inactive states with appropriate next actions. |
| Directory title was hidden and mobile search crowded | Visible heading, explanatory text, labeled stacked filters, filter reset, readable result cards, masked identifiers, and helpful empty state. |
| Read-only identity information was truncated on detail/profile screens | Names wrap and supporting metadata remains readable. |
| Account flows were visually disconnected and confirmation left forms available | Consistent access shell and dedicated success guidance for registration, recovery, and reports. |
| Global CSS overrode utility widths and input padding | Reusable defaults moved to the component layer, restoring intended content widths and room for input icons/password controls. |
| Input boundaries and some targets were too subtle/small | Separate contrast-tested control-border token, larger targets, consistent focus spacing, and comprehensive reduced-motion rules. |
| Appearance controls crowded the mobile header | Appearance preferences moved into the mobile navigation panel; brand and menu remain visible. |
| Admin labels, export wording, pagination, and moderation controls were inconsistent | Explicit labels, active navigation semantics, purposeful notes, differentiated decisions, CSV label, overflow-safe navigation/table, and page clamping. |

## Verification

Browser checks use the actual local application for public flows and temporary development-only fixtures for authenticated components. Fixtures contain only invented examples and fake submission actions; they do not create accounts or publish reviews, change roles, resolve reports, or write to the database. Temporary routes are removed before final validation.

Verified interactively:

- Desktop, 768px tablet, and 320px/390px mobile layouts, light and dark themes. The 320px and 768px sweep covered eight public/fixture screens with no page overflow or unlabeled fields.
- Mobile menu open/close and Escape returning focus to the menu button.
- Registration labels and role descriptions; no duplicate input IDs or unlabeled fields on the inspected form.
- New-review and record-detail redirects preserve their destination, filters, and page; registration's sign-in link keeps the return destination.
- Review errors retain identity fields, selected rating/tags, dates, optional selections, and comments.
- A date error inside a closed disclosure opens the disclosure and focuses the invalid field.
- Local success feedback is announced and focused.
- Submission includes the clicked moderation decision and preserves the selected role, checkbox state, and note on repeated actions.
- Search-card names wrap, document values remain masked, and ratings remain legible on narrow screens.
- Core text contrast is at least 5.18:1 in light mode and 7.51:1 in dark mode against page/card surfaces. Input border contrast is at least 3.02:1 and 3.83:1 respectively.

Final validation:

| Check | Result |
| --- | --- |
| `npm run lint` | Passed |
| `npm test` | 4 tests passed, including masked document regression coverage |
| `npx tsc --noEmit` | Passed |
| `npm run build` | Passed; all application routes compiled, no preview route included |
| `git diff --check` | Passed |
| Fresh browser session | No console errors or warnings during sign-in → registration navigation |
| Temporary test route | Returns the normal not-found screen after removal |
| Skip navigation | Keyboard activation focuses `#contenido` |
| Password form with fake local action | Show/hide works; password fields clear on success |

The Next.js smooth-scroll warning was resolved using the installed version's documented `data-scroll-behavior` attribute. The Node test runner still emits the pre-existing module-type detection warning; all tests pass.

Local screenshots were saved under `output/playwright/`: `home-desktop.png`, `search-desktop.png` (clearly labeled fixture data), and `login-mobile.png`. This directory is already ignored by Git. No runtime dependencies were added.

## Limits

Live authenticated data retrieval, account creation, email delivery, password changes, publication, and moderation were not exercised against the connected backend. Their existing integration paths remain in place. Component fixtures establish interface behavior, not end-to-end backend correctness. No formal assistive-technology audit or usability study was performed, and this review does not claim full WCAG conformance. Draft retention applies to a mounted form after recoverable errors, not to reloads or navigation.
