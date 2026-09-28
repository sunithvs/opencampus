# Campus

A playable single-player 3D campus exploration prototype, inspired by the supplied red-roofed college reference. Built with Babylon.js, TypeScript, and Vite. All geometry, textures, and ambient sound are generated locally; Google Fonts is the only optional external visual resource and has system fallbacks.

## Run

Requires Node.js 22.12+; Cloudflare builds use Node 22 from `.node-version`.

```sh
npm install
npm run dev
```

Open the local URL shown by Vite. For a phone on the same Wi-Fi, use the network URL printed by Vite. `localhost` on a phone refers to the phone, not the development computer.

```sh
npm run build    # Type checking + production assets in dist/
npm run preview  # Serve the production build
npm test         # Collision, door state, and save validation checks
```

## Cloudflare deployment

The repository is configured for **Cloudflare Workers Static Assets**. `wrangler.jsonc` serves the Vite output in `dist/`. The game runs at `/`; unknown paths return 404 so missing scripts and models are not replaced with HTML. This deployment hosts the single-player browser game; it does not create a multiplayer server.

Connect `sunithvs/opencampus` in Cloudflare **Workers & Pages → Create → Import a repository**, and use:

| Setting | Value |
| --- | --- |
| Worker name | `opencampus` (must match `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | `22` (also recorded in `.node-version`) |

Cloudflare's Git integration installs dependencies from `package-lock.json`. No application environment variables, database, or storage bindings are needed. Connect the repository in your Cloudflare account once; later pushes to the configured branch can then build and deploy automatically. Cloudflare will report the deployment URL. A custom domain can be attached afterward in the Worker's domain settings.

For a manual deployment from your computer:

```sh
npx wrangler login  # Authorize your Cloudflare account once
npm run deploy     # Builds current source, then publishes it
```

For local validation without publishing:

```sh
npm run cf:check    # Build and validate the Wrangler deployment bundle
npm run cf:dev      # Serve the build through Cloudflare's local runtime on :8787
```

`public/_headers` is copied into the build. Hashed JavaScript/CSS assets receive long-lived caching; HTML and the stable-name GLB model revalidate so updates are picked up. Cloudflare credentials belong in your local Wrangler login or the hosting platform's secrets, never in this repository. `.wrangler`, `.env`, and `.dev.vars` files are ignored.

If you already created a **Cloudflare Pages** project instead, it can serve the same static build: use build command `npm run build` and output directory `dist`, with the repository root as the root directory. Do not use the Workers deploy command in Pages; Pages publishes the output directory itself. The checked-in Wrangler configuration targets Workers.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Git build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), and [asset headers](https://developers.cloudflare.com/workers/static-assets/headers/).

## Controls

- WASD or arrow keys: walk relative to the camera.
- Drag the scene: orbit the third-person camera. Scroll: adjust follow distance.
- Shift: run. E: use a nearby classroom door, garden sign, or bench.
- Q or the hand button: wave while standing still.
- M: campus map. Escape: settings/pause.
- Touch: left joystick to walk, drag the scene to look, tap RUN to toggle running, tap interaction prompts.
- Settings: graphics quality, camera sensitivity, ambient sound, return to entrance, and fullscreen where supported.

The game saves your position, discovered places, and settings on the current device. It works without browser storage when storage is unavailable. Backgrounding the page clears movement input and suspends the soundscape.

## Playable spaces

- Academic block: open entrance and central hall, two furnished classrooms with operable doors.
- Campus café: furnished interior, service counter, terrace, and bench.
- Palm garden: circular path, fountain, seating, and sign.
- Surrounding campus: paths, palms, landscaping, and exterior-only supporting buildings.

The current terrain is flat. Upper floors and background buildings are exterior scenery. There are no simulated lessons, NPCs, stairs, or multiplayer yet. Geometry is a detailed procedural prototype, not a photorealistic recreation or a survey-accurate model. The player uses the custom rigged GLB avatar with a square face image surface. Realistic GLB architecture and foliage remain future art milestones.

## Architecture

- `src/game/world.ts`: campus generation, static mesh batching, colliders, doors, and interaction definitions.
- `src/game/player.ts`: GLB loading and blended idle/walk/run/sit/wave skeletal animations.
- `src/game/state.ts`: rendering-independent movement/collision rules, locations, and validated local saves.
- `src/main.ts`: frame loop, input, follow camera with obstruction detection, quality settings, and persistence.
- `src/ui.ts` / `src/style.css`: responsive HUD, maps, settings, instructions, touch controls.
- `src/game/audio.ts`: optional generated ambient wind and birds, activated after a user gesture.

World interactions already have stable IDs, and movement rules are separate from rendering. Future networking still needs an authoritative server, movement validation, synchronized object state, interpolation, and load testing. The intended multiplayer design is one public campus with a 50-player cap and a full-capacity response, not automatic creation of additional rooms. No networking server is included in this version.

## Browser integration check

In development, open `/?smoke` to run a visible integration check. It drives keyboard events through the real movement system, walks from the entrance through a classroom, verifies a closed/open door, opens/closes the map, resets position, visits the café, and tests sitting/standing. It also verifies rig/face loading, animation playback, wave completion, animation pausing, and sit/stand transitions. Test saves use separate storage keys. The harness is excluded from production builds.

Desktop browser checks and resized mobile layout checks are useful smoke tests; actual phone performance and touch feel still require testing on physical devices. The 30 FPS mobile / 60 FPS desktop targets are goals, not guarantees.
