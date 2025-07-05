import { XQRenderChild } from './xiangqi';
import { setIcon, MarkdownView } from 'obsidian';
import { redoMove, undoMove } from './action';
import { showActiveBTN } from './moveList';
import { showMoveList } from './moveList';
import { Notice } from 'obsidian';
import { ConfirmModal } from './confirmModal';
import { getICCS } from './parseSource';

export function creatButtons(state: XQRenderChild) {
    // 创建工具栏容器
    const toolbarContainer = state.containerEl.createEl('div', {
        cls: 'toolbar-container',
    });
    toolbarContainer.classList.toggle('right', state.settings.position === 'right');
    toolbarContainer.classList.toggle('bottom', state.settings.position === 'bottom');

    const buttons = [
        { title: '重置', icon: 'refresh-cw', handler: () => onResetClick(state) },
        { title: '开局', icon: 'arrow-left-to-line', handler: () => onToStartClick(state) },
        { title: '回退', icon: 'undo-dot', handler: () => onUndoClick(state) },
        { title: '前进', icon: 'redo-dot', handler: () => onRedoClick(state) },
        { title: '终局', icon: 'arrow-right-to-line', handler: () => onToEndClick(state) },
        {
            title: '保存',
            icon: 'save',
            handler: (ev: MouseEvent) => {
                const btn = ev.currentTarget as HTMLButtonElement;
                onSaveClick(state).then(() => {
                    btn.classList.toggle('saved', state.PGN.length > 0 && !state.modified);
                    btn.classList.toggle('empty', state.PGN.length === 0 && !state.modified);
                    btn.classList.toggle('unsaved', state.modified);
                });
            },
            isave: true,
        },
    ];

    for (const { title, icon, handler, isave } of buttons) {
        const btn = toolbarContainer.createEl('button', {
            attr: { title },
            cls: 'toolbar-btn',
        });
        setIcon(btn, icon);
        btn.addEventListener('click', handler);
        if (isave) {
            btn.classList.toggle('saved', state.PGN.length > 0);
            btn.classList.toggle('empty', state.PGN.length === 0);
            state.saveButton = btn;
        }
    }
    if (state.options.protected && state.saveButton) {
        state.saveButton.classList.add('disabled');
    }
}
function onResetClick(state: XQRenderChild) {
    while (state.currentStep > 0) {
        undoMove(state); // 撤销上一步
    }
    state.history = [];
    state.saveButton?.classList.remove('unsaved');

    state.modified = false; // 重置修改状态
    showMoveList(state);
    state.currentStep = 0;
    if (state.modifiedStep === 0 && state.moveContainer) {
        state.moveContainer.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
        return;
    }
    for (let i = 0; i < state.modifiedStep; i++) {
        redoMove(state);
    }
    state.modifiedStep = 0;
    state.modified = false;
    showActiveBTN(state);
}

function onToStartClick(state: XQRenderChild) {
    while (state.currentStep != 0) {
        undoMove(state);
    }
    showActiveBTN(state);
    if (state.moveContainer) {
        state.moveContainer.scrollTo({
            top: 0,
            behavior: 'smooth',
        });
    }
}

function onUndoClick(state: XQRenderChild) {
    undoMove(state);
    showActiveBTN(state);
}

function onRedoClick(state: XQRenderChild) {
    redoMove(state);
    showActiveBTN(state);
}

function onToEndClick(state: XQRenderChild) {
    if (!state.moveContainer) return;
    const step = state.modified ? state.history.length : state.PGN.length;
    const dif = step - state.currentStep;
    for (let i = 0; i < dif; i++) {
        redoMove(state);
    }
    showActiveBTN(state);
}

async function onSaveClick(state: XQRenderChild) {
    let message = '';
    if (state.history.length === 0 && state.PGN.length === 0) {
        new Notice('PGN记录为空，无需保存！');
        return;
    }
    if (state.history.length === 0 && state.PGN.length > 0)
        message = '当前PGN记录不为空，是否要清空？';
    if (state.history.length > 0 && state.PGN.length === 0)
        message = '当前PGN记录为空，是否要保存历史为PGN？';
    if (state.history.length > 0 && state.PGN.length > 0)
        message = '当前PGN记录不为空，是否要覆盖保存？';
    const modal = new ConfirmModal(state.plugin.app, '确认保存', message, '保存', '取消');

    modal.open();
    const userConfirmed = await modal.promise;

    if (userConfirmed) {
        await savePGN(state);
        new Notice('保存成功！');
    }
}

async function savePGN(state: XQRenderChild) {
    const view = state.plugin.app.workspace.getActiveViewOfType(MarkdownView);
    if (!view) return;
    const file = view.file; // TFile
    if (!file) return;

    // 这里 this.containerEl 可能指当前实例的属性，确保 this 指向正确
    // 如果 savePGN 是类方法，建议改写为箭头函数或 bind this
    const section = state.ctx.getSectionInfo(state.containerEl);
    if (!section) return;

    const { lineStart, lineEnd } = section;
    const content = await state.plugin.app.vault.read(file);
    const lines = content.split('\n');

    // 明确标注类型，初始赋值时用slice保证是string[]
    let blockLines: string[] = lines.slice(lineStart, lineEnd + 1);

    if (blockLines.length < 2) return;

    // 1. 删除所有符合 PGN 格式的行（无论 currentStep 是多少）
    blockLines = blockLines.filter((line) => !/[A-Z]\d-[A-Z]\d/.test(line));

    // 2. 仅当 currentStep > 0 时生成并插入新的 PGN
    if (state.currentStep > 0) {
        const moves = state.history.slice(0, state.currentStep).map((move) => getICCS(move));

        const pgnLines: string[] = [];
        for (let i = 0; i < moves.length; i += 2) {
            const line = `${Math.ceil((i + 1) / 2)}. ${moves[i]} ${moves[i + 1] || ''}`.trim();
            pgnLines.push(line);
        }
        const PGN = pgnLines.join('\n');

        // 插入PGN字符串
        blockLines.splice(blockLines.length - 1, 0, PGN);
    }

    // 3. 更新文件内容（无论是否插入 PGN，都会执行清理）
    const newContent = [
        ...lines.slice(0, lineStart),
        ...blockLines,
        ...lines.slice(lineEnd + 1),
    ].join('\n');

    await state.plugin.app.vault.modify(file, newContent);
}
