export interface ViewCtx {
  onSolved(): void;
  /** oxygen penalty in seconds (e.g. wrong code) */
  onPenalty(seconds: number): void;
  sfx: { click(): void; snap(): void; fail(): void };
}

export interface PuzzleView {
  el: HTMLElement;
  /** use one hint; returns false if nothing to hint */
  hint(): boolean;
  /** instantly solve (debug / e2e only) */
  solveNow(): void;
  /** keyboard input while this view is active */
  onKey?(e: KeyboardEvent): void;
  destroy?(): void;
}

export const COLORS = ['#38e1ff', '#ff5ea8', '#ffd23f', '#7cff6b', '#b18cff', '#ff8f3f'];
