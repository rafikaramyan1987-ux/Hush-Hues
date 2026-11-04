import type { Rng } from '../../core/rng';
import type { PuzzleType } from '../../puzzles/types';
import { createCargoView } from './cargo';
import { createCodeView } from './code';
import { createPipesView } from './pipes';
import { createValvesView } from './valves';
import { createWiresView } from './wires';
import type { PuzzleView, ViewCtx } from './types';

export const VIEW_FACTORIES: Record<PuzzleType, (rng: Rng, d: number, ctx: ViewCtx) => PuzzleView> = {
  pipes: createPipesView,
  wires: createWiresView,
  code: createCodeView,
  cargo: createCargoView,
  valves: createValvesView,
};

export type { PuzzleView, ViewCtx };
