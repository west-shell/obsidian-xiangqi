import { registerListModule } from "../../core/module-system";
import type { IListHost } from "../../types";
import { speak } from "../speak";

const SpeakerModule = {
  init(host: IListHost) {
    const eventBus = host.eventBus;

    eventBus.on("updateUI", () => {
      const currentNode = host.history[host.currentStep - 1];

      if (
        host.settings.enableSpeech &&
        window.speechSynthesis &&
        currentNode?.move
      ) {
        speak(currentNode.move);
      }
    });
  },
};

registerListModule("speech", SpeakerModule);
