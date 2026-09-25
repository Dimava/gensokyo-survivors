<script setup lang="ts">
// The credits roll: a Touhou-style staff roll over a starry dusk at the
// Hakurei Shrine. It fills whatever holds it (its own screen, or a Gallery
// tab), scrolls itself slowly upward, and takes its own input while mounted:
// holding Confirm or the pointer speeds it up, the wheel, a drag and the
// Up/Down arrows scroll by hand. Left/Right, Esc and everything else are left
// to the screen around it. At the end it rests on the closing card, then
// starts over (`loop`) or emits `end`. While mounted the title theme plays.
import { computed, onBeforeUnmount, onMounted, reactive, ref } from "vue";
import CreditsFigure from "./CreditsFigure.vue";
import LivePortrait from "./LivePortrait.vue";
import { state } from "../host.ts";
import { prefs } from "../prefs.ts";
import { keysFor } from "../keys.ts";
import { navTop } from "../keynav.ts";
import { TRACKS } from "../songs.ts";
import { ART } from "../../art/index.ts";
import { svgOf } from "../../art/drawing.ts";
import { DIMAVA_RATE, dimavaModel } from "../../art-l2d/dimava.ts";
import type { Rig } from "../../art-l2d/rig.ts";
import { ART_L2D } from "../../art-l2d/index.ts";
import { partImages, sharedRenderer } from "../../art-l2d/pixi-model.ts";
import { CLAWD_RATE, clawdExtra, clawdModel, clawdSvg, SUITS, type SuitId } from "../../art-l2d/clawd.ts";
import { CHARACTERS, GAME_SUBTITLE, GAME_TITLE, PLAYER_CHARACTER, type CharacterId } from "../../content/names.ts";
import { STAGES } from "../../content/stages.ts";
import { bossDef } from "../../content/bosses.ts";
import { ENEMIES, enemyIndex } from "../../content/enemies.ts";
import { CARDS } from "../../content/cards.ts";
import dimavaAvatar from "./credits/dimava.png";

const props = withDefaults(defineProps<{ loop?: boolean }>(), { loop: true });
const emit = defineEmits<{ end: [] }>();

const reduced = window.matchMedia?.("(prefers-reduced-motion: reduce)").matches ?? false;

// ---------------------------------------------------------------- the content

const cardsOf = (who: CharacterId) => CARDS.filter((c) => c.owner === who).map((c) => c.name);
const star = { id: PLAYER_CHARACTER, ...CHARACTERS[PLAYER_CHARACTER], cards: cardsOf(PLAYER_CHARACTER) };

/** A line for a midboss who is not a named character. */
const MID_TITLES: Record<string, string> = { duskfairy: "Grown fat on Rumia's darkness" };

/** Each stage's boss (with her spell cards) and midboss, in stage order. */
const stages = STAGES.map((s) => {
  const boss = bossDef(s.boss);
  const mid = s.script.find((b) => b.form === "midboss")?.enemy;
  const midDef = mid ? ENEMIES[enemyIndex(mid)] : undefined;
  return {
    id: s.id,
    place: s.name,
    boss: { id: boss.character, ...CHARACTERS[boss.character], spells: boss.spells.map((sp) => sp.name) },
    mid: midDef ? { id: midDef.id, name: midDef.name, title: (CHARACTERS as Record<string, { title: string }>)[midDef.id]?.title ?? MID_TITLES[midDef.id] ?? "Midboss" } : null,
  };
});

/** The characters who lend Reimu their spell cards. */
const lenders = (Object.keys(CHARACTERS) as CharacterId[])
  .filter((id) => id !== PLAYER_CHARACTER && !stages.some((s) => s.boss.id === id || s.mid?.id === id))
  .map((id) => ({ id, ...CHARACTERS[id], cards: cardsOf(id) }))
  .filter((c) => c.cards.length);

/** Every other enemy, with a line of its own (its codex blurb if it has none yet). */
const ROLES: Record<string, string> = {
  kedama: "As themselves. In great numbers.",
  fairy: "Flew in, fired, flew off. Every single time.",
  icefairy: "Cirno's rowdier friends, who insisted on a credit",
  phantom: "Circling, ominously",
  sunflower: "Held their post. Briefly.",
  yinyang: "No relation to the one at the shrine. Probably.",
  shade: "A scrap of the dark, playing itself",
  bigfairy: "The one with the purse",
};
const mobs = ENEMIES.filter((e) => !(e.id in CHARACTERS) && !stages.some((s) => s.mid?.id === e.id)).map((e) => ({ id: e.id, name: e.name, role: ROLES[e.id] ?? e.blurb, art: !!ART[e.id]?.sprite }));

/** Where it all began: the prompt, verbatim, typos and all (docs/ORIGIN.md, 2026-09-23 17:07 UTC). */
const PROMPT = [
  "And for the final test, consiter the Ultimate Hodgepodge (or whatever tahts iin english) Game",
  "A Vampire Surviwor game with Touhou bosses, Touhou figher style skill cards, gacha CCG style card pack drawing, nodebuster style upgrade tree, and five more games that fit well taht I forgot about. Maybe somehow metroidvania and VN and whatever else you come up with",
];
/** A stable pseudo-random 0..1 from a few integers (so the hand never changes between renders). */
function hash(...xs: number[]): number {
  let h = 2166136261;
  for (const x of xs) h = Math.imul(h ^ (x + 0x9e3779b9), 16777619) >>> 0;
  h = Math.imul(h ^ (h >>> 15), 2246822507) >>> 0;
  return (h ^ (h >>> 13)) / 2 ** 32;
}
/**
 * The prompt as words of letters, each letter a touch bigger or smaller, tilted,
 * off the line and spaced its own way, so it reads as neat print by hand.
 */
const promptWords = PROMPT.map((p, i) =>
  p.split(" ").map((w, j) =>
    [...w].map((c, k) => {
      const r = (n: number) => hash(i, j, k, n) - 0.5;
      return {
        c,
        style: {
          fontSize: `${(1 + r(1) * 0.14).toFixed(3)}em`,
          transform: `translateY(${(r(2) * 2.6).toFixed(1)}px) rotate(${(r(3) * 7).toFixed(1)}deg)`,
          marginRight: `${(r(4) * 1.6).toFixed(1)}px`,
        },
      };
    }),
  ),
);

/** Who wrote the code, the art and the music (the version is load-bearing). */
const CLAUDE = "Claude Opus 5.5";

