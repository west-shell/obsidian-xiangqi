import { registerGenFENModule, registerXQModule } from "../core/module-system";
import { parseSource, genFENFromBoard } from "../utils/parse";
import { MarkdownView } from "obsidian";

export const SourceModule = {

	init(host: any) {
		const eventBus = host.eventBus;
		eventBus.on('load', (renderChild: string) => {
			switch (renderChild) {
				case 'xq':
					const { haveFEN, board, PGN, firstTurn, options, isPikafishUrl } = parseSource(host.source)
					host.haveFEN = haveFEN;
					host.board = board;
					host.PGN = PGN;
					host.currentTurn = firstTurn;
					host.currentStep = 0;
					host.options = options;

					if (isPikafishUrl) {
						// 自动转换为标准语法
						const fen = genFENFromBoard(board, firstTurn);
						
						const pgnLines: string[] = [];
						for (let i = 0; i < PGN.length; i += 2) {
							const move1 = PGN[i].ICCS;
							const move2 = PGN[i + 1]?.ICCS || "";
							const line = `${Math.ceil((i + 1) / 2)}. ${move1} ${move2}`.trim();
							pgnLines.push(line);
						}
						const moves = pgnLines.join("\n");
						
						const newContent = `${fen}\n${moves}`;

						// 触发文件更新
						const view = host.plugin.app.workspace.getActiveViewOfType(MarkdownView);
						if (view && view.file) {
							host.plugin.app.vault.process(view.file, (fileContent: string) => {
								const section = host.ctx.getSectionInfo(host.containerEl);
								if (!section) return fileContent;
								const { lineStart, lineEnd } = section;
								const lines = fileContent.split("\n");
								const blockLines = lines.slice(lineStart, lineEnd + 1);
								
								// 替换代码块内容
								// 保留首尾行 (```xiangqi 和 ```)
								const newBlockLines = [blockLines[0], newContent, blockLines[blockLines.length - 1]];
								
								return [
									...lines.slice(0, lineStart),
									...newBlockLines,
									...lines.slice(lineEnd + 1)
								].join("\n");
							});
						}
					}
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
