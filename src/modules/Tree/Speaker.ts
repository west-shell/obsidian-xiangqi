import { registerPGNViewModule } from "../../core/module-system";
import { speak } from "../speak";

const SpeakerModule = {
    init(host: Record<string, any>) {
        const eventBus = host.eventBus;
        let lastSpokenNodeId: string | null = null;

        eventBus.on('updateUI', () => {
            if (!host.settings.enableSpeech) return;
            if (!window.speechSynthesis) return;

            const node = host.currentNode;
            if (!node || !node.move) return;
            if (node.id === lastSpokenNodeId) return;

            lastSpokenNodeId = node.id;
            speak(node.move);
        })
    }
}

registerPGNViewModule('speech', SpeakerModule);
