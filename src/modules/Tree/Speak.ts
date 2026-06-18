import { registerPGNViewModule, registerTreeModule } from '../../core/module-system';
import type { ITreeHost } from '../../types';
import { speak } from '../speak';

const SpeakerModule = {
  init(host: ITreeHost) {
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
    });
  },
};

registerPGNViewModule('speech', SpeakerModule);
registerTreeModule('speech', SpeakerModule);
