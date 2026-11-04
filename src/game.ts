import * as B from './core/balance';
import { createRng, dailyKey, dailySeed, randomSeed, type Rng } from './core/rng';
import { createRunPlan, EVENT_RULES, meteorDash, type EventType, type RunPlan } from './core/run';
import { getBrowserStorage, load, recordRun, save, type SaveData } from './core/save';
import { buyUpgrade, upgradeCost, UPGRADES, type UpgradeId } from './core/upgrades';
import { getLang, LANGS, setLang, t, type Key } from './i18n';
import { ads } from './platform/ads';
import { audio } from './platform/audio';
import type { PuzzleType } from './puzzles/types';
import { fmtTime, h, reducedMotion } from './ui/dom';
import { scene } from './ui/art';
import { iconMute, iconPause, iconSound, logo } from './ui/icons';
import { VIEW_FACTORIES, type PuzzleView } from './ui/views';

type Phase = 'menu' | 'puzzle' | 'cleared' | 'event' | 'leak' | 'end';
type EndKind = 'win' | 'lose' | 'quit';

interface RunState {
  plan: RunPlan;
  dailyKey: string | null;
  room: number;
  oxygen: number;
  max: number;
  parts: number;
  hints: number;
  time: number;
  roomTime: number;
  oxygenAdUsed: boolean;
  dark: boolean;
  roomsCleared: number;
  eventRng: Rng;
}

const TITLE_KEYS: Record<PuzzleType, [Key, Key]> = {
  pipes: ['pipesTitle', 'pipesHelp'],
  wires: ['wiresTitle', 'wiresHelp'],
  code: ['codeTitle', 'codeHelp'],
  cargo: ['cargoTitle', 'cargoHelp'],
  valves: ['valvesTitle', 'valvesHelp'],
};
const EVENT_NAME: Record<EventType, Key> = { leak: 'evLeak', meteor: 'evMeteor', power: 'evPower', lucky: 'evLucky' };

export class Game {
  private kv = getBrowserStorage();
  data: SaveData = load(this.kv);
  phase: Phase = 'menu';
  run: RunState | null = null;
  view: PuzzleView | null = null;
  private pauses = new Set<string>();
  private screen: HTMLElement;
  private toastEl: HTMLElement;
  private hud: { fill: HTMLElement; label: HTMLElement; room: HTMLElement; parts: HTMLElement; adBtn: HTMLElement | null; hintBtn: HTMLElement | null } | null = null;
  private last = 0;
  private alarmAcc = 0;
  private breathAcc = 0;
  private lowState = '';
  private runsThisSession = 0;
  private toastTimer = 0;
  private leak: { left: number; remaining: number; timer: HTMLElement; done: (ok: boolean) => void } | null = null;

