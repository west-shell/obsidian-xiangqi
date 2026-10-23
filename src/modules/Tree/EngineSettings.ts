import { CLS_PREFIX } from "../../chess";
import { Modal } from "obsidian";
import {
  registerBlockModule,
  registerFileModule,
} from "../../core/module-system";
import { t } from "../../i18n";
import type { IHost } from "../../types";

const EngineSettingsModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on("open-engine-settings", () => {
      const engineModal = new Modal(host.plugin.app);
      let depthValue = host.settings.engineDepth;
      let skillValue = host.settings.engineSkillLevel;
      let showBestMove = host.settings.showEngineBestMove;
      let showPonder = host.settings.showEnginePonder;
      let showEngineAnn = host.settings.showEngineAnnotations;

      engineModal.onOpen = () => {
        const { contentEl } = engineModal;
        contentEl.createEl("h3", { text: t("engine.title") });

        contentEl.createEl("label", { text: t("engine.depth") });
        const depthSlider = contentEl.createEl("input", { type: "range" });
        depthSlider.setAttribute("min", "1");
        depthSlider.setAttribute("max", "30");
        depthSlider.setAttribute("step", "1");
        depthSlider.value = String(depthValue);
        const depthLabel = contentEl.createDiv({
          text: String(depthValue),
          cls: `${CLS_PREFIX}-range-value`,
        });
        depthSlider.addEventListener("input", () => {
          depthValue = Number.parseInt(depthSlider.value) || 18;
          depthLabel.textContent = String(depthValue);
        });

        contentEl.createEl("label", { text: t("engine.skillLevel") });
        const skillSlider = contentEl.createEl("input", { type: "range" });
        skillSlider.setAttribute("min", "0");
        skillSlider.setAttribute("max", "20");
        skillSlider.setAttribute("step", "1");
        skillSlider.value = String(skillValue);
        const skillLabel = contentEl.createDiv({
          text: String(skillValue),
          cls: `${CLS_PREFIX}-range-value`,
        });
        skillSlider.addEventListener("input", () => {
          skillValue = Number.parseInt(skillSlider.value) || 20;
          skillLabel.textContent = String(skillValue);
        });

        const bmContainer = contentEl.createDiv(`${CLS_PREFIX}-engine-toggle`);
        const bmToggle = bmContainer.createEl("input", { type: "checkbox" });
        bmToggle.checked = showBestMove;
        bmContainer.createEl("label", { text: t("engine.showBestMove") });
        bmToggle.addEventListener("change", () => {
          showBestMove = bmToggle.checked;
        });

        const ponderContainer = contentEl.createDiv(
          `${CLS_PREFIX}-engine-toggle`,
        );
        const ponderToggle = ponderContainer.createEl("input", {
          type: "checkbox",
        });
        ponderToggle.checked = showPonder;
        ponderContainer.createEl("label", { text: t("engine.showPonder") });
        ponderToggle.addEventListener("change", () => {
          showPonder = ponderToggle.checked;
        });

        const engineAnnContainer = contentEl.createDiv(
          `${CLS_PREFIX}-engine-toggle`,
        );
        const engineAnnToggle = engineAnnContainer.createEl("input", {
          type: "checkbox",
        });
        engineAnnToggle.checked = showEngineAnn;
        engineAnnContainer.createEl("label", {
          text: t("engine.showEngineAnnotations"),
        });
        engineAnnToggle.addEventListener("change", () => {
          showEngineAnn = engineAnnToggle.checked;
        });

        const btnContainer = contentEl.createDiv("modal-button-container");
        const okBtn = btnContainer.createEl("button", {
          text: t("confirm.yes"),
          cls: "mod-cta",
        });
        okBtn.addEventListener("click", () => {
          if (depthValue >= 1 && depthValue <= 30) {
            host.settings.engineDepth = depthValue;
          }
          if (skillValue >= 0 && skillValue <= 20) {
            host.settings.engineSkillLevel = skillValue;
          }
          host.settings.showEngineBestMove = showBestMove;
          host.settings.showEnginePonder = showPonder;
          host.settings.showEngineAnnotations = showEngineAnn;
          void host.plugin.saveSettings();
          host.plugin.refresh();
          engineModal.close();
        });
        const cancelBtn = btnContainer.createEl("button", {
          text: t("confirm.cancel"),
        });
        cancelBtn.addEventListener("click", () => engineModal.close());
      };
      engineModal.onClose = () => {
        (engineModal as { contentEl: HTMLElement }).contentEl.empty();
      };
      engineModal.open();
    });
  },
};

registerFileModule("engineSettings", EngineSettingsModule);
registerBlockModule("engineSettings", EngineSettingsModule);
