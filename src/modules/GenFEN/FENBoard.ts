import GenFEN from "../../lib/GenFEN/GenFEN.svelte";
import { registerGenFENModule } from "../../core/module-system";
import { mount, unmount } from "svelte";

const BoardModule = {
    init(host: Record<string, any>) {
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
            unmount(host.Xiangqi)
        })
    }
}

registerGenFENModule('board', BoardModule);
