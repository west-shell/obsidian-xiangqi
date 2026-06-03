import type { Move } from "@west-shell/xiangqi.js";

export function speak(move: Move) {
    const { san } = move;
    if (!san) return;
    const finalSpeech = san.replace(/-/g, " ").replace(/\+/g, " capture ").replace(/#/g, " checkmate ");

    if (!window.speechSynthesis) return;
    const utter = new SpeechSynthesisUtterance(finalSpeech);
    utter.lang = "en-US";
    window.speechSynthesis.cancel();
    window.speechSynthesis.speak(utter);
}
