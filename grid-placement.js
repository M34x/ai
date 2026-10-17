/** Resolve the adjacent voxel cell from a hit voxel and its world-space outward face normal. */
export function adjacentCell(position, normal) {
  const axis = (value) => Math.abs(value) < 0.5 ? 0 : Math.sign(value);
  return {
    x: position.x + axis(normal.x),
    y: position.y + axis(normal.y),
    z: position.z + axis(normal.z)
  };
}

/** Resolve a top-face stack placement only when editing is paused and the target is occupied. */
export function stackedPlacementCell(position, normal, { occupied, simulationRunning }) {
  if (!position || !occupied || simulationRunning || normal.y < 0.5) return null;
  return adjacentCell(position, normal);
}

/** True when an empty voxel cell may be edited under the current simulation state. */
export function canPlaceInCell(position, { simulationRunning, occupied }) {
  return Boolean(position && !simulationRunning && !occupied);
}
