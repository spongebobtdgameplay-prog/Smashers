
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

    function update(delta, elapsed) {
        // Subtle arena lighting variation.
        redLight.intensity =
            65 + Math.sin(elapsed * 1.4) * 3;

        blueLight.intensity =
            55 + Math.sin(elapsed * 1.4 + 1.5) * 3;
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
        resize,
        update,
        dispose
    };
}
