# Screen previews (no phone, no internet)

`npm run preview:shots` (with `npm run dev` running) opens the app at phone size
and saves a PNG of every screen and menu into `preview-shots/`.

Map tiles, `/api/ground` and `/api/esau` are faked (see `fixtures.mjs`), so it runs
anywhere. The terrain is made up, and Esau answers from his built-in offline rules,
so these show layout and wording, not real hunting reads.

To add a screen, add one `step('name', () => click(...))` line in `shoot.mjs`.
Needs Playwright (`npm i -D playwright` locally; preinstalled in Claude's cloud box).
