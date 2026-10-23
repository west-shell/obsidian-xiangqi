import { t } from "../../../i18n";

export function formatResult(raw: string, v: number): string {
  if (!raw || raw === "*") return "-";
  if (raw === "1-0") return t("game.win", v);
  if (raw === "0-1") return t("game.loss", v);
  if (raw === "1/2-1/2") return t("game.draw", v);
  return raw;
}
