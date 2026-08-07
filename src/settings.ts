import "./style/settings.css";

import {
  type App,
  Notice,
  PluginSettingTab,
  Setting,
  type SettingDefinitionItem,
  type SettingGroupItem,
} from "obsidian";

import { initI18n, t } from "./i18n";
import type ChessPlugin from "./main";
import { THEME_KEYS } from "./themes";
import type { ISettings } from "./types";

const VALID_NAME_RE = /^[a-z0-9-]+$/;

function parseAndValidateNames(value: string): {
  valid: string[];
  invalid: string[];
} {
  const parsed = value
    .split(",")
    .map((s) => s.trim().toLowerCase())
    .filter(Boolean);
  const valid: string[] = [];
  const invalid: string[] = [];
  for (const name of parsed) {
    if (VALID_NAME_RE.test(name)) {
      valid.push(name);
    } else {
      invalid.push(name);
    }
  }
  return { valid, invalid };
}

export const DEFAULT_SETTINGS: ISettings = {
  lang: "auto",
  theme: "wood",
  zoom: 80,
  fontSize: 12,
  showCoordinateLabels: true,
  showLastMove: true,
  showNextMove: true,
  showTurnBorder: true,
  autoJump: "auto",
  enableSpeech: true,
  showMovelist: true,
  boardMarginTop: 20,
  boardMarginBottom: 20,
  viewOnly: false,
  rotated: false,
  treeBlockNames: ["xiangqi", "tree"],
  fenBlockNames: ["fen", "xq"],
  fenSaveBlockName: "tree",
  enablePGNView: true,
  pgnFileExtensions: ["pgn"],
  engineDepth: 18,
  engineSkillLevel: 20,
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

  const valueDisplay = createSpan({ cls: "ws-slider-value" });
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

  getSettingDefinitions(): SettingDefinitionItem[] {
    const settings = this.plugin.settings;
    return [
      {
        name: "Language / 语言",
        control: {
          type: "dropdown",
          key: "lang",
          options: { auto: "Auto/跟随软件", en: "English", zh: "中文" },
        },
      },
      {
        type: "group",
        heading: t("board.title"),
        items: [
          {
            name: t("board.theme"),
            desc: t("board.theme.desc"),
            control: {
              type: "dropdown",
              key: "theme",
              options: Object.fromEntries(
                THEME_KEYS.map((k) => [k, t(`theme.${k}`)]),
              ),
            },
          },
          {
            name: t("board.zoom"),
            desc: t("board.zoom.desc"),
            control: {
              type: "slider",
              key: "zoom",
              min: 0,
              max: 100,
              step: 1,
              displayFormat: (v) => `${v}%`,
            },
          },
          {
            name: t("board.coordinates"),
            desc: t("board.coordinates.desc"),
            control: { type: "toggle", key: "showCoordinateLabels" },
          },
        ],
      },
      {
        type: "group",
        heading: t("game.title"),
        items: [
          {
            name: t("game.lastMove"),
            desc: t("game.lastMove.desc"),
            control: { type: "toggle", key: "showLastMove" },
          },
          {
            name: t("game.legalMoves"),
            desc: t("game.legalMoves.desc"),
            control: { type: "toggle", key: "showNextMove" },
          },
          {
            name: t("game.turnBorder"),
            desc: t("game.turnBorder.desc"),
            control: { type: "toggle", key: "showTurnBorder" },
          },
          {
            name: t("game.speech"),
            desc: t("game.speech.desc"),
            control: { type: "toggle", key: "enableSpeech" },
            visible: () => !!window.speechSynthesis,
          },
        ],
      },
      {
        type: "group",
        heading: t("movelist.title"),
        items: [
          {
            name: t("movelist.show"),
            desc: t("movelist.show.desc"),
            control: { type: "toggle", key: "showMovelist" },
          },
          {
            name: t("movelist.fontSize"),
            desc: t("movelist.fontSize.desc"),
            control: {
              type: "slider",
              key: "fontSize",
              min: 10,
              max: 25,
              step: 1,
              displayFormat: (v) => `${v}px`,
            },
          },
          {
            name: t("movelist.autoJump"),
            desc: t("movelist.autoJump.desc"),
            control: {
              type: "dropdown",
              key: "autoJump",
              options: {
                never: t("movelist.autoJump.never"),
                always: t("movelist.autoJump.always"),
                auto: t("movelist.autoJump.auto"),
              },
            },
          },
        ],
      },
      {
        type: "group",
        heading: t("engine.title"),
        items: [
          {
            name: t("engine.depth"),
            desc: t("engine.depth.desc"),
            control: {
              type: "slider",
              key: "engineDepth",
              min: 1,
              max: 30,
              step: 1,
            },
          },
          {
            name: t("engine.skillLevel"),
            desc: t("engine.skillLevel.desc"),
            control: {
              type: "slider",
              key: "engineSkillLevel",
              min: 0,
              max: 20,
              step: 1,
            },
          },
        ],
      },
      {
        type: "group",
        heading: t("save.title"),
        items: [
          {
            name: t("save.saveEval"),
            desc: t("save.saveEval.desc"),
            control: { type: "toggle", key: "saveEvalByDefault" },
          },
          {
            name: t("save.saveEvalPrompt"),
            desc: t("save.saveEvalPrompt.desc"),
            control: { type: "toggle", key: "saveEvalPrompt" },
          },
        ],
      },
      {
        type: "group",
        heading: t("margin.title"),
        items: [
          {
            name: t("margin.top"),
            desc: t("margin.top.desc"),
            control: {
              type: "slider",
              key: "boardMarginTop",
              min: 0,
              max: 100,
              step: 1,
              displayFormat: (v) => `${v}px`,
            },
          },
          {
            name: t("margin.bottom"),
            desc: t("margin.bottom.desc"),
            control: {
              type: "slider",
              key: "boardMarginBottom",
              min: 0,
              max: 100,
              step: 1,
              displayFormat: (v) => `${v}px`,
            },
          },
        ],
      },
      {
        type: "group",
        heading: t("settings.restartRequired.title"),
        desc: t("settings.restartRequired.desc"),
        items: [
          ...(
            [
              {
                key: "treeBlockNames" as const,
                i18n: "treeAliases",
                fallback: "xiangqi, tree",
                defaults: ["xiangqi", "tree"] as const,
              },
              {
                key: "fenBlockNames" as const,
                i18n: "fenAliases",
                fallback: "fen, xq",
                defaults: ["fen", "xq"] as const,
              },
            ] as const
          ).flatMap((cfg): SettingGroupItem[] => {
            return [
              {
                name: t(`codeblock.${cfg.i18n}`),
                desc: t(`codeblock.${cfg.i18n}.desc`),
                render: (setting: Setting) => {
                  setting.addText((text) =>
                    text
                      .setValue(settings[cfg.key].join(", "))
                      .setPlaceholder(cfg.fallback)
                      .onChange((value) => {
                        const { valid, invalid } = parseAndValidateNames(value);
                        if (invalid.length) {
                          new Notice(
                            t("codeblock.invalidName").replace(
                              "{name}",
                              invalid[0],
                            ),
                          );
                          const input =
                            setting.controlEl.querySelector("input")!;
                          input.value = valid.length
                            ? valid.join(", ")
                            : cfg.fallback;
                        }
                        if (!valid.length) return;
                        settings[cfg.key] = valid;
                        void this.plugin.saveSettings();
                      }),
                  );
                  setting.addButton((button) =>
                    button.setIcon("rotate-ccw").onClick(() => {
                      settings[cfg.key] = [...cfg.defaults];
                      const input = setting.controlEl.querySelector("input")!;
                      input.value = cfg.fallback;
                      void this.plugin.saveSettings();
                    }),
                  );
                },
              },
            ];
          }),
          {
            name: t("codeblock.fenSaveBlockName"),
            desc: t("codeblock.fenSaveBlockName.desc"),
            render: (setting: Setting) => {
              setting.addDropdown((dropdown) => {
                for (const name of settings.treeBlockNames) {
                  dropdown.addOption(name, name);
                }
                dropdown.setValue(settings.fenSaveBlockName);
                dropdown.onChange((value) => {
                  settings.fenSaveBlockName = value;
                  void this.plugin.saveSettings();
                });
              });
            },
          },
        ],
      },
      {
        type: "group",
        heading: t("pgn.title"),
        items: [
          {
            name: t("pgn.enable"),
            desc: t("pgn.enable.desc"),
            control: { type: "toggle", key: "enablePGNView" },
          },
          {
            name: t("pgn.extensions"),
            desc: t("pgn.extensions.desc"),
            render: (setting: Setting) => {
              setting.addText((text) =>
                text
                  .setValue(settings.pgnFileExtensions.join(", "))
                  .setPlaceholder("pgn")
                  .onChange((value) => {
                    const { valid, invalid } = parseAndValidateNames(value);
                    if (invalid.length) {
                      new Notice(
                        t("codeblock.invalidName").replace(
                          "{name}",
                          invalid[0],
                        ),
                      );
                      const input = setting.controlEl.querySelector("input")!;
                      input.value = valid.length ? valid.join(", ") : "pgn";
                    }
                    if (!valid.length) return;
                    settings.pgnFileExtensions = valid;
                    void this.plugin.saveSettings();
                  }),
              );
              setting.addButton((button) =>
                button.setIcon("rotate-ccw").onClick(() => {
                  settings.pgnFileExtensions = ["pgn"];
                  const input = setting.controlEl.querySelector("input")!;
                  input.value = "pgn";
                  void this.plugin.saveSettings();
                }),
              );
            },
          },
        ],
      },
    ];
  }

  override setControlValue(key: string, value: unknown): void | Promise<void> {
    (this.plugin.settings as unknown as Record<string, unknown>)[key] = value;
    void this.plugin.saveSettings();
    if (
      [
        "theme",
        "zoom",
        "showLastMove",
        "showNextMove",
        "showTurnBorder",
        "showMovelist",
        "fontSize",
        "boardMarginTop",
        "boardMarginBottom",
      ].includes(key)
    ) {
      this.plugin.refresh();
    }
  }

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

    new Setting(containerEl).setName(t("board.title")).setHeading();

    new Setting(containerEl)
      .setName(t("board.theme"))
      .setDesc(t("board.theme.desc"))
      .addDropdown((dropdown) => {
        dropdown.addOptions(
          Object.fromEntries(THEME_KEYS.map((k) => [k, t(`theme.${k}`)])),
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

    new Setting(containerEl)
      .setName(t("settings.restartRequired.title"))
      .setDesc(t("settings.restartRequired.desc"))
      .setHeading();

    new Setting(containerEl).setName(t("codeblock.title")).setHeading();

    const treeSetting = new Setting(containerEl)
      .setName(t("codeblock.treeAliases"))
      .setDesc(t("codeblock.treeAliases.desc") + " (默认: xiangqi, tree)")
      .addText((text) =>
        text.setValue(settings.treeBlockNames.join(", ")).onChange((value) => {
          const { valid, invalid } = parseAndValidateNames(value);
          if (invalid.length) {
            new Notice(
              t("codeblock.invalidName").replace("{name}", invalid[0]),
            );
            const input = treeSetting.controlEl.querySelector("input")!;
            input.value = valid.length ? valid.join(", ") : "xiangqi, tree";
          }
          if (!valid.length) return;
          settings.treeBlockNames = valid;
          void this.plugin.saveSettings();
        }),
      )
      .addButton((button) =>
        button.setIcon("rotate-ccw").onClick(() => {
          settings.treeBlockNames = ["xiangqi", "tree"];
          treeSetting.controlEl.querySelector("input")!.value = "xiangqi, tree";
          void this.plugin.saveSettings();
        }),
      );

    const fenSetting = new Setting(containerEl)
      .setName(t("codeblock.fenAliases"))
      .setDesc(t("codeblock.fenAliases.desc") + " (默认: fen, xq)")
      .addText((text) =>
        text.setValue(settings.fenBlockNames.join(", ")).onChange((value) => {
          const { valid, invalid } = parseAndValidateNames(value);
          if (invalid.length) {
            new Notice(
              t("codeblock.invalidName").replace("{name}", invalid[0]),
            );
            const input = fenSetting.controlEl.querySelector("input")!;
            input.value = valid.length ? valid.join(", ") : "fen, xq";
          }
          if (!valid.length) return;
          settings.fenBlockNames = valid;
          void this.plugin.saveSettings();
        }),
      )
      .addButton((button) =>
        button.setIcon("rotate-ccw").onClick(() => {
          settings.fenBlockNames = ["fen", "xq"];
          fenSetting.controlEl.querySelector("input")!.value = "fen, xq";
          void this.plugin.saveSettings();
        }),
      );

    // ---- PGN 文件视图 ----

    new Setting(containerEl).setName(t("pgn.title")).setHeading();

    new Setting(containerEl)
      .setName(t("pgn.enable"))
      .setDesc(t("pgn.enable.desc"))
      .addToggle((toggle) =>
        toggle.setValue(settings.enablePGNView).onChange((value) => {
          settings.enablePGNView = value;
          void this.plugin.saveSettings();
        }),
      );

    const pgnExtSetting = new Setting(containerEl)
      .setName(t("pgn.extensions"))
      .setDesc(t("pgn.extensions.desc") + " (默认: pgn)")
      .addText((text) =>
        text
          .setValue(settings.pgnFileExtensions.join(", "))
          .onChange((value) => {
            const { valid, invalid } = parseAndValidateNames(value);
            if (invalid.length) {
              new Notice(
                t("codeblock.invalidName").replace("{name}", invalid[0]),
              );
              const input = pgnExtSetting.controlEl.querySelector("input")!;
              input.value = valid.length ? valid.join(", ") : "pgn";
            }
            if (!valid.length) return;
            settings.pgnFileExtensions = valid;
            void this.plugin.saveSettings();
          }),
      )
      .addButton((button) =>
        button.setIcon("rotate-ccw").onClick(() => {
          settings.pgnFileExtensions = ["pgn"];
          pgnExtSetting.controlEl.querySelector("input")!.value = "pgn";
          void this.plugin.saveSettings();
        }),
      );

    containerEl.parentElement?.classList.add("ws-setting-tab");
  }

  hide() {
    this.plugin.refresh();
    void this.plugin.saveSettings();
  }
}
