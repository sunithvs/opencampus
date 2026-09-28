# Campus

A playable 3D campus exploration prototype with one public multiplayer campus and offline exploration, inspired by the supplied red-roofed college reference. Built with Babylon.js, TypeScript, and Vite. All geometry, textures, and ambient sound are generated locally; Google Fonts is the only optional external visual resource and has system fallbacks.

## Run

Requires Node.js 22.12+; Cloudflare builds use Node 22 from `.node-version`.

```sh
npm install
npm run dev:server  # Cloudflare multiplayer server on :8787 (terminal 1)
npm run dev         # Vite client on :5173 (terminal 2)
```

Open the local URL shown by Vite. Its `/api` proxy connects to the local multiplayer server. `Explore offline` also works with Vite alone. For a phone on the same Wi-Fi, use the network URL printed by Vite. `localhost` on a phone refers to the phone, not the development computer.

```sh
npm run build    # Type checking + production assets in dist/
npm run preview  # Serve the production build
npm test         # Movement, capacity, interactions, protocol, and saves
npm run test:multiplayer  # Isolated local server + 50 WebSocket clients
```

## Cloudflare deployment

The repository is configured for **Cloudflare Workers Static Assets**. `wrangler.jsonc` serves the Vite output in `dist/` and routes `/api/*` to `worker/index.ts`. The game runs at `/`; unknown paths return 404 so missing scripts and models are not replaced with HTML. The `CAMPUS` binding connects the Worker to `CampusRoom`, a SQLite-backed Durable Object. Every guest joins the same fixed object, `public-campus-v1`. The `v1` migration creates its storage on first deployment; keep this migration in future releases.

Connect `sunithvs/opencampus` in Cloudflare **Workers & Pages → Create → Import a repository**, and use:

| Setting | Value |
| --- | --- |
| Worker name | `opencampus` (must match `wrangler.jsonc`) |
| Production branch | `main` |
| Root directory | Repository root |
| Build command | `npm run build` |
| Deploy command | `npx wrangler deploy` |
| Node version | `22` (also recorded in `.node-version`) |

Cloudflare's Git integration installs dependencies from `package-lock.json`. No application secrets or separate database setup are required. Wrangler creates the configured Durable Object binding and migration during deployment. Connect the repository in your Cloudflare account once; later pushes to the configured branch can then build and deploy automatically. Cloudflare will report the deployment URL. A custom domain can be attached afterward in the Worker's domain settings.

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

**Deploy this version as a Worker.** A static Cloudflare Pages deployment can serve offline exploration but does not provide the multiplayer `/api/campus` endpoint. The checked-in configuration deploys the frontend and multiplayer server together on one origin.

