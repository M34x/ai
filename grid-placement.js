const CIRCUIT_BLOCKS = new Set(['dust', 'torch', 'lever', 'repeater', 'comparator']);
const SUPPORT_BLOCKS = new Set([
  'block', 'lamp', 'note', 'observer', 'target', 'dropper', 'dispenser',
  'piston', 'sticky', 'slime', 'honey', 'white', 'light-gray', 'gray', 'black',
  'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light-blue',
  'blue', 'purple', 'magenta', 'pink'
]);
const PLACEABLE_BLOCKS = new Set([...CIRCUIT_BLOCKS, ...SUPPORT_BLOCKS]);
const ACTIVATABLE_BLOCKS = new Set(['lever', 'target', 'note']);

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

/** Only sturdy full blocks can support another placed block; circuits are never supports. */
export function canPlaceOnSupport(blockId, supportId) {
  return PLACEABLE_BLOCKS.has(blockId) && SUPPORT_BLOCKS.has(supportId);
}

/** Block activation is an in-simulation action; paused clicks may select/configure instead. */
export function canActivateBlock(blockId, { simulationRunning }) {
  return Boolean(simulationRunning && ACTIVATABLE_BLOCKS.has(blockId));
}

/** Destructive world edits are paused-only; they cannot interrupt an active simulation. */
export function canRemoveBlock({ simulationRunning }) {
  return !simulationRunning;
}

/** True when an empty voxel cell may be edited under the current simulation state. */
export function canPlaceInCell(position, { simulationRunning, occupied }) {
  return Boolean(position && !simulationRunning && !occupied);
}
