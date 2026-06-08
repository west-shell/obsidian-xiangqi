import type { Move } from '@west-shell/xiangqi.js';

export function speak(move: Move) {
  const { zh } = move;
  if (!zh) return;
  const finalSpeech = zh.replace(/-/g, ' ').replace(/\+/g, ' capture ').replace(/#/g, ' checkmate ');

  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(finalSpeech);
  utter.lang = 'en-US';
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}
