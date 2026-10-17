import { BLOCK_BY_ID, DIRECTIONS, INVENTORY_START, WORLD } from './block-catalog.js';
import { getDustConnections } from './dust-connections.js';

const keyOf = ({ x, y, z }) => `${x},${y},${z}`;
const positionOf = (key) => { const [x, y, z] = key.split(',').map(Number); return { x, y, z }; };
const inWorld = ({ x, y, z }) => x >= WORLD.minX && x <= WORLD.maxX && z >= WORLD.minZ && z <= WORLD.maxZ && y >= 0 && y <= WORLD.maxY;
const horizontalNeighbors = (position) => DIRECTIONS.map((direction) => ({ x: position.x + direction.x, y: position.y, z: position.z + direction.z }));
const verticalNeighbors = (position) => [{ x: position.x, y: position.y + 1, z: position.z }, { x: position.x, y: position.y - 1, z: position.z }];
const sidePositions = (position, facing) => {
  const front = DIRECTIONS[facing];
  const left = DIRECTIONS[(facing + 3) % 4];
  const right = DIRECTIONS[(facing + 1) % 4];
  return { front: { x: position.x + front.x, y: position.y, z: position.z + front.z }, rear: { x: position.x - front.x, y: position.y, z: position.z - front.z }, sides: [left, right].map((d) => ({ x: position.x + d.x, y: position.y, z: position.z + d.z })) };
};
const cloneEntry = (entry) => ({ ...entry, position: { ...entry.position }, pending: entry.pending ? { ...entry.pending } : null, toggleTimes: [...entry.toggleTimes] });
const createEntry = (id, position, options = {}) => ({ id, position: { ...position }, facing: options.facing ?? 0, state: options.state ?? false, delay: options.delay ?? 1, compareMode: options.compareMode ?? false, note: options.note ?? 0, count: options.count ?? INVENTORY_START, power: 0, previousPower: 0, pending: null, pulseUntil: -1, toggleTimes: [], extended: false });

export class RedstoneWorld {
  constructor(snapshot = undefined) {
    this.blocks = new Map();
    this.inventory = new Map([...BLOCK_BY_ID.keys()].map((id) => [id, INVENTORY_START]));
    this.tick = 0;
    this.droppedItems = [];
    this.events = [];
    this.simulationRunning = false;
    if (snapshot) this.load(snapshot);
  }

  place(position, id = 'dust', options = {}) {
    if (!BLOCK_BY_ID.has(id)) throw new RangeError(`Unknown block: ${id}`);
    if (!position || ![position.x, position.y, position.z].every(Number.isInteger) || !inWorld(position)) return false;
    const key = keyOf(position);
    if (this.blocks.has(key)) return false;
    const stock = this.inventory.get(id) ?? INVENTORY_START;
    if (!options.ignoreInventory && stock < 1) return false;
    if (!options.ignoreInventory) this.inventory.set(id, stock - 1);
    this.blocks.set(key, createEntry(id, position, options));
    this.#notify(position);
    return true;
  }

  remove(position, options = {}) {
    const key = keyOf(position);
    const entry = this.blocks.get(key);
    if (!entry) return null;
    this.blocks.delete(key);
    if (!options.consume) this.inventory.set(entry.id, (this.inventory.get(entry.id) ?? 0) + 1);
    this.#notify(position);
    return cloneEntry(entry);
  }

  setInventory(id, count) {
    if (!this.inventory.has(id) || !Number.isInteger(count) || count < 0) throw new RangeError('Invalid inventory entry');
    this.inventory.set(id, count);
  }

  toggle(position) {
    const entry = this.blocks.get(keyOf(position));
    if (!entry || !['lever', 'torch'].includes(entry.id)) return false;
    entry.state = !entry.state;
    if (entry.id === 'torch') {
      entry.toggleTimes = entry.toggleTimes.filter((at) => this.tick - at <= 60);
      entry.toggleTimes.push(this.tick);
      if (entry.toggleTimes.length >= 8) entry.pulseUntil = this.tick + 160;
    }
    this.#notify(position);
    return true;
  }

  rotate(position) {
    const entry = this.blocks.get(keyOf(position));
    if (!entry) return false;
    entry.facing = (entry.facing + 1) % DIRECTIONS.length;
    this.#notify(position);
    return true;
  }

