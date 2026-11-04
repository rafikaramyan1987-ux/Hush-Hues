export type UpgradeId = 'tank' | 'drain' | 'tools' | 'hints' | 'scanner';

export interface UpgradeDef {
  id: UpgradeId;
  maxLevel: number;
  baseCost: number;
}

export const UPGRADES: readonly UpgradeDef[] = [
  { id: 'tank', maxLevel: 5, baseCost: 10 },
  { id: 'drain', maxLevel: 5, baseCost: 14 },
  { id: 'tools', maxLevel: 5, baseCost: 8 },
  { id: 'hints', maxLevel: 3, baseCost: 12 },
  { id: 'scanner', maxLevel: 1, baseCost: 30 },
];

export type UpgradeLevels = Record<UpgradeId, number>;

export const emptyUpgrades = (): UpgradeLevels => ({ tank: 0, drain: 0, tools: 0, hints: 0, scanner: 0 });

export function getDef(id: UpgradeId): UpgradeDef {
  const d = UPGRADES.find((u) => u.id === id);
  if (!d) throw new Error(`unknown upgrade ${id}`);
  return d;
}

/** Cost to go from `level` to `level + 1`, or null if already maxed. */
export function upgradeCost(id: UpgradeId, level: number): number | null {
  const def = getDef(id);
  if (level >= def.maxLevel) return null;
  return Math.round(def.baseCost * Math.pow(1.6, level));
}

export interface BuyResult {
  ok: boolean;
  parts: number;
  levels: UpgradeLevels;
}

export function buyUpgrade(id: UpgradeId, levels: UpgradeLevels, parts: number): BuyResult {
  const cost = upgradeCost(id, levels[id]);
  if (cost === null || cost > parts) return { ok: false, parts, levels };
  return { ok: true, parts: parts - cost, levels: { ...levels, [id]: levels[id] + 1 } };
}
