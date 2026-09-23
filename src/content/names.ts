// Every character, boss, place and item name in the game lives here, so a
// rename (this is a private Touhou fan project) is a one-file change.
// Other content tables refer to these by key.

export const GAME_TITLE = "Gensokyo Survivors";
export const GAME_SUBTITLE = "a shrine maiden versus the whole of Gensokyo";

export const CHARACTERS = {
  reimu: { name: "Reimu Hakurei", short: "Reimu", title: "Shrine Maiden of Paradise", color: 0xe0314b },
  marisa: { name: "Marisa Kirisame", short: "Marisa", title: "Ordinary Magician", color: 0xf2c94c },
  sakuya: { name: "Sakuya Izayoi", short: "Sakuya", title: "Perfect Maid", color: 0x9aa7c7 },
  yukari: { name: "Yukari Yakumo", short: "Yukari", title: "Youkai of Boundaries", color: 0x9b59d0 },
  cirno: { name: "Cirno", short: "Cirno", title: "Ice Fairy of the Misty Lake", color: 0x6fd3ff },
  rumia: { name: "Rumia", short: "Rumia", title: "Youkai of the Dusk", color: 0x2b2238 },
  daiyousei: { name: "Daiyousei", short: "Dai", title: "Great Fairy", color: 0x7bd88f },
} as const;

export type CharacterId = keyof typeof CHARACTERS;

export const PLACES = {
  lake: "Misty Lake",
  forest: "Forest of Magic",
  shrine: "Hakurei Shrine",
} as const;

/** The currency: donations to the Hakurei Shrine's box. */
export const CURRENCY = { name: "Donations", short: "¥", icon: "¥" } as const;

export const PLAYER_CHARACTER: CharacterId = "reimu";