/** The joke section: every job, one answer. */
const JOBS = [
  "Programming",
  "Pixel pushing",
  "Synth wrangling",
  "Danmaku choreography",
  "Menu carpentry",
  "Hitbox accounting",
  "Unit tests",
  "Headless screenshots",
  "Typing these credits",
];
/** What Dimava was doing: the calls that made the game. */
const CALLS = [
  "“Circle mode is UX, flash mode shows you grazed.”",
  "No grazing while invulnerable (so long, max-graze exploit)",
  "The brooch is the hitbox, and it glows when you graze",
  "Bosses take a share of your upgrades: you can't just overpower them",
  "Focus locks your facing",
  "The duplicate-shadow icons",
  "“Every menu gets a back button.”",
  "“Dying should be an anime moment.”",
  "“Dying should be an L2D animation too.”",
  "“Don't explain anything, just let it work.”",
  "“I don't really like Dawn A.”",
];

/** What the game borrowed its ideas from: the work, who made it, what it gave us. */
const INSPIRATIONS: [string, string, string][] = [
  ["Vampire Survivors", "poncle", "the run, the swarm, the weapons that fire on their own"],
  ["Touhou Project", "ZUN / Team Shanghai Alice", "the bosses, spell cards, danmaku and grazing"],
  ["Touhou Hisoutensoku · Scarlet Weather Rhapsody", "Tasofro and Team Shanghai Alice", "the skill cards drawn mid-fight"],
  ["NodeBuster", "", "the upgrade tree"],
  ["Gacha card games", "all of them, really", "the pack pulls, rarity and pity"],
  ["Live2D", "Live2D Inc.", "the look of the puppet rigs (ours are an original Live2D-style engine)"],
  ["Strudel · TidalCycles", "the live-coding music projects", "their mini-notation inspired our song notation (none of their code is used)"],
];

const BUILT_WITH: [string, string][] = [
  ["Vue", "the menus, the cards and this roll"],
  ["PixiJS", "the playfield and every rig"],
  ["TypeScript", "every line of it"],
  ["Vite", "the dev server that never sleeps"],
  ["Bun", "the tests and the scripts"],
  ["gamebones", "the deterministic kernel: every run is a replay"],
  ["Web Audio", "every note, every pichuun"],
  ["resvg-js", "the art previews"],
  ["oxlint", "the tidying up"],
  ["Playwright", "the headless recordings"],
];

// ---------------------------------------------------------------- Clawd and the crew

const AVATAR_ALT = "Dimava's avatar: Ononoki Yotsugi's googly-eyed orange hat from Monogatari, on her head, recoloured for New Year";

/** When the pointer last moved (ms): the avatar's googly eyes focus on it for a second, then wander off again. */
let pointerAt = -1e9;
let focus = 0;
const onPointer = (): void => void (pointerAt = performance.now());
function driveAvatar(rig: Rig, dt: number): void {
  const want = performance.now() - pointerAt < 1000 ? 1 : 0;
  focus += (want - focus) * (1 - Math.exp(-dt * (want ? 9 : 2.5)));
  rig.set("Focus", focus);
}

const suit = ref<SuitId>("clawd");
const suitDef = computed(() => SUITS.find((s) => s.id === suit.value)!);
const clawd = computed(() => clawdModel(suit.value));
function nextSuit(): void {
  if (dragged) return;
  const i = SUITS.findIndex((s) => s.id === suit.value);
  suit.value = SUITS[(i + 1) % SUITS.length]!.id;
}

const K = "#2a2438";
/** The crew: small Clawds with the tools of their trade, drawn in the same pixel grid. */
const CREW = [
  {
    role: "The composer",
    line: "wrote every song note by note, then listened to them as numbers",
    svg: clawdSvg(clawdExtra([".NNNNNN", ".N....N", ".N....N", ".N....N", "NN...NN", "NN...NN"], { N: "#ffe08a" }, 31, -9), { l: 2, t: 10, r: 4, b: 1 }),
  },
  {
    role: "The artist",
    line: "drew every face in Gensokyo out of SVG paths",
    svg: clawdSvg(
      clawdExtra(["......rr......", "...rrrrrrrr...", ".rrrrrrrrrrrr.", "rRRRRRRRRRRRRr"], { r: "#c0304a", R: "#8a1a30" }, 11, -4) +
        clawdExtra(["....c", "...c.", "..w..", ".w...", "w...."], { c: "#6fd3ff", w: "#b08850" }, 33, 3),
      { l: 2, t: 5, r: 4, b: 1 },
    ),
  },
  {
    role: "The recorder",
    line: "played the game in a headless browser and watched every frame",
    svg: clawdSvg(clawdExtra(["..KK......", "KKKKKKKKKR", "KgggKKOKKK", "KgggKOOOKK", "KgggKKOKKK", "KKKKKKKKKK"], { K, g: "#8a86a0", O: "#6fd3ff", R: "#ff4060" }, 29, 3), {
      l: 2,
      t: 2,
      r: 5,
      b: 1,
    }),
  },
  {
    role: "The UI builder",
    line: "built the menus, the card packs and this very roll",
    svg: clawdSvg(clawdExtra(["......YYYYYYYYYY......", "....YYYYYYYYYYYYYY....", "...YYYYYYyYYYYYYYYY...", "YYYYYYYYYYYYYYYYYYYYYY"], { Y: "#ffc94d", y: "#fff0b0" }, 7, -4), { l: 2, t: 5, r: 2, b: 1 }),
  },
  {
    role: "The coordinator",
    line: "kept everyone out of everyone else's files",
    svg: clawdSvg(clawdExtra([".ww.", "BBBB", "BWWB", "BW.B", "BWWB", "BBBB"], { w: "#c8cce0", B: "#8a5a2e", W: "#ffffff" }, 33, 5), { l: 2, t: 2, r: 4, b: 1 }),
  },
];

// ---------------------------------------------------------------- by the numbers

/** Every count exactly, with thousands separators: 632,747,282. */
const exact = (n: number): string => n.toLocaleString("en-US");
const num = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

// Generated by scripts/usage-stats.ts (on build) and git-ignored: on a fresh checkout it is absent and the block is skipped.
const usage: unknown = Object.values(import.meta.glob("../../content/usage-stats.json", { eager: true, import: "default" }))[0] ?? {};
/** How much Claude went into the game (src/content/usage-stats.json, written by scripts/usage-stats.ts): only the fields that are there. */
const numbers = (() => {
  const u = usage as { generatedAt?: unknown; claude?: Record<string, unknown>; git?: Record<string, unknown> };
  const c = u.claude ?? {};
  const g = u.git ?? {};
  const tokens = (c.tokens ?? {}) as Record<string, unknown>;
  const lines: string[] = [];
  const total = num(tokens.total);
  const out = num(tokens.output);
  if (total !== null) lines.push(`${exact(total)} tokens read and written${out !== null ? ` (${exact(out)} of them written)` : ""}`);
  const agents = num(c.agents);
  const calls = num(c.apiCalls);
  const who = [agents !== null && `${exact(agents)} Claude agents`, calls !== null && `${exact(calls)} API calls`].filter(Boolean);
  if (who.length) lines.push(who.join(", "));
  const commits = num(g.commits);
  const loc = num(g.lines);
  const active = num(c.activeSeconds);
  const work = [commits !== null && `${exact(commits)} commits`, loc !== null && `${exact(loc)} lines`].filter(Boolean).join(", ");
  if (work) lines.push(work);
  if (active !== null) lines.push(`${Math.floor(active / 3600)}h ${Math.floor((active % 3600) / 60)}m ${active % 60}s of active work`);
  return { lines, asOf: typeof u.generatedAt === "string" ? u.generatedAt : "" };
})();

