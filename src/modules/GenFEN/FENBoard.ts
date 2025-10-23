import GenFEN from "../../lib/GenFEN/GenFEN.svelte";
import { registerGenFENModule } from "../../core/module-system";
import { mount } from "svelte";

export class BoardModule {
    static init(host: Record<string, any>) {
        host.BoardModule = new BoardModule(host);
    }

    constructor(host: Record<string, any>) {
        const eventBus = host.eventBus;
        eventBus.on("load", () => {
            host.modified = false
            const Container = host.containerEl.createEl('div');
            host.Xiangqi = mount(GenFEN, {
                target: Container,
                props: {
                    selectedPiece: host.selectedPiece,
                    settings: host.settings,
                    board: host.board,
                    markedPos: host.markedPos,
                    currentTurn: host.currentTurn,
                    eventBus: host.eventBus,
                },
            });
        })

        eventBus.on('updateUI', (type: string) => {
            host.Xiangqi.$set({
                selectedPiece: host.selectedPiece,
                settings: { ...host.settings },
                board: [...host.board],
                markedPos: { ...host.markedPos },
                currentTurn: host.currentTurn,
            });
        })

        eventBus.on("unload", () => {
            // host.Xiangqi.destroy();
            host.Xiangqi = null;
        })
    }
}

registerGenFENModule('board', BoardModule);
