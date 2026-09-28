# Campus tree assets

Two original Blender models replace the procedural palms and spherical tree canopies.

| Asset | Geometry | Triangles | GLB size |
|---|---|---:|---:|
| `public/models/campus-palm.glb` | Ringed trunk, roots, 18 feather fronds | 7,688 | 702 KiB |
| `public/models/campus-shade-tree.glb` | Forked branches, roots, individual leaf sprays | 7,764 | 804 KiB |

The editable source is `campus-trees.blend` in the user's Blender outputs folder:
`/Users/sunithvs/Documents/Codex/2026-09-09/plugin-creator-users-sunithvs-codex-skills/outputs/`.
The same folder contains both GLBs and `campus-trees-preview.png`.

Both assets are in metres, with their trunk base at the origin. The palm stem is 8 m tall;
fronds extend above the stem. Blender uses Z up and glTF uses Y up. Exported models have two
parts each: bark and foliage. Leaf colors are embedded vertex colors, and foliage materials
are double-sided. No external textures, downloads, alpha cards, or third-party assets are required.

`build_trees.py` recreates the models, exports the two game files, and renders a studio preview.
Run it in Blender with `--background --factory-startup --python`; change its top-level paths
if moving the project. The studio objects and showcase offsets are excluded from GLB exports.

`src/game/trees.ts` loads each GLB once, bakes the importer axis conversion, and creates thin
instances from the shared campus placements. The two bark batches and two foliage batches
share geometry and materials. Tree instances rotate and scale individually. The campus's
shared trunk obstacles remain authoritative. The models are static; wind and distance LODs
are not included. Instance bounds are refreshed for visibility and shadow rendering.
