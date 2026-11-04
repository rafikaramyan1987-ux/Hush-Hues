import type { UpgradeLevels } from './upgrades';

export const ROOM_COUNT = 10;
export const BASE_OXYGEN = 100;
export const LOW_OXYGEN_AD_RATIO = 0.15;
export const ALARM_RATIO = 0.25;
export const REWARD_AD_SECONDS = 20;
export const MIDGAME_AD_COOLDOWN_MS = 3 * 60 * 1000;
export const WRONG_CODE_PENALTY_S = 3;

const clamp01 = (x: number): number => Math.max(0, Math.min(1, x));

/** Difficulty in [0, 1] for room index 0..ROOM_COUNT-1. Monotonic non-decreasing. */
export function difficulty(room: number): number {
  return clamp01(Math.pow(room / (ROOM_COUNT - 1), 0.9));
}

/** Target solve time in seconds (15 s for the first room up to 40 s for the last) + tools upgrade. */
export function parTime(room: number, up: UpgradeLevels): number {
  return Math.round(15 + 25 * difficulty(room)) + 3 * up.tools;
}

export function maxOxygen(up: UpgradeLevels): number {
  return BASE_OXYGEN + 15 * up.tank;
}

/** Oxygen units lost per second. The station degrades a bit deeper in. */
export function drainPerSecond(room: number, up: UpgradeLevels): number {
  return (1 + 0.04 * room) * (1 - 0.07 * up.drain);
}

/** Oxygen canisters found when solving a room. */
export function solveReward(room: number, up: UpgradeLevels, seconds: number): { oxygen: number; parts: number; fast: boolean } {
  const par = parTime(room, up);
  const fast = seconds <= par;
  const oxygen = Math.round(15 + 25 * difficulty(room)) + (fast ? 5 : 0);
  const parts = 2 + Math.floor(room / 3) + (fast ? 1 : 0);
  return { oxygen, parts, fast };
}

export function skipCost(room: number): number {
  return 30 + 2 * room;
}

export function hintsPerRun(up: UpgradeLevels): number {
  return 1 + up.hints;
}

/** Oxygen units equivalent to N seconds of breathing in this room. */
export function secondsToOxygen(seconds: number, room: number, up: UpgradeLevels): number {
  return seconds * drainPerSecond(room, up);
}

export function addOxygen(current: number, amount: number, max: number): number {
  return Math.max(0, Math.min(max, current + amount));
}
