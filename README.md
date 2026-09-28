# Campus

A playable single-player 3D campus exploration prototype, inspired by the supplied red-roofed college reference. Built with Babylon.js, TypeScript, and Vite. All geometry, textures, and ambient sound are generated locally; Google Fonts is the only optional external visual resource and has system fallbacks.

## Run

Requires Node.js 20.19+ or 22.12+.

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

Serve `dist/` on any static web host. Multiplayer hosting is a separate future requirement.

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
