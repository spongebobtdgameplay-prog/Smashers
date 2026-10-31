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

export function punchHitsHurtboxes(punch, hurtboxes) {
  if (!punch?.start || !punch?.end || !Number.isFinite(punch.radius)) return null;

  for (const hurtbox of hurtboxes || []) {
    if (!hurtbox?.center || !Number.isFinite(hurtbox.radius)) continue;
    if (segmentSphereHit(
      punch.start,
      punch.end,
      hurtbox.center,
      punch.radius + hurtbox.radius
    )) {
      return hurtbox;
    }
  }

  return null;
}
