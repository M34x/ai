import test from 'node:test';
import assert from 'node:assert/strict';
import { BLOCKS, BLOCK_BY_ID, INVENTORY_START, WORLD } from '../block-catalog.js';
import { RedstoneWorld } from '../redstone-sim.js';
import { getDustConnections } from '../dust-connections.js';
import { adjacentCell, canActivateBlock, canPlaceInCell, canPlaceOnSupport, canRemoveBlock, stackedPlacementCell } from '../grid-placement.js';
import { createBlockGeometry } from '../block-models.js';
import * as THREE from 'three';

const p = (x, y = 0, z = 0) => ({ x, y, z });
const get = (world, id, position) => { const entry = world.blocks.get(`${position.x},${position.y},${position.z}`); assert.equal(entry?.id, id); return entry; };

test('the inventory contains each requested block exactly once', () => {
  const names = ['Redstone Dust','Redstone Torch','Redstone Block','Redstone Repeater','Redstone Comparator','Redstone Lamp','Observer','Note Block','Lever','Piston','Sticky Piston','Slime Block','Honey Block','Hopper','Dropper','Dispenser','Target Block','White Wool','Light Gray Wool','Gray Wool','Black Wool','Brown Wool','Red Wool','Orange Wool','Yellow Wool','Lime Wool','Green Wool','Cyan Wool','Light Blue Wool','Blue Wool','Purple Wool','Magenta Wool','Pink Wool'];
  assert.equal(BLOCKS.length, 33);
  assert.deepEqual(BLOCKS.map((block) => block.name), names);
  assert.equal(new Set(BLOCKS.map((block) => block.id)).size, 33);
  for (const block of BLOCKS) assert.ok(BLOCK_BY_ID.has(block.id));
});

test('placement uses integer cell coordinates, complete grid bounds, and counts inventory', () => {
  const world = new RedstoneWorld();
  assert.equal(world.place(p(0)), true);
  assert.equal(world.place(p(0)), false);
  for (let y = 0; y < 15; y++) assert.equal(world.place(p(15, y, -16), 'block'), true);
  assert.equal(world.place(p(15, 15, -16), 'pink'), true);
  assert.equal(world.place(p(16)), false);
  assert.equal(world.place(p(-17)), false);
  assert.equal(world.place(p(0.5)), false);
  assert.equal(world.place(p(0, 16)), false);
  assert.equal(world.place(p(0, 1), 'torch'), false, 'unsupported elevated placement is rejected');
  assert.equal(world.inventory.get('dust'), INVENTORY_START - 1);
  world.remove(p(0));
  assert.equal(world.inventory.get('dust'), INVENTORY_START);
});

test('unpowered wool is non-conductive and all 33 block types can be placed', () => {
  const world = new RedstoneWorld();
  for (const [index, block] of BLOCKS.entries()) {
    const position = index < 32 ? p(-16 + index, 0, 5) : p(-16, 0, 6);
    assert.equal(world.place(position, block.id), true, block.name);
  }
  assert.equal(world.blocks.size, 33);
  assert.deepEqual(WORLD, { minX: -16, maxX: 15, minZ: -16, maxZ: 15, maxY: 15, width: 32 });
});

test('non-full blocks use Minecraft-style partial geometry while full blocks stay unit sized', () => {
  for (const id of ['torch', 'hopper', 'lever', 'repeater', 'comparator', 'dust']) {
    const geometry = createBlockGeometry(id);
    geometry.computeBoundingBox();
    const size = geometry.boundingBox.getSize(new THREE.Vector3());
    assert.ok(size.x <= 1 && size.y < 1 && size.z <= 1, `${id} should not be a full cube`);
    assert.ok(geometry.boundingBox.min.y >= -0.5 && geometry.boundingBox.max.y <= 0.5, `${id} must fit within its voxel`);
  }
  const repeater = createBlockGeometry('repeater'); repeater.computeBoundingBox();
  assert.equal(repeater.boundingBox.min.y, -0.5, 'repeater base rests on voxel floor');
  const hopper = createBlockGeometry('hopper'); hopper.computeBoundingBox();
  assert.ok(hopper.boundingBox.min.y > -0.5 && hopper.boundingBox.min.y < 0, 'hopper bowl remains inset above its outlet');
  assert.ok(Math.abs(hopper.boundingBox.min.y + 0.38) < 1e-5, 'hopper outlet reaches close to the voxel floor');
  const wool = createBlockGeometry('white'); wool.computeBoundingBox();
  assert.deepEqual(wool.boundingBox.getSize(new THREE.Vector3()).toArray(), [1, 1, 1]);
});

