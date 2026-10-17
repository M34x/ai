export const BLOCKS = [
  { id: 'dust', name: 'Redstone Dust', category: 'redstone', color: '#c83a34', visual: 'dust', description: 'Connects to nearby dust and carries signal strength up to 15.' },
  { id: 'torch', name: 'Redstone Torch', category: 'redstone', color: '#e56637', visual: 'torch', description: 'Provides power while its supporting block is unpowered.' },
  { id: 'block', name: 'Redstone Block', category: 'redstone', color: '#9d2925', visual: 'cube', description: 'A solid, always-powered redstone source.' },
  { id: 'repeater', name: 'Redstone Repeater', category: 'redstone', color: '#a77762', visual: 'repeater', description: 'Repeats its rear input toward its front after 1–4 redstone ticks.' },
  { id: 'comparator', name: 'Redstone Comparator', category: 'redstone', color: '#c68a6a', visual: 'comparator', description: 'Compares or subtracts the side signal from its rear signal.' },
  { id: 'lamp', name: 'Redstone Lamp', category: 'redstone', color: '#c49a55', visual: 'lamp', description: 'Glows while directly powered or receiving a signal.' },
  { id: 'observer', name: 'Observer', category: 'redstone', color: '#8b8274', visual: 'observer', description: 'Detects a changed block at its face and pulses from its back for two game ticks.' },
  { id: 'note', name: 'Note Block', category: 'redstone', color: '#9c6844', visual: 'note', description: 'Plays its selected pitch when it receives a new power pulse.' },
  { id: 'lever', name: 'Lever', category: 'redstone', color: '#77735e', visual: 'lever', description: 'A manually toggled on/off redstone source.' },
  { id: 'piston', name: 'Piston', category: 'redstone', color: '#a48d6c', visual: 'piston', description: 'Pushes a movable block group up to 12 blocks when powered.' },
  { id: 'sticky', name: 'Sticky Piston', category: 'redstone', color: '#758769', visual: 'sticky', description: 'Pushes a block group and pulls one movable block when retracting.' },
  { id: 'slime', name: 'Slime Block', category: 'building', color: '#71a956', visual: 'slime', description: 'Moves adjacent blocks with a piston; does not stick to honey.' },
  { id: 'honey', name: 'Honey Block', category: 'building', color: '#c98c38', visual: 'honey', description: 'Moves adjacent blocks with a piston; does not stick to slime.' },
  { id: 'hopper', name: 'Hopper', category: 'redstone', color: '#626863', visual: 'hopper', description: 'Item-transfer device; a redstone signal locks it.' },
  { id: 'dropper', name: 'Dropper', category: 'redstone', color: '#71766f', visual: 'dropper', description: 'Ejects one stored item on a rising power edge.' },
  { id: 'dispenser', name: 'Dispenser', category: 'redstone', color: '#858982', visual: 'dispenser', description: 'Uses one stored item on a rising power edge.' },
  { id: 'target', name: 'Target Block', category: 'redstone', color: '#bd5149', visual: 'target', description: 'A hit produces a brief redstone signal.' },
  { id: 'white', name: 'White Wool', category: 'building', color: '#deded4', visual: 'wool' },
  { id: 'light-gray', name: 'Light Gray Wool', category: 'building', color: '#aaa99f', visual: 'wool' },
  { id: 'gray', name: 'Gray Wool', category: 'building', color: '#595a56', visual: 'wool' },
  { id: 'black', name: 'Black Wool', category: 'building', color: '#292a29', visual: 'wool' },
  { id: 'brown', name: 'Brown Wool', category: 'building', color: '#72533e', visual: 'wool' },
  { id: 'red', name: 'Red Wool', category: 'building', color: '#a12d30', visual: 'wool' },
  { id: 'orange', name: 'Orange Wool', category: 'building', color: '#df7827', visual: 'wool' },
  { id: 'yellow', name: 'Yellow Wool', category: 'building', color: '#dfc936', visual: 'wool' },
  { id: 'lime', name: 'Lime Wool', category: 'building', color: '#81b936', visual: 'wool' },
  { id: 'green', name: 'Green Wool', category: 'building', color: '#526e39', visual: 'wool' },
  { id: 'cyan', name: 'Cyan Wool', category: 'building', color: '#24888b', visual: 'wool' },
  { id: 'light-blue', name: 'Light Blue Wool', category: 'building', color: '#4d9dc3', visual: 'wool' },
  { id: 'blue', name: 'Blue Wool', category: 'building', color: '#394b96', visual: 'wool' },
  { id: 'purple', name: 'Purple Wool', category: 'building', color: '#7746a0', visual: 'wool' },
  { id: 'magenta', name: 'Magenta Wool', category: 'building', color: '#b53a89', visual: 'wool' },
  { id: 'pink', name: 'Pink Wool', category: 'building', color: '#d77f96', visual: 'wool' }
];

export const BLOCK_BY_ID = new Map(BLOCKS.map((block) => [block.id, block]));
export const INVENTORY_START = 64;
export const WORLD = Object.freeze({ minX: -16, maxX: 15, minZ: -16, maxZ: 15, maxY: 15, width: 32 });
export const DIRECTIONS = Object.freeze([
  { name: 'North', x: 0, y: 0, z: -1 },
  { name: 'East', x: 1, y: 0, z: 0 },
  { name: 'South', x: 0, y: 0, z: 1 },
  { name: 'West', x: -1, y: 0, z: 0 }
]);
