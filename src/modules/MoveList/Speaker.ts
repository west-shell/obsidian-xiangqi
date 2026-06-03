import { registerXQModule } from "../../core/module-system";
import type { IXQHost } from "../../types";
import { speak } from "../speak";

const SpeakerModule = {
    init(host: IXQHost) {
        const eventBus = host.eventBus;

        eventBus.on('updateUI', () => {
            if (
                host.settings.enableSpeech &&
                window.speechSynthesis &&
                host.currentStep > 0 &&
                host.history[host.currentStep - 1]
            ) {
                speak(host.history[host.currentStep - 1]);
            }
        })
    }
}

registerXQModule('speech', SpeakerModule);