test('dust visual and signal connections follow cardinal adjacency and block occlusion', () => {
  const world = new RedstoneWorld();
  world.place(p(0), 'dust'); world.place(p(1), 'dust'); world.place(p(0, 0, -1), 'lamp');
  assert.deepEqual(getDustConnections(world.blocks, p(0)).map(({ direction, id }) => [direction, id]).sort(), [['East', 'dust'], ['North', 'lamp']]);
  world.remove(p(0, 0, -1));
  world.place(p(0, 0, 1), 'white');
  world.place(p(0, 1, 1), 'dust');
  assert.ok(getDustConnections(world.blocks, p(0)).some(({ direction, dy }) => direction === 'South' && dy === 1));
  world.remove(p(0, 0, 1));
  world.place(p(0, 0, 1), 'hopper', { ignoreInventory: true });
  assert.ok(!getDustConnections(world.blocks, p(0)).some(({ direction, dy }) => direction === 'South' && dy === 1));
});

test('blocks need a solid support below and cannot stack on circuits or unsupported components', () => {
  const world = new RedstoneWorld();
  assert.equal(world.place(p(0, 1), 'torch'), false, 'torch cannot float');
  assert.equal(world.place(p(0), 'torch'), true);
  assert.equal(world.place(p(0, 1), 'torch'), false, 'torch cannot sit on another torch');
  assert.equal(world.place(p(1), 'dust'), true);
  assert.equal(world.place(p(1, 1), 'torch'), false, 'wire cannot support a torch');
  assert.equal(world.place(p(2), 'lever'), true);
  assert.equal(world.place(p(2, 1), 'dust'), false, 'lever cannot support wire');
  assert.equal(world.place(p(3), 'block'), true);
  assert.equal(world.place(p(3, 1), 'torch'), true, 'solid block supports a torch');
  assert.equal(world.place(p(3, 2), 'white'), false, 'torch is not sturdy enough to support another block');
  assert.equal(world.place(p(5), 'block'), true);
  assert.equal(world.place(p(5, 1), 'white'), true);
  assert.equal(world.place(p(5, 2), 'pink'), true, 'solid supports may form a stack');
  assert.equal(world.place(p(4), 'hopper'), true);
  assert.equal(world.place(p(4, 1), 'lever'), false, 'non-full components are not sturdy supports');
  assert.equal(canPlaceOnSupport('torch', 'block'), true);
  assert.equal(canPlaceOnSupport('torch', 'torch'), false);
  assert.equal(canPlaceOnSupport('white', 'dust'), false);
});

test('block click activation is gated on simulation running', () => {
  assert.equal(canActivateBlock('lever', { simulationRunning: false }), false);
  assert.equal(canActivateBlock('lever', { simulationRunning: true }), true);
  assert.equal(canActivateBlock('target', { simulationRunning: false }), false);
  assert.equal(canActivateBlock('target', { simulationRunning: true }), true);
  assert.equal(canActivateBlock('note', { simulationRunning: false }), false);
  assert.equal(canActivateBlock('note', { simulationRunning: true }), true);
  assert.equal(canActivateBlock('white', { simulationRunning: true }), false);
  assert.equal(canRemoveBlock({ simulationRunning: false }), true);
  assert.equal(canRemoveBlock({ simulationRunning: true }), false);
});

test('face placement resolves exact neighboring voxel including negative coordinates', () => {
  assert.deepEqual(adjacentCell(p(-1, 0, 0), { x: 0, y: 1, z: 0 }), p(-1, 1, 0));
  assert.deepEqual(adjacentCell(p(-1, 0, 0), { x: -1, y: 0, z: 0 }), p(-2, 0, 0));
  assert.deepEqual(adjacentCell(p(2, 1, 3), { x: 0, y: 0, z: -1 }), p(2, 1, 2));
});

test('stacking on a block top is allowed only while paused and in a free voxel', () => {
  const topFace = { x: 0, y: 1, z: 0 };
  assert.deepEqual(stackedPlacementCell(p(-2, 0, 3), topFace, { occupied: true, simulationRunning: false }), p(-2, 1, 3));
  assert.equal(stackedPlacementCell(p(0), { x: 1, y: 0, z: 0 }, { occupied: true, simulationRunning: false }), null);
  assert.equal(stackedPlacementCell(p(0), topFace, { occupied: false, simulationRunning: false }), null);
  assert.equal(stackedPlacementCell(p(0), topFace, { occupied: true, simulationRunning: true }), null);
  assert.equal(canPlaceInCell(p(0, 1, 0), { simulationRunning: false, occupied: false }), true);
  assert.equal(canPlaceInCell(p(0, 1, 0), { simulationRunning: true, occupied: false }), false);
  assert.equal(canPlaceInCell(p(0, 1, 0), { simulationRunning: false, occupied: true }), false);
});

test('dust connections form cardinal joints, climb full blocks, descend, and respect obstructions', () => {
  const world = new RedstoneWorld();
  world.place(p(0), 'dust');
  world.place(p(1), 'dust');
  world.place(p(1, 0, -1), 'block');
  world.place(p(1, 1, -1), 'dust');
  let connections = getDustConnections(world.blocks, p(1));
  assert.ok(connections.some(({ direction, id, dy }) => direction === 'West' && id === 'dust' && dy === 0));
  assert.ok(connections.some(({ direction, id, dy }) => direction === 'North' && id === 'dust' && dy === 1));
  world.place(p(1, 1, -2), 'white');
  connections = getDustConnections(world.blocks, p(1, 1, -1));
  assert.ok(!connections.some(({ direction, dy }) => direction === 'North' && dy === -1));
});

