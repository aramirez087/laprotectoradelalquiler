# La Protectora del Alquiler · Design direction

The product should feel like a calm, carefully kept community record. Preserve the warm paper background, green accents, Instrument Sans typography, and neighborhood illustration. Clarity, readable content, and predictable actions are the source of its quality.

## Principles

1. **Make the next step obvious.** Each screen has one visible title and one primary task. Use explicit verbs: “Consultar fichas”, “Escribir reseña”, “Ver mis reseñas”.
2. **Explain access before asking for effort.** A visitor should understand that consulting requires an account and an approved review before beginning a search or registration.
3. **Protect the work someone has done.** Recoverable errors preserve entered values. Restore the intended destination after sign-in. Keep search filters when opening a record and returning to results.
4. **Reveal detail when it helps.** Account security settings should not compete with review status. Native disclosures are preferable to custom accordions.
5. **Describe experience precisely.** Reviews are community contributions, not objective determinations about a person. Distinguish review counts, moderation status, and missing information. Never imply that no reviews means a positive history.
6. **Respect privacy in presentation.** Search cards always mask documents. Existing server authorization determines full-document visibility on a detail page. Do not store review drafts or identity documents in browser storage.

## Visual foundation

Color values live in `app/globals.css`; components use semantic tokens.

| Token | Light | Dark | Purpose |
| --- | --- | --- | --- |
| `--paper` | `#faf9f5` | `#171a17` | Page background |
| `--card` | `#ffffff` | `#20251f` | Content surfaces |
| `--ink` | `#252b26` | `#f0f1e9` | Headings and body |
| `--ink-soft` | `#666b63` | `#b0b6a8` | Supporting text |
| `--line` | `#e3e5dc` | `#363d32` | Decorative separation |
| `--control-line` | `#8b9385` | `#77816f` | Input boundaries |
| `--seal` | `#385443` | `#b8ceb0` | Accent, links, focus |
| `--alerta` | `#8a5652` | `#e4b4ae` | Errors and consequential actions |

Keep decorative borders subtle. Input borders need enough contrast to identify the control. Core text tokens exceed 4.5:1 against both page and card backgrounds; control borders exceed 3:1 in both themes. These token checks are not a full accessibility certification.

- **Type:** Instrument Sans for all interface text; body 16px, supporting text 14px, metadata 12px. Headings normally 30–36px. Reserve the largest type for the homepage.
- **Width:** directory/admin surfaces up to 72rem; record details up to 56rem; long forms/profile up to 48rem; access forms up to 30rem including padding.
- **Space:** use the existing 4px-based scale. Fields generally have 16px gaps; sections 20–32px; page margins 16px on small screens and 24px above 640px.
- **Shape:** controls around 10px radius; cards 14–20px; pills only for short statuses, tags, and compact choices.
- **Depth:** borders do most of the work. Avoid adding large shadows or gradients to ordinary cards.
- **Motion:** brief state transitions. Only the sun and moon move in the homepage watercolor: a soft fade on arrival, then a shallow circular arc slowly following horizontal mouse movement. Ease velocity for gentle direction changes and cap travel at four degrees per second, even during fast pointer sweeps. Vertical mouse movement does not affect the path. Windows warm when the theme turns dark. Keep the neighborhood, text, and controls still, including on initial load. Use the existing artwork and native transforms, with no continuous animation loop; stop work when settled, offscreen, or hidden. Honor reduced motion across transitions, animations, pointer effects, and scrolling.

Place reusable layout defaults in Tailwind's `components` layer when utilities must override them. Unlayered `max-width`, padding, and display rules can silently defeat page-specific utilities.

## Navigation and responsive behavior

- Desktop navigation uses explicit destination names and `aria-current`.
- Below 1024px, the header contains the full brand and a labeled menu button. The menu contains navigation and appearance preferences, in that order, and scrolls within short viewports.
- Escape closes the mobile menu and returns focus to its trigger. Changing routes, clicking outside, or moving keyboard focus out of the header also closes it.
- Admin navigation scrolls horizontally within its own region on narrow screens; the page itself must not overflow.
- Search filters stack below 640px. Results wrap long names, review counts and dates without a separate rating column.
- Pagination shows previous/next and the current page on mobile; numbered links appear on larger screens.
- Check at 320px, 390px, 768px, and desktop widths. Check long names, long emails, empty results, anonymous authors, and long validation messages.

## Key journeys

### Visitor → account → access

The public homepage keeps the neighborhood illustration and presents two explicit choices: “Iniciar sesión” and “Registrarse”. State that accounts are exclusively for propietarios y agencias. After sign-in and approval, `/` remains the main search landing page with the neighborhood illustration, “Conozca mejor a su inquilino”, and one centered search field. Submitting a search opens results at `/fichas`. Default sign-in and the “Consultar reseñas” navigation link lead to `/`; preserve explicit destinations such as an existing search. Registration offers the two account roles, then leads to “Mi primera reseña”. Returning accounts without reviews resume that step; accounts that already submitted a review keep their review status and are not asked to submit it again. Accounts with a current consultation permit return to `/` from registration or first-review links. Use the server's current permission decision, not merely the existence of a published review, so expired access is handled correctly. A two-step progress indicator connects account creation and the first review. Registration's return-to-sign-in link keeps the intended destination.

