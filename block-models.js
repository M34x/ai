import * as THREE from 'three';

const SOLID_BLOCKS = new Set([
  'block', 'lamp', 'note', 'observer', 'target', 'dropper', 'dispenser',
  'piston', 'sticky', 'slime', 'honey', 'white', 'light-gray', 'gray',
  'black', 'brown', 'red', 'orange', 'yellow', 'lime', 'green', 'cyan',
  'light-blue', 'blue', 'purple', 'magenta', 'pink'
]);

/** Shared voxel bodies; non-full redstone parts use their characteristic silhouette. */
export function createBlockGeometry(id) {
  switch (id) {
    case 'torch': {
      const geometry = new THREE.CylinderGeometry(0.085, 0.12, 0.58, 6);
      geometry.translate(0, -0.2, 0);
      return geometry;
    }
    case 'hopper': {
      // Open-topped tapered hopper bowl, with the separate outlet built by the renderer.
      const geometry = new THREE.CylinderGeometry(0.34, 0.13, 0.72, 8, 1, true);
      geometry.translate(0, -0.02, 0);
      return geometry;
    }
    case 'lever': {
      const geometry = new THREE.BoxGeometry(0.58, 0.16, 0.58);
      geometry.translate(0, -0.42, 0);
      return geometry;
    }
    case 'repeater':
    case 'comparator': {
      const geometry = new THREE.BoxGeometry(0.94, 0.13, 0.94);
      geometry.translate(0, -0.435, 0);
      return geometry;
    }
    case 'dust': return new THREE.BoxGeometry(0.6, 0.035, 0.6);
    case 'piston':
    case 'sticky': return new THREE.BoxGeometry(0.94, 0.94, 0.94);
    case 'target': return new THREE.BoxGeometry(0.96, 0.96, 0.96);
    case 'observer':
    case 'dropper':
    case 'dispenser': return new THREE.BoxGeometry(0.94, 0.94, 0.94);
    case 'lamp':
    case 'note':
    case 'slime':
    case 'honey': return new THREE.BoxGeometry(0.94, 0.94, 0.94);
    default:
      if (SOLID_BLOCKS.has(id)) return new THREE.BoxGeometry(1, 1, 1);
      throw new RangeError(`Unknown block model: ${id}`);
  }
}

/** Create the reusable shapes used for details that sit on the block body. */
export function createBlockDetailGeometry(id) {
  switch (id) {
    case 'torch-flame': return new THREE.OctahedronGeometry(0.11, 0);
    default: return new THREE.BoxGeometry(1, 1, 1);
  }
}
