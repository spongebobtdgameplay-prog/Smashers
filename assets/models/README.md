# Smashers boxer model

Smashers uses Quaternius' `casual-character.glb` as the base humanoid rig for both fighters. The source model is Z-up, so the game rotates its rig 90 degrees around X before calculating bounds and fitting it to a 1.76 m character height.

- Author: Quaternius
- Pack: [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)
- Source repository: https://github.com/euuuuuuan/fatal-funnel-public
- Source file: `packages/renderer/assets/models/quaternius-men/casual-character.glb`
- Upstream file: https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/casual-character.glb
- Licence: CC0 1.0 Universal; the source CC0 text is included as `CC0-1.0.txt`
- Expected Git blob SHA-1: `f31ba8b389268d4df6005cc62d4d7011de728bce`

Smashers attaches team-coloured boxing gloves to the mapped wrist bones and trunks to the hips at runtime. The loader checks `assets/models/casual-character.glb` first and uses the upstream URL as a fallback. The model is bundled in the repository; the built-in procedural fighter remains a last-resort fallback if model loading fails.

The integration uses the same Quaternius rig naming and GLTF loading approach as The Infinity Store, while applying the source model's Z-up to Y-up correction. Smashers uses dedicated rig-based hurtboxes, a swept fist capsule, and ring-bounded character collision.