  constructor(private root: HTMLElement) {
    this.screen = root.querySelector('#screen') as HTMLElement;
    this.toastEl = root.querySelector('#toast') as HTMLElement;
    audio.setMuted(this.data.settings.muted);
    setLang(this.data.settings.lang ?? getLang());
    ads.setHooks({
      onAdStart: () => {
        this.pauses.add('ad');
        audio.setAdMuted(true);
        this.syncGameplay();
      },
      onAdEnd: () => {
        this.pauses.delete('ad');
        audio.setAdMuted(false);
        this.syncGameplay();
      },
    });
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) this.pauses.add('hidden');
      else this.pauses.delete('hidden');
      this.last = performance.now();
      this.syncGameplay();
    });
    const unlock = () => audio.unlock();
    window.addEventListener('pointerdown', unlock, { capture: true });
    window.addEventListener('keydown', unlock, { capture: true });
    window.addEventListener('keydown', (e) => this.onKey(e));
    requestAnimationFrame((ts) => this.frame(ts));
  }

  /* ---------------- persistence ---------------- */
  private persist(): void {
    save(this.kv, this.data);
  }

  /* ---------------- loop ---------------- */
  private isActive(): boolean {
    return !!this.run && (this.phase === 'puzzle' || this.phase === 'leak') && this.pauses.size === 0;
  }

  private syncGameplay(): void {
    ads.setGameplay(this.isActive());
  }

  private frame(ts: number): void {
    const dt = Math.min(0.1, Math.max(0, (ts - (this.last || ts)) / 1000));
    this.last = ts;
    if (this.isActive() && this.run) {
      const r = this.run;
      r.time += dt;
      if (this.phase === 'puzzle') {
        r.roomTime += dt;
        r.oxygen -= B.drainPerSecond(r.room, this.data.upgrades) * dt;
        if (r.oxygen <= 0) {
          r.oxygen = 0;
          this.updateHud();
          this.end('lose');
        }
      } else if (this.phase === 'leak' && this.leak) {
        this.leak.left -= dt;
        this.leak.timer.textContent = t('evLeakTap', { s: Math.max(0, Math.ceil(this.leak.left)) });
        if (this.leak.left <= 0) this.leak.done(false);
      }
      this.lowAudio(dt);
    }
    if (this.run && this.hud) this.updateHud();
    requestAnimationFrame((n) => this.frame(n));
  }

  private lowAudio(dt: number): void {
    const r = this.run!;
    const ratio = r.oxygen / r.max;
    if (ratio < B.ALARM_RATIO && this.phase === 'puzzle') {
      this.alarmAcc += dt;
      this.breathAcc += dt;
      if (this.alarmAcc > 2.2) {
        this.alarmAcc = 0;
        audio.alarm();
      }
      if (this.breathAcc > (ratio < B.LOW_OXYGEN_AD_RATIO ? 1.6 : 2.6)) {
        this.breathAcc = 0;
        audio.breath();
      }
    }
  }

  private updateHud(): void {
    const r = this.run!, hud = this.hud!;
    const ratio = Math.max(0, r.oxygen / r.max);
    hud.fill.style.transform = `scaleX(${ratio})`;
    const secs = r.oxygen / B.drainPerSecond(r.room, this.data.upgrades);
    hud.label.textContent = `${t('oxygen')} ${Math.ceil(ratio * 100)}% · ${fmtTime(secs)}`;
    const low = ratio < B.LOW_OXYGEN_AD_RATIO ? 'critical' : ratio < B.ALARM_RATIO ? 'low' : '';
    if (low !== this.lowState) {
      this.lowState = low;
      this.root.classList.toggle('low', low !== '');
      this.root.classList.toggle('critical', low === 'critical');
    }
    if (hud.adBtn) hud.adBtn.hidden = !(this.phase === 'puzzle' && !r.oxygenAdUsed && ratio < B.LOW_OXYGEN_AD_RATIO);
  }

  /* ---------------- helpers ---------------- */
  toast(msg: string): void {
    this.toastEl.textContent = msg;
    this.toastEl.classList.remove('show');
    void this.toastEl.offsetWidth;
    this.toastEl.classList.add('show');
    clearTimeout(this.toastTimer);
    this.toastTimer = window.setTimeout(() => this.toastEl.classList.remove('show'), 2700);
  }

  private shake(): void {
    if (reducedMotion()) return;
    this.root.classList.remove('shake');
    void this.root.offsetWidth;
    this.root.classList.add('shake');
    setTimeout(() => this.root.classList.remove('shake'), 500);
  }

  private flash(kind: 'good' | 'bad'): void {
    const f = h('div', { class: `flash ${kind}` });
    this.root.append(f);
    setTimeout(() => f.remove(), 600);
  }

  private show(...children: (Node | null)[]): void {
    this.view?.destroy?.();
    this.view = null;
    this.screen.replaceChildren(...children.filter((c): c is Node => !!c));
    this.screen.scrollTop = 0;
  }

  private btn(label: string, onClick: () => void, cls = '', attrs: Record<string, string | boolean> = {}): HTMLButtonElement {
    return h('button', { type: 'button', class: `btn ${cls}`, ...attrs, onclick: () => { audio.click(); onClick(); } }, label);
  }

  private muteButton(): HTMLButtonElement {
    const b = h('button', { type: 'button', class: 'icon-btn', 'aria-label': audio.isMuted() ? t('soundOff') : t('soundOn'), 'data-testid': 'mute' });
    const paint = () => {
      b.replaceChildren(audio.isMuted() ? iconMute() : iconSound());
      b.setAttribute('aria-label', audio.isMuted() ? t('soundOff') : t('soundOn'));
    };
    b.addEventListener('click', () => {
      audio.unlock();
      audio.setMuted(!audio.isMuted());
      this.data.settings.muted = audio.isMuted();
      this.persist();
      paint();
    });
    paint();
    return b;
  }

  private ox(seconds: number): number {
    return B.secondsToOxygen(seconds, this.run?.room ?? 0, this.data.upgrades);
  }

  private changeOxygen(units: number): void {
    const r = this.run!;
    r.oxygen = B.addOxygen(r.oxygen, units, r.max);
  }

  /* ---------------- menus ---------------- */
  menu(): void {
    this.phase = 'menu';
    this.run = null;
    this.hud = null;
    this.root.classList.remove('low', 'critical');
    this.lowState = '';
    this.syncGameplay();
    const today = dailyKey();
    const d = this.data.daily && this.data.daily.key === today ? this.data.daily : null;
    const langSel = h('select', { class: 'lang', 'aria-label': t('language'), 'data-testid': 'lang' },
      ...Object.entries(LANGS).map(([code, dict]) => {
        const o = h('option', { value: code }, dict.langName);
        if (code === getLang()) o.selected = true;
        return o;
      }));
    langSel.addEventListener('change', () => {
      setLang(langSel.value);
      this.data.settings.lang = langSel.value;
      this.persist();
      this.menu();
    });
    this.show(
      h('div', { class: 'title-screen' },
        logo(t('title')),
        h('p', { class: 'tagline' }, t('tagline')),
        h('div', { class: 'menu' },
          this.btn(t('play'), () => this.startRun(false), 'primary', { 'data-testid': 'play' }),
          h('div', { class: 'daily-wrap' },
            this.btn(t('daily'), () => this.startRun(true), '', { 'data-testid': 'daily' }),
            h('small', {}, d ? (d.escaped ? t('dailyEscaped') : t('dailyBest', { rooms: d.bestRooms })) : t('dailySub', { date: today }))),
          this.btn(t('workshop'), () => this.workshop(), '', { 'data-testid': 'workshop' }),
          h('div', { class: 'row' },
            this.btn(t('stats'), () => this.stats(), 'small'),
            this.btn(t('howTo'), () => this.howTo(), 'small'))),
        h('div', { class: 'parts-bank' }, `⚙ ${this.data.parts} ${t('parts')}`),
        h('div', { class: 'settings-row' }, langSel, this.muteButton())),
    );
  }

  private panel(title: string, ...body: (Node | null)[]): HTMLElement {
    return h('div', { class: 'panel' }, h('h2', {}, title), ...body.filter((b): b is Node => !!b));
  }

  private howTo(): void {
    this.show(this.panel(t('howTo'), h('p', {}, t('howToText')), this.btn(t('back'), () => this.menu())));
  }

  private stats(): void {
    const st = this.data.stats;
    const row = (k: Key, v: string | number) => h('li', {}, h('span', {}, t(k)), h('b', {}, v));
    this.show(
      this.panel(t('stats'),
        h('ul', { class: 'stats' },
          row('statRuns', st.runs),
          row('statEscapes', st.escapes),
          row('statRooms', st.roomsCleared),
          row('statBest', `${st.bestRooms}/10`),
          row('statBestTime', st.bestEscapeTime ? fmtTime(st.bestEscapeTime) : t('none'))),
        this.btn(t('back'), () => this.menu())),
    );
  }

  private workshop(): void {
    const names: Record<UpgradeId, [Key, Key]> = {
      tank: ['upTank', 'upTankDesc'],
      drain: ['upDrain', 'upDrainDesc'],
      tools: ['upTools', 'upToolsDesc'],
      hints: ['upHints', 'upHintsDesc'],
      scanner: ['upScanner', 'upScannerDesc'],
    };
    const list = h('ul', { class: 'upgrades' });
    const bank = h('div', { class: 'parts-bank big' });
    const render = () => {
      bank.textContent = `⚙ ${this.data.parts} ${t('parts')}`;
      list.replaceChildren(
        ...UPGRADES.map((u) => {
          const lvl = this.data.upgrades[u.id];
          const cost = upgradeCost(u.id, lvl);
          const pips = h('span', { class: 'pips' }, ...Array.from({ length: u.maxLevel }, (_, i) => h('i', { class: i < lvl ? 'on' : '' })));
          const buy = cost === null
            ? h('span', { class: 'maxed' }, t('maxed'))
            : this.btn(t('buy', { c: `⚙${cost}` }), () => {
                const res = buyUpgrade(u.id, this.data.upgrades, this.data.parts);
                if (res.ok) {
                  this.data.upgrades = res.levels;
                  this.data.parts = res.parts;
                  this.persist();
                  audio.success();
                  render();
                } else this.toast(t('notEnoughParts'));
              }, `small${cost > this.data.parts ? ' disabled' : ''}`, { 'data-testid': `buy-${u.id}` });
          return h('li', { class: 'upgrade' },
            h('div', {}, h('b', {}, t(names[u.id][0])), h('small', {}, t(names[u.id][1])), h('div', {}, pips, h('small', {}, t('level', { l: lvl, m: u.maxLevel })))),
            buy);
        }),
      );
    };
    render();
    this.show(this.panel(t('workshop'), h('p', {}, t('workshopText')), bank, list, this.btn(t('back'), () => this.menu())));
  }

  /* ---------------- run flow ---------------- */
  async startRun(daily: boolean): Promise<void> {
    if (this.runsThisSession > 0) await ads.midgame();
    const seed = daily ? dailySeed() : randomSeed();
    const plan = createRunPlan(seed);
    const up = this.data.upgrades;
    this.run = {
      plan,
      dailyKey: daily ? dailyKey() : null,
      room: 0,
      oxygen: B.maxOxygen(up),
      max: B.maxOxygen(up),
      parts: 0,
      hints: B.hintsPerRun(up),
      time: 0,
      roomTime: 0,
      oxygenAdUsed: false,
      dark: false,
      roomsCleared: 0,
      eventRng: createRng(plan.eventSeed),
    };
    this.pauses.clear();
    if (document.hidden) this.pauses.add('hidden');
    this.enterRoom(0);
  }

  private hudEl(): HTMLElement {
    const r = this.run!;
    const fill = h('div', { class: 'o2-fill' });
    const label = h('span', { class: 'o2-label', 'data-testid': 'oxygen' });
    const room = h('span', { class: 'room-label' }, t('room', { n: r.room + 1, total: B.ROOM_COUNT }));
    const parts = h('span', { class: 'parts-label' }, `⚙ ${r.parts}`);
    const pause = h('button', { type: 'button', class: 'icon-btn', 'aria-label': t('pause'), onclick: () => this.pauseMenu() }, iconPause());
    this.hud = { fill, label, room, parts, adBtn: null, hintBtn: null };
    return h('header', { class: 'hud' },
      h('div', { class: 'o2-bar' }, fill, label),
      h('div', { class: 'hud-row' }, room, parts, h('span', { class: 'spacer' }), this.muteButton(), pause));
  }

  private enterRoom(index: number): void {
    const r = this.run!;
    r.room = index;
    r.roomTime = 0;
    const plan = r.plan.rooms[index]!;
    const [titleKey, helpKey] = TITLE_KEYS[plan.type];
    const hud = this.hudEl();
    const stage = h('div', { class: `stage${r.dark ? ' dark' : ''}` });
    const view = VIEW_FACTORIES[plan.type](createRng(plan.seed), plan.difficulty, {
      onSolved: () => this.solved(),
      onPenalty: (sec) => {
        this.changeOxygen(-this.ox(sec));
        this.toast(t('codeWrong', { n: Math.round(this.ox(sec)) }));
        this.flash('bad');
      },
      sfx: { click: () => audio.click(), snap: () => audio.snap(), fail: () => audio.fail() },
    });
    stage.append(view.el);
    if (r.dark) {
      const light = h('div', { class: 'flashlight' });
      stage.append(light);
      const aim = (e: PointerEvent) => {
        const rect = stage.getBoundingClientRect();
        stage.style.setProperty('--fx', `${e.clientX - rect.left}px`);
        stage.style.setProperty('--fy', `${e.clientY - rect.top}px`);
      };
      stage.addEventListener('pointermove', aim, { capture: true });
      stage.addEventListener('pointerdown', aim, { capture: true });
    }
    const hintBtn = this.btn(t('hint', { n: r.hints }), () => this.useHint(), 'small', { 'data-testid': 'hint' });
    if (r.hints <= 0) hintBtn.classList.add('disabled');
    const skipBtn = this.btn(t('skip', { n: B.skipCost(index) }), () => this.skip(), 'small danger', { 'data-testid': 'skip' });
    const adBtn = this.btn(t('adOxygen'), () => this.oxygenAd(), 'small ad', { 'data-testid': 'ad-oxygen' });
    adBtn.hidden = true;
    this.hud!.adBtn = adBtn;
    this.hud!.hintBtn = hintBtn;
    this.show(
      hud,
      h('section', { class: 'room', 'data-testid': 'room', 'data-type': plan.type, 'data-room': index },
        h('div', { class: 'room-head' },
          h('h2', {}, t(titleKey)),
          h('p', {}, r.dark ? t('dark') : t(helpKey))),
        stage,
        h('div', { class: 'room-actions' }, hintBtn, adBtn, skipBtn)),
    );
    this.view = view;
    this.phase = 'puzzle';
    this.last = performance.now();
    this.syncGameplay();
  }

  private useHint(): void {
    const r = this.run!;
    if (this.phase !== 'puzzle' || !this.view) return;
    if (r.hints <= 0) return this.toast(t('hint', { n: 0 }));
    if (this.view.hint()) {
      r.hints--;
      const b = this.hud?.hintBtn;
      if (b) {
        b.textContent = t('hint', { n: r.hints });
        if (r.hints <= 0) b.classList.add('disabled');
      }
    }
  }

  private async oxygenAd(): Promise<void> {
    const r = this.run!;
    if (r.oxygenAdUsed || this.pauses.has('ad-request')) return;
    this.pauses.add('ad-request');
    this.syncGameplay();
    const res = await ads.rewarded();
    this.pauses.delete('ad-request');
    this.last = performance.now();
    this.syncGameplay();
    if (!this.run || this.run !== r) return;
    if (res === 'failed') return this.toast(t('adFailed'));
    if (res === 'nosdk') this.toast(t('adNoSdk'));
    r.oxygenAdUsed = true;
    this.changeOxygen(B.secondsToOxygen(B.REWARD_AD_SECONDS, r.room, this.data.upgrades));
    this.flash('good');
    audio.success();
  }

  private skip(): void {
    const r = this.run!;
    if (this.phase !== 'puzzle') return;
    this.changeOxygen(-B.skipCost(r.room));
    this.flash('bad');
    audio.fail();
    if (r.oxygen <= 0) return this.end('lose');
    this.cleared(null);
  }

  solved(): void {
    if (this.phase !== 'puzzle' || !this.run) return;
    const r = this.run;
    const rew = B.solveReward(r.room, this.data.upgrades, r.roomTime);
    this.changeOxygen(rew.oxygen);
    r.parts += rew.parts;
    r.roomsCleared++;
    audio.success();
    this.flash('good');
    this.cleared(rew);
  }

  private cleared(rew: { oxygen: number; parts: number; fast: boolean } | null): void {
    const r = this.run!;
    r.dark = false;
    this.phase = 'cleared';
    this.syncGameplay();
    const last = r.room === B.ROOM_COUNT - 1;
    const next = r.plan.events[r.room] ?? null;
    const scanner = this.data.upgrades.scanner > 0 && !last
      ? h('p', { class: 'scanner' }, next ? t('scannerNext', { event: t(EVENT_NAME[next]) }) : t('scannerQuiet'))
      : null;
    this.show(
      this.hudEl(),
      h('section', { class: 'card cleared', 'data-testid': 'cleared' },
        h('h2', {}, rew ? t('cleared') : t('skipped')),
        rew ? h('p', { class: 'gain' }, t('gainOxygen', { n: rew.oxygen }), ' · ', t('gainParts', { n: rew.parts })) : null,
        rew?.fast ? h('p', { class: 'bonus' }, t('fastBonus')) : null,
        scanner,
        this.btn(last ? t('toPod') : t('nextRoom'), () => {
          if (last) return this.end('win');
          if (next) this.event(next);
          else this.enterRoom(r.room + 1);
        }, 'primary', { 'data-testid': 'next' })),
    );
  }

  private eventCard(type: EventType, text: string, choices: HTMLElement[]): void {
    this.phase = 'event';
    this.syncGameplay();
    this.show(
      this.hudEl(),
      h('section', { class: `card event ev-${type}`, 'data-testid': 'event', 'data-event': type },
        scene(type),
        h('h2', {}, t(EVENT_NAME[type])),
        h('p', {}, text),
        h('div', { class: 'choices' }, ...choices)),
    );
  }

  private outcome(type: EventType, text: string, good: boolean): void {
    const r = this.run!;
    this.flash(good ? 'good' : 'bad');
    if (r.oxygen <= 0) return this.end('lose');
    this.eventCard(type, text, [this.btn(t('continue'), () => this.enterRoom(r.room + 1), 'primary', { 'data-testid': 'continue' })]);
  }

  private event(type: EventType): void {
    const r = this.run!;
    const R = EVENT_RULES;
    const choice = (label: string, fn: () => void, enabled = true, testid = '') => {
      const b = this.btn(label, () => (enabled ? fn() : this.toast(t('notEnoughParts'))), enabled ? '' : 'disabled', { 'data-testid': testid });
      return b;
    };
    if (type === 'leak') {
      audio.hiss();
      this.shake();
      this.eventCard(type, t('evLeakText'), [
        choice(t('evLeakSeal', { n: R.leak.sealParts }), () => {
          r.parts -= R.leak.sealParts;
          this.outcome(type, t('evLeakSealed', { n: R.leak.sealParts }), false);
        }, r.parts >= R.leak.sealParts, 'choice-0'),
        choice(t('evLeakFix'), () => this.leakGame(), true, 'choice-1'),
      ]);
    } else if (type === 'meteor') {
      audio.boom();
      this.shake();
      this.eventCard(type, t('evMeteorText'), [
        choice(t('evMeteorCover', { n: R.meteor.coverOxygen }), () => {
          this.changeOxygen(-R.meteor.coverOxygen);
          this.outcome(type, t('evMeteorWaited', { n: R.meteor.coverOxygen }), false);
        }, true, 'choice-0'),
        choice(t('evMeteorDash', { n: R.meteor.dashRiskOxygen }), () => {
          const eff = meteorDash(r.eventRng.next());
          this.changeOxygen(eff.oxygen);
          r.parts += eff.parts;
          if (eff.oxygen < 0) {
            audio.boom();
            this.shake();
          }
          this.outcome(type, eff.oxygen < 0 ? t('evMeteorHit', { n: -eff.oxygen }) : t('evMeteorSafe'), eff.oxygen >= 0);
        }, true, 'choice-1'),
      ]);
    } else if (type === 'power') {
      this.eventCard(type, t('evPowerText'), [
        choice(t('evPowerBattery', { n: R.power.batteryParts }), () => {
          r.parts -= R.power.batteryParts;
          this.outcome(type, t('evPowerLit'), true);
        }, r.parts >= R.power.batteryParts, 'choice-0'),
        choice(t('evPowerDark', { n: R.power.darkBonusParts }), () => {
          r.parts += R.power.darkBonusParts;
          r.dark = true;
          this.outcome(type, t('evPowerGoDark'), true);
        }, true, 'choice-1'),
      ]);
    } else {
      audio.pop();
      this.eventCard(type, t('evLuckyText'), [
        choice(t('evLuckyTake', { o: R.lucky.oxygen, p: R.lucky.parts }), () => {
          this.changeOxygen(R.lucky.oxygen);
          r.parts += R.lucky.parts;
          audio.success();
          this.outcome(type, t('gainOxygen', { n: R.lucky.oxygen }), true);
        }, true, 'choice-0'),
      ]);
    }
  }

  private leakGame(): void {
    const R = EVENT_RULES.leak;
    const area = h('div', { class: 'leak-area', 'data-testid': 'leak-area' });
    const timer = h('p', { class: 'leak-timer' }, t('evLeakTap', { s: R.fixSeconds }));
    this.leak = {
      left: R.fixSeconds,
      remaining: R.fixTaps,
      timer,
      done: (ok) => {
        if (!this.leak) return;
        this.leak = null;
        if (ok) {
          audio.success();
          this.outcome('leak', t('evLeakOk'), true);
        } else {
          this.changeOxygen(-R.fixFailOxygen);
          audio.fail();
          this.shake();
          this.outcome('leak', t('evLeakFail', { n: R.fixFailOxygen }), false);
        }
      },
    };
    for (let i = 0; i < R.fixTaps; i++) {
      const b = h('button', {
        type: 'button',
        class: 'leak-spot',
        'aria-label': 'leak',
        style: `left:${10 + Math.random() * 70}%;top:${10 + Math.random() * 70}%`,
      });
      b.addEventListener('pointerdown', (e) => {
        e.preventDefault();
        if (b.classList.contains('fixed') || !this.leak) return;
        b.classList.add('fixed');
        audio.pop();
        if (--this.leak.remaining <= 0) this.leak.done(true);
      });
      b.addEventListener('keydown', (e) => {
        if (e.key === 'Enter' || e.key === ' ') b.dispatchEvent(new PointerEvent('pointerdown'));
      });
      area.append(b);
    }
    this.show(this.hudEl(), h('section', { class: 'card event ev-leak' }, h('h2', {}, t('evLeak')), timer, area));
    this.phase = 'leak';
    this.last = performance.now();
    this.syncGameplay();
  }

  private pauseMenu(): void {
    if (!this.run || this.pauses.has('menu')) return;
    this.pauses.add('menu');
    this.syncGameplay();
    const overlay = h('div', { class: 'overlay', 'data-testid': 'pause-menu' });
    const close = () => {
      overlay.remove();
      this.pauses.delete('menu');
      this.last = performance.now();
      this.syncGameplay();
    };
    overlay.append(
      h('div', { class: 'panel' },
        h('h2', {}, t('paused')),
        this.btn(t('resume'), close, 'primary'),
        h('div', { class: 'row center' }, this.muteButton()),
        this.btn(t('quitRun'), () => {
          this.end('quit');
          close();
        }, 'danger', { 'data-testid': 'quit' })),
    );
    this.root.append(overlay);
  }

  private end(kind: EndKind): void {
    const r = this.run;
    if (!r || this.phase === 'end') return;
    this.phase = 'end';
    this.syncGameplay();
    this.leak = null;
    this.root.classList.remove('low', 'critical');
    this.lowState = '';
    const escaped = kind === 'win';
    const earned = Math.max(0, r.parts);
    const prevBest = this.data.stats.bestRooms;
    this.data = recordRun(this.data, { roomsCleared: r.roomsCleared, escaped, seconds: r.time, parts: earned, dailyKey: r.dailyKey });
    this.persist();
    this.runsThisSession++;
    if (escaped) {
      ads.happytime();
      audio.success();
    } else if (kind === 'lose') {
      audio.fail();
      this.shake();
    }
    const record = r.roomsCleared > prevBest;
    const partsLine = h('p', { 'data-testid': 'parts-earned' }, t('partsEarned', { n: earned }));
    let doubled = false;
    let adBusy = false;
    const doubleBtn = earned > 0
      ? this.btn(t('adDouble'), async () => {
          if (doubled || adBusy) return;
          adBusy = true;
          const res = await ads.rewarded();
          adBusy = false;
          if (res === 'failed') return this.toast(t('adFailed'));
          if (res === 'nosdk') this.toast(t('adNoSdk'));
          doubled = true;
          this.data.parts += earned;
          this.persist();
          partsLine.textContent = `${t('partsEarned', { n: earned * 2 })} — ${t('doubled')}`;
          doubleBtn?.remove();
          audio.success();
        }, 'ad', { 'data-testid': 'ad-double' })
      : null;
    const title = kind === 'win' ? t('winTitle') : kind === 'lose' ? t('loseTitle') : t('quitTitle');
    this.hud = null;
    this.show(
      h('section', { class: `card end ${kind}`, 'data-testid': 'end', 'data-result': kind },
        scene(kind),
        h('h2', {}, title),
        kind !== 'quit' ? h('p', {}, kind === 'win' ? t('winText') : t('loseText')) : null,
        h('ul', { class: 'stats' },
          h('li', {}, t('roomsCleared', { n: r.roomsCleared })),
          h('li', {}, t('runTime', { t: fmtTime(r.time) }))),
        partsLine,
        record ? h('p', { class: 'bonus' }, t('newRecord')) : null,
        doubleBtn,
        this.btn(t('again'), () => this.startRun(!!r.dailyKey), 'primary', { 'data-testid': 'again' }),
        this.btn(t('menu'), () => this.menu(), '', { 'data-testid': 'menu' })),
    );
    this.run = null;
  }

  private onKey(e: KeyboardEvent): void {
    // Keep arrows/space from scrolling the host page (important inside an iframe).
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', ' '].includes(e.key) && e.target === document.body) e.preventDefault();
    if (e.key === 'Escape' && this.run && this.phase === 'puzzle') return this.pauseMenu();
    if (this.phase === 'puzzle' && this.pauses.size === 0) this.view?.onKey?.(e);
  }

  /** Debug hooks for automated tests (not in the CrazyGames build). */
  debug() {
    return {
      phase: () => this.phase,
      solve: () => this.view?.solveNow(),
      oxygen: () => this.run?.oxygen ?? 0,
      setOxygen: (v: number) => {
        if (this.run) this.run.oxygen = v;
      },
      darkNext: () => {
        if (this.run) this.run.dark = true;
      },
    };
  }
}
