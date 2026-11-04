/**
 * Ball colours, in the order they are introduced (the first ones are the most distinct),
 * plus one symbol per colour for the colour-blind option.
 */
export const COLORS = [
  '#f2685e', // coral
  '#4ea3f2', // sky
  '#f6c445', // sun
  '#52c27a', // leaf
  '#a98af0', // lavender
  '#f5953f', // apricot
  '#f589c4', // blossom
  '#1fa8a6', // lagoon
  '#4b5bc9', // indigo
  '#b7dd4c', // lime
  '#9b6b52', // cocoa
  '#eef0f4', // pearl
] as const;

/** 24×24 symbol paths, drawn centred on the ball. */
export const SYMBOLS = [
  '<circle cx="12" cy="12" r="5"/>', // dot
  '<path d="M12 5 19 18H5Z"/>', // triangle
  '<rect x="6.5" y="6.5" width="11" height="11" rx="1"/>', // square
  '<path d="M12 4 20 12 12 20 4 12Z"/>', // diamond
  '<path d="M12 4l2.3 5 5.4.5-4.1 3.6 1.2 5.3L12 15.6 7.2 18.4l1.2-5.3L4.3 9.5l5.4-.5Z"/>', // star
  '<path d="M9.5 5h5v4.5H19v5h-4.5V19h-5v-4.5H5v-5h4.5Z"/>', // plus
  '<path d="M12 19s-7-4.4-7-9.2A3.8 3.8 0 0 1 12 7.6a3.8 3.8 0 0 1 7 2.2C19 14.6 12 19 12 19Z"/>', // heart
  '<path d="M15.5 4.5a8 8 0 1 0 4 12 6.5 6.5 0 1 1-4-12Z"/>', // moon
  '<path d="M12 4.5 18.5 8.25v7.5L12 19.5 5.5 15.75v-7.5Z"/>', // hexagon
  '<path d="M7 5 12 10l5-5 2 2-5 5 5 5-2 2-5-5-5 5-2-2 5-5-5-5Z"/>', // cross
  '<path d="M12 5a7 7 0 1 1 0 14 7 7 0 0 1 0-14Zm0 3.5a3.5 3.5 0 1 0 0 7 3.5 3.5 0 0 0 0-7Z"/>', // ring
  '<path d="M5 7h14v3H5Zm0 7h14v3H5Z"/>', // bars
] as const;
