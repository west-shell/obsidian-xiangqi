import {
  type App,
  Notice,
  PluginSettingTab,
  Setting,
  // type SettingDefinitionItem,
  // type SettingGroupItem,
} from "obsidian";

import {
  CLS_PREFIX,
  DEFAULT_FEN_BLOCK_NAMES,
  DEFAULT_TREE_BLOCK_NAMES,
} from "./chess";
import { getLang, initI18n, t } from "./i18n";
import type ChessPlugin from "./main";
import { getThemeDisplayName, THEME_KEYS } from "./themes";
import type { ISettings } from "./types";

const VALID_NAME_RE = /^[a-z0-9-]+$/;
// Characters the tag input accepts as they are typed (committed to
// lowercase); anything else is rejected with a notice, never auto-removed.
const TYPABLE_NAME_RE = /[a-zA-Z0-9-]/;

interface TagInput {
  refresh: () => void;
}

// GitHub-style tag input: committed names render as removable chips, the
// inline input commits on Enter / comma / blur. Invalid characters are
// rejected the moment they are typed (with a notice naming the character)
// — the input value is never rewritten from under the user.
function addTagInput(
  setting: Setting,
  getNames: () => string[],
  setNames: (names: string[]) => void,
): TagInput {
  const wrap = setting.controlEl.createDiv({
    cls: `${CLS_PREFIX}-tags`,
  });

  const removeChip = (chip: HTMLElement, name: string): void => {
    const names = getNames();
    if (names.length <= 1) {
      new Notice(t("codeblock.lastName"));
      return;
    }
    chip.detach();
    setNames(names.filter((n) => n !== name));
  };

  const buildChip = (name: string): HTMLElement => {
    const chip = createSpan({ cls: `${CLS_PREFIX}-tags__chip` });
    chip.dataset.name = name;
    chip.createSpan({ text: name });
    const x = chip.createEl("button", {
      cls: `${CLS_PREFIX}-tags__x`,
      attr: {
        type: "button",
        "aria-label": t("codeblock.removeName").replace("{name}", name),
      },
      text: "×",
    });
    x.addEventListener("click", () => removeChip(chip, name));
    return chip;
  };

  const input = wrap.createEl("input", {
    cls: `${CLS_PREFIX}-tags__input`,
    attr: { type: "text", placeholder: t("codeblock.tagPlaceholder") },
  });

  const commit = (): void => {
    const name = input.value.trim().toLowerCase();
    input.value = "";
    if (!name) return;
    if (!VALID_NAME_RE.test(name)) {
      new Notice(t("codeblock.invalidName").replace("{name}", name));
      return;
    }
    const names = getNames();
    if (names.includes(name)) {
      new Notice(t("codeblock.duplicateName").replace("{name}", name));
      return;
    }
    wrap.insertBefore(buildChip(name), input);
    setNames([...names, name]);
  };

  input.addEventListener("keydown", (e: KeyboardEvent) => {
    if (e.key === "Enter" || e.key === ",") {
      e.preventDefault();
      commit();
    } else if (e.key === "Backspace" && !input.value) {
      const last = input.previousElementSibling;
      if (last instanceof HTMLElement) {
        e.preventDefault();
        removeChip(last, last.dataset.name ?? "");
      }
    } else if (e.key.length === 1 && !TYPABLE_NAME_RE.test(e.key)) {
      e.preventDefault();
      new Notice(t("codeblock.invalidChar").replace("{char}", e.key));
    }
  });

  // Pasted text is filtered to what the filter above would allow, so the
  // box never holds characters that would fail at commit time.
  input.addEventListener("paste", (e: ClipboardEvent) => {
    e.preventDefault();
    const raw = e.clipboardData?.getData("text") ?? "";
    const dropped = raw.replace(/[a-zA-Z0-9-]/g, "");
    if (dropped) {
      new Notice(t("codeblock.invalidChar").replace("{char}", dropped[0]));
    }
    input.value += raw.toLowerCase().replace(/[^a-z0-9-]/g, "");
  });

  input.addEventListener("blur", commit);

  const refresh = (): void => {
    wrap
      .querySelectorAll(`.${CLS_PREFIX}-tags__chip`)
      .forEach((el) => el.detach());
    for (const name of getNames()) {
      wrap.insertBefore(buildChip(name), input);
    }
  };
  refresh();

  return { refresh };
}