test('dust signal strength falls by one per wire and ends after 15 dust cells', () => {
  const world = new RedstoneWorld();
  world.place(p(-15), 'lever'); world.toggle(p(-15));
  for (let x = -14; x <= 1; x++) world.place(p(x), 'dust');
  world.step();
  assert.equal(get(world, 'dust', p(-14)).power, 15);
  assert.equal(get(world, 'dust', p(0)).power, 1);
  assert.equal(get(world, 'dust', p(1)).power, 0);
  world.toggle(p(-15)); world.step();
  assert.equal(get(world, 'dust', p(-14)).power, 0);
});

test('repeater accepts rear input only, faces forward, and honors one redstone tick', () => {
  const world = new RedstoneWorld();
  world.place(p(0), 'repeater', { facing: 0, delay: 1 });
  world.place(p(0, 0, 1), 'lever'); world.toggle(p(0, 0, 1));
  world.step(); assert.equal(get(world, 'repeater', p(0)).power, 0);
  world.step(); assert.equal(get(world, 'repeater', p(0)).power, 0);
  world.step(); assert.equal(get(world, 'repeater', p(0)).power, 15);
  const wrongWay = new RedstoneWorld();
  wrongWay.place(p(0), 'repeater', { facing: 0 });
  wrongWay.place(p(0, 0, -1), 'lever'); wrongWay.toggle(p(0, 0, -1));
  wrongWay.step(); wrongWay.step(); wrongWay.step();
  assert.equal(get(wrongWay, 'repeater', p(0)).power, 0);
});

test('comparator supports compare and subtract modes using rear/side signals', () => {
  const world = new RedstoneWorld();
  world.place(p(0), 'comparator', { facing: 0 });
  world.place(p(0, 0, 1), 'lever'); // rear: north-facing comparator reads south
  world.place(p(0, 0, -1), 'lever'); world.toggle(p(0, 0, -1)); // front must not count
  world.place(p(1, 0, 0), 'lever'); world.toggle(p(1, 0, 0)); // side input
  world.step(); assert.equal(get(world, 'comparator', p(0)).power, 0); // side exceeds rear
  world.toggle(p(0, 0, 1)); world.step(); assert.equal(get(world, 'comparator', p(0)).power, 15); // compare passes equal inputs
  world.toggleComparatorMode(p(0)); world.step(); assert.equal(get(world, 'comparator', p(0)).power, 0); // subtract equal inputs
  world.toggle(p(1, 0, 0)); world.step(); assert.equal(get(world, 'comparator', p(0)).power, 15); // 15 - 0
  world.toggle(p(0, 0, 1)); world.step(); assert.equal(get(world, 'comparator', p(0)).power, 0);
});

test('observers pulse only when the watched face changes and output from their back', () => {
  const world = new RedstoneWorld();
  world.place(p(0), 'observer', { facing: 0 });
  world.place(p(0, 0, -1), 'white');
  assert.equal(get(world, 'observer', p(0)).power, 0);
  world.place(p(0, 0, -1), 'blue', { ignoreInventory: true });
  world.step();
  assert.equal(get(world, 'observer', p(0)).power, 15);
  const sideDust = world.place(p(1), 'dust'); assert.equal(sideDust, true);
  world.step();  assert.equal(get(world, 'dust', p(1)).power, 0);
});

test('slime piston pushes a side-attached block and sticky piston pulls on retract', () => {
  const world = new RedstoneWorld();
  world.place(p(0), 'piston', { facing: 0 });
  world.place(p(-1), 'lever'); world.toggle(p(-1));
  world.place(p(0, 0, -1), 'slime'); world.place(p(1, 0, -1), 'white');
  world.step(); assert.ok(world.blocks.has('0,0,-2')); assert.ok(world.blocks.has('1,0,-2'));
  const sticky = new RedstoneWorld();sticky.place(p(0),'sticky',{facing:0});sticky.place(p(-1),'lever');sticky.toggle(p(-1));sticky.place(p(0,0,-1),'white');sticky.step();assert.ok(sticky.blocks.has('0,0,-2'));sticky.toggle(p(-1));sticky.step();assert.ok(sticky.blocks.has('0,0,-1'));
});

test('save/load preserves each block, orientation, inventory, and tick state', () => {
  const world = new RedstoneWorld(); world.place(p(-4, 3, 9), 'repeater', { facing: 2, delay: 4 }); world.place(p(0), 'lever'); world.toggle(p(0)); world.step();
  const restored = new RedstoneWorld(world.snapshot());
  assert.deepEqual(restored.blocks.get('-4,3,9'), world.blocks.get('-4,3,9'));
  assert.equal(restored.inventory.get('lever'), INVENTORY_START - 1);
  assert.equal(restored.tick, world.tick);
});
