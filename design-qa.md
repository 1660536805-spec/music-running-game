# Galactic Rap visual comparison

Source: `/Users/leo/Desktop/截屏2026-10-09 13.51.15.png` (1060 × 594).
Implementation: `visual-review/final.jpg` (1060 × 594 CSS pixels, deviceScaleFactor 1).
Comparison: `visual-review/comparison.jpg` (reference above, implementation below).
State: initial Galactic Rap, low track, score 0. The collectible total uses the actual chart (37), rather than the mock's 0.

## Changes and comparison history

1. Original scene: album and lyrics were small perspective panels; hero was too small; music card, score, controls, combo and resonance button did not match the reference positions.
2. Adjusted camera, hero smoothing and scale, screen-space lyrics, and scoped HUD dimensions. First comparison exposed an abrupt end to the track behind the spawn and a wide horizontal sleeve.
3. Extended the rendered track behind the spawn, resized the sleeve vertically, placed the disc on its right, and added rings, cyan pylons and magenta rail halos. Transparent upper-floor depth writes had hidden the blue lower rails; disabled them.
4. Increased track widths and softened the lower character. Rechecked at 1060 × 594. Portrait inspection exposed a clipped sleeve; added aspect-aware sleeve positioning and character scale, then captured `visual-review/mobile.jpg` at 390 × 844.

## Required fidelity surfaces

- Typography: song metadata, score, combo, six poem lines and key hints use the source's existing system/PingFang stack. Chinese active line is white with pink glow; inactive lines fade by distance. Source font and raster antialiasing are not available as editable assets.
- Spacing: main HUD follows the reference's 1060 × 594 coordinates. World-space sleeve, running pose and scenery remain animated, so their exact pixels vary between frames.
- Color: indigo sky, purple sleeve, blue inner rails, pink outer rails and active lyric glow now match the intended palette. Reference bloom remains softer and more extensive than the implemented layered glow.
- Image quality: real generated galaxy artwork is stored in `assets/galaxy-album.png`; the playable character and disc use the project's existing Three.js geometry. The generated mountains/planet are not the exact reference artwork.
- Copy: the six starting poem lines match the supplied reference. These are theme poem lines, as in the existing game, not a claim of official song lyrics. Real score and collectible data remain live.

## Verification

- Browser: up key selects `hi on`; down selects `lo on`. Scoring and combo update while running. Resonance button accepts a held pointer. Home (1) and game (5) switch correctly and hide/show the theme.
- Browser console: no error entries during the recorded checks.
- JavaScript syntax: `node --check` passed on the extracted inline scripts.
- Diff whitespace: `git diff --check` passed.
- Local preview uses the project's Range server, changed to ThreadingHTTPServer to prevent concurrent CSS/script requests being blocked by a persistent connection.

## Remaining findings

- [P1] Exact artwork parity: album mountains, star pattern and planet differ from the source. Original editable artwork was not in the supplied repository. Generated replacement matches the theme but is not pixel-identical.
- [P2] Exact rendered scene parity: camera, pose, sleeve glows and reflections differ from the reference render. This version preserves a live Three.js game, and does not use a screenshot as the game screen.

Focused comparison: the album/record and character/rails were reviewed in the full-width 1060-pixel comparison, where both regions are readable. The above findings remain unresolved for the user's strict identical-image criterion.

final result: blocked
