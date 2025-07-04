import { XQRenderChild } from './xiangqi';
import { IMove } from './types';
import { redoMove, undoMove } from './action';
import { scrollToBTN } from './utils';
import { speak } from './speaker';

export function showMoveList(state: XQRenderChild) {
    const moveContaine = state.moveContainer;
    if (!moveContaine) return;
    moveContaine.empty();
    let toShow: IMove[] = [];
    if (state.modified) {
        toShow = state.history;
    } else {
        toShow = state.PGN;
    }
    for (let i = 0; i < toShow.length; i += 2) {
        const roundNumber = Math.floor(i / 2) + 1;
        const li = moveContaine.createEl('li', { cls: 'round' });

        // 直接创建元素，不声明变量
        // li.createEl('span', { cls: 'roundnum', text: `${roundNumber}. ` });

        // 处理红方走法
        const redMove = toShow[i];
        const redMoveSpan = li.createEl('span', {
            cls: 'move',
            text: redMove.WXF,
            attr: { name: `${i + 1}` },
        });

        // 处理黑方走法
        let blackMoveSpan: HTMLElement | null = null;
        if (i + 1 < toShow.length) {
            const blackMove = toShow[i + 1];
            blackMoveSpan = li.createEl('span', {
                cls: 'move',
                text: blackMove.WXF,
                attr: { name: `${i + 2}` },
            });
        }

        // 为当前步骤添加 active 类
        if (state.currentStep >= i + 1 && state.currentStep <= i + 2) {
            const stepIndex = state.currentStep - 1 - i;
            const targetSpan = stepIndex === 0 ? redMoveSpan : blackMoveSpan;
            if (targetSpan) {
                targetSpan.classList.add('active');
            }
        }

        // 为每个走法添加点击事件
        [redMoveSpan, blackMoveSpan].forEach((span, index) => {
            if (span) {
                span.addEventListener('click', () => {
                    const targetStep = i + index + 1;
                    const diff = targetStep - state.currentStep;
                    const move = diff > 0 ? redoMove : undoMove;

                    // 移除所有 active 类
                    moveContaine.querySelectorAll('li span.move.active').forEach((el) => {
                        el.classList.remove('active');
                    });

                    // 为当前点击元素添加 active 类
                    span.classList.add('active');

                    for (let j = 0; j < Math.abs(diff); j++) {
                        move(state);
                    }

                    if (state.settings.enableSpeech) {
                        speak(toShow[state.currentStep - 1]);
                    }

                    scrollToBTN(li, moveContaine);
                });
            }
        });
    }
}

export function showActiveBTN(state: XQRenderChild): void {
    const container = state.moveContainer;
    if (!container) return;

    // 移除所有已激活的按钮和 span
    const activeElements = container.querySelectorAll<HTMLElement>('.active');
    activeElements.forEach((el) => el.classList.remove('active'));

    // 激活当前 moveList 里的 span
    const targetSpan = container.querySelector<HTMLElement>(
        `span.move[name="${state.currentStep}"]`,
    );
    if (targetSpan) {
        targetSpan.classList.add('active');
        // 滚动到激活的元素
        scrollToBTN(targetSpan.closest('li')!, container);
    }
}
