/**
 * 象棋走子规则校验模块
 * 支持基本的棋子走法合法性判断
 */
import { IBoard, IMove, IPosition } from './types';

export function isValidMove(from: IPosition, to: IPosition, board: IBoard): boolean {
  // 通用校验
  if (!board) return false;
  const err = baseCheck(from, to, board);
  if (err) return false;
  const fromPiece = board[from.x][from.y];
  const toPiece = board[to.x][to.y];
  if (isSameSide(fromPiece!, toPiece)) return false;

  switch (fromPiece!.toUpperCase()) {
    case 'R':
      return canRMove(from, to, board);
    case 'N':
      return canNMove(from, to, board);
    case 'B':
      return canBMove(from, to, board);
    case 'A':
      return canAMove(from, to, board);
    case 'K':
      return canKMove(from, to, board);
    case 'C':
      return canCMove(from, to, board);
    case 'P':
      return canPMove(from, to, board);
    default:
      return false;
  }
}
// 通用校验：越界、原地不动、无棋子
function baseCheck(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): string | null {
  if (
    from.x < 0 ||
    from.x > 8 ||
    from.y < 0 ||
    from.y > 9 ||
    to.x < 0 ||
    to.x > 8 ||
    to.y < 0 ||
    to.y > 9
  )
    return 'out-of-board';
  if (from.x === to.x && from.y === to.y) return 'same-pos';
  if (!board[from.x][from.y]) return 'no-piece';
  return null;
}

// 通用校验：不能吃己方
function isSameSide(fromPiece: string, toPiece: string | null): boolean {
  if (!toPiece) return false;
  return (fromPiece === fromPiece.toUpperCase()) === (toPiece === toPiece.toUpperCase());
}

// 车
function canRMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  if (from.x !== to.x && from.y !== to.y) return false;
  if (from.x === to.x) {
    const [min, max] = [from.y, to.y].sort((a, b) => a - b);
    for (let y = min + 1; y < max; y++) {
      if (board[from.x][y]) return false;
    }
  } else {
    const [min, max] = [from.x, to.x].sort((a, b) => a - b);
    for (let x = min + 1; x < max; x++) {
      if (board[x][from.y]) return false;
    }
  }
  return true;
}

// 马
function canNMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (!((Math.abs(dx) === 2 && Math.abs(dy) === 1) || (Math.abs(dx) === 1 && Math.abs(dy) === 2)))
    return false;
  if (Math.abs(dx) === 2) {
    if (board[from.x + dx / 2][from.y]) return false;
  } else {
    if (board[from.x][from.y + dy / 2]) return false;
  }
  return true;
}

// 相/象
function canBMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (Math.abs(dx) !== 2 || Math.abs(dy) !== 2) return false;
  const fromPiece = board[from.x][from.y]!;
  const isRed = fromPiece === fromPiece.toUpperCase();
  if ((isRed && to.y < 5) || (!isRed && to.y > 4)) return false;
  if (board[from.x + dx / 2][from.y + dy / 2]) return false;
  return true;
}

// 士/仕
function canAMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  const dx = Math.abs(to.x - from.x),
    dy = Math.abs(to.y - from.y);
  if (dx !== 1 || dy !== 1) return false;
  const fromPiece = board[from.x][from.y]!;
  const isRed = fromPiece === fromPiece.toUpperCase();
  if (isRed) {
    return to.x >= 3 && to.x <= 5 && to.y >= 7 && to.y <= 9;
  } else {
    return to.x >= 3 && to.x <= 5 && to.y >= 0 && to.y <= 2;
  }
}

// 将/帅
function canKMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  const dx = Math.abs(to.x - from.x),
    dy = Math.abs(to.y - from.y);
  if (dx + dy !== 1) return false;
  const fromPiece = board[from.x][from.y]!;
  const isRed = fromPiece === fromPiece.toUpperCase();
  if (isRed) {
    if (!(to.x >= 3 && to.x <= 5 && to.y >= 7 && to.y <= 9)) return false;
  } else {
    if (!(to.x >= 3 && to.x <= 5 && to.y >= 0 && to.y <= 2)) return false;
  }
  return true;
}

// 炮
function canCMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  if (from.x !== to.x && from.y !== to.y) return false;
  let count = 0;
  if (from.x === to.x) {
    const [min, max] = [from.y, to.y].sort((a, b) => a - b);
    for (let y = min + 1; y < max; y++) {
      if (board[from.x][y]) count++;
    }
  } else {
    const [min, max] = [from.x, to.x].sort((a, b) => a - b);
    for (let x = min + 1; x < max; x++) {
      if (board[x][from.y]) count++;
    }
  }
  const toPiece = board[to.x][to.y];
  if (!toPiece) {
    return count === 0;
  } else {
    const fromPiece = board[from.x][from.y]!;
    if (isSameSide(fromPiece, toPiece)) return false;
    return count === 1;
  }
}

// 兵/卒
function canPMove(
  from: { x: number; y: number },
  to: { x: number; y: number },
  board: (string | null)[][],
): boolean {
  const fromPiece = board[from.x][from.y]!;
  const isRed = fromPiece === fromPiece.toUpperCase();
  const dx = to.x - from.x,
    dy = to.y - from.y;
  if (Math.abs(dx) + Math.abs(dy) !== 1) return false;
  const crossedRiver = isRed ? from.y <= 4 : from.y >= 5;
  if (isRed) {
    if (!crossedRiver) {
      return dx === 0 && dy === -1;
    } else {
      return (dx === 0 && dy === -1) || (dy === 0 && Math.abs(dx) === 1);
    }
  } else {
    if (!crossedRiver) {
      return dx === 0 && dy === 1;
    } else {
      return (dx === 0 && dy === 1) || (dy === 0 && Math.abs(dx) === 1);
    }
  }
}
