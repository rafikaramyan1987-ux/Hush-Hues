import { s } from './dom';

/** Small original scene illustrations drawn with SVG primitives. */
export type Scene = 'leak' | 'meteor' | 'power' | 'lucky' | 'win' | 'lose' | 'quit';

export function scene(kind: Scene): SVGSVGElement {
  const svg = s('svg', { viewBox: '0 0 320 110', class: `scene scene-${kind}`, 'aria-hidden': 'true' });
  const wall = () =>
    [0, 1, 2, 3, 4, 5, 6, 7].map((i) => s('rect', { x: i * 40 + 2, y: 4, width: 36, height: 102, rx: 4, class: 'sc-panel' }));
  switch (kind) {
    case 'leak':
      svg.append(...wall(),
        s('path', { d: 'M150 20 L160 45 L148 60 L165 80 L155 100', class: 'sc-crack' }),
        ...[0, 1, 2].map((i) => s('circle', { cx: 175 + i * 22, cy: 55 - i * 6, r: 8 + i * 5, class: `sc-puff p${i}` })));
      break;
    case 'meteor':
      svg.append(s('rect', { width: 320, height: 110, class: 'sc-space' }),
        ...[[60, 20], [150, 10], [240, 35], [110, 60]].map(([x, y], i) =>
          s('g', { class: `sc-meteor m${i}` },
            s('line', { x1: x! - 40, y1: y! - 20, x2: x, y2: y, class: 'sc-trail' }),
            s('circle', { cx: x, cy: y, r: 5 + (i % 2) * 3, class: 'sc-rock' }))),
        s('rect', { x: 0, y: 90, width: 320, height: 20, class: 'sc-floor' }));
      break;
    case 'power':
      svg.append(s('rect', { width: 320, height: 110, fill: '#02040a' }),
        s('path', { d: 'M160 30 L60 110 L260 110 Z', class: 'sc-cone' }),
        s('circle', { cx: 160, cy: 28, r: 12, class: 'sc-bulb' }),
        s('path', { d: 'M156 18 L164 18', stroke: '#555', 'stroke-width': 3 }));
      break;
    case 'lucky':
      svg.append(...wall(),
        s('rect', { x: 120, y: 18, width: 80, height: 84, rx: 6, class: 'sc-locker' }),
        s('rect', { x: 146, y: 34, width: 28, height: 56, rx: 12, class: 'sc-canister' }),
        s('text', { x: 160, y: 68, 'text-anchor': 'middle', class: 'sc-o2' }, 'O₂'));
      break;
    case 'win':
      svg.append(s('rect', { width: 320, height: 110, class: 'sc-space' }),
        s('circle', { cx: 60, cy: 80, r: 50, class: 'sc-station' }),
        s('g', { class: 'sc-pod' },
          s('ellipse', { cx: 220, cy: 40, rx: 22, ry: 13, class: 'sc-pod-body' }),
          s('path', { d: 'M198 40 L170 34 L170 46 Z', class: 'sc-flame' })));
      break;
    default:
      svg.append(s('rect', { width: 320, height: 110, fill: '#0c0610' }),
        s('circle', { cx: 160, cy: 58, r: 38, class: 'sc-helmet' }),
        s('path', { d: 'M134 52 Q160 32 186 52 L186 66 Q160 82 134 66 Z', class: 'sc-visor' }));
  }
  return svg;
}