// ---------------------------------------------------------------- the backdrop

/** Deterministic stars (a small LCG), so the sky is the same every time. */
const stars = (() => {
  let s = 20240917;
  const r = () => ((s = (s * 1664525 + 1013904223) >>> 0) / 2 ** 32);
  return Array.from({ length: 110 }, () => ({ x: r() * 1600, y: r() * 560, r: 0.6 + r() ** 3 * 2, d: r() * 5, o: 0.35 + r() * 0.65 }));
})();
const flies = Array.from({ length: 9 }, (_, i) => ({ x: 120 + ((i * 173) % 1360), y: 700 + ((i * 53) % 150), d: i * 0.9 }));
/** Stars and fireflies in groups, each group one layer with its own twinkle or drift. */
const starGroups = [0, 1, 2].map((g) => stars.filter((_, i) => i % 3 === g));
const flyGroups = [0, 1].map((g) => flies.filter((_, i) => i % 2 === g));

const reimuSweeping = ART[PLAYER_CHARACTER]?.sprite ? svgOf(ART[PLAYER_CHARACTER]!.sprite!, 2.6) : "";

// ---------------------------------------------------------------- scrolling

const root = ref<HTMLElement>();
const track = ref<HTMLElement>();
const sky = ref<HTMLElement>();
const clawdBox = ref<HTMLElement>();
const avatarBox = ref<HTMLElement>();
/** The live rigs are made when they first come near the view. */
const seen = reactive({ clawd: false, avatar: false });
const fading = ref(false);
const rollH = ref(720);

let pos = 0;
let wheel = 0;
let speed = 1;
let arrow = 0;
let holdKey = false;
let holdPtr = false;
let dragged = false;
let lastY = 0;
let downY = 0;
let endFor = 0;
let maxPos = 1;
let raf = 0;
let last = performance.now();

/** Screen heights per second at rest; holding multiplies it. */
const BASE = 0.058;
const FAST = 7;
const ARROW = 0.9;
/** Seconds the closing card rests before the roll starts over. */
const REST = 7;

function measure(): void {
  if (!root.value || !track.value) return;
  rollH.value = root.value.clientHeight || 720;
  maxPos = Math.max(1, track.value.scrollHeight - rollH.value);
}

function restart(): void {
  if (!props.loop) {
    emit("end");
    return;
  }
  fading.value = true;
  window.setTimeout(() => {
    pos = 0;
    wheel = 0;
    endFor = 0;
    fading.value = false;
  }, 900 * (1 / prefs.animSpeed));
}

function frame(now: number): void {
  raf = requestAnimationFrame(frame);
  const dt = Math.min(0.1, (now - last) / 1000);
  last = now;
  const h = rollH.value;
  const want = holdKey || holdPtr ? FAST : 1;
  speed += (want - speed) * (1 - Math.exp(-dt * 6));
  const take = wheel * (1 - Math.exp(-dt * 14));
  wheel -= take;
  if (!fading.value) pos += h * (BASE * (reduced ? 0.6 : 1) * prefs.animSpeed * speed + ARROW * arrow) * dt + take;
  pos = Math.max(0, Math.min(maxPos, pos));
  if (pos >= maxPos - 0.5 && !fading.value) {
    endFor += dt;
    if (endFor > REST / prefs.animSpeed) {
      endFor = -Infinity;
      restart();
    }
  } else if (pos < maxPos - 0.5) endFor = Math.max(0, endFor);
  if (track.value) track.value.style.transform = `translate3d(0, ${-pos.toFixed(2)}px, 0)`;
  if (sky.value) sky.value.style.transform = `translate3d(0, ${(-pos * 0.02).toFixed(2)}px, 0)`;
}

// Keys: only while the scope holding the roll is on top (no modal over it).
const CONFIRM = new Set(keysFor("Confirm"));
const DOWN = new Set(["ArrowDown", "KeyS"]);
const UP = new Set(["ArrowUp", "KeyW"]);
const mine = (): boolean => !!root.value && !!navTop()?.contains(root.value);
const pressed = new Set<string>();

function onKeyDown(e: KeyboardEvent): void {
  if (!mine() || e.ctrlKey || e.altKey || e.metaKey) return;
  if (CONFIRM.has(e.code)) {
    // A focused Clawd suit toggle takes the key; anywhere else it speeds the roll up.
    const a = document.activeElement;
    if (a instanceof HTMLElement && root.value!.contains(a) && a.matches("button")) return;
    holdKey = true;
  } else if (UP.has(e.code) || DOWN.has(e.code)) {
    pressed.add(e.code);
    arrow = [...pressed].some((c) => DOWN.has(c)) ? 1 : 0;
    arrow -= [...pressed].some((c) => UP.has(c)) ? 1 : 0;
  } else return;
  e.preventDefault();
  e.stopImmediatePropagation();
}
function onKeyUp(e: KeyboardEvent): void {
  if (CONFIRM.has(e.code)) holdKey = false;
  if (pressed.delete(e.code)) arrow = ([...pressed].some((c) => DOWN.has(c)) ? 1 : 0) - ([...pressed].some((c) => UP.has(c)) ? 1 : 0);
}
function onBlur(): void {
  holdKey = false;
  holdPtr = false;
  pressed.clear();
  arrow = 0;
}

function onWheel(e: WheelEvent): void {
  wheel += e.deltaY * (e.deltaMode === 1 ? 32 : e.deltaMode === 2 ? rollH.value : 1);
}
function onDown(e: PointerEvent): void {
  if (e.button !== 0 || (e.target as HTMLElement).closest("button")) return;
  // Space must speed the roll up now, not press a button the mouse passed over.
  (document.activeElement as HTMLElement | null)?.blur?.();
  root.value!.setPointerCapture(e.pointerId);
  holdPtr = true;
  dragged = false;
  lastY = downY = e.clientY;
}
function onMove(e: PointerEvent): void {
  if (!root.value?.hasPointerCapture(e.pointerId)) return;
  if (!dragged && Math.abs(e.clientY - downY) > 8) {
    dragged = true;
    holdPtr = false;
  }
  if (dragged) pos -= (e.clientY - lastY) / (root.value.getBoundingClientRect().height / root.value.clientHeight || 1);
  lastY = e.clientY;
}
function onUp(e: PointerEvent): void {
  if (root.value?.hasPointerCapture(e.pointerId)) root.value.releasePointerCapture(e.pointerId);
  holdPtr = false;
  // The click after a drag is not a click on Clawd.
  window.setTimeout(() => (dragged = false));
}

