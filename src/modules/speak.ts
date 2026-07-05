import type { Move } from "../chess";

export function speak(move: Move) {
  const { zh } = move;
  if (!zh) return;
  const finalSpeech = zh
    .replace(/卒/g, "足")
    .replace(/车/g, "局")
    .replace(/相/g, "象")
    .replace(/将/g, "酱");

  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(finalSpeech);
  utter.lang = "en-US";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
