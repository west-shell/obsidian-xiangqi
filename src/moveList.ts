import { XQRenderChild } from './xiangqi';
import { IMove } from './types';
import { redoMove, undoMove } from './action';
import { scrollToBTN } from './utils';
import { speak } from './speaker';

export function showMoveList(state: XQRenderChild) {
    const moveContainer = state.moveContainer;
    if (!moveContainer) return;
    moveContainer.empty();
    let toShow: IMove[] = [];
    if (state.modified) {
        toShow = state.history;
    } else {
        toShow = state.PGN;
    }
    toShow.forEach((move, index) => {
        let text = '';
        let cls = '';
        if (state.settings.showPGNtxt) {
            text = `${index + 1}：${move.WXF}`;
            cls = 'move-btn';
        } else {
            text = `${index + 1}`;
            cls = 'move-btn circle';
        }
        const btn = moveContainer.createEl('button', {
            text,
            cls,
            attr: { id: `move-btn-${index + 1}` },
        });
        if (state.settings.fontSize > 0) {
            btn.style.fontSize = `${state.settings.fontSize}px`;
        }
        if (state.settings.position === 'bottom' && !state.settings.showPGNtxt) {
            btn.style.width = `${0.83 * state.settings.cellSize}px`;
        }
        if (state.settings.position === 'bottom' && state.settings.showPGNtxt) {
            btn.style.width = `${2.4 * state.settings.cellSize}px`;
            btn.style.height = `${0.8 * state.settings.cellSize}px`;
        }

        if (index === state.currentStep - 1) {
            btn.classList.add('active'); // 高亮当前步
        }
        btn.addEventListener('click', () => {
            const diff = index - state.currentStep + 1;
            const move = diff > 0 ? redoMove : undoMove;
            moveContainer
                .querySelector(`#move-btn-${state.currentStep}`)
                ?.classList.remove('active');
            moveContainer.querySelector(`#move-btn-${index + 1}`)!.classList.add('active');
            for (let i = 0; i < Math.abs(diff); i++) {
                move(state);
            }
            if (state.settings.enableSpeech) {
                speak(toShow[state.currentStep - 1]);
            }
            scrollToBTN(btn, moveContainer);
        });
    });
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