Use `MarcoAcceso` for sign-in, registration, recovery, and reset screens. Successful registration/recovery replaces the input form with confirmation and a next step. Do not imply that a recovery email identifies whether an account exists.

### Writing a review

Use two numbered sections: person and experience. Mark required fields with `*`, and explain the notation before the form. An existing person's identity is a compact read-only summary, with the same submitted values as the editable flow. Keep the comment's 30-character minimum and 5,000-character limit visible. The current form collects identity, a written experience and the anonymity choice. Results, profiles, moderation cards and reports follow that same model; do not display ratings, rental dates, tags or structured rental details from older records. Historical data stays in the database for import compatibility.

Keep the anonymity option next to the comment so users understand what is hidden. The final action says “Enviar reseña a revisión” when moderation applies and “Publicar reseña” when publication is immediate; derive this from the same existing conditions as the server. If someone already reviewed the selected person, lead to their existing review. A failed or unavailable selected ficha must offer recovery instead of silently opening a blank identity form.

`useFormAction` keeps uncontrolled values through recoverable responses and includes the clicked submit button in `FormData`. Forms retain their action attribute for pre-hydration submission. Announce feedback and focus the first invalid field, falling back to the message. Password-change forms explicitly clear their fields on success. Do not reset a review on failure.

No draft is saved across a page reload or navigation. Only the current mounted form retains it; do not describe this as autosave.

### Waiting for access

- No review: explain the contribution requirement and offer the first review.
- In review: explain what happens next; lead to “Ver mis reseñas”. Do not encourage duplicate submissions.
- Rejected: lead to the reason in the profile, with writing another review secondary.
- Inactive: explain the restriction and lead to the profile; do not offer a form that cannot be submitted.

### Search → record → return

Use visible search/filter labels, a clear submit button, visible active filters, and a reset link. Show the result range and total. Cards display the full name, masked document, published-review count and last review date. Do not show location fields the current form does not collect. All of a card is one link.

A record has a clear back-to-results link preserving filters and page, including when returning from the review form. Its review action is explicit and leads to the existing review when someone has already contributed. Do not truncate the person's name at the point where someone needs to verify identity. Distinguish unavailable data from empty results.

Separate the identity and published-review summary on record details. Lead review cards with the contributor, date and their story. Preserve author anonymity, ownership and moderation status. Reporting starts with an unselected required reason; never preselect an allegation.

### Administration

Use the same controls and spacing. Prefer “Resumen”, “Reseñas”, and “Rechazadas” over ambiguous labels. Style publication as the primary action and rejection as consequential. Label the moderation note by its purpose. Preserve selected roles, checkbox values, notes, and the clicked decision across submissions. Clamp out-of-range result pages. Label exports with their format.

Use `CabeceraAdmin`, `ResultadosAdmin`, and `VacioAdmin` for consistent hierarchy and search feedback. User counts become cards on small screens and a table on desktop. Retain the original search and list page when opening an author's contributions. Keep invitations in a disclosure and explain destructive review controls where they are used. Successful moderation feedback must survive removal of its card.

## Accessibility contract

- Native buttons, links, labels, fieldsets, and disclosures first.
- One `h1` per screen; use headings for content groups.
- A working skip link and visible keyboard focus throughout.
- Form errors use text, `aria-invalid`, and `aria-describedby`; message regions use `alert` or `status`.
- Inputs use 16px text and approximately 48px height. Primary actions and standalone controls aim for at least 44px touch height.
- Selection must have a cue beyond color: native radio marks, checkmarks, or text.
- Sticky navigation must not obscure focused fields or anchor targets.
- Maintain language `es`, Spanish copy, and the respectful “usted” voice.
- Theme preferences remain server-readable to avoid a light/dark flash.
- Verify keyboard interactions, reduced motion, both themes, zoom/reflow, and screen-reader output before making a conformance claim.

## Change checklist

For each new surface, verify its first-use, loading, empty, populated, invalid, pending, success, and unavailable states where applicable. Confirm that someone can identify where they are, what they can do, what just happened, and how to recover. Do not add a dependency or client component for a pattern that native HTML and the existing styles already support.

See [the UX review record](docs/ux-review.md) for scope, evidence, and verification limits from the September 2026 review. Reference guidance: [React forms](https://react.dev/reference/react-dom/components/form), [WCAG 2.2 quick reference](https://www.w3.org/WAI/WCAG22/quickref/), and the installed Next.js guides in `node_modules/next/dist/docs/`.