export const DEFAULT_SETTINGS: ISettings = {
  lang: "auto",
  theme: "wood",
  zoom: 80,
  fontSize: 12,
  showCoordinateLabels: true,
  showLastMove: true,
  showNextMove: true,
  showOtherVariations: true,
  showTurnBorder: true,
  autoJump: "auto",
  enableSpeech: true,
  showMovelist: true,
  boardMarginTop: 20,
  boardMarginBottom: 20,
  viewOnly: false,
  rotated: false,
  treeBlockNames: DEFAULT_TREE_BLOCK_NAMES,
  fenBlockNames: DEFAULT_FEN_BLOCK_NAMES,
  fenSaveBlockName: DEFAULT_TREE_BLOCK_NAMES[0],
  enableFileHost: true,
  pgnFileExtensions: ["pgn"],
  engineDepth: 18,
  engineSkillLevel: 20,
  showEngineBestMove: true,
  showEnginePonder: true,
  showEngineAnnotations: true,
  showBoardAnnotations: true,
  saveEvalByDefault: false,
  saveEvalPrompt: true,
};

function addSliderWithValue(
  containerEl: HTMLElement,
  name: string,
  desc: string,
  value: number,
  limits: { min: number; max: number; step: number },
  unit: string,
  onChange: (v: number) => void,
) {
  let currentValue = value;
  const setting = new Setting(containerEl).setName(name).setDesc(desc);

  const valueDisplay = createSpan({ cls: `${CLS_PREFIX}-setting-value` });
  valueDisplay.setText(`${currentValue}${unit}`);
  setting.controlEl.prepend(valueDisplay);

  setting.addSlider((slider) => {
    slider
      .setLimits(limits.min, limits.max, limits.step)
      .setValue(currentValue);
    slider.onChange((v) => {
      currentValue = v;
      valueDisplay.setText(`${v}${unit}`);
      onChange(v);
    });
    // 拖动时实时更新
    slider.sliderEl.addEventListener("input", () => {
      const v = slider.getValue();
      currentValue = v;
      valueDisplay.setText(`${v}${unit}`);
    });
  });

  return setting;
}

export class ChessSettingTab extends PluginSettingTab {
  plugin: ChessPlugin;

  constructor(app: App, plugin: ChessPlugin) {
    super(app, plugin);
    this.plugin = plugin;
  }

