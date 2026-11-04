import { createRng, type Rng } from './rng';
import { PUZZLE_TYPES, type PuzzleType } from '../puzzles/types';
import { ROOM_COUNT, difficulty } from './balance';

export type EventType = 'leak' | 'meteor' | 'power' | 'lucky';

export interface RoomPlan {
  index: number;
  type: PuzzleType;
  seed: number;
  difficulty: number;
}

export interface RunPlan {
  seed: number;
  rooms: RoomPlan[];
  /** events[i] happens in the corridor after room i (null = quiet corridor). Last room leads to the pod. */
  events: (EventType | null)[];
  /** seed for random outcomes of event choices */
  eventSeed: number;
}

export const EVENT_CHANCE = 0.55;
const EVENT_WEIGHTS: [EventType, number][] = [
  ['leak', 0.3],
  ['meteor', 0.25],
  ['power', 0.25],
  ['lucky', 0.2],
];

function pickWeighted(rng: Rng): EventType {
  let r = rng.next();
  for (const [t, w] of EVENT_WEIGHTS) {
    if ((r -= w) < 0) return t;
  }
  return 'lucky';
}

/** Room order: each puzzle type appears twice, never the same type twice in a row. */
export function roomOrder(rng: Rng): PuzzleType[] {
  const reps = Math.ceil(ROOM_COUNT / PUZZLE_TYPES.length);
  for (let tries = 0; tries < 200; tries++) {
    const bag: PuzzleType[] = [];
    for (let i = 0; i < reps; i++) bag.push(...PUZZLE_TYPES);
    rng.shuffle(bag);
    const order = bag.slice(0, ROOM_COUNT);
    if (order.every((t, i) => i === 0 || t !== order[i - 1])) return order;
  }
  return [...Array(ROOM_COUNT)].map((_, i) => PUZZLE_TYPES[i % PUZZLE_TYPES.length]!);
}

export function createRunPlan(seed: number): RunPlan {
  const rng = createRng(seed);
  const order = roomOrder(rng.fork('order'));
  const rooms = order.map((type, index) => ({
    index,
    type,
    seed: rng.fork(`room${index}`).seed,
    difficulty: difficulty(index),
  }));
  const ev = rng.fork('events');
  const events: (EventType | null)[] = rooms.map((_, i) =>
    i === ROOM_COUNT - 1 ? null : ev.chance(EVENT_CHANCE) ? pickWeighted(ev) : null,
  );
  return { seed, rooms, events, eventSeed: rng.fork('outcomes').seed };
}

/* ---------- Event consequences (pure, so they can be tested and shown to the player) ---------- */

export const EVENT_RULES = {
  leak: { sealParts: 3, fixFailOxygen: 15, fixTaps: 4, fixSeconds: 5 },
  meteor: { coverOxygen: 8, dashRiskOxygen: 22, dashChance: 0.5 },
  power: { batteryParts: 2, darkBonusParts: 2 },
  lucky: { oxygen: 20, parts: 1 },
} as const;

export interface Effect {
  oxygen: number;
  parts: number;
  dark?: boolean;
}

export function meteorDash(roll: number): Effect {
  return roll < EVENT_RULES.meteor.dashChance ? { oxygen: -EVENT_RULES.meteor.dashRiskOxygen, parts: 0 } : { oxygen: 0, parts: 1 };
}
