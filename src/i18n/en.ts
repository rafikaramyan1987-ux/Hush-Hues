/** English strings. To add a language: copy this file, translate the values, register it in index.ts. */
const en = {
  langName: 'English',
  title: 'Hush Hues',
  tagline: 'Sort the colours. Take your time.',
  play: 'Play',
  continueLevel: 'Level {n}',
  levels: 'Levels',
  level: 'Level {n}',
  moves: 'Moves {n}',
  undo: 'Undo',
  extraTube: 'Extra tube',
  restart: 'Restart',
  next: 'Next',
  replay: 'Replay',
  back: 'Back',
  home: 'Home',
  settings: 'Settings',
  language: 'Language',
  sound: 'Sound',
  vibration: 'Vibration',
  symbols: 'Colour symbols',
  on: 'On',
  off: 'Off',
  close: 'Close',
  sorted: 'Sorted!',
  hint: 'Tap a tube, then another',
  watchAd: 'Watch an ad',
  noAd: 'No ad right now — try again later',
  locked: 'Locked',
  stars: '{n} stars',
} as const;

export type Key = keyof typeof en;
export type Dict = Record<Key, string>;
export default en as Dict;
