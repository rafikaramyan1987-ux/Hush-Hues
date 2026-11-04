import { s } from './dom';

const icon = (...paths: string[]) => {
  const svg = s('svg', { viewBox: '0 0 24 24', class: 'icon', 'aria-hidden': 'true' });
  for (const d of paths) svg.append(s('path', { d }));
  return svg;
};

export const iconSound = () => icon('M4 9h4l5-4v14l-5-4H4z', 'M16 8.5a5 5 0 0 1 0 7', 'M18.5 6a8.5 8.5 0 0 1 0 12');
export const iconMute = () => icon('M4 9h4l5-4v14l-5-4H4z', 'M16 9l5 6', 'M21 9l-5 6');
export const iconPause = () => icon('M8 5v14', 'M16 5v14');
export const iconGear = () => icon('M12 8a4 4 0 1 0 0 8a4 4 0 1 0 0-8z', 'M12 2v3 M12 19v3 M2 12h3 M19 12h3 M4.9 4.9l2.1 2.1 M17 17l2.1 2.1 M4.9 19.1L7 17 M17 7l2.1-2.1');

/** Original logo: a helmet visor with a rising breath bubble over the station ring. */
export function logo(title: string) {
  const svg = s('svg', { viewBox: '0 0 320 200', class: 'logo', role: 'img', 'aria-label': title });
  const defs = s('defs', {},
    s('linearGradient', { id: 'lg-visor', x1: 0, y1: 0, x2: 1, y2: 1 },
      s('stop', { offset: '0', 'stop-color': '#38e1ff' }),
      s('stop', { offset: '1', 'stop-color': '#7b5cff' })),
    s('radialGradient', { id: 'lg-glow' },
      s('stop', { offset: '0', 'stop-color': '#38e1ff', 'stop-opacity': '0.45' }),
      s('stop', { offset: '1', 'stop-color': '#38e1ff', 'stop-opacity': '0' })));
  svg.append(defs,
    s('circle', { cx: 160, cy: 78, r: 76, fill: 'url(#lg-glow)' }),
    s('ellipse', { cx: 160, cy: 92, rx: 140, ry: 22, class: 'logo-ring' }),
    s('circle', { cx: 160, cy: 78, r: 50, fill: '#0b1426', stroke: 'url(#lg-visor)', 'stroke-width': 6 }),
    s('path', { d: 'M126 70 Q160 40 194 70 L194 90 Q160 112 126 90 Z', fill: 'url(#lg-visor)', opacity: 0.85 }),
    s('path', { d: 'M136 70 Q150 58 166 60', stroke: '#fff', 'stroke-width': 4, fill: 'none', 'stroke-linecap': 'round', opacity: 0.8 }),
    s('circle', { cx: 204, cy: 30, r: 9, class: 'bubble b1' }),
    s('circle', { cx: 220, cy: 12, r: 5, class: 'bubble b2' }),
    s('text', { x: 160, y: 168, 'text-anchor': 'middle', class: 'logo-title' }, title),
    s('rect', { x: 92, y: 182, width: 136, height: 4, rx: 2, fill: 'url(#lg-visor)' }));
  return svg;
}
