import { registerGenFENModule, registerXQModule } from "../core/module-system";
import { parseSource } from "../utils/parse";
import { DEFAULT_FEN } from "../types";

const SourceModule = {
    init(host: any) {
        const eventBus = host.eventBus;
        eventBus.on('load', (renderChild: string) => {
            const { haveFEN, fen, fenRoot, PGN, firstTurn, options } = parseSource(host.source);
            switch (renderChild) {
                case 'xq':
                    host.haveFEN = haveFEN;
                    host.fen = fenRoot;
                    host.fenRoot = fenRoot;
                    host.PGN = PGN;
                    host.history = [...PGN];
                    host.currentTurn = firstTurn;
                    host.currentStep = 0;
                    host.options = options;
                    break;
                case 'fen':
                    host.fen = fen;
                    break;
            }
        })

        eventBus.on('full', () => {
            host.fen = DEFAULT_FEN;
        })
    }
}

registerXQModule('source', SourceModule);
registerGenFENModule('source', SourceModule);
