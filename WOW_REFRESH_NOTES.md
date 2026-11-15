# Legacy Sensor website — WOW refresh (GitHub Pages)

This is a visual refresh of the existing Legacy Sensor website. The desktop app, Phone Sensor logic, download destinations, and game adapters were not modified.

## Visual updates
- Brighter dance-inspired palette with pink, orange, violet and cyan gradients.
- Stronger contrast for headings, body copy, buttons, cards, FAQ, download archive and troubleshooting content.
- Animated highlights ribbon, subtle floating screenshot effect, and card hover motion.
- Responsive layouts, including a stacked compatibility table on small screens.
- Existing seasonal UI remains included; reduced-motion preferences are respected.

## Compatibility table artwork
- `assets/game-covers/jd2021-dreyn-banner.webp`: optimized from the JD2021 PC by Dreyn banner supplied in the conversation.
- `assets/game-covers/legacy-jd2018-logo.webp`: optimized from the orange LEGACY title image supplied in the conversation.
- `assets/game-covers/just-dance-liminal-exe-icon.png`: 256x256 PNG icon extracted from the `RT_ICON` resource group in the supplied `Just Dance Liminal.exe` inside `gra.zip`.
- `assets/game-covers/liminal-launcher-capture.webp`: optimized from the Liminal launcher screenshot supplied in the conversation and linked from the Liminal row.

## Compatibility statements
- Legacy Just Dance PC by DIEGUINHODG: fully working / recommended, according to the project owner's report.
- Just Dance 2021 PC by Dreyn: not supported in recent Legacy Sensor releases; older releases still need separate testing.
- Just Dance Liminal: under investigation; the presence of Kinect v1/v2 options does not prove that Legacy Sensor input is supported.

## GitHub Pages / PWA
- No Netlify dependencies or Netlify functions were added.
- `wow-refresh.css` and the four game-cover assets are included in the service-worker shell cache.
- Cache version was bumped to `legacy-sensor-shell-v1.8.0`.
- Manifest theme colors were updated to match the redesigned app experience.

## Validation
- HTML local resource references checked.
- Duplicate HTML IDs checked.
- CSS parsed with tinycss2.
- JavaScript syntax checked with Node.js.
- Manifest parsed as JSON.
