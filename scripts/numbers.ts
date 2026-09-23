// Prints the save and log sizes for NOTES.md.
import { newGame, activeRun, runView } from "../src/sim/game.ts";
import { playRun, SKILL } from "../src/sim/bot.ts";
const size = (x: unknown): number => JSON.stringify(x).length;
const k = newGame("numbers");
console.log(`fresh profile save: ${size(k.save())} bytes`);
k.dispatch("/", "run:start", { stage: "lake" });
const path = activeRun(k)!;
let peak = 0;
let peakAt = "";
const marks: string[] = [];
playRun(k, {
  ...SKILL.expert,
  onTick: (i) => {
    if (!activeRun(k) || i % 600 !== 0) return;
    const s = size(k.save());
    const v = runView(k, path);
    if (s > peak) {
      peak = s;
      peakAt = `${Math.floor(i / 60)}s, ${v.packed("enemies").count} enemies, ${v.packed("bullets").count} bullets, ${v.packed("drops").count} drops`;
    }
    if (i % 3600 === 0) marks.push(`${i / 3600} min: log ${size(k.log())} bytes, ${k.log().records.length} records`);
  },
});
console.log(`largest mid-run save: ${peak} bytes at ${peakAt}`);
console.log(marks.join("\n"));
const log = k.log();
console.log(`whole run: ${size(log)} bytes of log, ${log.records.length} records; profile save after: ${size(k.save())} bytes`);
