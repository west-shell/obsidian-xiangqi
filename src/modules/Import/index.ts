import type { IHost } from "../../types";
import { ImportModal } from "./ImportModal";
import { isFileHost } from "../Actions/shared";

export const ImportModule = {
  init(host: IHost) {
    host.eventBus.on("import", () => {
      const modal = new ImportModal(host.plugin.app, host, !isFileHost(host));
      modal.open();
    });
  },
};
