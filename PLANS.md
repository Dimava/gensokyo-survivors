# Plans: later, not now

Ideas the user wants kept but not started. Newest first.

- **Trailer** (Q30, not today). A 15-30 s gameplay trailer: slopus writes the shots and the cut, the
  recorder films them (title, a swarm, the winds, Cirno's spell cards, a clear), over the composer's
  lake and Cirno themes. The other option was a pure motion-graphics showreel of the UI and art.
- **Keyboard stack from gamebones/kds.** Port src/view/kds, keys.ts and keynav.ts to
  `createGameKeys` / `createKeynav` and delete them, once slopus's view pass is done
  (it touches about 20 view files).
- **The rest of gamebones/std** as each module lands: delayed input (the human bot's order
  queue), director (src/sim/director.ts), spatial grid (spatial.ts), bot and sweep harness
  (playRun, balance-log.ts, balance-report.ts), persist (gzip / IndexedDB saves).
- **Live2D on the GPU.** The rig deformed in the vertex shader (the artist's step 3, about 11x
  estimated), after its steps 1 and 2 (grouped parts, one mesh per rig).
