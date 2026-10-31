# Smashers boxer model

Smashers uses Quaternius' `worker.glb` model as the base humanoid rig for both boxers. This is the same Y-up model source used by The Infinity Store's player controller; the casual-character GLB was tested and rejected because its Z-up orientation made it unsuitable for this scene without a separate reorientation pass.

- Author: Quaternius
- Pack: [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)
- Source repository: https://github.com/euuuuuuan/fatal-funnel-public
- Source file: `packages/renderer/assets/models/quaternius-men/worker.glb`
- Upstream file: https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/worker.glb
- Licence: CC0 1.0 Universal; the source CC0 text is included as `CC0-1.0.txt`
- Expected Git blob SHA-1: `eb29e2adb795972e1f475cd25a000975fe260aa9`

Smashers attaches team-coloured boxing gloves to the mapped wrist bones and red/blue trunks to the hips at runtime. The loader checks `assets/models/worker.glb` first and uses the upstream URL as a fallback. Built-in procedural fighters remain available if both model sources fail.

To add the model to a local checkout manually, run this from the repository root:

```powershell
.\assets\models\download-boxer.ps1
```

The script validates the file against the recorded Git object SHA-1 before keeping it. A GitHub Actions workflow also vendors the verified binary automatically when it is not yet present.

The Infinity Store's `worker.glb` loader, Y-up bounds, Quaternius bone names, and arm rig structure are the integration reference. Smashers adds radius-bounded ring collision, rig-driven hurtboxes, and a swept glove capsule for actual punch contact.
