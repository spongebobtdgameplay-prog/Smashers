# Smashers boxer model

Smashers uses Quaternius' `casual-character.glb` as the base humanoid rig for both fighters. The bundled file is Y-up; the game preserves its native orientation and fits the model to a 1.76 m character height from its raw bounds.

- Author: Quaternius
- Pack: [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)
- Source repository: https://github.com/euuuuuuan/fatal-funnel-public
- Source file: `packages/renderer/assets/models/quaternius-men/casual-character.glb`
- Upstream file: https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/casual-character.glb
- Licence: CC0 1.0 Universal; the source CC0 text is included as `CC0-1.0.txt`
- Expected Git blob SHA-1: `f31ba8b389268d4df6005cc62d4d7011de728bce`

Smashers attaches team-coloured boxing gloves to the mapped wrist bones and trunks to the hips at runtime. The loader checks `assets/models/casual-character.glb` first and uses the upstream URL as a fallback. The model is bundled in the repository; the built-in procedural fighter remains a last-resort fallback if model loading fails.

The integration uses the same Quaternius bone naming and GLTF-loading approach as The Infinity Store, while retaining the casual model's native Y-up coordinate system. Smashers uses dedicated rig-based hurtboxes, a swept fist capsule, and ring-bounded character collision.
