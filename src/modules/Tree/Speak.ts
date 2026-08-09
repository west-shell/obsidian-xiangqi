import {
  registerPGNViewModule,
  registerTreeModule,
} from "../../core/module-system";
import type { Move } from "../../chess";
import type { ITreeHost } from "../../types";

function speak(move: Move) {
  const { zh } = move;
  if (!zh) return;
  const finalSpeech = zh
    .replace(/卒/g, "足")
    .replace(/车/g, "局")
    .replace(/相/g, "象")
    .replace(/将/g, "酱");

  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(finalSpeech);
  utter.lang = "zh-CN";
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

const SpeakerModule = {
  init(host: ITreeHost) {
    const eventBus = host.eventBus;
    let lastSpokenNodeId: string | null = null;

    eventBus.on("updateUI", () => {
      if (!host.settings.enableSpeech) return;
      if (!window.speechSynthesis) return;

      const node = host.currentNode;
      if (!node || !node.move) return;
      if (node.id === lastSpokenNodeId) return;

      lastSpokenNodeId = node.id;
      speak(node.move);
    });
  },
};

registerPGNViewModule("speech", SpeakerModule);
registerTreeModule("speech", SpeakerModule);
