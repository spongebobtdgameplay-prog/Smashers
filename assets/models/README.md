# Smashers character models

The boxer prototype uses Quaternius' `worker.glb` model, the same source model used by The Infinity Store's character pipeline:

- Source repository: https://github.com/euuuuuuan/fatal-funnel-public
- Source asset: `packages/renderer/assets/models/quaternius-men/worker.glb`
- Upstream raw file: https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/worker.glb
- Original author: Quaternius
- Original pack: Ultimate Modular Men Pack
- Recorded licence: CC0-1.0; the upstream asset register marks this file as redistributable.
- Recorded SHA-256: `9c28614f465b7dc105f908c20c22fc045f4b07caf8c5ef0e9f8049eceb6dd38d`

Smashers adds team-coloured boxing gloves and trunks to the rig at runtime. The loader checks for a local copy at `assets/models/worker.glb` first, then uses the upstream raw URL. The built-in procedural fighter remains as a fallback if both sources fail.

To keep the model local in a checkout, run this from the Smashers repository root:

```powershell
.\assets\models\download-worker.ps1
```

The script downloads the CC0 model and verifies its upstream SHA-256 before keeping it. The full CC0 text is included as `CC0-1.0.txt`.

The Infinity Store's player controller and collision code were used as the structural reference; Smashers uses a simpler radius-based ring collision model for its two fighters.
