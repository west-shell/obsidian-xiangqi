import Xiangqi from "../../lib/XIangqi/Xiangqi.svelte";
import { registerXQModule } from "../../core/module-system";
import type { IXQHost } from "../../types";

export class BoardModule {
    static init(host: IXQHost) {
        host.BoardModule = new BoardModule(host);
    }

    constructor(host: IXQHost) {
        const eventBus = host.eventBus;
        eventBus.on("load", () => {
            host.modified = false
            const Container = host.containerEl.createEl('div');
            host.Xiangqi = new Xiangqi({
                target: Container,
                props: {
                    settings: host.settings,
                    board: host.board,
                    markedPos: host.markedPos,
                    currentTurn: host.currentTurn,
                    currentStep: host.currentStep,
                    eventBus: host.eventBus,
                    modified: host.modified,
                    PGN: host.PGN,
                    history: host.history,
                    options: host.options || {}
                },
            });
        })

        eventBus.on('ready', () => {
            if (!host.settings.autoJump) return
            switch (host.settings.autoJump) {
                case "never":
                    break;
                case "always":
                    eventBus.emit('toEnd');
                    break;
                case "auto":
                    if (!host.haveFEN) {
                        eventBus.emit('toEnd');
                    }
                    break;
            }
        })

        eventBus.on('updateUI', (type: string | undefined) => {
            // if (type === undefined) return;
            host.Xiangqi?.$set({
                settings: { ...host.settings },
                board: host.board,
                markedPos: host.markedPos,
                currentTurn: host.currentTurn,
                currentStep: host.currentStep,
                modified: host.modified,
                history: [...host.history],
                options: { ...(host.options || {}) }
            });
        })

        eventBus.on("unload", () => {
            host.Xiangqi?.$destroy();
        })
    }
}

registerXQModule('board', BoardModule);
