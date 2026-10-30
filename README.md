# SMASHERS
### 3D Fighting. Competitive Combat. Your World.

**Smashers** is an original browser-based 3D fighting game project built around fast-paced combat, interactive environments, character customization, and future online multiplayer experiences.

The project aims to bring together fighting-game mechanics and a larger world where players can train, compete, explore, and develop their own fighting styles.

Smashers is being developed with JavaScript and a locally hosted, modifiable Three.js engine.

---

## Project Overview

Smashers is designed to grow beyond a simple fighting demo. Its long-term direction includes a complete fighting experience with multiple environments, fighters, combat systems, online features, and player progression.

The project is currently in active development. Core gameplay systems and the underlying architecture are being built incrementally.

## Core Features

### 3D Fighting System
- Real-time 3D fighter rendering.
- Player movement and directional control.
- Punching and attack animations.
- Blocking and dodging mechanics.
- Health and damage tracking.
- Match timers and fight results.
- Opponent interactions.

### 3D Environments
- Three-dimensional fighting arenas.
- Boxing-ring environments.
- Arena lighting and environmental details.
- Camera and viewport management.
- Expandable world architecture.

### Fighter System
- Modular fighter creation.
- Configurable fighter names and colors.
- Separate body, glove, skin, and clothing materials.
- Individual fighter health and combat state.
- Expandable character customization.

### Game Interface
- Fight HUD.
- Player and opponent health bars.
- Match timer.
- Loading screen.
- Pause menu.
- Keyboard control display.
- Responsive interface styling.

### Future World Features
Planned expansions include:
- Open-world environments.
- Gyms and training facilities.
- Different fighting locations.
- NPC fighters.
- Arenas and competitive events.
- Additional player activities.

### Future Online Features
The architecture is being prepared for future server integration.

Planned online capabilities include:
- Multiplayer matches.
- Player accounts and profiles.
- Server-managed match sessions.
- Player progression.
- Competitive rankings.
- Additional server versions and infrastructure.

Online multiplayer is not currently deployed.

---

## Technology Stack

| Technology | Purpose |
|---|---|
| JavaScript | Game logic and systems |
| Three.js r162 | 3D rendering; WebGL 2 with WebGL 1 fallback |
| HTML5 | Game interface and structure |
| CSS3 | Interface styling |
| WebGL | Hardware-accelerated graphics |
| Git | Version control |
| GitHub | Source-code hosting |

## Project Architecture

The project uses a modular structure to keep the game systems separate and easier to maintain.

```text
Smashers/
│
├── assets/
│   ├── audio/
│   │   ├── music/
│   │   └── sounds/
│   │
│   ├── models/
│   └── textures/
│
├── engine/
│   └── three/
│       ├── three.module.js
│       └── LICENSE
│
├── scr/
│   ├── main.js
│   ├── player.js
│   ├── v1-server.js
│   └── world.js
│
├── game.html
├── index.html
├── style1-main.css
├── style2-main.css
└── README.md
```

### Main Modules

**`main.js`**

The main game controller. Coordinates initialization, gameplay, controls, combat, match timing, and the interface.

**`player.js`**

Contains fighter creation, character components, movement, combat actions, health, and fighter state.

**`world.js`**

Responsible for the Three.js scene, renderer, camera, lighting, arena, and viewport resizing.

**`v1-server.js`**

A local server-management module intended to support future server configurations and server switching. It is not currently connected to a deployed backend.

**`engine/three/`**

Contains the locally hosted Three.js r162 distribution. This release is intentional: its renderer tries WebGL 2 first and falls back to WebGL 1 when needed, while newer Three.js releases no longer support WebGL 1. The game does not depend on a remote Three.js CDN at runtime.

---

## Controls

| Key | Action |
|---|---|
| W | Move forward |
| A | Move left |
| S | Move backward |
| D | Move right |
| J | Attack |
| K | Block |
| SPACE | Dodge |
| ESC | Pause |

Controls may evolve as the combat system develops.

---

## Running Locally

You need:
- A modern browser with WebGL support.
- Python installed, or another local HTTP server.

Clone the repository:

```bash
git clone https://github.com/spongebobtdgameplay-prog/Smashers.git
cd Smashers
```

Start a local server:

```bash
python -m http.server 8000
```

Open:

```text
http://localhost:8000
```

The game uses local JavaScript modules, so it should be served over HTTP rather than opened directly as a `file://` page.

---

## Development Status

**Current stage: Early development**

| System | Status |
|---|---|
| Project structure | Established |
| Three.js local engine | Added |
| Fighter module | Initial implementation |
| World and arena module | Initial implementation |
| Game controller | Initial implementation |
| Combat mechanics | Initial implementation |
| Game interface | Initial implementation |
| Server management module | Local prototype |
| Online multiplayer | Planned |
| Player accounts | Planned |
| Open world | Planned |
| Character progression | Planned |

Features and systems are subject to change as development continues.

---

## Development Philosophy

Smashers is being developed as an original project with its own codebase, systems, and visual direction.

The project follows several principles:

- Modular and maintainable architecture.
- Locally hosted rendering dependencies.
- Incremental development instead of unnecessary rewrites.
- Performance improvements for different hardware configurations.
- Server-authoritative architecture for future competitive online features.
- Expandable systems that can support future game modes.

---

## Roadmap

### Phase 1 — Core Foundation
- [x] Establish the project structure.
- [x] Add the local Three.js engine.
- [x] Create the initial fighter system.
- [x] Create the initial arena.
- [x] Establish the game interface.
- [ ] Complete gameplay stability testing.
- [ ] Refine combat and movement.

### Phase 2 — Gameplay Expansion
- [ ] Improve attack animations.
- [ ] Add additional combat mechanics.
- [ ] Expand fighter customization.
- [ ] Introduce additional arenas.
- [ ] Improve visual effects and sound design.

### Phase 3 — World Development
- [ ] Develop larger explorable environments.
- [ ] Add gyms and training systems.
- [ ] Introduce NPC fighters.
- [ ] Add competitive events.

### Phase 4 — Online Infrastructure
- [ ] Develop the V1 backend.
- [ ] Implement secure player accounts.
- [ ] Introduce multiplayer sessions.
- [ ] Add server-side match validation.
- [ ] Develop rankings and progression.

### Phase 5 — Expansion
- [ ] Additional game modes.
- [ ] More environments and fighters.
- [ ] Expanded multiplayer infrastructure.
- [ ] Continued performance and gameplay improvements.

---

## Repository

**GitHub:**  
https://github.com/spongebobtdgameplay-prog/Smashers

**Project:** Smashers  
**Development:** Active  
**Platform:** Web Browser  
**Rendering:** Three.js / WebGL

---

*Smashers is an independently developed original game project. Its features, architecture, and roadmap will continue to evolve throughout development.*