/** Focus moved by keys scrolls the roll itself (scrollIntoView): take that into the roll's own position. */
function onScroll(): void {
  const el = root.value!;
  if (!el.scrollTop) return;
  pos += el.scrollTop;
  el.scrollTop = 0;
}

let ro: ResizeObserver | null = null;
let idle = 0;
let io: IntersectionObserver | null = null;
onMounted(() => {
  state.rolling++;
  window.addEventListener("keydown", onKeyDown, { capture: true });
  window.addEventListener("keyup", onKeyUp, { capture: true });
  window.addEventListener("blur", onBlur);
  ro = new ResizeObserver(measure);
  ro.observe(root.value!);
  ro.observe(track.value!);
  measure();
  io = new IntersectionObserver(
    (es) => {
      // Once near the view they stay mounted (a live rig idles off screen by itself): built and uploaded once.
      for (const x of es) if (x.isIntersecting) seen[x.target === avatarBox.value ? "avatar" : "clawd"] = true;
    },
    { root: root.value, rootMargin: "500px 0px" },
  );
  io.observe(clawdBox.value!);
  io.observe(avatarBox.value!);
  window.addEventListener("pointermove", onPointer);
  // Decode the rigs' part images while nothing else is happening, so they appear without a hitch.
  idle = requestIdleCallback(() => {
    void sharedRenderer();
    for (const m of [dimavaModel, clawdModel(), ...[star.id, ...stages.map((s) => s.boss.id)].map((id) => ART_L2D[id]?.portrait)]) if (m) void partImages(m);
  });
  last = performance.now();
  raf = requestAnimationFrame(frame);
});
onBeforeUnmount(() => {
  state.rolling--;
  window.removeEventListener("keydown", onKeyDown, { capture: true });
  window.removeEventListener("keyup", onKeyUp, { capture: true });
  window.removeEventListener("blur", onBlur);
  window.removeEventListener("pointermove", onPointer);
  cancelIdleCallback(idle);
  cancelAnimationFrame(raf);
  ro?.disconnect();
  io?.disconnect();
});
</script>