  // getSettingDefinitions(): SettingDefinitionItem[] {
  //   const settings = this.plugin.settings;
  //   return [
  //     {
  //       name: "Language / 语言",
  //       control: {
  //         type: "dropdown",
  //         key: "lang",
  //         options: { auto: "Auto/跟随软件", en: "English", zh: "中文" },
  //       },
  //     },
  //     {
  //       type: "group",
  //       heading: t("board.title"),
  //       items: [
  //         {
  //           name: t("board.theme"),
  //           desc: t("board.theme.desc"),
  //           control: {
  //             type: "dropdown",
  //             key: "theme",
  //             options: Object.fromEntries(
  //               THEME_KEYS.map((k) => [k, t(`theme.${k}`)]),
  //             ),
  //           },
  //         },
  //         {
  //           name: t("board.zoom"),
  //           desc: t("board.zoom.desc"),
  //           control: {
  //             type: "slider",
  //             key: "zoom",
  //             min: 0,
  //             max: 100,
  //             step: 1,
  //             displayFormat: (v) => `${v}%`,
  //           },
  //         },
  //         {
  //           name: t("board.coordinates"),
  //           desc: t("board.coordinates.desc"),
  //           control: { type: "toggle", key: "showCoordinateLabels" },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("game.title"),
  //       items: [
  //         {
  //           name: t("game.lastMove"),
  //           desc: t("game.lastMove.desc"),
  //           control: { type: "toggle", key: "showLastMove" },
  //         },
  //         {
  //           name: t("game.legalMoves"),
  //           desc: t("game.legalMoves.desc"),
  //           control: { type: "toggle", key: "showNextMove" },
  //         },
  //         {
  //           name: t("game.turnBorder"),
  //           desc: t("game.turnBorder.desc"),
  //           control: { type: "toggle", key: "showTurnBorder" },
  //         },
  //         {
  //           name: t("game.speech"),
  //           desc: t("game.speech.desc"),
  //           control: { type: "toggle", key: "enableSpeech" },
  //           visible: () => !!window.speechSynthesis,
  //         },
  //         {
  //           name: t("movelist.autoJump"),
  //           desc: t("movelist.autoJump.desc"),
  //           control: {
  //             type: "dropdown",
  //             key: "autoJump",
  //             options: {
  //               never: t("movelist.autoJump.never"),
  //               always: t("movelist.autoJump.always"),
  //               auto: t("movelist.autoJump.auto"),
  //             },
  //           },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("movelist.title"),
  //       items: [
  //         {
  //           name: t("movelist.show"),
  //           desc: t("movelist.show.desc"),
  //           control: { type: "toggle", key: "showMovelist" },
  //         },
  //         {
  //           name: t("movelist.fontSize"),
  //           desc: t("movelist.fontSize.desc"),
  //           control: {
  //             type: "slider",
  //             key: "fontSize",
  //             min: 10,
  //             max: 25,
  //             step: 1,
  //             displayFormat: (v) => `${v}px`,
  //           },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("engine.title"),
  //       items: [
  //         {
  //           name: t("engine.depth"),
  //           desc: t("engine.depth.desc"),
  //           control: {
  //             type: "slider",
  //             key: "engineDepth",
  //             min: 1,
  //             max: 30,
  //             step: 1,
  //           },
  //         },
  //         {
  //           name: t("engine.skillLevel"),
  //           desc: t("engine.skillLevel.desc"),
  //           control: {
  //             type: "slider",
  //             key: "engineSkillLevel",
  //             min: 0,
  //             max: 20,
  //             step: 1,
  //           },
  //         },
  //         {
  //           name: t("engine.showBestMove"),
  //           desc: t("engine.showBestMove.desc"),
  //           control: { type: "toggle", key: "showEngineBestMove" },
  //         },
  //         {
  //           name: t("engine.showPonder"),
  //           desc: t("engine.showPonder.desc"),
  //           control: { type: "toggle", key: "showEnginePonder" },
  //         },
  //         {
  //           name: t("engine.showEngineAnnotations"),
  //           desc: t("engine.showEngineAnnotations.desc"),
  //           control: { type: "toggle", key: "showEngineAnnotations" },
  //         },
  //         {
  //           name: t("engine.showBoardAnnotations"),
  //           desc: t("engine.showBoardAnnotations.desc"),
  //           control: { type: "toggle", key: "showBoardAnnotations" },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("save.title"),
  //       items: [
  //         {
  //           name: t("save.saveEval"),
  //           desc: t("save.saveEval.desc"),
  //           control: { type: "toggle", key: "saveEvalByDefault" },
  //         },
  //         {
  //           name: t("save.saveEvalPrompt"),
  //           desc: t("save.saveEvalPrompt.desc"),
  //           control: { type: "toggle", key: "saveEvalPrompt" },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("margin.title"),
  //       items: [
  //         {
  //           name: t("margin.top"),
  //           desc: t("margin.top.desc"),
  //           control: {
  //             type: "slider",
  //             key: "boardMarginTop",
  //             min: 0,
  //             max: 100,
  //             step: 1,
  //             displayFormat: (v) => `${v}px`,
  //           },
  //         },
  //         {
  //           name: t("margin.bottom"),
  //           desc: t("margin.bottom.desc"),
  //           control: {
  //             type: "slider",
  //             key: "boardMarginBottom",
  //             min: 0,
  //             max: 100,
  //             step: 1,
  //             displayFormat: (v) => `${v}px`,
  //           },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("settings.restartRequired.title"),
  //       desc: t("settings.restartRequired.desc"),
  //       items: [
  //         ...(
  //           [
  //             {
  //               key: "treeBlockNames" as const,
  //               i18n: "treeAliases",
  //               fallback: "chess, tree",
  //               defaults: ["chess", "tree"] as const,
  //             },
  //           ] as const
  //         ).flatMap((cfg): SettingGroupItem[] => {
  //           return [
  //             {
  //               name: t(`codeblock.${cfg.i18n}`),
  //               desc: t(`codeblock.${cfg.i18n}.desc`),
  //               render: (setting: Setting) => {
  //                 setting.addText((text) =>
  //                   text
  //                     .setValue(settings[cfg.key].join(", "))
  //                     .setPlaceholder(cfg.fallback)
  //                     .onChange((value) => {
  //                       const { valid, invalid } = parseAndValidateNames(value);
  //                       if (invalid.length) {
  //                         new Notice(
  //                           t("codeblock.invalidName").replace(
  //                             "{name}",
  //                             invalid[0],
  //                           ),
  //                         );
  //                         const input =
  //                           setting.controlEl.querySelector("input")!;
  //                         input.value = valid.length
  //                           ? valid.join(", ")
  //                           : cfg.fallback;
  //                       }
  //                       if (!valid.length) return;
  //                       settings[cfg.key] = valid;
  //                       void this.plugin.saveSettings();
  //                     }),
  //                 );
  //                 setting.addButton((button) =>
  //                   button.setIcon("rotate-ccw").onClick(() => {
  //                     settings[cfg.key] = [...cfg.defaults];
  //                     const input = setting.controlEl.querySelector("input")!;
  //                     input.value = cfg.fallback;
  //                     void this.plugin.saveSettings();
  //                   }),
  //                 );
  //               },
  //             },
  //           ];
  //         }),
  //         {
  //           name: t("codeblock.fenSaveBlockName"),
  //           desc: t("codeblock.fenSaveBlockName.desc"),
  //           control: {
  //             type: "dropdown",
  //             key: "fenSaveBlockName",
  //             options: Object.fromEntries(
  //               settings.treeBlockNames.map((n) => [n, n]),
  //             ),
  //           },
  //         },
  //       ],
  //     },
  //     {
  //       type: "group",
  //       heading: t("pgn.title"),
  //       items: [
  //         {
  //           name: t("pgn.enable"),
  //           desc: t("pgn.enable.desc"),
  //           control: { type: "toggle", key: "enableFileHost" },
  //         },
  //         {
  //           name: t("pgn.extensions"),
  //           desc: t("pgn.extensions.desc"),
  //           render: (setting: Setting) => {
  //             setting.addText((text) =>
  //               text
  //                 .setValue(settings.pgnFileExtensions.join(", "))
  //                 .setPlaceholder("pgn")
  //                 .onChange((value) => {
  //                   const { valid, invalid } = parseAndValidateNames(value);
  //                   if (invalid.length) {
  //                     new Notice(
  //                       t("codeblock.invalidName").replace(
  //                         "{name}",
  //                         invalid[0],
  //                       ),
  //                     );
  //                     const input = setting.controlEl.querySelector("input")!;
  //                     input.value = valid.length ? valid.join(", ") : "pgn";
  //                   }
  //                   if (!valid.length) return;
  //                   settings.pgnFileExtensions = valid;
  //                   void this.plugin.saveSettings();
  //                 }),
  //             );
  //             setting.addButton((button) =>
  //               button.setIcon("rotate-ccw").onClick(() => {
  //                 settings.pgnFileExtensions = ["pgn"];
  //                 const input = setting.controlEl.querySelector("input")!;
  //                 input.value = "pgn";
  //                 void this.plugin.saveSettings();
  //               }),
  //             );
  //           },
  //         },
  //       ],
  //     },
  //   ];
  // }

