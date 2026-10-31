
// ============================================
// SMASHERS — WORLD AND RENDERER
// ============================================

export function createWorld(THREE, canvas, viewport) {
    const scene = new THREE.Scene();

    scene.background = new THREE.Color(0x101014);

    scene.fog = new THREE.Fog(
        0x101014,
        28,
        75
    );

    // ========================================
    // CAMERA
    // ========================================

    const camera = new THREE.PerspectiveCamera(
        45,
        1,
        0.1,
        150
    );

    // Side-on fighting-game camera with some depth.
    camera.position.set(0, 6.5, 17);
    camera.lookAt(0, 1.15, 0);

    // ========================================
    // RENDERER
    // ========================================

    // Create a clean replacement canvas so an earlier failed context
    // request or stale canvas state cannot block the WebGL 1 fallback.
    const rendererCanvas = canvas.cloneNode(false);

    const contextAttributes = {
        alpha: false,
        antialias: false,
        depth: true,
        stencil: false,
        powerPreference: "default",
        failIfMajorPerformanceCaveat: false
    };

    // Always try WebGL 2 first. If it cannot be created, try WebGL 1
    // on the exact same fresh canvas before reporting a renderer failure.
    const contextTypes = [
        "webgl2",
        "webgl",
        "experimental-webgl"
    ];

    const contextAttempts = [];
    let context = null;
    let contextType = "";
    let contextCreationError = "";

    const captureContextError = (event) => {
        if (event.statusMessage) {
            contextCreationError = event.statusMessage;
        }
    };

    rendererCanvas.addEventListener(
        "webglcontextcreationerror",
        captureContextError
    );

    for (const type of contextTypes) {
        for (const useAttributes of [true, false]) {
            try {
                const candidate = useAttributes
                    ? rendererCanvas.getContext(type, contextAttributes)
                    : rendererCanvas.getContext(type);

                if (candidate) {
                    context = candidate;
                    contextType = type;
                    break;
                }

                contextAttempts.push(
                    `${type} (${useAttributes ? "requested" : "default"} attributes): unavailable`
                );
            } catch (error) {
                contextAttempts.push(
                    `${type} (${useAttributes ? "requested" : "default"} attributes): ${error.message || error}`
                );
            }
        }

        if (context) break;
    }

    rendererCanvas.removeEventListener(
        "webglcontextcreationerror",
        captureContextError
    );

    if (!context) {
        const detail = contextAttempts.join("; ");
        const browserDetail = contextCreationError
            ? ` Browser detail: ${contextCreationError}`
            : "";

        throw new Error(
            `WebGL 2 and WebGL 1 both failed on a fresh Smashers canvas. Attempts: ${detail}.${browserDetail}`
        );
    }

    // Keep the existing game canvas untouched until a usable context
    // has actually been acquired on its replacement.
    canvas.replaceWith(rendererCanvas);

    const renderer = new THREE.WebGLRenderer({
        canvas: rendererCanvas,
        context,
        ...contextAttributes
    });

    const gl = renderer.getContext();
    const glVersion = gl.getParameter(gl.VERSION);

    console.info(
        `[SMASHERS] Selected ${contextType} (${glVersion}) — Three.js r${THREE.REVISION}.`
    );

    // Keep rendering at native display resolution for broader GPU support.
    renderer.setPixelRatio(1);

    renderer.outputColorSpace = THREE.SRGBColorSpace;
    renderer.toneMapping = THREE.ACESFilmicToneMapping;
    renderer.toneMappingExposure = 1.1;

    renderer.shadowMap.enabled = true;
    renderer.shadowMap.type = THREE.PCFSoftShadowMap;

    // The clock is used by main.js for frame timing.
    const clock = new THREE.Clock();

    // ========================================
    // LIGHTING
    // ========================================

    const ambient = new THREE.HemisphereLight(
        0xd7e2ff,
        0x25202b,
        1.7
    );

    scene.add(ambient);

    const mainLight = new THREE.DirectionalLight(
        0xffffff,
        2.8
    );

    mainLight.position.set(-5, 12, 9);
    mainLight.castShadow = true;

    mainLight.shadow.mapSize.set(512, 512);

    mainLight.shadow.camera.left = -12;
    mainLight.shadow.camera.right = 12;
    mainLight.shadow.camera.top = 12;
    mainLight.shadow.camera.bottom = -12;

    mainLight.shadow.normalBias = 0.035;

    scene.add(mainLight);

    const redLight = new THREE.PointLight(
        0xff253d,
        65,
        20
    );

    redLight.position.set(-7, 4.8, -2);
    scene.add(redLight);

    const blueLight = new THREE.PointLight(
        0x315dff,
        55,
        20
    );

    blueLight.position.set(7, 4.8, -2);
    scene.add(blueLight);

    // ========================================
    // MATERIALS
    // ========================================

    const floorMaterial = new THREE.MeshStandardMaterial({
        color: 0x202027,
        roughness: 0.9
    });

    const platformMaterial = new THREE.MeshStandardMaterial({
        color: 0x292932,
        roughness: 0.7,
        metalness: 0.15
    });

    const postMaterial = new THREE.MeshStandardMaterial({
        color: 0x191b23,
        roughness: 0.38,
        metalness: 0.55
    });

    const ropeMaterial = new THREE.MeshStandardMaterial({
        color: 0xb8bdc9,
        roughness: 0.65
    });

    // ========================================
    // ARENA
    // ========================================

    const arena = new THREE.Group();
    arena.name = "SmashersArena";

    const ARENA_WIDTH = 12;
    const ARENA_DEPTH = 7;

    // Large ground plane

    const ground = new THREE.Mesh(
        new THREE.PlaneGeometry(80, 80),
        floorMaterial
    );

    ground.rotation.x = -Math.PI / 2;
    ground.position.y = -0.22;
    ground.receiveShadow = true;

    arena.add(ground);

    // Fighting platform

    const platform = new THREE.Mesh(
        new THREE.BoxGeometry(
            ARENA_WIDTH,
            0.36,
            ARENA_DEPTH
        ),
        platformMaterial
    );

    platform.position.y = 0;
    platform.castShadow = true;
    platform.receiveShadow = true;

    arena.add(platform);

    // Platform perimeter

    const perimeter = new THREE.LineSegments(
        new THREE.EdgesGeometry(
            new THREE.BoxGeometry(
                ARENA_WIDTH,
                0.36,
                ARENA_DEPTH
            )
        ),
        new THREE.LineBasicMaterial({
            color: 0xff263f
        })
    );

    perimeter.position.y = 0;
    arena.add(perimeter);

    // ========================================
    // RING POSTS
    // ========================================

    const halfWidth = ARENA_WIDTH / 2;
    const halfDepth = ARENA_DEPTH / 2;

    const postPositions = [
        [-halfWidth, -halfDepth],
        [halfWidth, -halfDepth],
        [-halfWidth, halfDepth],
        [halfWidth, halfDepth]
    ];

    for (const [x, z] of postPositions) {
        const post = new THREE.Mesh(
            new THREE.BoxGeometry(0.24, 2.65, 0.24),
            postMaterial
        );

        post.position.set(x, 1.5, z);
        post.castShadow = true;

        arena.add(post);
    }

    // ========================================
    // RING ROPES
    // ========================================

    function addRope(start, end, height) {
        const a = new THREE.Vector3(
            start[0],
            height,
            start[1]
        );

        const b = new THREE.Vector3(
            end[0],
            height,
            end[1]
        );

        const direction = new THREE.Vector3()
            .subVectors(b, a);

        const length = direction.length();

        const rope = new THREE.Mesh(
            new THREE.CylinderGeometry(
                0.045,
                0.045,
                length,
                8
            ),
            ropeMaterial
        );

        rope.position.copy(a).add(b).multiplyScalar(0.5);

        rope.quaternion.setFromUnitVectors(
            new THREE.Vector3(0, 1, 0),
            direction.normalize()
        );

        rope.castShadow = true;
        arena.add(rope);
    }

    const ropeHeights = [0.85, 1.48, 2.1];

    for (const height of ropeHeights) {
        addRope(
            [-halfWidth, -halfDepth],
            [halfWidth, -halfDepth],
            height
        );

        addRope(
            [-halfWidth, halfDepth],
            [halfWidth, halfDepth],
            height
        );

        addRope(
            [-halfWidth, -halfDepth],
            [-halfWidth, halfDepth],
            height
        );

        addRope(
            [halfWidth, -halfDepth],
            [halfWidth, halfDepth],
            height
        );
    }

    // ========================================
    // ARENA DECORATION
    // ========================================

    const grid = new THREE.GridHelper(
        80,
        40,
        0x403b48,
        0x292630
    );

    grid.position.y = -0.205;

    arena.add(grid);

    // Side accent lights

    const leftAccent = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 2.3, 0.08),
        new THREE.MeshBasicMaterial({
            color: 0xff263f
        })
    );

    leftAccent.position.set(-halfWidth, 1.5, 0);
    arena.add(leftAccent);

    const rightAccent = new THREE.Mesh(
        new THREE.BoxGeometry(0.08, 2.3, 0.08),
        new THREE.MeshBasicMaterial({
            color: 0x315dff
        })
    );

    rightAccent.position.set(halfWidth, 1.5, 0);
    arena.add(rightAccent);

    scene.add(arena);

    // ========================================
    // STADIUM CROWD
    // ========================================

    const crowd = new THREE.Group();
    crowd.name = "SmashersAudience";
    const audiencePositions = [];

    const audienceColors = [
        0xb52b38, 0x315dff, 0xe4b04b, 0x3e9a76,
        0x8d5bc4, 0xd7dce5, 0x3a4658, 0xc76e3a
    ];

    for (let row = 0; row < 3; row += 1) {
        const seatY = 0.42 + row * 0.68;
        const seatZ = -6.0 - row * 0.9;

        const bench = new THREE.Mesh(
            new THREE.BoxGeometry(21, 0.24, 0.85),
            new THREE.MeshStandardMaterial({
                color: row % 2 ? 0x34323d : 0x282630,
                roughness: 0.82
            })
        );
        bench.position.set(0, seatY - 0.12, seatZ);
        bench.receiveShadow = true;
        crowd.add(bench);

        for (let column = 0; column < 15; column += 1) {
            audiencePositions.push({
                x: (column - 7) * 1.35,
                y: seatY,
                z: seatZ,
                color: audienceColors[(column * 3 + row * 5) % audienceColors.length]
            });
        }
    }

    function addAudiencePart(geometry, count, placement, scaleFor, rotationFor, materialColor = 0xffffff) {
        const mesh = new THREE.InstancedMesh(
            geometry,
            new THREE.MeshStandardMaterial({
                color: materialColor,
                roughness: 0.86
            }),
            count
        );

        const matrix = new THREE.Matrix4();
        const position = new THREE.Vector3();
        const scale = new THREE.Vector3();
        const quaternion = new THREE.Quaternion();

        for (let index = 0; index < count; index += 1) {
            const person = audiencePositions[index];
            const transform = placement(person, index);
            position.set(transform.x, transform.y, transform.z);
            scale.copy(scaleFor(person, index));
            quaternion.copy(rotationFor(person, index));
            matrix.compose(position, quaternion, scale);
            mesh.setMatrixAt(index, matrix);
            if (transform.color) {
                mesh.setColorAt(index, new THREE.Color(transform.color));
            }
        }

        mesh.instanceMatrix.needsUpdate = true;
        if (mesh.instanceColor) mesh.instanceColor.needsUpdate = true;
        mesh.castShadow = false;
        mesh.receiveShadow = false;
        crowd.add(mesh);
        return mesh;
    }

    const identityRotation = new THREE.Quaternion();
    const noScale = () => new THREE.Vector3(1, 1, 1);

    addAudiencePart(
        new THREE.CapsuleGeometry(0.17, 0.34, 2, 7),
        audiencePositions.length,
        person => ({
            x: person.x, y: person.y + 0.40, z: person.z,
            color: person.color
        }),
        () => noScale(),
        () => identityRotation
    );

    addAudiencePart(
        new THREE.SphereGeometry(0.125, 8, 6),
        audiencePositions.length,
        person => ({ x: person.x, y: person.y + 0.83, z: person.z + 0.015 }),
        () => noScale(),
        () => identityRotation,
        0xc18d6d
    );

    const legRotation = new THREE.Quaternion().setFromEuler(
        new THREE.Euler(Math.PI / 2, 0, 0)
    );

    for (const side of [-1, 1]) {
        addAudiencePart(
            new THREE.CapsuleGeometry(0.065, 0.22, 2, 5),
            audiencePositions.length,
            person => ({
                x: person.x + side * 0.105,
                y: person.y + 0.105,
                z: person.z + 0.20
            }),
            () => noScale(),
            () => legRotation,
            0x24242c
        );
    }

    for (const side of [-1, 1]) {
        const armRotation = new THREE.Quaternion().setFromEuler(
            new THREE.Euler(0, 0, side * 0.58)
        );

        addAudiencePart(
            new THREE.CapsuleGeometry(0.052, 0.26, 2, 5),
            audiencePositions.length,
            person => ({
                x: person.x + side * 0.225,
                y: person.y + 0.50,
                z: person.z + 0.025
            }),
            () => noScale(),
            () => armRotation,
            0xc18d6d
        );
    }

    scene.add(crowd);

    // ========================================
    // REFEREE
    // ========================================

    const referee = new THREE.Group();
    referee.name = "RingReferee";

    const refereeBlack = new THREE.MeshStandardMaterial({ color: 0x17191f, roughness: 0.78 });
    const refereeWhite = new THREE.MeshStandardMaterial({ color: 0xe8e8e3, roughness: 0.88 });
    const refereeSkin = new THREE.MeshStandardMaterial({ color: 0xb77d5d, roughness: 0.82 });
    const refereeGold = new THREE.MeshStandardMaterial({ color: 0xd6ad45, metalness: 0.45, roughness: 0.35 });

    function refereeMesh(geometry, material, parent, x, y, z) {
        const mesh = new THREE.Mesh(geometry, material);
        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        parent.add(mesh);
        return mesh;
    }

    refereeMesh(
        new THREE.CapsuleGeometry(0.22, 0.48, 4, 8),
        refereeBlack,
        referee,
        0, 1.20, 0
    );

    for (const height of [1.02, 1.18, 1.34, 1.50]) {
        refereeMesh(
            new THREE.BoxGeometry(0.37, 0.055, 0.035),
            refereeWhite,
            referee,
            0, height, 0.205
        );
    }

    refereeMesh(
        new THREE.SphereGeometry(0.21, 12, 10),
        refereeSkin,
        referee,
        0, 1.88, 0
    );

    refereeMesh(
        new THREE.BoxGeometry(0.48, 0.30, 0.34),
        refereeBlack,
        referee,
        0, 0.73, 0
    );

    refereeMesh(
        new THREE.BoxGeometry(0.20, 0.045, 0.055),
        refereeGold,
        referee,
        0, 1.57, 0.22
    );

    const refereeArms = [];
    for (const side of [-1, 1]) {
        const pivot = new THREE.Group();
        pivot.position.set(side * 0.27, 1.53, 0);
        referee.add(pivot);

        refereeMesh(
            new THREE.CapsuleGeometry(0.075, 0.35, 3, 6),
            refereeWhite,
            pivot,
            0, -0.23, 0
        );

        refereeMesh(
            new THREE.SphereGeometry(0.09, 8, 7),
            refereeSkin,
            pivot,
            0, -0.48, 0.02
        );

        refereeArms.push(pivot);
    }

    referee.position.set(0, 0.18, -2.25);
    scene.add(referee);

    function startRefereeCount(fighterPosition) {
        const side = fighterPosition.x > 0 ? -1 : 1;
        referee.position.set(
            THREE.MathUtils.clamp(fighterPosition.x + side * 1.15, -4.4, 4.4),
            0.18,
            THREE.MathUtils.clamp(fighterPosition.z + 0.75, -2.25, 2.25)
        );
        referee.rotation.y = side > 0 ? Math.PI / 2 : -Math.PI / 2;
        refereeArms[1].rotation.z = -0.9;
    }

    function updateRefereeCount(count) {
        refereeArms[1].rotation.z = -0.95 - Math.sin(count * 0.72) * 0.32;
        refereeArms[0].rotation.z = 0.18;
    }

    function resetReferee() {
        referee.position.set(0, 0.18, -2.25);
        referee.rotation.set(0, 0, 0);
        refereeArms.forEach((arm) => arm.rotation.set(0, 0, 0));
    }

    // ========================================
    // RESIZE
    // ========================================


    function resize() {
        const width = Math.max(
            1,
            viewport.clientWidth || window.innerWidth
        );

        const height = Math.max(
            1,
            viewport.clientHeight || window.innerHeight
        );

        camera.aspect = width / height;
        camera.updateProjectionMatrix();

        renderer.setSize(width, height, false);
    }

    resize();

    // ========================================
    // WORLD UPDATE
    // ========================================

    function update(delta, elapsed, playerPosition = null, opponentPosition = null) {
        // Subtle arena lighting variation.
        redLight.intensity = 65 + Math.sin(elapsed * 1.4) * 3;
        blueLight.intensity = 55 + Math.sin(elapsed * 1.4 + 1.5) * 3;

        // Keep both fighters framed while retaining the side-on boxing view.
        if (playerPosition && opponentPosition) {
            const centerX = (playerPosition.x + opponentPosition.x) * 0.5;
            const centerZ = (playerPosition.z + opponentPosition.z) * 0.5;
            const spread = Math.abs(playerPosition.x - opponentPosition.x);
            const desired = new THREE.Vector3(
                centerX * 0.18,
                6.5 + Math.min(0.5, spread * 0.025),
                17.2 + Math.max(0, spread - 4.2) * 0.34
            );

            camera.position.lerp(desired, 1 - Math.exp(-delta * 3.2));
            camera.lookAt(centerX * 0.72, 1.12, centerZ * 0.12);
        }

        // Small referee movement keeps the official from looking frozen.
        refereeArms[0].rotation.z = Math.sin(elapsed * 1.1) * 0.035;
    }

    // ========================================
    // CLEANUP
    // ========================================

    function dispose() {
        renderer.dispose();

        scene.traverse((object) => {
            if (!object.isMesh && !object.isLineSegments) {
                return;
            }

            if (object.geometry) {
                object.geometry.dispose();
            }

            if (Array.isArray(object.material)) {
                object.material.forEach((material) => {
                    material.dispose();
                });
            } else if (object.material) {
                object.material.dispose();
            }
        });
    }

    return {
        scene,
        camera,
        renderer,
        clock,
        arena,
        crowd,
        referee,
        startRefereeCount,
        updateRefereeCount,
        resetReferee,
        resize,
        update,
        dispose
    };
}
