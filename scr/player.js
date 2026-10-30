
export function createFighter(THREE, options = {}) {
    const {
        name = "FIGHTER",
        color = 0x29313d,
        gloveColor = 0xe52d42,
        position = [0, 0.18, 0],
        maxHealth = 100
    } = options;

    const root = new THREE.Group();
    root.name = name;

    const bodyMaterial = new THREE.MeshStandardMaterial({
        color,
        roughness: 0.72
    });

    const skinMaterial = new THREE.MeshStandardMaterial({
        color: 0xb77d5d,
        roughness: 0.82
    });

    const gloveMaterial = new THREE.MeshStandardMaterial({
        color: gloveColor,
        roughness: 0.5,
        metalness: 0.05
    });

    const shoeMaterial = new THREE.MeshStandardMaterial({
        color: 0x17191f,
        roughness: 0.8
    });

    const detailMaterial = new THREE.MeshStandardMaterial({
        color: 0x11141a,
        roughness: 0.55
    });

    const state = {
        health: maxHealth,
        maxHealth,

        attackCooldown: 0,
        attackTimer: 0,
        attackDuration: 0.25,

        dodgeCooldown: 0,
        dodgeTimer: 0,
        dodgeDuration: 0.23,

        blocking: false,
        walking: false,
        walkPhase: 0
    };

    function addMesh(geometry, material, parent, x, y, z) {
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = true;

        parent.add(mesh);

        return mesh;
    }

    // ========================================
    // TORSO
    // ========================================

    const torso = addMesh(
        new THREE.CapsuleGeometry(0.38, 0.72, 5, 12),
        bodyMaterial,
        root,
        0,
        1.38,
        0
    );

    // Waist detail

    addMesh(
        new THREE.BoxGeometry(0.65, 0.2, 0.42),
        detailMaterial,
        root,
        0,
        0.91,
        0
    );

    // ========================================
    // HEAD
    // ========================================

    const headGroup = new THREE.Group();
    headGroup.position.set(0, 2.24, 0);

    root.add(headGroup);

    addMesh(
        new THREE.SphereGeometry(0.31, 20, 16),
        skinMaterial,
        headGroup,
        0,
        0,
        0
    );

    // Hair / head covering

    addMesh(
        new THREE.SphereGeometry(
            0.315,
            16,
            12,
            0,
            Math.PI * 2,
            0,
            Math.PI * 0.52
        ),
        bodyMaterial,
        headGroup,
        0,
        0.055,
        0
    );

    // Eyes facing the default forward direction (+Z)

    addMesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        detailMaterial,
        headGroup,
        -0.115,
        0.005,
        0.283
    );

    addMesh(
        new THREE.SphereGeometry(0.035, 8, 8),
        detailMaterial,
        headGroup,
        0.115,
        0.005,
        0.283
    );

    // ========================================
    // ARMS AND GLOVES
    // ========================================

    function createArm(side) {
        const pivot = new THREE.Group();

        pivot.position.set(
            side * 0.48,
            1.69,
            0
        );

        root.add(pivot);

        addMesh(
            new THREE.CapsuleGeometry(0.135, 0.48, 4, 10),
            skinMaterial,
            pivot,
            0,
            -0.34,
            0
        );

        const glove = addMesh(
            new THREE.SphereGeometry(0.2, 14, 12),
            gloveMaterial,
            pivot,
            0,
            -0.7,
            0.055
        );

        addMesh(
            new THREE.BoxGeometry(0.22, 0.12, 0.2),
            detailMaterial,
            pivot,
            0,
            -0.55,
            0.04
        );

        return {
            pivot,
            glove
        };
    }

    const leftArm = createArm(-1);
    const rightArm = createArm(1);

    // ========================================
    // LEGS AND SHOES
    // ========================================

    function createLeg(side) {
        const pivot = new THREE.Group();

        pivot.position.set(
            side * 0.23,
            0.76,
            0
        );

        root.add(pivot);

        addMesh(
            new THREE.CapsuleGeometry(0.16, 0.5, 4, 10),
            bodyMaterial,
            pivot,
            0,
            -0.36,
            0
        );

        addMesh(
            new THREE.BoxGeometry(0.32, 0.17, 0.47),
            shoeMaterial,
            pivot,
            0,
            -0.72,
            0.09
        );

        return pivot;
    }

    const leftLeg = createLeg(-1);
    const rightLeg = createLeg(1);

    // ========================================
    // FIGHTER API
    // ========================================

    const fighter = {
        name,
        root,
        torso,
        state,

        leftArm,
        rightArm,
        leftLeg,
        rightLeg,

        get position() {
            return root.position;
        },

        get health() {
            return state.health;
        },

        get maxHealth() {
            return state.maxHealth;
        },

        get isBlocking() {
            return state.blocking;
        },

        get isDodging() {
            return state.dodgeTimer > 0;
        },

        get isWalking() {
            return state.walking;
        },

        move(dx, dz, delta, speed) {
            const length = Math.hypot(dx, dz);

            state.walking = length > 0.001;

            if (!state.walking) return;

            dx /= length;
            dz /= length;

            root.position.x += dx * speed * delta;
            root.position.z += dz * speed * delta;

            state.walkPhase += delta * 9;
        },

        setFacing(directionX) {
            if (Math.abs(directionX) < 0.001) return;

            // The fighter's default forward direction is +Z.
            // Rotate toward the opponent along the X axis.
            root.rotation.y = directionX > 0
                ? Math.PI / 2
                : -Math.PI / 2;
        },

        attack() {
            if (
                state.attackCooldown > 0 ||
                state.health <= 0
            ) {
                return false;
            }

            state.attackCooldown = 0.46;
            state.attackTimer = state.attackDuration;

            return true;
        },

        dodge() {
            if (
                state.dodgeCooldown > 0 ||
                state.health <= 0
            ) {
                return false;
            }

            state.dodgeCooldown = 0.95;
            state.dodgeTimer = state.dodgeDuration;

            return true;
        },

        setBlocking(active) {
            state.blocking = Boolean(active);
        },

        takeDamage(amount) {
            if (
                !Number.isFinite(amount) ||
                amount <= 0 ||
                state.health <= 0
            ) {
                return 0;
            }

            // Dodge gives temporary complete protection.
            if (state.dodgeTimer > 0) {
                return 0;
            }

            // Blocking reduces incoming damage.
            const actualDamage = state.blocking
                ? amount * 0.3
                : amount;

            const previousHealth = state.health;

            state.health = Math.max(
                0,
                state.health - actualDamage
            );

            return previousHealth - state.health;
        },

        update(delta) {
            state.attackCooldown = Math.max(
                0,
                state.attackCooldown - delta
            );

            state.attackTimer = Math.max(
                0,
                state.attackTimer - delta
            );

            state.dodgeCooldown = Math.max(
                0,
                state.dodgeCooldown - delta
            );

            state.dodgeTimer = Math.max(
                0,
                state.dodgeTimer - delta
            );

            // Walking animation

            const swing = state.walking
                ? Math.sin(state.walkPhase) * 0.42
                : 0;

            leftLeg.rotation.x = swing;
            rightLeg.rotation.x = -swing;

            // Attack animation

            let attackRotation = 0;

            if (state.attackTimer > 0) {
                const progress = 1 -
                    state.attackTimer / state.attackDuration;

                attackRotation =
                    -Math.sin(progress * Math.PI) * 1.35;
            }

            // Defensive blocking pose

            const blockRotation = state.blocking
                ? -0.48
                : 0;

            leftArm.pivot.rotation.x = blockRotation;
            leftArm.pivot.rotation.z = state.blocking
                ? 0.25
                : 0;

            rightArm.pivot.rotation.x =
                state.attackTimer > 0
                    ? attackRotation
                    : blockRotation;

            rightArm.pivot.rotation.z = state.blocking
                ? -0.25
                : 0;

            // Dodge crouch

            if (state.dodgeTimer > 0) {
                const progress = 1 -
                    state.dodgeTimer / state.dodgeDuration;

                root.position.y =
                    0.18 - Math.sin(progress * Math.PI) * 0.12;

                torso.rotation.x = 0.12;
            } else {
                root.position.y = 0.18;
                torso.rotation.x = 0;
            }

            // Return idle arms to their neutral position.
            if (!state.blocking && state.attackTimer <= 0) {
                leftArm.pivot.rotation.set(0, 0, 0);
                rightArm.pivot.rotation.set(0, 0, 0);
            }
        },

        dispose() {
            root.traverse((object) => {
                if (object.isMesh) {
                    object.geometry.dispose();

                    if (Array.isArray(object.material)) {
                        object.material.forEach((material) => {
                            material.dispose();
                        });
                    } else {
                        object.material.dispose();
                    }
                }
            });
        }
    };

    root.position.set(
        position[0] ?? 0,
        position[1] ?? 0.18,
        position[2] ?? 0
    );

    return fighter;
}
