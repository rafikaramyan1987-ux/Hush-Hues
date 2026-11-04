type Attrs = Record<string, string | number | boolean | undefined | null | ((e: Event) => void)>;
type Child = Node | string | number | null | undefined | false;

export function h<K extends keyof HTMLElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): HTMLElementTagNameMap[K] {
  const el = document.createElement(tag);
  applyAttrs(el, attrs);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

const SVGNS = 'http://www.w3.org/2000/svg';
export function s<K extends keyof SVGElementTagNameMap>(tag: K, attrs: Attrs = {}, ...children: Child[]): SVGElementTagNameMap[K] {
  const el = document.createElementNS(SVGNS, tag);
  applyAttrs(el, attrs);
  for (const c of children) if (c !== null && c !== undefined && c !== false) el.append(c instanceof Node ? c : String(c));
  return el;
}

function applyAttrs(el: Element, attrs: Attrs): void {
  for (const [k, v] of Object.entries(attrs)) {
    if (v === undefined || v === null || v === false) continue;
    if (typeof v === 'function') el.addEventListener(k.replace(/^on/, '').toLowerCase(), v as EventListener);
    else if (k === 'text') el.textContent = String(v);
    else el.setAttribute(k, v === true ? '' : String(v));
  }
}

export const reducedMotion = (): boolean =>
  typeof matchMedia !== 'undefined' && matchMedia('(prefers-reduced-motion: reduce)').matches;

/** Convert a pointer position to a grid cell inside an element. */
export function cellFromPoint(el: Element, x: number, y: number, size: number, pad = 0): number {
  const r = el.getBoundingClientRect();
  const w = r.width - 2 * pad, hh = r.height - 2 * pad;
  const c = Math.floor(((x - r.left - pad) / w) * size);
  const rr = Math.floor(((y - r.top - pad) / hh) * size);
  if (c < 0 || rr < 0 || c >= size || rr >= size) return -1;
  return rr * size + c;
}

export function fmtTime(sec: number): string {
  const s0 = Math.max(0, Math.round(sec));
  return `${Math.floor(s0 / 60)}:${String(s0 % 60).padStart(2, '0')}`;
}
