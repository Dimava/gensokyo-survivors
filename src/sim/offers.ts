// Level-up offers: three distinct choices drawn from what can still grow.
// Owned weapons and passives below max, new ones while slots are free
// (locked weapons only once the shrine tree unlocked them); when fewer than
// three exist, a heal and a donation fill in.

import type { Ctx, View } from "gamebones";
import { PASSIVES, passiveDef } from "../content/passives.ts";
import { WEAPONS, weaponDef } from "../content/weapons.ts";
import type { RS0 } from "./run.ts";
import type { OfferChoice } from "./schemas.ts";
import { SLOTS } from "./tuning.ts";

export const HEAL_FRACTION = 0.3;
export const COIN_OFFER = 15;

/** Every choice that could be offered now, with its draw weight. */
export function offerPool(v: View<RS0>): { choice: OfferChoice; weight: number }[] {
  const out: { choice: OfferChoice; weight: number }[] = [];
  const weapons = v.derived("weapons");
  const passives = v.derived("passives");
  const unlocked = new Set(v.derived("loadout").unlocked);
  for (const w of weapons) {
    const def = weaponDef(w.weapon.id);
    if (w.weapon.level < def.levels.length) out.push({ choice: { kind: "weapon", id: def.id, level: w.weapon.level + 1 }, weight: 10 });
  }
  if (weapons.length < SLOTS.weapons) {
    for (const def of WEAPONS) {
      if (weapons.some((w) => w.weapon.id === def.id)) continue;
      if (def.locked && !unlocked.has(def.id)) continue;
      out.push({ choice: { kind: "weapon", id: def.id, level: 1 }, weight: 7 });
    }
  }
  for (const p of passives) {
    const def = passiveDef(p.passive.id);
    if (p.passive.level < def.max) out.push({ choice: { kind: "passive", id: def.id, level: p.passive.level + 1 }, weight: 8 });
  }
  if (passives.length < SLOTS.passives) {
    for (const def of PASSIVES) {
      if (passives.some((p) => p.passive.id === def.id)) continue;
      out.push({ choice: { kind: "passive", id: def.id, level: 1 }, weight: 6 });
    }
  }
  return out;
}

export function rollOffer(ctx: Ctx<RS0>): OfferChoice[] {
  const pool = offerPool(ctx);
  const r = ctx.rng("levelup");
  const picks: OfferChoice[] = [];
  while (picks.length < 3 && pool.length) {
    const total = pool.reduce((s, p) => s + p.weight, 0);
    let roll = r.float() * total;
    let k = 0;
    for (; k < pool.length - 1; k++) {
      roll -= pool[k]!.weight;
      if (roll < 0) break;
    }
    picks.push(pool[k]!.choice);
    pool.splice(k, 1);
  }
  if (picks.length < 3) picks.push({ kind: "heal", id: "heal", level: 0 });
  if (picks.length < 3) picks.push({ kind: "coins", id: "coins", level: 0 });
  return picks;
}