  cycleDelay(position) {
    const entry = this.blocks.get(keyOf(position));
    if (!entry || entry.id !== 'repeater') return false;
    entry.delay = entry.delay % 4 + 1;
    return true;
  }

  toggleComparatorMode(position) {
    const entry = this.blocks.get(keyOf(position));
    if (!entry || entry.id !== 'comparator') return false;
    entry.compareMode = !entry.compareMode;
    this.#notify(position);
    return true;
  }

  hitTarget(position, power = 15) {
    const entry = this.blocks.get(keyOf(position));
    if (!entry || entry.id !== 'target' || !Number.isInteger(power) || power < 1 || power > 15) return false;
    entry.pulseUntil = this.tick + 4;
    entry.power = power;
    this.#notify(position);
    return true;
  }

  #notify(position) {
    for (const observer of this.blocks.values()) {
      if (observer.id !== 'observer') continue;
      const watched = DIRECTIONS[observer.facing];
      if (observer.position.x + watched.x === position.x && observer.position.y + watched.y === position.y && observer.position.z + watched.z === position.z) observer.pulseUntil = Math.max(observer.pulseUntil, this.tick + 2);
    }
  }

  #sourcePower(entry) {
    if (entry.id === 'lever') return entry.state ? 15 : 0;
    if (entry.id === 'torch') {
      if (entry.pulseUntil > this.tick) return 0;
      const direction=DIRECTIONS[entry.facing];
      const support = { x: entry.position.x-direction.x, y: entry.position.y-1, z: entry.position.z-direction.z };
      const supportEntry = this.blocks.get(keyOf(support));
      if (supportEntry && (supportEntry.id === 'block' || supportEntry.id === 'lever' && supportEntry.state || supportEntry.id === 'dust' && supportEntry.power > 0 || ['repeater','comparator','observer','target'].includes(supportEntry.id) && supportEntry.power > 0)) return 0;
      const supportPowered = [...horizontalNeighbors(support), ...verticalNeighbors(support)].some((neighbor) => {
        const source = this.blocks.get(keyOf(neighbor));
        return source && (source.id === 'dust' ? source.power > 0 : this.#isPowerSource(source) && this.#outputReaches(source, support) && this.#sourcePowerNoRecursion(source) > 0);
      });
      return supportPowered ? 0 : 15;
    }
    if (entry.id === 'block') return 15;
    if (entry.id === 'observer' || entry.id === 'target') return entry.pulseUntil > this.tick ? entry.id === 'target' ? entry.power : 15 : 0;
    return entry.power;
  }

  #isPowerSource(entry) { return ['lever','torch','block','repeater','comparator','observer','target'].includes(entry.id); }
  #sourcePowerNoRecursion(entry) {
    if (entry.id === 'torch') return entry.pulseUntil > this.tick ? 0 : 15;
    if (entry.id === 'lever') return entry.state ? 15 : 0;
    return entry.id === 'block' ? 15 : entry.power || 0;
  }

  #outputDirections(entry) {
    if (entry.id === 'repeater' || entry.id === 'comparator') return [DIRECTIONS[entry.facing]];
    if (entry.id === 'observer') return [DIRECTIONS[(entry.facing + 2) % 4]];
    if (entry.id === 'torch') return [...DIRECTIONS, { x: 0, y: -1, z: 0 }];
    return [...DIRECTIONS, { x: 0, y: 1, z: 0 }, { x: 0, y: -1, z: 0 }];
  }

  #outputReaches(entry, position) {
    return this.#outputDirections(entry).some((direction) => entry.position.x + direction.x === position.x && entry.position.y + direction.y === position.y && entry.position.z + direction.z === position.z);
  }

  #isDirectionalInput(entry, position) {
    if (!['repeater','comparator'].includes(entry.id)) return true;
    const rear = sidePositions(entry.position, entry.facing).rear;
    return rear.x === position.x && rear.y === position.y && rear.z === position.z;
  }

  #redstonePowerAt(position, wires, consumerPosition = null) {
    const key = keyOf(position);
    const entry = this.blocks.get(key);
    if (!entry) return 0;
    if (entry.id === 'dust') return wires.get(key) ?? 0;
    if (!consumerPosition) return 0;
    const dx=consumerPosition.x-entry.position.x,dy=consumerPosition.y-entry.position.y,dz=consumerPosition.z-entry.position.z;
    if (!this.#outputDirections(entry).some((direction)=>direction.x===dx&&direction.y===dy&&direction.z===dz)) return 0;
    return this.#sourcePower(entry);
  }

  #powerAt(position, { exclude = null } = {}) {
    const key = keyOf(position);
    if (key === exclude) return 0;
    const entry = this.blocks.get(key);
    if (!entry) return 0;
    return this.#sourcePower(entry);
  }

  #readInput(position, id, orientation) {
    const direct = this.#powerAt(position);
    if (direct > 0) return direct;
    const entry = this.blocks.get(keyOf(position));
    if (entry?.id === 'dust') return entry.power;
    if (entry && ['repeater', 'comparator', 'observer', 'torch', 'block', 'lever'].includes(entry.id)) return this.#sourcePower(entry);
    return 0;
  }

  #wireConnections(entry, knownDust) {
    return new Set(getDustConnections(this.blocks, entry.position)
      .filter((connection) => connection.id === 'dust')
      .map((connection) => keyOf({ x: entry.position.x + connection.dx, y: entry.position.y + connection.dy, z: entry.position.z + connection.dz }))
      .filter((key) => knownDust.has(key)));
  }

  #sampleInput(entry, position) {
    const source = this.blocks.get(keyOf(position));
    if (!source) return 0;
    if (source.id === 'dust') return source.power;
    return this.#outputReaches(source, position) ? this.#sourcePower(source) : 0;
  }

  #computeWirePower() {
    const dust = [...this.blocks.values()].filter((entry) => entry.id === 'dust');
    const knownDust = new Set(dust.map((entry) => keyOf(entry.position)));
    const powers = new Map(dust.map((entry) => [keyOf(entry.position), 0]));
    const queue = [];
    for (const entry of this.blocks.values()) {
      const output = this.#sourcePower(entry);
      if (output <= 0 || !this.#isPowerSource(entry)) continue;
      const connections = new Set();
      for (const direction of this.#outputDirections(entry)) {
        const next = { x: entry.position.x + direction.x, y: entry.position.y + direction.y, z: entry.position.z + direction.z };
        if (knownDust.has(keyOf(next))) connections.add(keyOf(next));
      }
      for (const key of connections) queue.push({ key, power: output });
    }
    for (let cursor = 0; cursor < queue.length; cursor++) {
      const { key, power } = queue[cursor];
      if (power <= powers.get(key)) continue;
      powers.set(key, power);
      const entry = this.blocks.get(key);
      for (const nextKey of this.#wireConnections(entry, knownDust)) queue.push({ key: nextKey, power: power - 1 });
    }
    return powers;
  }

  #connectedWirePower(position, { exclude = null } = {}) {
    let maximum = 0;
    for (const next of [...horizontalNeighbors(position), ...verticalNeighbors(position)]) {
      const key = keyOf(next);
      if (key === exclude) continue;
      const entry = this.blocks.get(key);
      if (entry?.id === 'dust') maximum = Math.max(maximum, entry.power);
    }
    return maximum;
  }

  #inputPower(position, { exclude = null } = {}) {
    const key = keyOf(position);
    if (key === exclude) return 0;
    const entry = this.blocks.get(key);
    if (!entry) return 0;
    if (entry.id === 'dust') return entry.power;
    return this.#outputReaches(entry, position) ? this.#sourcePower(entry) : 0;
  }

  #poweredBlock(position, exclude = null) {
    const key = keyOf(position);
    if (key === exclude) return false;
    const entry = this.blocks.get(key);
    if (!entry) return false;
    if (entry.id === 'dust') return entry.power > 0;
    return this.#isPowerSource(entry) && this.#sourcePower(entry) > 0;
  }

  #repeaterLocked(entry) {
    const { sides } = sidePositions(entry.position, entry.facing);
    return sides.some((position) => {
      const side = this.blocks.get(keyOf(position));
      if (!side) return false;
      const thisDirection = DIRECTIONS[entry.facing];
      const dx = side.position.x - entry.position.x;
      const dz = side.position.z - entry.position.z;
      if (side.id === 'repeater') { const sideDirection = DIRECTIONS[side.facing]; return sideDirection.x * dx + sideDirection.z * dz === -1 && side.power > 0; }
      return side.id === 'comparator' && side.power > 0 && (dx !== thisDirection.x || dz !== thisDirection.z);
    });
  }

  #desiredPower(entry, wires) {
    const position = entry.position;
    const { rear, sides } = sidePositions(position, entry.facing);
    const adjacent = [...horizontalNeighbors(position), ...verticalNeighbors(position)];
    if (entry.id === 'dust') return wires.get(keyOf(position)) ?? 0;
    if (entry.id === 'lever' || entry.id === 'block' || entry.id === 'observer' || entry.id === 'target') return this.#sourcePower(entry);
    if (entry.id === 'torch') return this.#sourcePower(entry);
    if (entry.id === 'repeater') {
      const input = this.#redstonePowerAt(rear, wires, position);
      if (!this.#repeaterLocked(entry)) {
        const due = entry.pending && entry.pending.at <= this.tick ? entry.pending.power : null;
        if (due !== null) { entry.power = due > 0 ? 15 : 0; entry.pending = null; }
        const desired = input > 0 ? 15 : 0;
        if (desired === entry.power) entry.pending = null;
        else if (!entry.pending || entry.pending.power !== desired) entry.pending = { power: desired, at: this.tick + entry.delay * 2 };
      }
      return entry.power;
    }
    if (entry.id === 'comparator') {
      const main = this.#redstonePowerAt(rear, wires, position);
      const side = Math.max(0,...sides.map((sidePosition) => this.#redstonePowerAt(sidePosition, wires, position)));
      return entry.compareMode ? Math.max(main - side, 0) : main >= side ? main : 0;
    }
    if (entry.id === 'piston' || entry.id === 'sticky') {
      const direct = adjacent.some((next) => this.#poweredBlock(next, keyOf(position)));
      const quasi = this.blocks.get(keyOf({ x: position.x, y: position.y + 2, z: position.z }));
      const above = this.blocks.get(keyOf({ x: position.x, y: position.y + 1, z: position.z }));
      const quasiPower = Boolean(quasi && ['lever','block','torch','repeater','comparator'].includes(quasi.id) && this.#sourcePower(quasi) > 0 || above?.id === 'dust' && above.power > 0);
      const stronglyPoweredNeighbors=adjacent.some((next)=>{const support=this.blocks.get(keyOf(next));return support&&['lever','block','torch','repeater','comparator'].includes(support.id)&&this.#sourcePower(support)>0;});
      return direct || quasiPower || stronglyPoweredNeighbors ? 15 : 0;
    }
    if (entry.id === 'hopper' || entry.id === 'dropper' || entry.id === 'dispenser') return adjacent.some((next) => this.#poweredBlock(next, keyOf(position))) ? 15 : 0;
    if (entry.id === 'lamp' || entry.id === 'note') return Math.max(0,...adjacent.map((next) => this.#redstonePowerAt(next,wires,position)));
    return 0;
  }

  #blockGroup(start, direction) {
    const group = new Set();
    const queue = [start];
    while (queue.length && group.size <= 12) {
      const current = queue.shift();
      const currentKey = keyOf(current);
      if (group.has(currentKey)) continue;
      const block = this.blocks.get(currentKey);
      if (!block || !this.#movable(block)) continue;
      group.add(currentKey);
      const forward = {x:current.x+direction.x,y:current.y+direction.y,z:current.z+direction.z};
      if (this.blocks.has(keyOf(forward)) && !group.has(keyOf(forward))) queue.push(forward);
      if (!['slime','honey'].includes(block.id)) continue;
      for (const side of [...horizontalNeighbors(current),...verticalNeighbors(current)]) {
        const sideKey=keyOf(side),neighbor=this.blocks.get(sideKey);
        if(!neighbor||group.has(sideKey)||!this.#movable(neighbor))continue;
        if((block.id==='slime'&&neighbor.id==='honey')||(block.id==='honey'&&neighbor.id==='slime'))continue;
        queue.push(side);
      }
    }
    return group;
  }

  #movable(entry) { return !(['piston', 'sticky'].includes(entry.id) && entry.extended); }

  #movePiston(entry, extending) {
    const front = DIRECTIONS[entry.facing];
    const face = { x: entry.position.x + front.x, y: entry.position.y, z: entry.position.z + front.z };
    if (extending) {
      if (this.blocks.has(keyOf(face))) {
        const initial = this.blocks.get(keyOf(face));
        if (!this.#movable(initial)) return false;
        const group = this.#blockGroup(face, front);
        const destination = [...group].map((key) => { const p = positionOf(key); return { x: p.x + front.x, y: p.y + front.y, z: p.z + front.z }; });
        if (group.size > 12 || destination.some((next) => !inWorld(next) || this.blocks.has(keyOf(next)) && !group.has(keyOf(next)))) return false;
        const ordered=[...group].sort((a,b)=>{const pa=positionOf(a),pb=positionOf(b);return (pb.x-pa.x)*front.x+(pb.z-pa.z)*front.z;});
        for (const key of ordered) {
          const block = this.blocks.get(key); const p = positionOf(key); const next = { x: p.x + front.x, y: p.y+front.y, z: p.z + front.z };
          this.blocks.delete(key); block.position = next; this.blocks.set(keyOf(next), block);
        }
      }
      entry.extended = true;
      return true;
    }
    if (entry.id === 'sticky') {
      const pull = { x: face.x + front.x, y: face.y, z: face.z + front.z };
      const target = this.blocks.get(keyOf(pull));
      if (target && this.#movable(target) && !this.blocks.has(keyOf(face))) { this.blocks.delete(keyOf(pull)); target.position = face; this.blocks.set(keyOf(face), target); }
    }
    entry.extended = false;
    return true;
  }

  step() {
    this.tick++;
    const wires = this.#computeWirePower();
    const updates = [];
    const previousPower = new Map([...this.blocks].map(([key, entry]) => [key, entry.power]));
    for (const [key, entry] of this.blocks) {
      const power = this.#desiredPower(entry, wires);
      updates.push({ key, entry, power });
    }
    for (const { key, entry, power } of updates) {
      entry.previousPower = previousPower.get(key) ?? 0;
      if (entry.id === 'hopper' || entry.id === 'dropper' || entry.id === 'dispenser') {
        if (entry.id === 'hopper') entry.locked = power > 0;
        if ((entry.id === 'dropper' || entry.id === 'dispenser') && power > 0 && entry.previousPower === 0 && (entry.count ?? 0) > 0) {
          entry.count--;
          this.events.push({ type: entry.id === 'dropper' ? 'drop' : 'dispense', position: { ...entry.position } });
        }
      }
      const oldPower = entry.power;
      if (entry.id === 'torch' && power !== entry.power) {
        entry.toggleTimes = entry.toggleTimes.filter((at) => this.tick - at <= 60);
        entry.toggleTimes.push(this.tick);
        if (entry.toggleTimes.length >= 8) { entry.pulseUntil = this.tick + 160; entry.toggleTimes = []; }
      }
      entry.power = power;
      if ((entry.id === 'piston' || entry.id === 'sticky') && (power > 0) !== entry.extended) {
        const moved = this.#movePiston(entry, power > 0);
        entry.power = moved && power > 0 ? 15 : moved ? 0 : entry.extended ? 15 : 0;
      }
      if (entry.id === 'note' && power > 0 && oldPower === 0) this.events.push({ type: 'note', position: { ...entry.position }, pitch: entry.note });
    }
    return this.snapshot();
  }

  snapshot() {
    return { tick: this.tick, blocks: [...this.blocks.values()].map((entry) => cloneEntry(entry)), inventory: Object.fromEntries(this.inventory), events: this.events.splice(0) };
  }

  load(snapshot) {
    this.blocks.clear();
    this.tick = Math.max(0, snapshot.tick ?? 0);
    for (const [id, count] of Object.entries(snapshot.inventory ?? {})) if (this.inventory.has(id) && Number.isInteger(count) && count >= 0) this.inventory.set(id, count);
    for (const saved of snapshot.blocks ?? []) {
      if (!BLOCK_BY_ID.has(saved.id) || !inWorld(saved.position) || !Number.isInteger(saved.position.x) || !Number.isInteger(saved.position.y) || !Number.isInteger(saved.position.z)) continue;
      const entry = createEntry(saved.id, saved.position, saved);
      Object.assign(entry, saved, { position: { ...saved.position }, toggleTimes: saved.toggleTimes ?? [], pending: saved.pending ?? null });
      this.blocks.set(keyOf(entry.position), entry);
    }
  }
}
