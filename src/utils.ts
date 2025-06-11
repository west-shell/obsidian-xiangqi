import { IPiece, IPosition, IState, IMove } from './types';
export function movePiece(piece: IPiece, from: IPosition, to: IPosition, state: IState) {
    const { cellSize } = state.settings;
    state.board[from.x][from.y] = null;
    state.board[to.x][to.y] = piece.type;
    piece.position = { ...to };
    piece.pieceEl!.setAttribute('transform', `translate(${(to.x + 1) * cellSize},${(to.y + 1) * cellSize})`);
}
export function editHistory(move: IMove, state: IState) {
    let { currentStep, history } = state;
    const currentMove = move;

    // 检查当前步骤是否已存在相同的 move
    const existingMove = history[currentStep];
    if (
        existingMove &&
        existingMove.from.x === currentMove.from.x &&
        existingMove.from.y === currentMove.from.y &&
        existingMove.to.x === currentMove.to.x &&
        existingMove.to.y === currentMove.to.y
    ) {
        return; // 相同则不做任何修改
    }

    // 不同则：
    // 1. 删除 currentStep 之后的所有历史
    history.splice(currentStep);

    // 2. 添加新 move（直接 push 到原数组）
    history.push({
        from: { ...currentMove.from },
        to: { ...currentMove.to },
        capture: currentMove.capture || null,
    });
}

export function markPiece(pieceEl: Element) {
    if (!pieceEl.hasAttribute('data-original-transform')) {
        const originalTransform = pieceEl.getAttribute('transform') || '';
        const cleanTransform = originalTransform.replace(/\s*scale\([^)]+\)/, '');
        pieceEl.setAttribute('data-original-transform', cleanTransform);
        pieceEl.setAttribute('transform', `${cleanTransform} scale(1.2)`);
    }
}

export function restorePiece(pieceEl: Element) {
    const originalTransform = pieceEl.getAttribute('data-original-transform');
    if (originalTransform !== null) {
        pieceEl.setAttribute('transform', originalTransform);
        pieceEl.removeAttribute('data-original-transform');
    }
}
export function findPieceAt(position: IPosition, state: IState): IPiece | undefined {
    if (!state.pieces) {
        return undefined;
    }
    return state.pieces.find((p) => p.position.x === position.x && p.position.y === position.y && !p.hidden);
}