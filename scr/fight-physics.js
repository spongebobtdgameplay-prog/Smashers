export function clamp(value, min, max) {
  return Math.min(max, Math.max(min, value));
}

export function clampFighterPosition(position, radius, bounds) {
  position.x = clamp(position.x, bounds.minX + radius, bounds.maxX - radius);
  position.z = clamp(position.z, bounds.minZ + radius, bounds.maxZ - radius);
  return position;
}

function movementCapacity(position, direction, radius, bounds) {
  let capacity = Infinity;

  if (direction.x > 1e-9) {
    capacity = Math.min(capacity, (bounds.maxX - radius - position.x) / direction.x);
  } else if (direction.x < -1e-9) {
    capacity = Math.min(capacity, (bounds.minX + radius - position.x) / direction.x);
  }

  if (direction.z > 1e-9) {
    capacity = Math.min(capacity, (bounds.maxZ - radius - position.z) / direction.z);
  } else if (direction.z < -1e-9) {
    capacity = Math.min(capacity, (bounds.minZ + radius - position.z) / direction.z);
  }

  return Math.max(0, Number.isFinite(capacity) ? capacity : 0);
}

export function resolveFighterPair(first, second, firstRadius, secondRadius, bounds, iterations = 5) {
  clampFighterPosition(first, firstRadius, bounds);
  clampFighterPosition(second, secondRadius, bounds);

  const requiredDistance = Math.max(0, firstRadius) + Math.max(0, secondRadius);
  let distance = 0;

  for (let iteration = 0; iteration < iterations; iteration += 1) {
    const dx = second.x - first.x;
    const dz = second.z - first.z;
    distance = Math.hypot(dx, dz);
    const overlap = requiredDistance - distance;

    if (overlap <= 1e-5) break;

    let nx;
    let nz;
    if (distance > 1e-8) {
      nx = dx / distance;
      nz = dz / distance;
    } else {
      nx = first.x <= second.x ? 1 : -1;
      nz = 0;
    }

    const firstDirection = { x: -nx, z: -nz };
    const secondDirection = { x: nx, z: nz };
    const firstCapacity = movementCapacity(first, firstDirection, firstRadius, bounds);
    const secondCapacity = movementCapacity(second, secondDirection, secondRadius, bounds);

    let moveFirst = Math.min(overlap * 0.5, firstCapacity);
    let moveSecond = Math.min(overlap - moveFirst, secondCapacity);
    let remainder = overlap - moveFirst - moveSecond;

    if (remainder > 1e-5) {
      const extraFirst = Math.min(remainder, firstCapacity - moveFirst);
      moveFirst += extraFirst;
      remainder -= extraFirst;
    }

    if (remainder > 1e-5) {
      const extraSecond = Math.min(remainder, secondCapacity - moveSecond);
      moveSecond += extraSecond;
    }

    first.x += firstDirection.x * moveFirst;
    first.z += firstDirection.z * moveFirst;
    second.x += secondDirection.x * moveSecond;
    second.z += secondDirection.z * moveSecond;

    clampFighterPosition(first, firstRadius, bounds);
    clampFighterPosition(second, secondRadius, bounds);
  }

  distance = Math.hypot(second.x - first.x, second.z - first.z);
  return {
    distance,
    requiredDistance,
    overlap: Math.max(0, requiredDistance - distance),
    separated: distance >= requiredDistance - 1e-4
  };
}

export function segmentSphereHit(start, end, center, radius) {
  const abX = end.x - start.x;
  const abY = end.y - start.y;
  const abZ = end.z - start.z;
  const acX = center.x - start.x;
  const acY = center.y - start.y;
  const acZ = center.z - start.z;
  const lengthSquared = abX * abX + abY * abY + abZ * abZ;

  const t = lengthSquared > 1e-10
    ? clamp((acX * abX + acY * abY + acZ * abZ) / lengthSquared, 0, 1)
    : 0;

  const dx = start.x + abX * t - center.x;
  const dy = start.y + abY * t - center.y;
  const dz = start.z + abZ * t - center.z;
  const safeRadius = Math.max(0, radius);

  return dx * dx + dy * dy + dz * dz <= safeRadius * safeRadius;
}

export function segmentSegmentDistanceSquared(firstStart, firstEnd, secondStart, secondEnd) {
  const d1x = firstEnd.x - firstStart.x;
  const d1y = firstEnd.y - firstStart.y;
  const d1z = firstEnd.z - firstStart.z;
  const d2x = secondEnd.x - secondStart.x;
  const d2y = secondEnd.y - secondStart.y;
  const d2z = secondEnd.z - secondStart.z;
  const rx = firstStart.x - secondStart.x;
  const ry = firstStart.y - secondStart.y;
  const rz = firstStart.z - secondStart.z;

  const a = d1x * d1x + d1y * d1y + d1z * d1z;
  const e = d2x * d2x + d2y * d2y + d2z * d2z;
  const f = d2x * rx + d2y * ry + d2z * rz;
  const epsilon = 1e-10;
  let s = 0;
  let t = 0;

  if (a <= epsilon && e <= epsilon) {
    return rx * rx + ry * ry + rz * rz;
  }

  if (a <= epsilon) {
    t = clamp(f / e, 0, 1);
  } else {
    const c = d1x * rx + d1y * ry + d1z * rz;

    if (e <= epsilon) {
      s = clamp(-c / a, 0, 1);
    } else {
      const b = d1x * d2x + d1y * d2y + d1z * d2z;
      const denominator = a * e - b * b;
      s = denominator > epsilon
        ? clamp((b * f - c * e) / denominator, 0, 1)
        : 0;
      t = (b * s + f) / e;

      if (t < 0) {
        t = 0;
        s = clamp(-c / a, 0, 1);
      } else if (t > 1) {
        t = 1;
        s = clamp((b - c) / a, 0, 1);
      }
    }
  }

  const dx = rx + d1x * s - d2x * t;
  const dy = ry + d1y * s - d2y * t;
  const dz = rz + d1z * s - d2z * t;
  return dx * dx + dy * dy + dz * dz;
}

export function segmentCapsuleHit(
  punchStart,
  punchEnd,
  punchRadius,
  hurtStart,
  hurtEnd,
  hurtRadius
) {
  const combinedRadius = Math.max(0, punchRadius) + Math.max(0, hurtRadius);
  return segmentSegmentDistanceSquared(
    punchStart,
    punchEnd,
    hurtStart,
    hurtEnd
  ) <= combinedRadius * combinedRadius;
}

export function punchHitsHurtboxes(punch, hurtboxes) {
  if (!punch?.start || !punch?.end || !Number.isFinite(punch.radius)) return null;

  for (const hurtbox of hurtboxes || []) {
    if (!hurtbox || !Number.isFinite(hurtbox.radius)) continue;
    const hurtStart = hurtbox.start || hurtbox.center;
    const hurtEnd = hurtbox.end || hurtbox.center;
    if (!hurtStart || !hurtEnd) continue;

    if (segmentCapsuleHit(
      punch.start,
      punch.end,
      punch.radius,
      hurtStart,
      hurtEnd,
      hurtbox.radius
    )) {
      return hurtbox;
    }
  }

  return null;
}