<template>
  <div
    ref="root"
    class="credits-roll"
    :class="{ still: reduced, fading }"
    :style="{ '--rollh': `${rollH}px` }"
    @wheel.prevent="onWheel"
    @pointerdown="onDown"
    @pointermove="onMove"
    @pointerup="onUp"
    @pointercancel="onUp"
    @scroll="onScroll"
  >
    <!-- The sky in layers the compositor moves: stars twinkle by group and drift a little with the roll; nothing repaints per frame. -->
    <div class="sky" aria-hidden="true">
      <svg class="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <defs>
          <linearGradient id="cr-sky" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0" stop-color="#060918" />
            <stop offset="0.42" stop-color="#121838" />
            <stop offset="0.66" stop-color="#2c2450" />
            <stop offset="0.8" stop-color="#6a3c5e" />
            <stop offset="0.9" stop-color="#c46a5a" />
            <stop offset="1" stop-color="#f0a068" />
          </linearGradient>
        </defs>
        <rect width="1600" height="900" fill="url(#cr-sky)" />
      </svg>
      <div ref="sky" class="drift">
        <svg v-for="g in 3" :key="g" class="layer twinkle" :class="`t${g}`" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
          <circle v-for="(st, i) in starGroups[g - 1]" :key="i" :cx="st.x" :cy="st.y" :r="st.r" :opacity="st.o" fill="#fff6e0" />
        </svg>
        <svg class="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
          <defs>
            <radialGradient id="cr-glow" cx="0.5" cy="0.5" r="0.5">
              <stop offset="0" stop-color="#ffd890" stop-opacity="0.9" />
              <stop offset="1" stop-color="#ffd890" stop-opacity="0" />
            </radialGradient>
            <mask id="cr-moon">
              <circle cx="1270" cy="150" r="36" fill="#fff" />
              <circle cx="1286" cy="140" r="32" fill="#000" />
            </mask>
          </defs>
          <circle cx="1270" cy="150" r="36" fill="#fff2c8" mask="url(#cr-moon)" />
          <circle cx="1270" cy="150" r="70" fill="url(#cr-glow)" opacity="0.18" />
        </svg>
      </div>
      <!-- Far hills, the shrine forest, the torii, the shrine hall and its steps. -->
      <svg class="layer" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <path d="M0 700 C180 640 320 660 470 620 C620 585 760 640 900 610 C1060 575 1220 630 1380 600 C1480 585 1560 600 1600 610 L1600 900 L0 900 Z" fill="#241c3c" />
        <path
          d="M0 760 C60 700 90 720 120 690 C150 720 190 680 230 700 C280 660 330 700 380 690 L420 760 Z M1000 760 C1040 690 1090 700 1130 670 C1180 690 1240 660 1290 690 C1350 670 1420 700 1480 690 C1540 700 1580 690 1600 700 L1600 760 Z"
          fill="#171228"
        />
        <g fill="#3a1624">
          <path d="M150 560 Q262 548 374 560 L384 543 Q262 528 140 543 Z" />
          <rect x="168" y="560" width="188" height="11" />
          <rect x="176" y="600" width="172" height="10" />
          <rect x="257" y="571" width="10" height="29" />
          <rect x="190" y="560" width="15" height="200" />
          <rect x="319" y="560" width="15" height="200" />
        </g>
        <g fill="#120e20">
          <path d="M1010 650 Q1090 640 1160 580 Q1230 640 1310 650 L1296 662 L1024 662 Z" />
          <rect x="1052" y="662" width="216" height="98" />
          <rect x="1140" y="690" width="40" height="50" fill="#ffb46a" opacity="0.35" />
          <rect x="1080" y="690" width="30" height="36" fill="#ffb46a" opacity="0.22" />
          <rect x="1210" y="690" width="30" height="36" fill="#ffb46a" opacity="0.22" />
        </g>
        <path d="M0 760 L1600 760 L1600 900 L0 900 Z" fill="#0d0a18" />
        <path d="M690 760 L910 760 L930 800 L670 800 Z M660 810 L940 810 L962 850 L638 850 Z M628 860 L972 860 L996 900 L604 900 Z" fill="#1c1630" />
      </svg>
      <svg v-for="g in 2" :key="g" class="layer flies" :class="`f${g}`" viewBox="0 0 1600 900" preserveAspectRatio="xMidYMax slice">
        <circle v-for="(fl, i) in flyGroups[g - 1]" :key="i" :cx="fl.x" :cy="fl.y" r="3" fill="#ffe7a0" />
      </svg>
    </div>
    <div class="veil"></div>

    <div ref="track" class="track">
      <!-- Title card: fills the view when the roll starts. -->
      <section class="card">
        <svg class="yy" viewBox="-1 -1 2 2" aria-hidden="true">
          <circle r="1" fill="#fff" />
          <path d="M0-1A1 1 0 0 1 0 1A.5.5 0 0 1 0 0A.5.5 0 0 0 0-1Z" fill="#e0314b" />
          <circle cy="-.5" r=".15" fill="#e0314b" />
          <circle cy=".5" r=".15" fill="#fff" />
        </svg>
        <h1 class="title">{{ GAME_TITLE }}</h1>
        <p class="subtitle">{{ GAME_SUBTITLE }}</p>
      </section>

      <section class="sec">
        <figure class="note" role="img" :aria-label="`The original prompt, 2026-09-23: ${PROMPT.join(' ')} (Dimava)`">
          <div class="paper">
            <span class="tape" aria-hidden="true"></span>
            <p v-for="(ws, i) in promptWords" :key="i" class="hand" aria-hidden="true">
              <span v-for="(w, j) in ws" :key="j" class="word"><span v-for="(x, k) in w" :key="k" :style="x.style">{{ x.c }}</span></span>
            </p>
            <p class="hand sign" aria-hidden="true">— Dimava <img class="sig" :src="dimavaAvatar" alt="" width="30" height="30" /></p>
            <svg class="doodle" viewBox="-12 -12 24 24" aria-hidden="true">
              <circle r="10" fill="none" stroke="currentColor" stroke-width="1.4" />
              <path d="M0-10A10 10 0 0 1 0 10A5 5 0 0 1 0 0A5 5 0 0 0 0-10Z" fill="currentColor" opacity="0.8" />
              <circle cy="-5" r="1.6" fill="#f6efdf" />
              <circle cy="5" r="1.6" fill="currentColor" />
            </svg>
            <svg class="doodle star" viewBox="-10 -10 20 20" aria-hidden="true">
              <path d="M0-9L2.4-2.6L9-2.6L3.8 1.6L5.8 8.4L0 4.4L-5.8 8.4L-3.8 1.6L-9-2.6L-2.4-2.6Z" fill="none" stroke="currentColor" stroke-width="1.3" stroke-linejoin="round" />
            </svg>
          </div>
          <figcaption>The original prompt, 2026-09-23</figcaption>
        </figure>
      </section>

      <section class="sec">
        <div class="role">A game by</div>
        <div class="director">
          <div class="avatar-wrap">
            <div ref="avatarBox" class="avatar">
              <img :src="dimavaAvatar" :alt="AVATAR_ALT" width="96" height="96" />
              <LivePortrait v-if="seen.avatar && !reduced" class="avatar-live" :model="dimavaModel" :width="96" :height="96" :rate="DIMAVA_RATE" :fps="30" follow :drive="driveAvatar" />
            </div>
            <div class="hat">(the hat)</div>
          </div>
          <div class="name huge">Dimava</div>
        </div>
        <div class="jobs">Director · Game Design · Art Direction · Music Direction · Quality Assurance · Producer</div>
        <p class="line">Decided what the game is, and judged every single iteration.</p>
      </section>

      <section class="sec">
        <div class="role">Code, art, music and sound</div>
        <div class="name big">{{ CLAUDE }}</div>
        <p class="line">by Anthropic, working in Claude Code</p>
        <div ref="clawdBox" class="clawd" @click="nextSuit">
          <LivePortrait v-if="seen.clawd" :key="suit" :model="clawd" :width="360" :height="288" :rate="reduced ? 0 : CLAWD_RATE" :fps="30" follow />
        </div>
        <p class="caption">
          Clawd, Claude Code's mascot<template v-if="suitDef.as">, {{ suitDef.as }}</template>
        </p>
        <div class="suits">
          <button v-for="s in SUITS" :key="s.id" class="btn small suit" :class="{ on: suit === s.id }" @click="suit = s.id">{{ s.label }}</button>
        </div>
        <div v-if="numbers.lines.length" class="numbers">
          <div class="role mini">By the numbers</div>
          <div v-for="l in numbers.lines" :key="l" class="num-line">{{ l }}</div>
          <div v-if="numbers.asOf" class="as-of">As of {{ numbers.asOf }}</div>
        </div>
        <p class="line crew-intro">…or rather, a small crew of Claudes, working side by side in one folder and politely not editing each other's files:</p>
        <div class="crew">
          <div v-for="(c, i) in CREW" :key="c.role" class="mate">
            <div class="px" :style="{ animationDelay: `calc(${-i * 0.37}s * var(--anim))` }" v-html="c.svg"></div>
            <div class="mate-role">{{ c.role }}</div>
            <div class="mate-line">{{ c.line }}</div>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="role rigs">Live2D-style puppet rigs</div>
        <div class="name">An original mesh-deformer engine, drawn and rigged in code</div>
        <p class="line">
          Layered mesh parts on warp and rotation deformers, springy hair and ribbons, blinking, breathing, looking your way, and the anime death sequence. Every character and enemy
          is one: Reimu, Cirno, Rumia, Daiyousei, the fairies, even the kedama. So is Clawd.
        </p>
      </section>

      <section class="sec">
        <div class="role">Staff</div>
        <div class="dots">
          <div v-for="j in JOBS" :key="j" class="dot-row">
            <span>{{ j }}</span><i></i><b>{{ CLAUDE }}</b>
          </div>
        </div>
      </section>

      <section class="sec">
        <p class="aside">…and what was Dimava even doing here again?</p>
        <p class="line">Only this:</p>
        <ul class="calls">
          <li v-for="c in CALLS" :key="c">{{ c }}</li>
        </ul>
        <p class="line strong">{{ CLAUDE }} typed the lines. Dimava made the game.</p>
      </section>

      <section class="sec">
        <div class="role">Starring</div>
        <div class="bill">
          <CreditsFigure :art="star.id" kind="portrait" :zoom="0.82" />
          <div class="who">
            <div class="name big" :style="{ color: '#ff8a9c' }">{{ star.name }}</div>
            <div class="title-line">{{ star.title }}</div>
            <p class="line">She only wanted a quiet day and a full donation box.</p>
            <div class="spells">
              <span v-for="c in star.cards" :key="c">{{ c }}</span>
            </div>
          </div>
        </div>
      </section>

      <section v-for="(s, i) in stages" :key="s.id" class="sec">
        <div class="role">Stage {{ i + 1 }} · {{ s.place }}</div>
        <div class="bill" :class="{ flip: i % 2 === 0 }">
          <CreditsFigure :art="s.boss.id" kind="portrait" :zoom="0.82" :flip="i % 2 === 0" />
          <div class="who">
            <div class="name big">{{ s.boss.name }}</div>
            <div class="title-line">{{ s.boss.title }}</div>
            <div class="spells">
              <span v-for="sp in s.boss.spells" :key="sp">{{ sp }}</span>
            </div>
          </div>
        </div>
        <div v-if="s.mid" class="bill small" :class="{ flip: i % 2 === 1 }">
          <CreditsFigure v-if="ART[s.mid.id]?.sprite" :art="s.mid.id" :zoom="1.4" :delay="0.4" />
          <div class="who">
            <div class="role mini">Midboss</div>
            <div class="name">{{ s.mid.name }}</div>
            <div class="title-line">{{ s.mid.title }}</div>
          </div>
        </div>
      </section>

      <section v-if="lenders.length" class="sec">
        <div class="role">Lending their spell cards</div>
        <div class="lenders">
          <div v-for="c in lenders" :key="c.id" class="lender">
            <div class="name" :style="{ color: `#${c.color.toString(16).padStart(6, '0')}` }">{{ c.name }}</div>
            <div class="title-line">{{ c.title }}</div>
            <div class="spells">
              <span v-for="n in c.cards" :key="n">{{ n }}</span>
            </div>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="role">Fairies, fuzzballs and phantoms</div>
        <div class="mobs">
          <div v-for="(m, i) in mobs" :key="m.id" class="mob">
            <CreditsFigure v-if="m.art" :art="m.id" :zoom="1.6" :delay="i * 0.23" />
            <div class="name small">{{ m.name }}</div>
            <div class="mob-role">{{ m.role }}</div>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="role">Music</div>
        <p class="line">Every track an original composition, synthesized live in your browser.</p>
        <div class="tracks">
          <div v-for="(t, i) in TRACKS" :key="t.id" class="trk">
            <span class="no">{{ String(i + 1).padStart(2, "0") }}</span>
            <div>
              <div class="trk-title">{{ t.title }}</div>
              <div class="trk-sub">{{ t.where }} · {{ t.credit }}</div>
            </div>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="role">Inspirations</div>
        <p class="line">It began as the “Ultimate Hodgepodge”: the final stress test for the gamebones kernel. Then it became a game.</p>
        <div class="inspo">
          <div v-for="[work, by, gave] in INSPIRATIONS" :key="work" class="insp">
            <div class="insp-work">{{ work }}<span v-if="by" class="insp-by"> · {{ by }}</span></div>
            <div class="insp-gave">{{ gave }}</div>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="role">Touhou Project</div>
        <div class="jobs">Original characters and world</div>
        <div class="name big">ZUN / Team Shanghai Alice</div>
        <p class="line">Thank you for Gensokyo.</p>
        <p class="notice">{{ GAME_TITLE }} is an unofficial fan work of the Touhou Project. It is not affiliated with Team Shanghai Alice.</p>
        <p class="notice small">Live2D is a trademark of Live2D Inc.; this game does not use Live2D Cubism.</p>
      </section>

      <section class="sec">
        <div class="role">Built with</div>
        <div class="dots">
          <div v-for="[n, what] in BUILT_WITH" :key="n" class="dot-row">
            <b>{{ n }}</b><i></i><span>{{ what }}</span>
          </div>
        </div>
      </section>

      <section class="sec">
        <div class="role">Playtesting</div>
        <div class="name">The bot <code>?bot=1</code></div>
        <p class="line">has cleared Misty Lake more times than anyone, and never once asked for a continue</p>
        <div class="name you">and you, the player</div>
      </section>

      <!-- Closing card: the roll rests here. -->
      <section class="card end">
        <svg class="yy big" viewBox="-1 -1 2 2" aria-hidden="true">
          <circle r="1" fill="#fff" />
          <path d="M0-1A1 1 0 0 1 0 1A.5.5 0 0 1 0 0A.5.5 0 0 0 0-1Z" fill="#e0314b" />
          <circle cy="-.5" r=".15" fill="#e0314b" />
          <circle cy=".5" r=".15" fill="#fff" />
        </svg>
        <h2 class="thanks">Thank you for playing!</h2>
        <p class="subtitle">{{ GAME_TITLE }}</p>
        <div class="sweep" aria-hidden="true">
          <span v-for="n in 4" :key="n" class="leaf" :style="{ animationDelay: `calc(${n * 0.55}s * var(--anim))` }"></span>
          <svg class="broom" viewBox="0 0 40 110">
            <rect x="18" y="0" width="4" height="78" rx="2" fill="#9a6a3a" />
            <rect x="15" y="74" width="10" height="6" fill="#c0303a" />
            <path d="M14 80 L26 80 L36 108 L4 108 Z" fill="#d8b060" />
            <path d="M12 90 L28 90 M10 98 L30 98" stroke="#b08838" stroke-width="2" />
          </svg>
          <div class="sweeper" v-html="reimuSweeping"></div>
        </div>
      </section>
    </div>
  </div>
