import { registerGenFENModule, registerXQModule } from "../core/module-system";
import { parseSource } from "../utils/parse";

export const SourceModule = {

	init(host: any) {
		const eventBus = host.eventBus;
		eventBus.on('load', (renderChild: string) => {
			switch (renderChild) {
				case 'xq':
					const { haveFEN, board, PGN, firstTurn, options } = parseSource(host.source)
					host.haveFEN = haveFEN;
					host.board = board;
					host.PGN = PGN;
					host.currentTurn = firstTurn;
					host.currentStep = 0;
					host.options = options;
					break;
				case 'fen':
					host.board = parseSource('').board;
					host.currentTurn = 'red';
					break;
			}
		})

		eventBus.on('full', () => {
			host.board = parseSource('').board;
		})
	}
}

registerXQModule('source', SourceModule);
registerGenFENModule('source', SourceModule);
