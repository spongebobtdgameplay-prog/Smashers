# Smashers character models

Smashers uses Quaternius' `casual-character.glb` as the base humanoid rig for both boxers. Boxing gloves and team-coloured trunks are attached to the rig at runtime.

- Author: Quaternius
- Pack: [Ultimate Modular Men Pack](https://quaternius.com/packs/ultimatemodularcharacters.html)
- Source repository: https://github.com/euuuuuuan/fatal-funnel-public
- Source file: `packages/renderer/assets/models/quaternius-men/casual-character.glb`
- Upstream file: https://raw.githubusercontent.com/euuuuuuan/fatal-funnel-public/main/packages/renderer/assets/models/quaternius-men/casual-character.glb
- Pack page licence: CC0 1.0 Universal
- Expected Git blob SHA-1: `f31ba8b389268d4df6005cc62d4d7011de728bce`

`scr/main.js` loads `assets/models/casual-character.glb` first, then uses the upstream raw file as a fallback. If both requests fail, the built-in low-poly fighter remains visible.

To add the actual model binary to a local checkout, run this from the repository root:

```powershell
.\assets\models\download-boxer.ps1
```

The installer validates the downloaded bytes against the known Git blob object hash before keeping the file. The source CC0 text is included as `CC0-1.0.txt`.

The Infinity Store's Quaternius rig mapping and character-loading structure informed the model integration. Smashers uses dedicated boxing hurtboxes, swept fist hitboxes, and ring-bounded capsule separation rather than importing the store's first-person movement controller.
