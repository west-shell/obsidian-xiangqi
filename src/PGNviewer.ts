import { IState, IHistory, IMove } from './types';
export function PGNViewer(move: IMove): HTMLElement {
    const pgnLines = document.createElement('button');
    pgnLines.textContent = move.toString();
    pgnLines.title = move.toString();
    pgnLines.classList.add('pgn-line');
    return pgnLines;
}