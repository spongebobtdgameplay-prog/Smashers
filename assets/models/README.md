# Smashers character models

The current boxer prototype loads Quaternius' `worker.glb` model at runtime:

- Source repository: https://github.com/euuuuuuan/fatal-funnel-public
- Source asset: `packages/renderer/assets/models/quaternius-men/worker.glb`
- Upstream raw file: https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/worker.glb
- Original author: Quaternius
- Original pack: Ultimate Modular Men Pack
- Recorded licence: CC0-1.0; the source project's asset register marks the model as redistributable.

Smashers adds team-coloured boxing gloves and trunks at runtime. The original source file is not vendored in this directory yet; the game currently loads it from the upstream raw URL and retains its built-in procedural fighter as a fallback if the request fails.

The Infinity Store's character pipeline uses this same source model and provides the rig/bone-loading reference for Smashers.
