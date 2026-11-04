/** Ad rules, kept pure so they are unit-tested. */
export const MIDGAME_COOLDOWN_MS = 3 * 60 * 1000;
/** No midgame ad before level 3 is done: the first one can only appear between level 3 and level 4. */
export const MIDGAME_FIRST_AFTER_LEVEL = 3;
export const FREE_UNDOS = 3;
export const UNDOS_PER_AD = 3;

export function midgameAllowed(completedLevel: number, now: number, lastMidgameAt: number, sessionStart: number): boolean {
  if (completedLevel < MIDGAME_FIRST_AFTER_LEVEL) return false;
  // cooldown counts from the last midgame ad, or from the session start if none was shown yet
  const since = lastMidgameAt > 0 ? lastMidgameAt : sessionStart;
  return now - since >= MIDGAME_COOLDOWN_MS;
}
