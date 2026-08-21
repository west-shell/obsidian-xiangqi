import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { getLang, t } from "../../i18n";
import type { Move } from "../../chess";
import { getMoveNotation } from "../../chess";
import type { IHost } from "../../types";

const PIECE_SPEECH_KEYS: Record<string, string> = {
  K: "speech.pieceK",
  Q: "speech.pieceQ",
  R: "speech.pieceR",
  B: "speech.pieceB",
  N: "speech.pieceN",
};

let cachedVoices: SpeechSynthesisVoice[] = [];

function loadVoices(): SpeechSynthesisVoice[] {
  if (cachedVoices.length) return cachedVoices;
  cachedVoices = window.speechSynthesis.getVoices();
  return cachedVoices;
}

if (window.speechSynthesis) {
  window.speechSynthesis.onvoiceschanged = () => {
    cachedVoices = window.speechSynthesis.getVoices();
  };
}

const FILE_SPEECH: Record<string, string> = {
  a: "A",
  b: "B",
  c: "C",
  d: "D",
  e: "E",
  f: "F",
  g: "G",
  h: "H",
};

function speak(move: Move) {
  const san = getMoveNotation(move);
  if (!san) return;
  const isZh = getLang() === "zh";
  const preprocessed = isZh
    ? san
    : san.replace(/[a-h]/g, (f) => FILE_SPEECH[f] + "-");
  const finalSpeech = preprocessed
    .replace(/O-O-O/g, t("speech.queensideCastle"))
    .replace(/O-O/g, t("speech.kingsideCastle"))
    .replace(/^[KQRBN]/, (m) => ` ${t(PIECE_SPEECH_KEYS[m])} `)
    .replace(
      /=([QRBN])/g,
      (_, piece) => ` ${t("speech.promotesTo")} ${t("speech.piece" + piece)}`,
    )
    .replace(/x/g, ` ${t("speech.captures")} `)
    .replace(/\+/g, ` ${t("speech.check")}`)
    .replace(/#/g, ` ${t("speech.checkmate")}`);

  if (!window.speechSynthesis) return;
  const utter = new SpeechSynthesisUtterance(finalSpeech);
  utter.lang = isZh ? "zh-CN" : "en-US";
  if (!isZh) {
    const voices = loadVoices();
    const enVoice =
      voices.find((v) => v.lang === "en-US") ??
      voices.find((v) => v.lang.startsWith("en"));
    if (enVoice) utter.voice = enVoice;
  }
  window.speechSynthesis.cancel();
  window.speechSynthesis.speak(utter);
}

const SpeakerModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;
    let lastSpokenNodeId: string | null = null;

    eventBus.on("updateUI", () => {
      if (!host.settings.enableSpeech) return;
      if (!window.speechSynthesis) return;

      const node = host.currentNode;
      if (!node || !node.move) return;
      if (node.id === lastSpokenNodeId) return;

      lastSpokenNodeId = node.id;
      speak(node.move);
    });
  },
};

registerFileModule("speech", SpeakerModule);
registerBlockModule("speech", SpeakerModule);
