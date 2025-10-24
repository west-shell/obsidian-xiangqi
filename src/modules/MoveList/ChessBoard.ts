import Xiangqi from "../../lib/Movelist/Xiangqi.svelte";
import { registerXQModule } from "../../core/module-system";
import type { IXQHost } from "../../types";
import { mount, SvelteComponent } from "svelte";

export class BoardModule {
    static init(host: IXQHost) {
        host.BoardModule = new BoardModule(host);
    }

    constructor(host: IXQHost) {
        const eventBus = host.eventBus;
        eventBus.on("load", () => {
            host.modified = false
            const Container = host.containerEl.createEl('div');
            host.Xiangqi = mount(Xiangqi, {
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
                    lastMove: host.modified ? host.history[host.currentStep - 1] || null : host.PGN[host.currentStep - 1] || null,
                    options: host.options || {}
                },
            }) as SvelteComponent;
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
                board: [...host.board.map(row => [...row])], // 创建新的 board 数组引用
                markedPos: host.markedPos,
                currentTurn: host.currentTurn,
                currentStep: host.currentStep,
                modified: host.modified,
                history: [...host.history],
                lastMove: host.modified ? host.history[host.currentStep - 1] || null : host.PGN[host.currentStep - 1] || null,
                options: { ...(host.options || {}) }
            });
        })

        eventBus.on("unload", () => {
            // host.Xiangqi?.destroy();
        })
    }
}

registerXQModule('board', BoardModule);
