# Infografías de instalación de La Protectora

Generadas con la herramienta integrada de imágenes. Formato vertical, cuatro pasos y español latinoamericano. No se modificó la aplicación.

## Fuentes verificadas

- [Apple: convertir un sitio web en una app en iPhone](https://support.apple.com/es-lamr/guide/iphone/iphea86e5236/26/ios/26)
- [Google Chrome: instalar apps web en Android](https://support.google.com/chrome/answer/9658361?co=GENIE.Platform%3DAndroid&hl=es-419)
- [Chrome: variantes anteriores del menú](https://developer.chrome.com/blog/how_chrome_helps_users_install_the_apps_they_value?hl=es-419)

Los botones pueden cambiar según el idioma o la versión: en iPhone también puede aparecer «Añadir a pantalla de inicio» y «Añadir». En Android puede aparecer «Agregar a la pantalla principal» o «Instalar app». Android puede ubicar el icono en la pantalla principal o en el listado de aplicaciones.

Colores e icono revisados en app/globals.css, components/marca.tsx y public/icons/icon-512.png. Dominio comprobado en lib/seo.ts.

## Prompt iPhone

```text
Use case: infographic-diagram.
Asset type: ready-to-share Spanish instructional infographic, one single vertical portrait image, aspect ratio 2:3, target 1536x2304.
Audience: Costa Rican adults who barely use technology. Make it extremely easy to follow on a phone. Friendly, polished, uncluttered. Absolutely correct Spanish accents and exact button labels. No technical jargon and do not use the word PWA or "for dummies" in the artwork.
Brand: La Protectora del Alquiler, a Costa Rican rental website, not an animal shelter. Palette from its real website: warm off-white #faf9f5, forest green #385443, near-black #252b26, pale sage #edf1e9, white. Brand symbol is a simple cream outline of a house with a pitched roof and one centered rectangular door, on a forest-green rounded-square app icon. Do not use a shield, paw, dog or cat.
Art direction: professional friendly editorial infographic, flat vector-like illustrations, extremely crisp modern rounded sans-serif, bold large headings, generous spacing. At the top a small house mark with "La Protectora" and small "DEL ALQUILER". Then a prominent two-line title and a short subtitle. Main body: exactly four numbered horizontal teaching rows, arranged vertically, with green circular numerals 1, 2, 3, 4, short left-aligned text and a simple large visual of the exact action at the right. Pale divider lines or subtle light panels, no heavy decoration. Illustrate controls as schematic enlarged UI fragments with a rounded highlight and a finger/cursor tapping; do not claim they are real screenshots. Every visual must correspond to its own step. Only one clearly highlighted action per fragment, except the final row can show a toggle and button.
Text hierarchy: title around 80px at target size, row headings around 52px, helper text around 33px, footer at least 28px. Domain must be fully written and legible on its own line, never misspelled, never broken across words. The information should fill the page comfortably without clipping.
Bottom success strip in forest green with white text and the house app icon, then one small plain-text connection note. No watermarks, QR codes, store logos, fake badges, fictitious price claims, decorative microtext, extra steps, invented URLs or extra text.

OS: iPhone using Safari. Safari blue compass icon in step 1. Share symbol must be the Apple square with an UPWARD arrow, clearly enlarged; NEVER a downward download arrow.
Render this exact text, no additional instructional paragraphs:
Brand: "La Protectora" / "DEL ALQUILER"
Title: "Instala La Protectora" / "en tu iPhone"
Subtitle: "Sigue estos 4 pasos"
Step 1 heading: "Abre Safari"
Step 1 helper: "Entra a:"
Step 1 URL: "protectoradelalquiler.com"
Visual 1: large recognizable Safari blue compass and a clean browser address bar showing the exact domain.
Step 2 heading: "Toca Compartir"
Step 2 helper: "Es el cuadrito con la flecha hacia arriba."
Step 2 extra helper, on a distinct short line: "Si no lo ves: abre el menú y toca Compartir."
Visual 2: enlarged Apple share icon inside a small toolbar, highlighted by a green circle and a tapping finger; small menu icon nearby may show horizontal ellipsis.
Step 3 heading: "Toca Agregar a Inicio"
Step 3 helper: "Baja por las opciones hasta encontrarlo."
Visual 3: a simple share-menu fragment with the row "Agregar a Inicio" clearly highlighted and a plus-in-square icon, and a small downward scroll cue.
Step 4 heading: "Toca Agregar"
Step 4 helper: "Si ves Abrir como app web, déjalo activado."
Visual 4: a clean confirmation fragment, house icon with "La Protectora", row "Abrir como app web" with an unmistakably ON green switch and a highlighted "Agregar" button. Switch appears before the button in reading order.
Success heading: "¡Listo!"
Success text: "Toca La Protectora en tu pantalla de inicio."
Connection note: "Necesitas internet para usar La Protectora."
Ensure "Agregar a Inicio" is exactly capitalized and "Abrir como app web" is legible.

```

## Prompt Android

```text
Use case: infographic-diagram.
Asset type: ready-to-share Spanish instructional infographic, one single vertical portrait image, aspect ratio 2:3, target 1536x2304.
Audience: Costa Rican adults who barely use technology. Make it extremely easy to follow on a phone. Friendly, polished, uncluttered. Absolutely correct Spanish accents and exact button labels. No technical jargon and do not use the word PWA or "for dummies" in the artwork.
Brand: La Protectora del Alquiler, a Costa Rican rental website, not an animal shelter. Palette from its real website: warm off-white #faf9f5, forest green #385443, near-black #252b26, pale sage #edf1e9, white. Brand symbol is a simple cream outline of a house with a pitched roof and one centered rectangular door, on a forest-green rounded-square app icon. Do not use a shield, paw, dog or cat.
Art direction: professional friendly editorial infographic, flat vector-like illustrations, extremely crisp modern rounded sans-serif, bold large headings, generous spacing. At the top a small house mark with "La Protectora" and small "DEL ALQUILER". Then a prominent two-line title and a short subtitle. Main body: exactly four numbered horizontal teaching rows, arranged vertically, with green circular numerals 1, 2, 3, 4, short left-aligned text and a simple large visual of the exact action at the right. Pale divider lines or subtle light panels, no heavy decoration. Illustrate controls as schematic enlarged UI fragments with a rounded highlight and a finger/cursor tapping; do not claim they are real screenshots. Every visual must correspond to its own step. Only one clearly highlighted action per fragment, except the final row can show a toggle and button.
Text hierarchy: title around 80px at target size, row headings around 52px, helper text around 33px, footer at least 28px. Domain must be fully written and legible on its own line, never misspelled, never broken across words. The information should fill the page comfortably without clipping.
Bottom success strip in forest green with white text and the house app icon, then one small plain-text connection note. No watermarks, QR codes, store logos, fake badges, fictitious price claims, decorative microtext, extra steps, invented URLs or extra text.

OS: Android using Google Chrome. Use the recognizable Chrome red/yellow/green circle with blue center in step 1. Menu is THREE VERTICAL DOTS at the right side of the address bar, never horizontal dots.
Render this exact text, no additional instructional paragraphs:
Brand: "La Protectora" / "DEL ALQUILER"
Title: "Instala La Protectora" / "en tu Android"
Subtitle: "Sigue estos 4 pasos"
Step 1 heading: "Abre Chrome"
Step 1 helper: "Entra a:"
Step 1 URL: "protectoradelalquiler.com"
Visual 1: large recognizable Chrome icon and a clean browser address bar showing the exact domain.
Step 2 heading: "Toca los 3 puntitos"
Step 2 helper: "Están a la derecha de la dirección."
Visual 2: cropped browser top toolbar address bar with THREE VERTICAL DOTS at the far right, dots circled in forest green and a tapping finger. Make the icon extra large so a beginner recognizes it.
Step 3 heading: "Elige la instalación"
Step 3 helper: "Toca Instalar y crear acceso directo."
Step 3 extra helper: "En algunos teléfonos dice Agregar a la pantalla principal."
Visual 3: clean menu fragment with the exact label "Instalar y crear acceso directo" in a highlighted row. The long label may wrap naturally across two lines; it must NOT be cut off or shortened.
Step 4 heading: "Toca Instalar"
Step 4 helper: "Confirma cuando el teléfono te lo pida."
Visual 4: simple installation confirmation fragment with the house app icon, "La Protectora" name and a clear highlighted "Instalar" button. This step represents selecting Instalar and confirming the installation, not creating just a browser shortcut.
Success heading: "¡Listo!"
Success text: "Busca La Protectora entre tus apps y tócala."
Connection note: "Necesitas internet para usar La Protectora."
Keep current Chrome path accurate: vertical-dot menu, Instalar y crear acceso directo, Instalar, confirmation. Do not insert "Crear acceso directo" as the final action.

```

