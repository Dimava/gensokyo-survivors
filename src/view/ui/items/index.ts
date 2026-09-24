// Every look the level-up cards have had for items, kept side by side: the
// gallery switches between them and a preference picks the one the cards use.
import type { Component } from "vue";
import ItemIcon from "./ItemIcon.vue";
import ItemCopies from "./ItemCopies.vue";
import ItemMedallion from "./ItemMedallion.vue";
import ItemDetail from "./ItemDetail.vue";
import ItemEffect from "./ItemEffect.vue";
import ItemIconEffect from "./ItemIconEffect.vue";

export type ItemLook = "iconfx" | "icon" | "copies" | "medallion" | "detail" | "effect";

export const ITEM_LOOKS: readonly { id: ItemLook; label: string; blurb: string; component: Component }[] = [
  { id: "iconfx", label: "Icon + effect", blurb: "The HUD icon, unchanged, with an effect round it that grows each level", component: ItemIconEffect },
  { id: "icon", label: "Icon", blurb: "The HUD icon, big, with level pips", component: ItemIcon },
  { id: "copies", label: "Copies", blurb: "One copy of the icon per level, a wave through them", component: ItemCopies },
  { id: "medallion", label: "Medallion", blurb: "The icon in a medallion: silver, gold, gems, a crown", component: ItemMedallion },
  { id: "detail", label: "Detailed", blurb: "The item redrawn with more detail each level", component: ItemDetail },
  { id: "effect", label: "Effect", blurb: "A pictogram of what the item gives, growing each level", component: ItemEffect },
];

export function itemLook(id: string): (typeof ITEM_LOOKS)[number] {
  return ITEM_LOOKS.find((l) => l.id === id) ?? ITEM_LOOKS[0]!;
}
