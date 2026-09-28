# Campus Student

Gender-neutral stylized avatar for the campus game: relaxed oat shirt, charcoal trousers,
forest backpack, and sage sneakers. The rounded head has no modeled facial features or hairstyle.
Its flat square face is ready for a personalized image. All geometry and materials are created locally;
the placeholder face texture is embedded in the GLB.

## Files

- Runtime asset: `public/models/campus-student.glb`
- Source generator: `assets/characters/build_student.py` (Blender 5.2)
- Clip metadata: `assets/characters/campus-student.json`
- Editable source and renders: `/Users/sunithvs/Documents/Codex/2026-09-09/plugin-creator-users-sunithvs-codex-skills/outputs/campus-student.blend`

The GLB is integrated as the playable character through `src/game/player.ts`. Movement selects
Idle, Walk, and Run; seats select Sit; Q or the hand button plays Wave while standing still.
Animations blend during transitions and freeze while paused. NPC behavior is not included.

## Runtime details

- Approximately 1.85 metres tall; feet at ground level in the rest pose.
- 5,910 triangles; two skinned meshes (body and face), 10 material primitives; 16 bones.
- About 724 KiB, with embedded materials and a 512 × 512 placeholder texture.
- Blender coordinates: Z up, -Y forward. glTF coordinates: Y up, +Z forward.
- Body components use rigid bone weights for a segmented low-poly style.
- Separate material slots allow recoloring skin, clothes, shoes, and backpack.
- No facial rig, finger articulation, collision mesh, navigation, or crowd AI is included.

| Clip | Duration | Playback |
|---|---:|---|
| Idle | 3 s | Loop |
| Walk | 1 s | Loop, in place |
| Run | 0.733 s | Loop, in place |
| Wave | 2.5 s | Once; returns to idle pose |
| Sit | 3 s | Loop in seated pose; no sit-down transition |

Move the actor's outer transform for navigation; animations do not translate it across the world.
Sit already lowers the hips by 0.40 m, so do not add the old procedural player's seated offset.
Blend into Sit, and align the seat to the character's hips. Ground and props are excluded from the GLB.

The Babylon.js glTF 2.0 loader is registered in `src/game/player.ts`, and the asset URL respects
the Vite base path. For future NPCs, clone the hierarchy and skeleton for each independently
animated person. Select animation groups by the names in the table.
Avoid cloning materials unless the person needs different colors. Use a simple capsule for collisions.
The 10 material primitives mean this asset needs a lower-detail version or crowd batching for very large crowds.

## Add a face image

The separate mesh and its dedicated material are both named `FaceImage`. The plane is
0.272 × 0.272 metres, attached to the head bone, and offset 1 mm from the flat head surface.
Its UVs cover the entire 0–1 square, upright and unmirrored. It follows all five animations.

In Blender, select `FaceImage`, open its material in the Shader Editor, and replace the image
in the node labeled `Face Image — replace with your square image`. Use a square PNG or JPG,
such as 512 × 512 or 1024 × 1024. Crop rectangular photos to a square first. Pack the new image
and re-export the body, face, and skeleton together. The starter image is
`assets/characters/face-placeholder.png`; editing that file alone does not change an already
exported GLB, because the GLB embeds a copy.

At runtime, replace only the `FaceImage` material's base-color texture. Clone that material
per person when different people need different photos, while sharing the body materials.
Keep the image upright using glTF's top-left image convention. The material is opaque, so
use an image with a filled background. No remodeling or UV adjustment is needed.

## Rebuild and verification

Run `build_student.py` in Blender's Python environment. It creates a separate asset scene,
saves the blend file in the outputs folder, and exports both copies of the GLB. The generator
contains absolute project/output paths at its top, which can be changed when relocating it.

`preview_student.py` is intended for a background Blender process with the saved asset scene open.
It imports the actual GLB, evaluates all five animation clips, and renders a pose sheet without
saving changes to the source blend. This verifies exported skeletal poses, not game integration.
