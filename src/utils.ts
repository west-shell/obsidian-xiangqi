import { XQRenderChild } from './xiangqi';
import { IPiece, IPosition, IMove, PieceType } from './types';
export function movePiece(
    piece: IPiece,
    from: IPosition | null,
    to: IPosition,
    state: XQRenderChild,
) {
    const { cellSize } = state.settings;
    if (from) {
        state.board[from.x][from.y] = null;
    }
    state.board[to.x][to.y] = piece.type;
    piece.position = { ...to };
    piece.pieceEl!.setAttribute(
        'transform',
        `translate(${(to.x + 1) * cellSize},${(to.y + 1) * cellSize})`,
    );
}
export function editHistory(move: IMove, state: XQRenderChild) {
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
    history.push(currentMove);
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
export function findPieceAt(position: IPosition, state: XQRenderChild): IPiece | undefined {
    if (!state.pieces) {
        return undefined;
    }
    return state.pieces.find(
        (p: IPiece) => p.position.x === position.x && p.position.y === position.y && !p.hidden,
    );
}

/**
 * 在指定容器内，如果有垂直滚动条，则平滑滚动让目标元素垂直居中。
 * 没有滚动条时不滚动。
 * @param element 目标元素
 * @param container 可滚动容器
 */
export function scrollBTN(element: HTMLElement | null, container: HTMLElement | null): void {
    if (!element || !container) return;
    const hasVerticalScrollbar = container.scrollHeight > container.clientHeight;
    if (!hasVerticalScrollbar) return;

    const elementRect = element.getBoundingClientRect();
    const containerRect = container.getBoundingClientRect();

    const offsetTop = elementRect.top - containerRect.top;
    const targetScrollTop =
        container.scrollTop + offsetTop - container.clientHeight / 2 + element.offsetHeight / 2;

    container.scrollTo({
        top: targetScrollTop,
        behavior: 'smooth',
    });
}

export function isRed(Piece: PieceType): boolean {
    return Piece === Piece.toUpperCase();
}