References: [Workers static assets](https://developers.cloudflare.com/workers/static-assets/), [Git build settings](https://developers.cloudflare.com/workers/ci-cd/builds/configuration/), and [asset headers](https://developers.cloudflare.com/workers/static-assets/headers/), and [Durable Object WebSockets](https://developers.cloudflare.com/durable-objects/best-practices/websockets/).

## Controls

- WASD or arrow keys: walk relative to the camera.
- Drag the scene: orbit the third-person camera. Scroll: adjust follow distance.
- Shift: run. E: use a nearby classroom door, garden sign, or bench.
- Q or the hand button: wave while standing still.
- M: campus map. Escape: settings/pause.
- Touch: left joystick to walk, drag the scene to look, tap RUN to toggle running, tap interaction prompts.
- Settings: graphics quality, camera sensitivity, ambient sound, return to entrance, and fullscreen where supported.

Offline exploration saves your position and discovered places; settings are saved on the current device. Multiplayer does not overwrite your offline position. It works without browser storage when storage is unavailable. Backgrounding the page clears movement input and suspends the soundscape.

## Playable spaces

- Academic block: open entrance and central hall, two furnished classrooms with operable doors.
- Campus café: furnished interior, service counter, terrace, and bench.
- Palm garden: circular path, fountain, seating, and sign.
- Surrounding campus: paths, palms, landscaping, and exterior-only supporting buildings.

The current terrain is flat. Upper floors and background buildings are exterior scenery. There are no simulated lessons, NPCs, stairs, chat, voice, or accounts yet. Geometry is a detailed procedural prototype, not a photorealistic recreation or a survey-accurate model. The player uses the custom rigged GLB avatar with a square face image surface. More realistic architecture and additional art detail remain future milestones.

## Architecture

- `src/game/world.ts`: campus generation, static mesh batching, colliders, doors, and interaction definitions.
- `src/game/player.ts`: GLB loading and blended idle/walk/run/sit/wave skeletal animations.
- `src/game/state.ts`: rendering-independent movement/collision rules, locations, and validated local saves.
- `src/main.ts`: frame loop, input, follow camera with obstruction detection, quality settings, and persistence.
- `src/ui.ts` / `src/style.css`: responsive HUD, maps, settings, instructions, touch controls.
- `src/game/audio.ts`: optional generated ambient wind and birds, activated after a user gesture.

## Multiplayer

Choose a display name and **Join public campus**. There is one shared campus with a 50-player limit, no room selector, and no overflow rooms. Names are guest labels, not authenticated identities. Players can walk through each other.

- Server-owned movement and collisions run at 20 Hz. Clients predict their own movement and reconcile with acknowledgments; remote avatars interpolate snapshots sent at up to 10 Hz.
- Doors, exclusive bench seats, and waves synchronize across clients. Interaction proximity, packet shape, input sequence, backlog, and message rate are validated by the server.
- Unexpected disconnects reserve a slot and position for 30 seconds. Rejoining the same browser tab resumes using a private session token. Leaving for offline mode immediately releases the slot; disconnected players release their seats.
- At capacity, new guests see a full message and can retry or explore offline. Mobile backgrounding stops movement; reconnect uses bounded backoff and heartbeat checks.
- Door states persist in Durable Object storage. Active players use WebSocket attachments for hibernation recovery; reconnect reservations use storage. Positions are temporary session state, not permanent account saves, and a deployment/runtime restart that disconnects all sockets may reset active positions.
- Idle simulation timers stop. Cloudflare's hibernation API and automatic ping/pong responses keep idle sockets connected without a permanent simulation loop. Active play still incurs Worker/Durable Object usage.
- Avatar geometry/materials are reused with independent skeletons. Distant avatars, labels, shadows, and animations use reduced work. This is a starting optimization, not a guarantee of 50 visible avatars at the target frame rate on every phone.

Networking files: `worker/index.ts` handles admission, WebSockets, persistence, and lifecycle; `shared/layout.ts` and `shared/campus.ts` define identical world geometry/collision data for both sides; `shared/simulation.ts` owns movement and interaction rules; `shared/protocol.ts` defines packets; `src/game/network.ts` manages the browser connection; `src/game/remotes.ts` renders other guests.

`npm run test:multiplayer` launches an isolated Wrangler runtime on :8788 and checks shared movement/doors/seats/waves, 50 connections, full rejection, reserved reconnection, malformed packets, movement load, and door persistence across restart. Set `CAMPUS_TEST_URL` only for a disposable test environment: the test fills the campus and changes doors. This validates networking/simulation, not real-world internet latency, 50 rendered avatars, or phone GPU performance.

## Browser integration check

In development, open `/?smoke` to run a visible integration check. It drives keyboard events through the real movement system, walks from the entrance through a classroom, verifies a closed/open door, opens/closes the map, resets position, visits the café, and tests sitting/standing. It also verifies rig/face loading, animation playback, wave completion, animation pausing, and sit/stand transitions. Test saves use separate storage keys. With the local multiplayer server running, `/?smoke=online` exercises the same walking, animation, door, and seating flow through the real WebSocket client. Keep another guest connected to check remote avatar creation too. The harness is excluded from production builds.

Desktop browser checks and resized mobile layout checks are useful smoke tests; actual phone performance and touch feel still require testing on physical devices. The 30 FPS mobile / 60 FPS desktop targets are goals, not guarantees.

## Blender trees

The campus trees use original Blender assets: feather-frond palms on the avenue and
branching shade trees in the garden and background. `src/game/trees.ts` loads the two
GLBs once and renders the shared campus placements with four thin-instance batches.
See `assets/trees/README.md` for the editable Blender file, generator, geometry budgets,
and export details. All tree materials use embedded vertex colors; no external textures
are needed.
