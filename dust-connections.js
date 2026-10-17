import { DIRECTIONS } from './block-catalog.js';

const keyOf = ({ x, y, z }) => `${x},${y},${z}`;
const DUST_ENDPOINTS = new Set(['dust', 'lever', 'torch', 'block', 'repeater', 'comparator', 'observer', 'target', 'lamp', 'note']);
const CLIMBABLE_BLOCKS = new Set(['block', 'lamp', 'note', 'observer', 'target', 'dropper', 'dispenser', 'piston', 'sticky', 'slime', 'honey', 'white', 'light-gray', 'gray', 'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan', 'light-blue', 'blue', 'purple', 'magenta', 'pink']);

/** Return cardinal connections: dust, valid full-block climbs, and unobstructed descents. */
export function getDustConnections(blocks, position) {
  const connections = [];
  for (const direction of DIRECTIONS) {
    const beside = { x: position.x + direction.x, y: position.y, z: position.z + direction.z };
    const sameLevel = blocks.get(keyOf(beside));
    const above = { x: beside.x, y: beside.y + 1, z: beside.z };
    const climbableSupport = sameLevel && CLIMBABLE_BLOCKS.has(sameLevel.id);
    if (climbableSupport && blocks.get(keyOf(above))?.id === 'dust') {
      connections.push({ direction: direction.name, dx: direction.x, dz: direction.z, dy: 1, id: 'dust' });
      continue;
    }
    if (sameLevel?.id === 'dust' || (sameLevel && DUST_ENDPOINTS.has(sameLevel.id))) {
      connections.push({ direction: direction.name, dx: direction.x, dz: direction.z, dy: 0, id: sameLevel.id });
      continue;
    }
    const below = { x: beside.x, y: beside.y - 1, z: beside.z };
    if (!sameLevel && blocks.get(keyOf(below))?.id === 'dust') connections.push({ direction: direction.name, dx: direction.x, dz: direction.z, dy: -1, id: 'dust' });
  }
  return connections;
}
