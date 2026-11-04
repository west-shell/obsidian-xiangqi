import { CLS_PREFIX } from "../../chess";
import { Modal } from "obsidian";
import { t } from "../../i18n";
import type { IHost } from "../../types";

export const EngineSettingsModule = {
  init(host: IHost) {
    const eventBus = host.eventBus;

    eventBus.on("open-engine-settings", () => {
      const engineModal = new Modal(host.plugin.app);
      let depthValue = host.settings.engineDepth;
      let skillValue = host.settings.engineSkillLevel;
      let intervalValue = host.settings.engineSimInterval;
      let showBestMove = host.settings.showEngineBestMove;
      let showPonder = host.settings.showEnginePonder;
      let showEngineAnn = host.settings.showEngineAnnotations;
      let showGhosts = host.settings.showEngineGhosts;
      let ghostLinesValue = host.settings.engineGhostLines;
      let ghostDepthValue = host.settings.engineGhostDepth;

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

        contentEl.createEl("label", { text: t("engine.simInterval") });
        const intervalSlider = contentEl.createEl("input", { type: "range" });
        intervalSlider.setAttribute("min", "0.1");
        intervalSlider.setAttribute("max", "10");
        intervalSlider.setAttribute("step", "0.1");
        intervalSlider.value = String(intervalValue);
        const intervalLabel = contentEl.createDiv({
          text: `${intervalValue}s`,
          cls: `${CLS_PREFIX}-range-value`,
        });
        intervalSlider.addEventListener("input", () => {
          intervalValue = Number.parseFloat(intervalSlider.value) || 1;
          intervalLabel.textContent = `${intervalValue}s`;
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

        const ghostContainer = contentEl.createDiv(
          `${CLS_PREFIX}-engine-toggle`,
        );
        const ghostToggle = ghostContainer.createEl("input", {
          type: "checkbox",
        });
        ghostToggle.checked = showGhosts;
        ghostContainer.createEl("label", { text: t("engine.showGhosts") });
        ghostToggle.addEventListener("change", () => {
          showGhosts = ghostToggle.checked;
        });

        contentEl.createEl("label", { text: t("engine.ghostLines") });
        const ghostLinesSlider = contentEl.createEl("input", {
          type: "range",
        });
        ghostLinesSlider.setAttribute("min", "1");
        ghostLinesSlider.setAttribute("max", "5");
        ghostLinesSlider.setAttribute("step", "1");
        ghostLinesSlider.value = String(ghostLinesValue);
        const ghostLinesLabel = contentEl.createDiv({
          text: String(ghostLinesValue),
          cls: `${CLS_PREFIX}-range-value`,
        });
        ghostLinesSlider.addEventListener("input", () => {
          ghostLinesValue = Number.parseInt(ghostLinesSlider.value) || 3;
          ghostLinesLabel.textContent = String(ghostLinesValue);
        });

        contentEl.createEl("label", { text: t("engine.ghostDepth") });
        const ghostDepthSlider = contentEl.createEl("input", {
          type: "range",
        });
        ghostDepthSlider.setAttribute("min", "1");
        ghostDepthSlider.setAttribute("max", "20");
        ghostDepthSlider.setAttribute("step", "1");
        ghostDepthSlider.value = String(ghostDepthValue);
        const ghostDepthLabel = contentEl.createDiv({
          text: String(ghostDepthValue),
          cls: `${CLS_PREFIX}-range-value`,
        });
        ghostDepthSlider.addEventListener("input", () => {
          ghostDepthValue = Number.parseInt(ghostDepthSlider.value) || 10;
          ghostDepthLabel.textContent = String(ghostDepthValue);
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
          if (intervalValue >= 0.1 && intervalValue <= 10) {
            host.settings.engineSimInterval = intervalValue;
          }
          host.settings.showEngineBestMove = showBestMove;
          host.settings.showEnginePonder = showPonder;
          host.settings.showEngineAnnotations = showEngineAnn;
          host.settings.showEngineGhosts = showGhosts;
          if (ghostLinesValue >= 1 && ghostLinesValue <= 5) {
            host.settings.engineGhostLines = ghostLinesValue;
          }
          if (ghostDepthValue >= 1 && ghostDepthValue <= 20) {
            host.settings.engineGhostDepth = ghostDepthValue;
          }
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
