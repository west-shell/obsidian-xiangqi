import { IMove, IState } from './types';
import { findPieceAt, editHistory, movePiece } from './utils';
import { speak } from './speaker';
export function runMove(move: IMove, state: IState) {
    if (state.settings.enableSpeech) {
        speak(move);
    }
    const { from, to } = move;
    const fromPiece = findPieceAt(from, state);
    const toPiece = findPieceAt(to, state);
    if (!fromPiece) return;
    // 如果目标有棋子，隐藏目标棋子
    if (toPiece) {
        toPiece.hidden = true;
        toPiece.pieceEl?.setAttribute('display', 'none');
        move.capture = toPiece;
    }
    editHistory(move, state);
    movePiece(fromPiece, from, to, state);
    state.currentStep++;
    state.currentTurn = state.currentTurn === 'red' ? 'black' : 'red';
}
export function undoMove(state: IState) {
    if (state.history.length === 0) return;
    const move = state.history[state.currentStep - 1];
    if (!move) return;
    const { from, to, capture } = move;
    // 找到需要回退的棋子
    const returnPiece = findPieceAt(to, state);
    if (!returnPiece) return;
    movePiece(returnPiece, to, from, state);
    // 恢复被吃掉的棋子
    if (capture) {
        capture.hidden = false;
        capture.pieceEl?.removeAttribute('display');
        state.board[to.x][to.y] = capture.type;
    }
    state.currentStep--;
    state.currentTurn = state.currentTurn === 'red' ? 'black' : 'red';
}
export function redoMove(state: IState) {
    // 如果没有悔棋记录且没有预定义的走法，直接返回
    // 如果没有悔棋记录但有预定义的走法，从 moves 中执行下一步
    if (!state.modified && state.PGN!.length > 0) {
        const nextMove = state.PGN[state.currentStep]; // 获取并移除 moves 中的第一步
        if (!nextMove) return;
        runMove(nextMove, state);
        return;
    }
    if (state.history.length <= state.currentStep) return;
    // 如果有悔棋记录，从 undoHistory 中执行下一步
    const moveToRedo = state.history[state.currentStep];
    if (!moveToRedo) return;
    runMove(moveToRedo, state);
}
