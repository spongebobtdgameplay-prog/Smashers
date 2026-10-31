import test from "node:test";
import assert from "node:assert/strict";
import {
  clampFighterPosition,
  resolveFighterPair,
  segmentSphereHit,
  segmentSegmentDistanceSquared,
  segmentCapsuleHit,
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

test("diagonal collision resolves both axes and keeps both fighters in bounds", () => {
  const a = { x: -0.15, z: -0.10 };
  const b = { x: 0.15, z: 0.10 };
  const result = resolveFighterPair(a, b, 0.5, 0.5, bounds);
  assert.equal(result.separated, true);
  assert.ok(result.distance >= 0.999);
  for (const p of [a, b]) {
    assert.ok(p.x >= bounds.minX + 0.5 && p.x <= bounds.maxX - 0.5);
    assert.ok(p.z >= bounds.minZ + 0.5 && p.z <= bounds.maxZ - 0.5);
  }
});

test("zero-length punch query remains finite and only hits overlapping targets", () => {
  const point = { x: 0, y: 1.2, z: 0 };
  assert.equal(
    segmentSphereHit(point, point, { x: 0.1, y: 1.2, z: 0 }, 0.2),
    true
  );
  assert.equal(
    segmentSphereHit(point, point, { x: 0.5, y: 1.2, z: 0 }, 0.2),
    false
  );
});


test("swept fist capsule hits a forearm capsule along the bone segment", () => {
  const fistStart = { x: 0, y: 1.4, z: 0 };
  const fistEnd = { x: 0, y: 1.4, z: 1.0 };
  const armStart = { x: 0.28, y: 1.38, z: 0.75 };
  const armEnd = { x: 0.28, y: 1.38, z: 1.35 };
  assert.equal(segmentCapsuleHit(fistStart, fistEnd, 0.16, armStart, armEnd, 0.13), true);
});

test("swept fist capsule rejects a bone capsule outside combined radii", () => {
  const fistStart = { x: 0, y: 1.4, z: 0 };
  const fistEnd = { x: 0, y: 1.4, z: 1.0 };
  const armStart = { x: 0.55, y: 1.38, z: 0.75 };
  const armEnd = { x: 0.55, y: 1.38, z: 1.35 };
  assert.equal(segmentCapsuleHit(fistStart, fistEnd, 0.16, armStart, armEnd, 0.13), false);
});

test("parallel capsule segments use their closest points rather than midpoint spheres", () => {
  const a0 = { x: 0, y: 0, z: 0 };
  const a1 = { x: 0, y: 0, z: 2 };
  const b0 = { x: 0.5, y: 0, z: 0.5 };
  const b1 = { x: 0.5, y: 0, z: 1.5 };
  assert.ok(Math.abs(segmentSegmentDistanceSquared(a0, a1, b0, b1) - 0.25) < 1e-8);
});

test("capsule distance remains finite for a sphere against a zero-length segment", () => {
  const point = { x: 0, y: 0, z: 0 };
  const start = { x: 0.2, y: 0, z: 0 };
  const end = { x: 0.2, y: 0, z: 1 };
  assert.ok(Math.abs(segmentSegmentDistanceSquared(point, point, start, end) - 0.04) < 1e-8);
});

test("punch resolver accepts a rig capsule and reports its body zone", () => {
  const punch = {
    start: { x: 0, y: 1.4, z: 0 },
    end: { x: 0, y: 1.4, z: 1.0 },
    radius: 0.16
  };
  const hurtboxes = [{
    zone: "torso",
    start: { x: 0.22, y: 1.1, z: 0.75 },
    end: { x: 0.22, y: 1.7, z: 0.75 },
    center: { x: 0.22, y: 1.4, z: 0.75 },
    radius: 0.18
  }];
  assert.equal(punchHitsHurtboxes(punch, hurtboxes)?.zone, "torso");
});