  // override setControlValue(key: string, value: unknown): void | Promise<void> {
  //   if (!(key in DEFAULT_SETTINGS)) return;
  //   (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
  //   void this.plugin.saveSettings();
  //   if (key === "lang" && typeof value === "string") {
  //     initI18n(value);
  //     this.update();
  //   }
  //   if (
  //     [
  //       "theme",
  //       "zoom",
  //       "showLastMove",
  //       "showNextMove",
  //       "showTurnBorder",
  //       "showMovelist",
  //       "fontSize",
  //       "boardMarginTop",
  //       "boardMarginBottom",
  //       "showEngineBestMove",
  //       "showEnginePonder",
  //       "showEngineAnnotations",
  //       "showBoardAnnotations",
  //     ].includes(key)
  //   ) {
  //     this.plugin.refresh();
  //   }
  // }

  display(): void {
    const settings = this.plugin.settings;
    const { containerEl } = this;
    containerEl.empty();

    new Setting(containerEl).setName("Language / 语言").addDropdown((d) =>
      d
        .addOptions({ auto: "Auto/跟随软件", en: "English", zh: "中文" })
        .setValue(settings.lang)
        .onChange((v) => {
          settings.lang = v as ISettings["lang"];
          initI18n(v);
          this.display();
        }),
    );

    // ==================== 棋盘外观 ====================
    new Setting(containerEl).setName(t("board.title")).setHeading();

    new Setting(containerEl)
      .setName(t("board.theme"))
      .setDesc(t("board.theme.desc"))
      .addDropdown((dropdown) => {
        dropdown.addOptions(
          Object.fromEntries(
            THEME_KEYS.map((k) => [k, getThemeDisplayName(k, getLang())]),
          ),
        );
        dropdown.setValue(settings.theme).onChange((theme) => {
          settings.theme = theme;
          this.plugin.refresh();
        });
      });

    addSliderWithValue(
      containerEl,
      t("board.zoom"),
      t("board.zoom.desc"),
      settings.zoom,
      { min: 0, max: 100, step: 1 },
      "%",
      (v) => {
        settings.zoom = v;
        this.plugin.refresh();
      },
    );

    new Setting(containerEl)
      .setName(t("board.coordinates"))
      .setDesc(t("board.coordinates.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showCoordinateLabels).onChange((value) => {
          settings.showCoordinateLabels = value;
        }),
      );

