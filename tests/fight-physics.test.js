import test from "node:test";
import assert from "node:assert/strict";
import {
  clampFighterPosition,
  resolveFighterPair,
  segmentSphereHit,
  punchHitsHurtboxes
} from "../scr/fight-physics.js";

const bounds = { minX: -5, maxX: 5, minZ: -3, maxZ: 3 };

test("ring clamp keeps the complete body radius inside each edge", () => {
  const position = { x: 5.4, z: -3.4 };
  clampFighterPosition(position, 0.4, bounds);
  assert.deepEqual(position, { x: 4.6, z: -2.6 });
});

test("fighter collision separates overlapping bodies symmetrically", () => {
  const a = { x: -0.2, z: 0 };
  const b = { x: 0.2, z: 0 };
  const result = resolveFighterPair(a, b, 0.45, 0.45, bounds);
  assert.equal(result.separated, true);
  assert.ok(Math.abs(result.distance - 0.9) < 1e-4);
  assert.ok(Math.abs(a.x + b.x) < 1e-4);
});

test("coincident fighter centres resolve deterministically without NaN", () => {
  const a = { x: 0, z: 0 };
  const b = { x: 0, z: 0 };
  const result = resolveFighterPair(a, b, 0.4, 0.4, bounds);
  assert.equal(result.separated, true);
  assert.ok(Number.isFinite(a.x) && Number.isFinite(b.x));
});

test("collision at a ring edge pushes the movable fighter instead of escaping the ring", () => {
  const a = { x: -4.9, z: 0 };
  const b = { x: -4.7, z: 0 };
  const result = resolveFighterPair(a, b, 0.5, 0.5, bounds);
  assert.equal(result.separated, true);
  assert.ok(a.x >= -4.5 - 1e-4);
  assert.ok(b.x >= -4.5 - 1e-4);
  assert.ok(result.distance >= 0.999);
});

test("swept punch capsule registers a torso contact", () => {
  const start = { x: 0, y: 1.4, z: 0 };
  const end = { x: 0, y: 1.4, z: 1.2 };
  const center = { x: 0, y: 1.4, z: 1.45 };
  assert.equal(segmentSphereHit(start, end, center, 0.45), true);
});

test("swept punch rejects a target outside its radius", () => {
  const start = { x: 0, y: 1.4, z: 0 };
  const end = { x: 0, y: 1.4, z: 1.2 };
  const center = { x: 0, y: 2.5, z: 1.2 };
  assert.equal(segmentSphereHit(start, end, center, 0.4), false);
});

test("punch contact returns the actual hurtbox zone", () => {
  const punch = {
    start: { x: 0, y: 1.4, z: 0 },
    end: { x: 0, y: 1.4, z: 1.2 },
    radius: 0.18
  };
  const hurtboxes = [
    { zone: "head", center: { x: 0, y: 1.9, z: 1.4 }, radius: 0.2 },
    { zone: "torso", center: { x: 0, y: 1.4, z: 1.4 }, radius: 0.32 }
  ];
  assert.equal(punchHitsHurtboxes(punch, hurtboxes)?.zone, "torso");
});
