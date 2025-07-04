import { XQRenderChild } from './xiangqi';
import { IMove } from './types';
import { redoMove, undoMove } from './action';
import { scrollToBTN } from './utils';
import { speak } from './speaker';

export function showMoveList(state: XQRenderChild) {
    const ul = state.moveContainer;
    if (!ul) return;
    ul.empty();
    let toShow: IMove[] = [];
    if (state.modified) {
        toShow = state.history;
    } else {
        toShow = state.PGN;
    }
    for (let i = 0; i < toShow.length; i += 2) {
        const roundNumber = Math.floor(i / 2) + 1;
        const li = ul.createEl('li', { cls: 'round' });

        // 直接创建元素，不声明变量
        li.createEl('span', { cls: 'roundnum', text: `${roundNumber}. ` });

        // 处理红方走法
        const redMove = toShow[i];
        const redMoveSpan = li.createEl('span', {
            cls: 'move',
            text: redMove.WXF,
            attr: { name: `${i + 1}` }
        });

        // 处理黑方走法
        if (i + 1 < toShow.length) {
            const blackMove = toShow[i + 1];
            const blackMoveSpan = li.createEl('span', {
                cls: 'move',
                text: blackMove.WXF,
                attr: { name: `${i + 2}` }
            });
        }

        // 为当前步骤添加 active 类
        if (i < state.currentStep - 1 && state.currentStep - 1 <= i + 1) {
            const stepIndex = state.currentStep - 1 - i;
            const targetSpan = stepIndex === 0 ? redMoveSpan : li.children[2] as HTMLElement;
            targetSpan.classList.add('active');
        }

        // 为每个走法添加点击事件
        [redMoveSpan, li.children[2] as HTMLElement | null].forEach((span, index) => {
            if (span) {
                span.addEventListener('click', () => {
                    const targetStep = i + index + 1;
                    const diff = targetStep - state.currentStep;
                    const move = diff > 0 ? redoMove : undoMove;

                    // 移除所有 active 类
                    ul.querySelectorAll('li span.move.active').forEach((el) => {
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

                    scrollToBTN(li, ul);
                });
            }
        });
    }
}

export function showActiveBTN(state: XQRenderChild): void {
    const container = state.moveContainer;
    if (!container) return;

    // 移除所有已激活的按钮
    const activeButtons = container.querySelectorAll<HTMLElement>('.active');
    activeButtons.forEach((btn) => btn.classList.remove('active'));

    // 激活当前按钮
    const btn = `move-btn-${state.currentStep}`;
    const currentBTN = container.querySelector<HTMLElement>(`#${btn}`);
    if (!currentBTN) return;

    currentBTN.classList.add('active');
    scrollToBTN(currentBTN, container);
}
