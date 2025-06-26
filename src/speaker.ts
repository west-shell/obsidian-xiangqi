import { IMove } from './types';

export function speak(move: IMove) {
    const { type, WXF } = move;
    if (!WXF || !type) return;
    const turn = type === type.toUpperCase() ? '红：' : '黑：'
    const finalSpeech = turn + WXF
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
