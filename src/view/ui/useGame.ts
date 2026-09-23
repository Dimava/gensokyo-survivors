// Reactive reads of the kernel for the Vue shell. The kernel is not reactive;
// these computeds depend on the host's counters (`state.meta` for menus,
// `state.frame` for the HUD) and re-read views when they change.

import { computed } from "vue";
import { host, state } from "../host.ts";
import { treeLoadout } from "../../sim/meta.ts";
import { STAGES } from "../../content/stages.ts";

export function metaView() {
  return host.k.view();
}

export const wallet = computed(() => {
  void state.meta;
  return metaView().derived("wallet").wallet;
});

export const profile = computed(() => {
  void state.meta;
  return metaView().derived("profile").profile;
});

export const owned = computed(() => {
  void state.meta;
  return metaView()
    .derived("owned")
    .map((o) => ({ ...o.owned, id: o.id }));
});

export const treeLevels = computed(() => {
  void state.meta;
  return metaView().derived("tree").tree.levels;
});

export const loadout = computed(() => treeLoadout(treeLevels.value));

export const lastRun = computed(() => {
  void state.meta;
  return metaView().q("lastRun")[0]?.lastRun ?? null;
});

export const gacha = computed(() => {
  void state.meta;
  return metaView().derived("gacha").gacha;
});

export const affordableNodes = computed(() => {
  void state.meta;
  return host.k.options("/", "tree:buy").length;
});

export const stages = STAGES;

export function fmtTime(seconds: number): string {
  const s = Math.max(0, Math.floor(seconds));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function hex(color: number): string {
  return `#${color.toString(16).padStart(6, "0")}`;
}
