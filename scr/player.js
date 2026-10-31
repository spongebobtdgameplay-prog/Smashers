
export function createFighter(THREE, options = {}) {
    const {
        name = "FIGHTER",
        color = 0x29313d,
        gloveColor = 0xe52d42,
        position = [0, 0.18, 0],
        maxHealth = 100,
        loader = null,
        modelUrl = "",
        modelUrls = null,
        modelRotation = [0, 0, 0]
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
        walkPhase: 0,
        knockedDown: false,
        model: null,
        mixer: null,
        actions: new Map(),
        activeAction: null,
        activeActionName: "",
        modelBones: new Map(),
        baseBoneQuaternions: new Map(),
        baseBonePositions: new Map(),
        modelGloves: new Map(),
        modelRawSourceSize: null,
        modelSourceSize: null,
        modelScale: 1,
        modelScaledSize: null,
        modelExpectedBounds: null,
        modelOrigin: null,
        accessoryTransforms: null,
        attackHitResolved: false
    };

    function addMesh(geometry, material, parent, x, y, z) {
        const mesh = new THREE.Mesh(geometry, material);

        mesh.position.set(x, y, z);
        mesh.castShadow = true;
        mesh.receiveShadow = false;

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
    // ONLINE BOXER MODEL
    // ========================================

    function playModelAction(name, loop = true, restart = false) {
        const next = state.actions.get(name);
        if (!next) return;
        if (state.activeAction === next && state.activeActionName === name && !restart) return;

        next.reset();
        next.enabled = true;
        next.setLoop(loop ? THREE.LoopRepeat : THREE.LoopOnce, loop ? Infinity : 1);
        next.clampWhenFinished = !loop;
        next.fadeIn(0.12).play();

        if (state.activeAction && state.activeAction !== next) {
            state.activeAction.fadeOut(0.12);
        }

        state.activeAction = next;
        state.activeActionName = name;
    }

    function setupBoxerModel(sourceModel, animations) {
        // Read the imported GLB bounds in its own authored coordinate system.
        sourceModel.updateMatrixWorld(true);
        const rawBounds = new THREE.Box3().setFromObject(sourceModel);
        const rawSize = rawBounds.getSize(new THREE.Vector3());

        // Some Quaternius exports are Z-up. An outer group rotates the whole
        // skinned rig, while the fit is calculated from rotated box corners.
        const model = new THREE.Group();
        model.name = `${name}BoxerModelRoot`;
        model.rotation.set(
            modelRotation[0] ?? 0,
            modelRotation[1] ?? 0,
            modelRotation[2] ?? 0
        );

        const rotation = model.quaternion.clone();
        const orientedBounds = new THREE.Box3().makeEmpty();
        for (const x of [rawBounds.min.x, rawBounds.max.x]) {
            for (const y of [rawBounds.min.y, rawBounds.max.y]) {
                for (const z of [rawBounds.min.z, rawBounds.max.z]) {
                    orientedBounds.expandByPoint(
                        new THREE.Vector3(x, y, z).applyQuaternion(rotation)
                    );
                }
            }
        }

        const orientedSize = orientedBounds.getSize(new THREE.Vector3());
        const orientedCenter = orientedBounds.getCenter(new THREE.Vector3());
        const fitScale = 1.76 / Math.max(orientedSize.y, 0.001);
        const scaledSize = orientedSize.clone().multiplyScalar(fitScale);

        state.modelRawSourceSize = rawSize.toArray();
        state.modelSourceSize = orientedSize.toArray();
        state.modelScale = fitScale;
        state.modelScaledSize = scaledSize.toArray();
        state.modelExpectedBounds = {
            min: [-scaledSize.x * 0.5, 0, -scaledSize.z * 0.5],
            max: [scaledSize.x * 0.5, scaledSize.y, scaledSize.z * 0.5]
        };

        model.add(sourceModel);
        model.scale.setScalar(fitScale);
        model.position.set(
            -orientedCenter.x * fitScale,
            -orientedBounds.min.y * fitScale,
            -orientedCenter.z * fitScale
        );
        model.updateMatrixWorld(true);
        state.modelOrigin = model.position.toArray();

        model.traverse((object) => {
            if (!object.isMesh) return;
            object.castShadow = true;
            object.receiveShadow = false;
            const materials = Array.isArray(object.material)
                ? object.material
                : [object.material];

            for (const material of materials) {
                if (!material) continue;
                if ("roughness" in material) {
                    material.roughness = Math.max(material.roughness ?? 0.55, 0.58);
                }
                material.needsUpdate = true;
            }
        });

        // Exact bone names from the Quaternius worker.glb rig.
        const boneNames = [
            "Root", "Body", "Hips", "Abdomen", "Torso", "Chest", "Neck", "Head",
            "ShoulderL", "UpperArmL", "LowerArmL", "WristL",
            "ShoulderR", "UpperArmR", "LowerArmR", "WristR",
            "UpperLegL", "LowerLegL", "UpperLegR", "LowerLegR", "FootL", "FootR"
        ];

        for (const name of boneNames) {
            const bone = sourceModel.getObjectByName(name);
            if (bone?.isBone) {
                state.modelBones.set(name, bone);
                state.baseBoneQuaternions.set(name, bone.quaternion.clone());
                state.baseBonePositions.set(name, bone.position.clone());
            }
        }

        // Boxing trunks are attached to the pelvis so they follow the rig.
        // These imported bones carry very large local transform scales.
        // Cancel that inherited scale for accessory geometry so gloves and
        // trunks keep their intended world-space dimensions.
        function attachAccessoryInWorldUnits(parent, mesh, desiredPosition, desiredScale = [1, 1, 1]) {
            parent.updateMatrixWorld(true);

            const inheritedScale = parent.getWorldScale(new THREE.Vector3());
            const safeX = Math.max(Math.abs(inheritedScale.x), 0.0001);
            const safeY = Math.max(Math.abs(inheritedScale.y), 0.0001);
            const safeZ = Math.max(Math.abs(inheritedScale.z), 0.0001);

            mesh.position.set(
                desiredPosition[0] / safeX,
                desiredPosition[1] / safeY,
                desiredPosition[2] / safeZ
            );
            mesh.scale.set(
                desiredScale[0] / safeX,
                desiredScale[1] / safeY,
                desiredScale[2] / safeZ
            );
            mesh.castShadow = true;
            parent.add(mesh);
            mesh.updateMatrixWorld(true);

            return {
                inheritedScale: inheritedScale.toArray(),
                localPosition: mesh.position.toArray(),
                localScale: mesh.scale.toArray(),
                worldScale: mesh.getWorldScale(new THREE.Vector3()).toArray()
            };
        }

        const hips = state.modelBones.get("Hips");
        if (hips) {
            const trunks = new THREE.Mesh(
                new THREE.CylinderGeometry(0.22, 0.25, 0.22, 12),
                new THREE.MeshStandardMaterial({
                    color: options.shortsColor ?? gloveColor,
                    roughness: 0.72
                })
            );
            trunks.name = "SmashersBoxingTrunks";
            state.accessoryTransforms = {
                trunks: attachAccessoryInWorldUnits(
                    hips,
                    trunks,
                    [0, -0.10, 0],
                    [1, 1, 1]
                )
            };
        }

        // Add boxing gloves to the model's wrist bones.
        for (const side of ["L", "R"]) {
            const wrist = state.modelBones.get(`Wrist${side}`);
            if (!wrist) continue;

            const glove = new THREE.Mesh(
                new THREE.SphereGeometry(0.105, 12, 10),
                new THREE.MeshStandardMaterial({
                    color: gloveColor,
                    roughness: 0.48,
                    metalness: 0.03
                })
            );
            glove.name = `SmashersBoxingGlove.${side}`;

            const transform = attachAccessoryInWorldUnits(
                wrist,
                glove,
                [0, -0.01, 0.04],
                [1.0, 0.9, 1.1]
            );

            state.accessoryTransforms.gloves ??= {};
            state.accessoryTransforms.gloves[side] = transform;
            state.modelGloves.set(side, glove);
        }

        if (animations?.length) {
            state.mixer = new THREE.AnimationMixer(sourceModel);
            const definitions = [
                ["idle", /idle|breath/i],
                ["walk", /walk|jog|run/i],
                ["punch", /punch|attack|jab|hook/i],
                ["fall", /death|knock.?down|fall/i]
            ];

            for (const [name, pattern] of definitions) {
                const clip = animations.find((entry) => pattern.test(entry.name));
                if (clip) state.actions.set(name, state.mixer.clipAction(clip));
            }

            if (state.actions.has("idle")) {
                playModelAction("idle");
            }
        }

        return model;
    }

    const modelSources = Array.isArray(modelUrls) && modelUrls.length
        ? modelUrls.filter(Boolean)
        : modelUrl
            ? [modelUrl]
            : [];

    const poseEuler = new THREE.Euler();
    const poseQuaternion = new THREE.Quaternion();

    function applyModelBonePose(name, x = 0, y = 0, z = 0) {
        const bone = state.modelBones.get(name);
        const base = state.baseBoneQuaternions.get(name);
        if (!bone || !base) return;

        poseEuler.set(x, y, z, "XYZ");
        poseQuaternion.setFromEuler(poseEuler);
        bone.quaternion.copy(base).multiply(poseQuaternion);
    }

    const ready = loader && modelSources.length
        ? (async () => {
            let lastError = null;

            for (const source of modelSources) {
                try {
                    const gltf = await loader.loadAsync(source);
                    const sourceModel = gltf.scene;
                    const model = setupBoxerModel(sourceModel, gltf.animations || []);

                    state.model = model;
                    root.add(model);

                    // Keep the procedural fighter visible unless a model loaded.
                    root.traverse((object) => {
                        if (
                            object.isMesh &&
                            !object.name.startsWith("Smashers") &&
                            !state.model.getObjectById(object.id)
                        ) {
                            object.visible = false;
                        }
                    });

                    return true;
                } catch (error) {
                    lastError = error;
                    console.warn(
                        `[SMASHERS] Boxer model source failed for ${name}: ${source}`,
                        error
                    );
                }
            }

            console.warn(
                `[SMASHERS] No online boxer model loaded for ${name}; using built-in fallback.`,
                lastError
            );
            return false;
        })()
        : Promise.resolve(false);

    // ========================================
    // FIGHTER API
    // ========================================

    const fighter = {
        name,
        root,
        torso,
        state,
        ready,

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

        get isKnockedDown() {
            return state.knockedDown;
        },

        get isDodging() {
            return state.dodgeTimer > 0;
        },

        get isWalking() {
            return state.walking;
        },

        get isAttacking() {
            return state.attackTimer > 0.035 &&
                !state.attackHitResolved &&
                !state.knockedDown;
        },

        get hasLandedAttack() {
            return state.attackHitResolved;
        },

        getHurtboxes() {
            root.updateMatrixWorld(true);

            const definitions = [
                ["Head", 0.24, "head"],
                ["Chest", 0.34, "torso"],
                ["Torso", 0.34, "torso"],
                ["Abdomen", 0.30, "body"],
                ["Hips", 0.29, "body"],
                ["UpperArmL", 0.145, "arm"],
                ["UpperArmR", 0.145, "arm"]
            ];

            const boxes = [];
            if (state.model) {
                for (const [boneName, radius, zone] of definitions) {
                    const bone = state.modelBones.get(boneName);
                    if (!bone) continue;
                    boxes.push({
                        zone,
                        radius,
                        center: bone.getWorldPosition(new THREE.Vector3())
                    });
                }
            }

            if (!boxes.length) {
                const fallback = [
                    [0, 1.94, 0, 0.27, "head"],
                    [0, 1.45, 0, 0.39, "torso"],
                    [0, 1.05, 0, 0.34, "body"],
                    [-0.43, 1.43, 0, 0.19, "arm"],
                    [0.43, 1.43, 0, 0.19, "arm"]
                ];

                for (const [x, y, z, radius, zone] of fallback) {
                    boxes.push({
                        zone,
                        radius,
                        center: root.localToWorld(new THREE.Vector3(x, y, z))
                    });
                }
            }

            return boxes;
        },

        getPunchHitbox() {
            root.updateMatrixWorld(true);

            const lowerArm = state.modelBones.get("LowerArmR");
            const glove = state.modelGloves.get("R");
            if (state.model && lowerArm && glove) {
                return {
                    start: lowerArm.getWorldPosition(new THREE.Vector3()),
                    end: glove.getWorldPosition(new THREE.Vector3()),
                    radius: 0.19
                };
            }

            return {
                start: rightArm.pivot.getWorldPosition(new THREE.Vector3()),
                end: rightArm.glove.getWorldPosition(new THREE.Vector3()),
                radius: 0.20
            };
        },

        registerAttackHit() {
            if (!state.attackTimer || state.attackHitResolved) return false;
            state.attackHitResolved = true;
            return true;
        },

        getForwardVector() {
            return new THREE.Vector3(0, 0, 1)
                .applyQuaternion(root.quaternion)
                .setY(0)
                .normalize();
        },

        move(dx, dz, delta, speed) {
            if (state.knockedDown) return;

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
                state.knockedDown ||
                state.attackCooldown > 0 ||
                state.health <= 0
            ) {
                return false;
            }

            state.attackCooldown = 0.46;
            state.attackTimer = state.attackDuration;
            state.attackHitResolved = false;
            if (state.actions.has("punch")) playModelAction("punch", false, true);

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
                state.knockedDown ||
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
            if (state.mixer) {
                if (state.knockedDown && state.actions.has("fall")) {
                    playModelAction("fall", false);
                } else if (!state.knockedDown && state.attackTimer > 0 && state.actions.has("punch")) {
                    playModelAction("punch", false);
                } else if (!state.knockedDown && state.actions.has("walk") && state.walking) {
                    playModelAction("walk");
                } else if (!state.knockedDown && state.actions.has("idle")) {
                    playModelAction("idle");
                }

                state.mixer.update(delta);
            }

            if (state.model && !state.actions.has("punch")) {
                const swing = state.walking ? Math.sin(state.walkPhase) : 0;
                const punchAmount = state.attackTimer > 0
                    ? Math.sin((1 - state.attackTimer / state.attackDuration) * Math.PI) * 0.92
                    : 0;
                const guardAmount = state.blocking ? 0.30 : 0;
                const stepAmount = state.walking ? swing * 0.24 : 0;

                // The Infinity Store rig uses these same Quaternius bone names.
                // Keep both hands in a guard stance and drive the right jab locally.
                applyModelBonePose("UpperArmL", -stepAmount - guardAmount, 0, 1.10 + guardAmount);
                applyModelBonePose("UpperArmR", stepAmount - punchAmount - guardAmount, 0, -1.10 - guardAmount);
                applyModelBonePose("LowerArmL", -0.17 + Math.max(0, swing) * 0.12, 0, 0);
                applyModelBonePose("LowerArmR", -0.17 + Math.max(0, -swing) * 0.12, 0, 0);

            }

            // Apply the glove extension after the animation mixer. A matched
            // punch clip also writes WristR each frame; placing this outside
            // the manual-pose-only branch makes the visible glove and sweep
            // move together for both animated and procedural rigs.
            if (state.model) {
                const rightWrist = state.modelBones.get("WristR");
                const wristBase = state.baseBonePositions.get("WristR");
                if (rightWrist && wristBase) {
                    const extension = state.attackTimer > 0
                        ? Math.sin(
                            (1 - state.attackTimer / state.attackDuration) * Math.PI
                        ) * 0.32
                        : 0;

                    if (state.mixer && state.actions.has("punch")) {
                        // The mixer has just restored this frame's animated
                        // wrist pose, so add extension without accumulating it.
                    } else {
                        rightWrist.position.copy(wristBase);
                    }

                    // Quaternius' rig has a large scale baked into the wrist
                    // parent chain. Convert the requested world-space jab
                    // extension into that parent's local units.
                    const wristParent = rightWrist.parent;
                    wristParent?.updateMatrixWorld(true);
                    const parentScale = wristParent
                        ? wristParent.getWorldScale(new THREE.Vector3())
                        : new THREE.Vector3(1, 1, 1);
                    const localExtension = extension /
                        Math.max(Math.abs(parentScale.z), 0.0001);
                    rightWrist.position.z += localExtension;

                    state.wristExtensionWorld = extension;
                    state.wristParentWorldScale = parentScale.toArray();
                    state.wristExtensionLocal = localExtension;
                }
            }

            const downTarget = state.knockedDown ? -Math.PI * 0.49 : 0;
            root.rotation.z = THREE.MathUtils.lerp(
                root.rotation.z,
                downTarget,
                1 - Math.exp(-delta * 10)
            );
            const targetHeight = state.dodgeTimer > 0 && !state.knockedDown
                ? 0.10
                : 0.18;
            root.position.y = THREE.MathUtils.lerp(
                root.position.y,
                targetHeight,
                1 - Math.exp(-delta * 12)
            );

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

            const swing = state.walking && !state.knockedDown
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

            // Dodge lean. Height is controlled once above so the
            // knockdown pose cannot be overwritten by the standing pose.
            if (state.dodgeTimer > 0 && !state.knockedDown) {
                torso.rotation.x = 0.12;
            } else {
                torso.rotation.x = 0;
            }

            // Return idle arms to their neutral position.
            if (!state.blocking && state.attackTimer <= 0) {
                leftArm.pivot.rotation.set(0, 0, 0);
                rightArm.pivot.rotation.set(0, 0, 0);
            }
        },

        knockDown() {
            if (state.knockedDown) return;
            state.knockedDown = true;
            state.walking = false;
            state.blocking = false;
            state.attackTimer = 0;
            state.attackHitResolved = true;
            state.dodgeTimer = 0;
            state.dodgeCooldown = Math.max(state.dodgeCooldown, 0.2);
            if (state.actions.has("fall")) playModelAction("fall", false, true);
        },

        standUp() {
            state.knockedDown = false;
            state.attackHitResolved = true;
            state.attackTimer = 0;
            root.rotation.z = 0;
            root.position.y = 0.18;
            if (state.actions.has("idle")) playModelAction("idle", true, true);
        },

        recover(health = 40) {
            state.health = THREE.MathUtils.clamp(health, 1, state.maxHealth);
            this.standUp();
        },

        reset() {
            state.health = state.maxHealth;
            state.attackCooldown = 0;
            state.attackTimer = 0;
            state.attackHitResolved = false;
            state.dodgeCooldown = 0;
            state.dodgeTimer = 0;
            state.blocking = false;
            state.walking = false;
            state.walkPhase = 0;
            state.knockedDown = false;
            root.position.set(
                position[0] ?? 0,
                position[1] ?? 0.18,
                position[2] ?? 0
            );
            root.rotation.set(0, 0, 0);
            if (state.model) {
                state.model.visible = true;
                if (state.actions.has("idle")) playModelAction("idle");
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
