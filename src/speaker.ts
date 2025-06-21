import { PIECE_CHARS, IBoard, IMove } from './types';

// 数字到中文的映射（红方和黑方视角不同）
const NUMBERS_RED = ['一', '二', '三', '四', '五', '六', '七', '八', '九'];
const NUMBERS_BLACK = ['1', '2', '3', '4', '5', '6', '7', '8', '9'];

// 移动类型描述
const MOVE_TYPES = {
    horizontal: '平',
    forward: '进',
    backward: '退',
};

export function speak(move: IMove, board: IBoard) {
    const { from, to } = move;
    const piece = board[from.x][from.y];
    if (!piece) return;

    const isRed = piece === piece.toUpperCase();
    const pieceChar = PIECE_CHARS[piece];
    const numbers = isRed ? NUMBERS_RED : NUMBERS_BLACK;
    const turn = isRed ? '红方' : '黑方';
    const BOARD: IBoard = Array.from({ length: 9 }, () => Array(10).fill(null));
    let fromx = from.x;
    let fromy = from.y;
    let tox = to.x;
    let toy = to.y;
    if (isRed) {
        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 10; y++) {
                BOARD[x][y] = board[8 - x][9 - y];
            }
        }
        fromx = 8 - from.x;
        fromy = 9 - from.y;
        tox = 8 - to.x;
        toy = 9 - to.y;
    } else {
        for (let x = 0; x < 9; x++) {
            for (let y = 0; y < 10; y++) {
                BOARD[x][y] = board[x][y];
            }
        }
    }

    // 获取起始位置描述（红方和黑方的坐标系是相反的）
    let pre = '';
    let samecol: number[] = [];
    // 检查同列是否有相同棋子
    for (let y = 0; y < 10; y++) {
        if (BOARD[fromx][y] === piece) {
            samecol.push(y);
        }
    }
    if (samecol.length === 1) {
        pre = PIECE_CHARS[piece] + numbers[fromx];
    } else if (samecol.length === 2) {
        const index = samecol.indexOf(fromy);
        if (index === 0) {
            pre = '后' + PIECE_CHARS[piece];
        } else if (index === 1) {
            pre = '前' + PIECE_CHARS[piece];
        }
    } else if (samecol.length === 3) {
        const index = samecol.indexOf(fromy);
        if (index === 0) {
            pre = '后' + PIECE_CHARS[piece];
        } else if (index === 1) {
            pre = '中' + PIECE_CHARS[piece];
        } else if (index === 2) {
            pre = '前' + PIECE_CHARS[piece];
        }
    }
    // 确定移动类型和距离
    let moveType: string;
    let dest: string;

    if (fromx === tox) {
        // 纵向移动
        const delta = toy - fromy;
        moveType = delta > 0 ? MOVE_TYPES.forward : MOVE_TYPES.backward;
        dest = numbers[Math.abs(delta) - 1];
    } else if (fromy === toy) {
        // 横向移动
        moveType = MOVE_TYPES.horizontal;
        dest = numbers[tox];
    } else {
        moveType = fromy < toy ? MOVE_TYPES.forward : MOVE_TYPES.backward;
        dest = numbers[tox];
    }

    const finalSpeech = `${turn}:${pre}${moveType}${dest}`;
    const finalSpeechReplace = finalSpeech
        .replace(/卒/g, '族') // "卒"（zú）常被读错为 cù
        .replace(/將/g, '酱') // 繁体“將”可替代“将”，避免 jiāng
        .replace(/将/g, '酱') // 简体“将”也处理
        .replace(/相/g, '巷') // "相" 发 xiāng 时可能被误读
        .replace(/仕/g, '市') // "仕"（shì）有时被读成 sī
        .replace(/炮/g, '泡') // 部分语音引擎读成 bāo，替换为发音更接近的
        .replace(/兵/g, '冰')
        .replace(/傌/g, '马');
    // 发音
    if (!window.speechSynthesis) {
        return;
    }
    const utter = new SpeechSynthesisUtterance(finalSpeechReplace);
    utter.lang = 'zh-CN';
    window.speechSynthesis.cancel(); // 停止前一条朗读
    window.speechSynthesis.speak(utter);
}