    // ==================== 对局提示 ====================
    new Setting(containerEl).setName(t("game.title")).setHeading();

    new Setting(containerEl)
      .setName(t("game.lastMove"))
      .setDesc(t("game.lastMove.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showLastMove).onChange((value) => {
          settings.showLastMove = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t("game.legalMoves"))
      .setDesc(t("game.legalMoves.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showNextMove).onChange((value) => {
          settings.showNextMove = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t("game.otherVariations"))
      .setDesc(t("game.otherVariations.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showOtherVariations).onChange((value) => {
          settings.showOtherVariations = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t("game.turnBorder"))
      .setDesc(t("game.turnBorder.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showTurnBorder).onChange((value) => {
          settings.showTurnBorder = value;
          this.plugin.refresh();
        }),
      );

    if (window.speechSynthesis) {
      new Setting(containerEl)
        .setName(t("game.speech"))
        .setDesc(t("game.speech.desc"))
        .addToggle((toggle) =>
          toggle.setValue(settings.enableSpeech).onChange((value) => {
            settings.enableSpeech = value;
          }),
        );
    }

    new Setting(containerEl)
      .setName(t("movelist.autoJump"))
      .setDesc(t("movelist.autoJump.desc"))
      .addDropdown((dropdown) => {
        dropdown
          .addOptions({
            never: t("movelist.autoJump.never"),
            always: t("movelist.autoJump.always"),
            auto: t("movelist.autoJump.auto"),
          })
          .setValue(settings.autoJump)
          .onChange(async (value) => {
            settings.autoJump = value as "never" | "always" | "auto";
          });
      });

    // ==================== 着法列表 ====================
    new Setting(containerEl).setName(t("movelist.title")).setHeading();

    new Setting(containerEl)
      .setName(t("movelist.show"))
      .setDesc(t("movelist.show.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showMovelist).onChange((value) => {
          settings.showMovelist = value;
          this.plugin.refresh();
        }),
      );

    addSliderWithValue(
      containerEl,
      t("movelist.fontSize"),
      t("movelist.fontSize.desc"),
      settings.fontSize,
      { min: 10, max: 25, step: 1 },
      "px",
      (v) => {
        settings.fontSize = v;
        this.plugin.refresh();
      },
    );

    // ---- 引擎 ----
    new Setting(containerEl).setName(t("engine.title")).setHeading();

    addSliderWithValue(
      containerEl,
      t("engine.depth"),
      t("engine.depth.desc"),
      settings.engineDepth,
      { min: 1, max: 30, step: 1 },
      "",
      (v) => {
        settings.engineDepth = v;
        void this.plugin.saveSettings();
      },
    );

    addSliderWithValue(
      containerEl,
      t("engine.skillLevel"),
      t("engine.skillLevel.desc"),
      settings.engineSkillLevel,
      { min: 0, max: 20, step: 1 },
      "",
      (v) => {
        settings.engineSkillLevel = v;
        void this.plugin.saveSettings();
      },
    );

    new Setting(containerEl)
      .setName(t("engine.showBestMove"))
      .setDesc(t("engine.showBestMove.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showEngineBestMove).onChange((value) => {
          settings.showEngineBestMove = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t("engine.showPonder"))
      .setDesc(t("engine.showPonder.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showEnginePonder).onChange((value) => {
          settings.showEnginePonder = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t("engine.showEngineAnnotations"))
      .setDesc(t("engine.showEngineAnnotations.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showEngineAnnotations).onChange((value) => {
          settings.showEngineAnnotations = value;
          this.plugin.refresh();
        }),
      );

    new Setting(containerEl)
      .setName(t("engine.showBoardAnnotations"))
      .setDesc(t("engine.showBoardAnnotations.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.showBoardAnnotations).onChange((value) => {
          settings.showBoardAnnotations = value;
          this.plugin.refresh();
        }),
      );

    // ---- 保存 ----
    new Setting(containerEl).setName(t("save.title")).setHeading();

    new Setting(containerEl)
      .setName(t("save.saveEval"))
      .setDesc(t("save.saveEval.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.saveEvalByDefault).onChange((value) => {
          settings.saveEvalByDefault = value;
          void this.plugin.saveSettings();
        }),
      );