</template>

<style scoped>
.credits-roll {
  position: relative;
  width: 100%;
  height: 100%;
  overflow: hidden;
  user-select: none;
  touch-action: none;
  background: #060918;
  cursor: default;
}
.sky,
.layer,
.drift {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
}
.drift {
  will-change: transform;
}
.twinkle {
  animation: twinkle calc(3.2s * var(--anim)) ease-in-out infinite alternate;
}
.t2 {
  animation-duration: calc(4.1s * var(--anim));
  animation-delay: calc(-1.3s * var(--anim));
}
.t3 {
  animation-duration: calc(2.7s * var(--anim));
  animation-delay: calc(-2.2s * var(--anim));
}
.flies {
  animation: drift calc(6s * var(--anim)) ease-in-out infinite alternate;
}
.f2 {
  animation-duration: calc(7.4s * var(--anim));
  animation-delay: calc(-3s * var(--anim));
  animation-direction: alternate-reverse;
}
.still .twinkle,
.still .flies,
.still .yy,
.still .px,
.still .broom,
.still .leaf {
  animation: none;
}
/* A soft dark column behind the text, so it reads over the sky. */
.veil {
  position: absolute;
  inset: 0;
  background: radial-gradient(ellipse 46% 80% at 50% 45%, rgba(6, 8, 22, 0.55), rgba(6, 8, 22, 0) 100%);
  pointer-events: none;
}
.track {
  position: absolute;
  top: 0;
  left: 0;
  right: 0;
  will-change: transform;
  transition: opacity calc(0.9s * var(--anim)) ease;
  text-align: center;
  text-shadow: 0 2px 10px rgba(0, 0, 0, 0.75);
}
.fading .track {
  opacity: 0;
}
.card {
  min-height: var(--rollh);
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: center;
  box-sizing: border-box;
  padding: 20px;
}
.sec {
  width: min(860px, 92%);
  margin: 0 auto 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.yy {
  width: 72px;
  height: 72px;
  border-radius: 50%;
  margin-bottom: 18px;
  box-shadow: 0 0 36px rgba(224, 49, 75, 0.55);
  animation: spin calc(8s * var(--anim)) linear infinite;
}
.yy.big {
  width: 110px;
  height: 110px;
}
.title {
  margin: 0;
  font-size: clamp(2.6rem, 6vw, 4.4rem);
  letter-spacing: 0.06em;
  text-shadow:
    0 0 24px rgba(224, 49, 75, 0.7),
    0 4px 0 #6a0f1f;
}
.subtitle {
  margin: 10px 0 0;
  color: #d8def5;
  font-size: 1.1rem;
  letter-spacing: 0.1em;
}
.role {
  color: var(--gold);
  font-size: 0.85rem;
  font-weight: 700;
  letter-spacing: 0.28em;
  text-transform: uppercase;
  margin-bottom: 10px;
}
.role.mini {
  font-size: 0.7rem;
  margin-bottom: 2px;
}
.name {
  font-size: 1.5rem;
  font-weight: 700;
  letter-spacing: 0.03em;
}
.name.big {
  font-size: 2.3rem;
}
/* The original prompt, on a scrap of lined washi taped up at the shrine. */
.note {
  margin: 0;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.paper {
  position: relative;
  width: min(600px, 100%);
  box-sizing: border-box;
  padding: 34px 40px 30px 58px;
  text-align: left;
  text-shadow: none;
  color: #243a78;
  background:
    linear-gradient(90deg, transparent 42px, rgba(224, 49, 75, 0.35) 42px 44px, transparent 44px),
    repeating-linear-gradient(180deg, transparent 0 31px, rgba(80, 110, 170, 0.28) 31px 32px),
    radial-gradient(ellipse at 30% 20%, #fbf6ea, #efe5cf 90%);
  background-position: 0 0, 0 22px, 0 0;
  transform: rotate(-1.8deg);
  filter: drop-shadow(0 10px 18px rgba(0, 0, 0, 0.55));
  /* A torn bottom edge. */
  clip-path: polygon(0 0, 100% 0, 100% 97%, 96% 99%, 91% 97.5%, 86% 99.5%, 80% 97.8%, 74% 99.3%, 67% 97.6%, 60% 99.6%, 53% 97.9%, 46% 99.4%, 39% 97.5%, 32% 99.5%, 25% 97.8%, 18% 99.2%, 11% 97.6%, 5% 99.4%, 0 97.8%);
}
.tape {
  position: absolute;
  top: -2px;
  left: 50%;
  width: 110px;
  height: 26px;
  transform: translateX(-50%) rotate(2.5deg);
  background: rgba(255, 238, 170, 0.55);
  border-left: 2px dashed rgba(255, 255, 255, 0.4);
  border-right: 2px dashed rgba(255, 255, 255, 0.4);
}
.hand {
  margin: 0 0 6px;
  /* Print letters, not script: Dimava writes in print. */
  font-family: "Segoe Print", "Patrick Hand", "Architects Daughter", "Comic Neue", "Chalkboard SE", "Marker Felt", "Segoe UI", system-ui, sans-serif;
  font-size: 1.05rem;
  line-height: 32px;
}
.hand .word {
  display: inline-block;
  white-space: nowrap;
  margin-right: 0.32em;
}
.hand .word span {
  display: inline-block;
}
.hand.sign {
  text-align: right;
  margin: 4px 10px 0 0;
  transform: rotate(-3deg);
}
.doodle {
  position: absolute;
  left: 12px;
  top: 40px;
  width: 22px;
  height: 22px;
  color: #b0283e;
  transform: rotate(-12deg);
}
.doodle.star {
  top: auto;
  bottom: 34px;
  left: 14px;
  width: 18px;
  height: 18px;
  color: #d09a20;
}
.note figcaption {
  margin-top: 14px;
  color: var(--muted);
  font-size: 0.85rem;
  letter-spacing: 0.08em;
}
.director {
  display: flex;
  align-items: center;
  gap: 18px;
}
.avatar-wrap {
  display: flex;
  flex-direction: column;
  align-items: center;
}
/* A New Year frame: a gold ring in a red one. */
.avatar {
  position: relative;
  width: 96px;
  height: 96px;
  border-radius: 50%;
  overflow: hidden;
  border: 3px solid var(--gold);
  box-shadow:
    0 0 0 3px #c0203a,
    0 0 24px rgba(255, 201, 77, 0.45);
}
.avatar img,
.avatar-live {
  position: absolute;
  inset: 0;
  width: 100%;
  height: 100%;
  image-rendering: auto;
}
.hat {
  margin-top: 6px;
  font-size: 0.8rem;
  color: var(--muted);
  font-style: italic;
}
.sig {
  width: 30px;
  height: 30px;
  border-radius: 50%;
  vertical-align: middle;
  margin-left: 6px;
  border: 1.5px solid #b0283e;
  transform: rotate(4deg);
}
.name.huge {
  font-size: 3.2rem;
  letter-spacing: 0.06em;
  text-shadow:
    0 0 26px rgba(255, 201, 77, 0.45),
    0 3px 0 #5a3a0a;
}
.name.small {
  font-size: 1.1rem;
}
.jobs {
  color: var(--cyan);
  font-size: 0.95rem;
  letter-spacing: 0.08em;
  margin-top: 6px;
}
.line {
  margin: 8px 0 0;
  color: #d8def5;
  max-width: 620px;
  line-height: 1.5;
}
.line.strong {
  margin-top: 26px;
  font-size: 1.25rem;
  font-weight: 700;
  color: #fff;
}
.aside {
  margin: 0;
  font-size: 1.35rem;
  font-style: italic;
  color: #ffd6de;
}
.caption {
  margin: 2px 0 10px;
  color: var(--muted);
  font-size: 0.9rem;
  min-height: 1.3em;
}
.title-line {
  color: var(--cyan);
  font-size: 1.05rem;
  margin-top: 2px;
}
code {
  font-size: 0.8em;
  color: var(--muted);
  margin-left: 6px;
}

/* Clawd and the crew. */
.clawd {
  width: 360px;
  height: 288px;
  margin-top: 6px;
  cursor: pointer;
  filter: drop-shadow(0 8px 16px rgba(0, 0, 0, 0.5));
}
.suits {
  display: flex;
  flex-wrap: wrap;
  justify-content: center;
  gap: 6px;
  max-width: 620px;
  text-shadow: none;
}
.suit.on {
  border-color: #ffb08a;
  background: rgba(215, 119, 87, 0.45);
  color: #fff;
}
.numbers {
  margin-top: 30px;
  padding: 12px 22px;
  border: 1px dashed rgba(255, 176, 138, 0.45);
  border-radius: 12px;
  background: rgba(215, 119, 87, 0.08);
}
.num-line {
  color: #ffd8c8;
  font-size: 1.02rem;
  line-height: 1.6;
}
.as-of {
  margin-top: 4px;
  font-size: 0.75rem;
  color: var(--muted);
}
.inspo {
  margin-top: 18px;
  display: flex;
  flex-direction: column;
  gap: 12px;
}
.insp-work {
  font-weight: 700;
  font-size: 1.1rem;
}
.insp-by {
  font-weight: 400;
  color: var(--cyan);
  font-size: 0.95rem;
}
.insp-gave {
  color: var(--muted);
  font-size: 0.92rem;
}
.notice.small {
  margin-top: 6px;
  font-size: 0.75rem;
}
.crew-intro {
  margin-top: 40px;
}
.crew {
  display: flex;
  justify-content: center;
  gap: 18px;
  margin-top: 22px;
  flex-wrap: wrap;
}
.mate {
  width: 150px;
  display: flex;
  flex-direction: column;
  align-items: center;
}
.px {
  height: 70px;
  display: flex;
  align-items: flex-end;
  animation: hop calc(0.9s * var(--anim)) steps(2, jump-none) infinite alternate;
}
.px :deep(svg) {
  display: block;
  height: 100%;
  width: auto;
  filter: drop-shadow(0 4px 6px rgba(0, 0, 0, 0.5));
}
.mate-role {
  margin-top: 8px;
  font-weight: 700;
  color: #ffb08a;
}
.mate-line {
  font-size: 0.82rem;
  color: var(--muted);
  line-height: 1.35;
  margin-top: 2px;
}

/* Dotted leaders: job ........ Claude. */
.dots {
  width: min(560px, 100%);
  display: flex;
  flex-direction: column;
  gap: 8px;
  font-size: 1.1rem;
}
.dot-row {
  display: flex;
  align-items: baseline;
  gap: 10px;
}
.dot-row i {
  flex: 1;
  border-bottom: 2px dotted rgba(200, 210, 255, 0.35);
  transform: translateY(-4px);
}
.dot-row span {
  color: #d8def5;
}
.dot-row b {
  color: #ffb08a;
}
.calls {
  list-style: none;
  padding: 0;
  margin: 16px 0 0;
  display: flex;
  flex-direction: column;
  gap: 9px;
  font-size: 1.08rem;
}
.calls li::before {
  content: "✦ ";
  color: var(--gold);
}

/* A character beside her lines. */
.bill {
  display: flex;
  align-items: center;
  gap: 34px;
  text-align: left;
}
.bill.flip {
  flex-direction: row-reverse;
  text-align: right;
}
.bill.small {
  margin-top: 26px;
  gap: 22px;
}
.who {
  display: flex;
  flex-direction: column;
  min-width: 280px;
}
.spells {
  display: flex;
  flex-direction: column;
  gap: 4px;
  margin-top: 12px;
  color: #ffd6de;
  font-size: 0.95rem;
}
.lenders {
  display: flex;
  justify-content: center;
  gap: 40px;
  flex-wrap: wrap;
}
.lender .spells {
  align-items: center;
}
.mobs {
  display: grid;
  grid-template-columns: repeat(4, 1fr);
  gap: 30px 20px;
  width: 100%;
  align-items: end;
}
.mob {
  display: flex;
  flex-direction: column;
  align-items: center;
  justify-content: flex-end;
}
.mob .name {
  margin-top: 8px;
}
.mob-role {
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.35;
  margin-top: 2px;
}

/* The soundtrack. */
.tracks {
  margin-top: 16px;
  display: flex;
  flex-direction: column;
  gap: 10px;
  text-align: left;
  width: min(600px, 100%);
}
.trk {
  display: flex;
  gap: 14px;
  align-items: baseline;
}
.no {
  color: var(--gold);
  font-weight: 700;
  font-variant-numeric: tabular-nums;
}
.trk-title {
  font-weight: 700;
  font-size: 1.08rem;
}
.trk-sub {
  color: var(--muted);
  font-size: 0.85rem;
}
.notice {
  margin: 18px 0 0;
  max-width: 560px;
  font-size: 0.85rem;
  color: var(--muted);
  line-height: 1.5;
}
.you {
  margin-top: 28px;
  font-size: 1.9rem;
  color: #ff8a9c;
}

/* The end: thanks, and Reimu sweeping the shrine steps. */
.thanks {
  margin: 0;
  font-size: clamp(2rem, 4.4vw, 3.2rem);
  letter-spacing: 0.04em;
  text-shadow:
    0 0 22px rgba(224, 49, 75, 0.6),
    0 3px 0 #6a0f1f;
}
.sweep {
  position: relative;
  margin-top: 40px;
  width: 280px;
  height: 150px;
}
.sweeper {
  position: absolute;
  right: 40px;
  bottom: 0;
  animation: sway calc(1.4s * var(--anim)) ease-in-out infinite alternate;
  transform-origin: 50% 100%;
}
.sweeper :deep(svg) {
  display: block;
}
.broom {
  position: absolute;
  right: 118px;
  bottom: -6px;
  width: 40px;
  height: 110px;
  transform-origin: 50% 8%;
  animation: sweep calc(1.4s * var(--anim)) ease-in-out infinite alternate;
}
.leaf {
  position: absolute;
  bottom: 2px;
  right: 150px;
  width: 9px;
  height: 5px;
  border-radius: 50% 0;
  background: #f4a0b8;
  opacity: 0;
  animation: leaf calc(2.8s * var(--anim)) ease-out infinite;
}
.leaf:nth-child(2n) {
  background: #e8a040;
}

@keyframes spin {
  to {
    transform: rotate(360deg);
  }
}
@keyframes twinkle {
  from {
    opacity: 0.35;
  }
}
@keyframes drift {
  0% {
    transform: translate(0, 0);
    opacity: 0.2;
  }
  50% {
    opacity: 0.9;
  }
  100% {
    transform: translate(18px, -22px);
    opacity: 0.3;
  }
}
@keyframes hop {
  to {
    transform: translateY(-4px);
  }
}
@keyframes sway {
  from {
    transform: rotate(-2deg);
  }
  to {
    transform: rotate(2deg);
  }
}
@keyframes sweep {
  from {
    transform: rotate(-16deg);
  }
  to {
    transform: rotate(18deg);
  }
}
@keyframes leaf {
  0% {
    opacity: 0;
    transform: translate(0, 0) rotate(0);
  }
  15% {
    opacity: 1;
  }
  100% {
    opacity: 0;
    transform: translate(-130px, -26px) rotate(-280deg);
  }
}
</style>
