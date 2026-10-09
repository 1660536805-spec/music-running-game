# Visual update

Run from the repository root:

```sh
python3 tools/serve.py 8789
```

Open `http://127.0.0.1:8789/声浪星球.html?scene=causeway`.

The new theme is scoped to the causeway game. Its styles are in `causeway-visual.css`; the scene and gallery remain in `声浪星球.html`. Default gameplay uses the reference chase composition. `?fixchase=0` restores the chart-driven camera switches.

`final.jpg` shows the desktop start state. `mobile.jpg` shows the portrait adaptation. `comparison.jpg` places the supplied reference above the implementation. Strict pixel parity is not yet achieved; see `../design-qa.md`.

Album artwork: `../assets/galaxy-album.png`, generated with the built-in Image Gen tool from the supplied visual reference. Prompt direction: a square Galactic Rap album cover with a purple cosmic night sky, glowing pink nebula, sharp alien mountains, a purple planet on the right, white Galactic Rap / Kevin MacLeod type and small waveform at the top left; no record, frame or surrounding game UI.

No deployment or remote push was performed.