    new Setting(containerEl)
      .setName(t("save.saveEvalPrompt"))
      .setDesc(t("save.saveEvalPrompt.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.saveEvalPrompt).onChange((value) => {
          settings.saveEvalPrompt = value;
          void this.plugin.saveSettings();
        }),
      );

    // ---- 边距 ----
    new Setting(containerEl).setName(t("margin.title")).setHeading();

    addSliderWithValue(
      containerEl,
      t("margin.top"),
      t("margin.top.desc"),
      settings.boardMarginTop,
      { min: 0, max: 100, step: 1 },
      "px",
      (v) => {
        settings.boardMarginTop = v;
        this.plugin.refresh();
      },
    );

    addSliderWithValue(
      containerEl,
      t("margin.bottom"),
      t("margin.bottom.desc"),
      settings.boardMarginBottom,
      { min: 0, max: 100, step: 1 },
      "px",
      (v) => {
        settings.boardMarginBottom = v;
        this.plugin.refresh();
      },
    );

    // ==================== 重启后生效的设置 ====================
    new Setting(containerEl)
      .setName(t("settings.restartRequired.title"))
      .setDesc(t("settings.restartRequired.desc"))
      .setHeading();

    // ---- 代码块名称 ----
    new Setting(containerEl).setName(t("codeblock.title")).setHeading();

    // FEN-save dropdown options follow the tree aliases; rebuilt whenever
    // the tree tag list changes.
    let fenSaveSelect: HTMLSelectElement | null = null;
    const renderFenSaveOptions = (): void => {
      if (!fenSaveSelect) return;
      fenSaveSelect.innerHTML = "";
      for (const name of settings.treeBlockNames) {
        fenSaveSelect.add(new Option(name, name));
      }
      if (!settings.treeBlockNames.includes(settings.fenSaveBlockName)) {
        settings.fenSaveBlockName = settings.treeBlockNames[0];
      }
      fenSaveSelect.value = settings.fenSaveBlockName;
    };

    const treeSetting = new Setting(containerEl)
      .setName(t("codeblock.treeAliases"))
      .setDesc(
        t("codeblock.treeAliases.desc") +
          " " +
          t("settings.defaultSuffix").replace(
            "{names}",
            DEFAULT_TREE_BLOCK_NAMES.join(", "),
          ),
      );
    const treeTags = addTagInput(
      treeSetting,
      () => settings.treeBlockNames,
      (names) => {
        settings.treeBlockNames = names;
        if (!names.includes(settings.fenSaveBlockName)) {
          settings.fenSaveBlockName = names[0];
        }
        renderFenSaveOptions();
        void this.plugin.saveSettings();
      },
    );
    treeSetting.addButton((button) =>
      button.setIcon("rotate-ccw").onClick(() => {
        settings.treeBlockNames = [...DEFAULT_TREE_BLOCK_NAMES];
        if (!settings.treeBlockNames.includes(settings.fenSaveBlockName)) {
          settings.fenSaveBlockName = settings.treeBlockNames[0];
        }
        renderFenSaveOptions();
        treeTags.refresh();
        void this.plugin.saveSettings();
      }),
    );

    const fenSetting = new Setting(containerEl)
      .setName(t("codeblock.fenAliases"))
      .setDesc(
        t("codeblock.fenAliases.desc") +
          " " +
          t("settings.defaultSuffix").replace(
            "{names}",
            DEFAULT_FEN_BLOCK_NAMES.join(", "),
          ),
      );
    const fenTags = addTagInput(
      fenSetting,
      () => settings.fenBlockNames,
      (names) => {
        settings.fenBlockNames = names;
        void this.plugin.saveSettings();
      },
    );
    fenSetting.addButton((button) =>
      button.setIcon("rotate-ccw").onClick(() => {
        settings.fenBlockNames = [...DEFAULT_FEN_BLOCK_NAMES];
        fenTags.refresh();
        void this.plugin.saveSettings();
      }),
    );

    new Setting(containerEl)
      .setName(t("codeblock.fenSaveBlockName"))
      .setDesc(t("codeblock.fenSaveBlockName.desc"))
      .addDropdown((dropdown) => {
        fenSaveSelect = dropdown.selectEl;
        renderFenSaveOptions();
        dropdown.onChange((value) => {
          settings.fenSaveBlockName = value;
          void this.plugin.saveSettings();
        });
      });

    // ---- PGN 文件视图 ----
    new Setting(containerEl).setName(t("pgn.title")).setHeading();

    new Setting(containerEl)
      .setName(t("pgn.enable"))
      .setDesc(t("pgn.enable.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.enableFileHost).onChange((value) => {
          settings.enableFileHost = value;
          void this.plugin.saveSettings();
        }),
      );

    const pgnExtSetting = new Setting(containerEl)
      .setName(t("pgn.extensions"))
      .setDesc(
        t("pgn.extensions.desc") +
          " " +
          t("settings.defaultSuffix").replace("{names}", "pgn"),
      );
    const pgnExtTags = addTagInput(
      pgnExtSetting,
      () => settings.pgnFileExtensions,
      (names) => {
        settings.pgnFileExtensions = names;
        void this.plugin.saveSettings();
      },
    );
    pgnExtSetting.addButton((button) =>
      button.setIcon("rotate-ccw").onClick(() => {
        settings.pgnFileExtensions = ["pgn"];
        pgnExtTags.refresh();
        void this.plugin.saveSettings();
      }),
    );

    containerEl.parentElement?.classList.add(`${CLS_PREFIX}-settings`);
  }

  hide(): void {
    this.plugin.refresh();
    void this.plugin.saveSettings();
  }
}
