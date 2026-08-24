import { DownloadModal } from "../../utils/confirmModal";
import { requestUrl } from "obsidian";
import { t } from "../../i18n";
import { BaseEngine, type EngineResult } from "./BaseEngine";

export type { EngineResult };

const BASE_GITHUB =
  "https://raw.githubusercontent.com/west-shell/obsidian-xiangqi/main/assets/pikafish";
const BASE_GITEE_RELEASE =
  "https://gitee.com/wesnell/obsidian-xiangqi/releases/download/pikafish";
const ENGINE_FILES = ["pikafish.js", "pikafish.wasm", "pikafish.data"] as const;

interface DownloadSource {
  key: string;
  label: string;
  getUrl: (file: string) => string;
}

const DOWNLOAD_SOURCES: DownloadSource[] = [
  {
    key: "github",
    label: "GitHub",
    getUrl: (file) => `${BASE_GITHUB}/${file}`,
  },
  {
    key: "gitee",
    label: "Gitee",
    getUrl: (file) => `${BASE_GITEE_RELEASE}/${file}`,
  },
];

export class XiangqiEngine extends BaseEngine {
  private pikafishJs: string | null = null;

  async checkFileExists(): Promise<string[]> {
    const plugin = this.plugin!;
    const adapter = plugin.app.vault.adapter;
    const baseDir = `${plugin.app.vault.configDir}/plugins/xiangqi`;
    const missing: string[] = [];
    for (const file of ENGINE_FILES) {
      if (!(await adapter.exists(`${baseDir}/${file}`))) {
        missing.push(file);
      }
    }
    return missing;
  }

  openDownloadModal(missingFiles: string[]): void {
    const plugin = this.plugin!;
    const adapter = plugin.app.vault.adapter;
    const baseDir = `${plugin.app.vault.configDir}/plugins/xiangqi`;

    const files = missingFiles.map((f) => ({
      name: f,
      sources: DOWNLOAD_SOURCES.map((s) => ({
        key: s.key,
        label: s.label,
        url: s.getUrl(f),
      })),
    }));
    const modal = new DownloadModal(
      plugin.app,
      t("engine.downloadFile", 0),
      files,
      t("engine.downloadBtn", 0),
      t("engine.downloadCancel", 0),
      t("engine.downloadSource", 0),
    );
    modal.setCallbacks(
      () => {
        const sourceKey = modal.getSelectedSource();
        const source =
          DOWNLOAD_SOURCES.find((s) => s.key === sourceKey) ??
          DOWNLOAD_SOURCES[0];
        void (async () => {
          for (let i = 0; i < missingFiles.length; i++) {
            const file = missingFiles[i];
            const url = source.getUrl(file);
            const destPath = `${baseDir}/${file}`;
            modal.showProgress(i);
            try {
              const resp = await requestUrl({ url });
              const buffer = new Uint8Array(resp.arrayBuffer);
              if (file === "pikafish.js") {
                await adapter.write(destPath, new TextDecoder().decode(buffer));
              } else {
                await adapter.writeBinary(destPath, buffer.buffer);
              }
              modal.done(i);
            } catch {
              modal.error(i, t("engine.downloadFailed", 0));
              return;
            }
          }
        })();
      },
      () => {},
    );
    modal.open();
  }

  private async loadPikafishSource(): Promise<string> {
    if (this.pikafishJs) return this.pikafishJs;
    if (!this.plugin) throw new Error("Plugin not set");
    const adapter = this.plugin.app.vault.adapter;
    const baseDir = `${this.plugin.app.vault.configDir}/plugins/xiangqi`;
    this.pikafishJs = await adapter.read(`${baseDir}/pikafish.js`);
    return this.pikafishJs;
  }

  protected async initWorker(): Promise<void> {
    const pikafishSource = await this.loadPikafishSource();

    const adapter = this.plugin!.app.vault.adapter;
    const baseDir = `${this.plugin!.app.vault.configDir}/plugins/xiangqi`;

    const wasmBuffer = await adapter.readBinary(`${baseDir}/pikafish.wasm`);
    const dataBuffer = await adapter.readBinary(`${baseDir}/pikafish.data`);

    const workerCode = `
self.addEventListener('unhandledrejection', function(e) {
  self.postMessage({type:'error', data:'UNHANDLED:' + String(e.reason ? (e.reason.message || e.reason) : 'unknown')});
});

if (typeof global !== 'undefined' && global.process) {
  try { delete global.process; } catch(e) {
    try { global.process = undefined; } catch(e) {}
  }
}
if (typeof process !== 'undefined' && process.versions) {
  try { delete process.versions.node; } catch(e) {}
}

console.log = function() {};
console.warn = function() {};

var _PF_WB_ = null;
var _PF_DATA_ = null;
var _pf = null;

self.onmessage = function(e) {
  if (e.data && e.data.type === 'wasm') {
    _PF_WB_ = new Uint8Array(e.data.buffer);
    _PF_DATA_ = e.data.dataBuffer ? new Uint8Array(e.data.dataBuffer) : null;
    self.onmessage = null;
    try {
      var Module = {};
      Module.wasmBinary = _PF_WB_;
      Module.locateFile = function(path, prefix) {
        if (path.endsWith('.wasm')) return path;
        return prefix + path;
      };
      if (_PF_DATA_) {
        Module.getPreloadedPackage = function(remotePackageSize) {
          return _PF_DATA_.buffer;
        };
      }
      Module.print = function(text) {
        if (arguments.length > 1) text = Array.prototype.slice.call(arguments).join(' ');
        self.postMessage(text);
      };
      Module.printErr = function(text) {};
      ${pikafishSource}
      Pikafish(Module).then(function(pf) {
        _pf = pf;
        _pf.read_stdout = function(text) {
          self.postMessage(text);
        };
        self.onmessage = function(e) {
          if (typeof e.data === 'string') {
            _pf.send_command(e.data);
          }
        };
        _pf.send_command('uci');
      });
    } catch(e) {
      self.postMessage({type:'error', data:'PF_LOAD:' + e.message + '|' + (e.stack||'')});
    }
  }
};
`;

    const blobUrl = URL.createObjectURL(
      new Blob([workerCode], { type: "text/javascript" }),
    );
    this.worker = new Worker(blobUrl);
    URL.revokeObjectURL(blobUrl);

    return new Promise<void>((resolve, reject) => {
      const timeout = window.setTimeout(() => {
        this.initResolve = null;
        this.initReject = null;
        reject(new Error("Engine init timeout"));
      }, 120_000);

      this.initResolve = () => {
        window.clearTimeout(timeout);
        resolve();
      };
      this.initReject = (err: Error) => {
        window.clearTimeout(timeout);
        reject(err);
      };

      this.worker!.onmessage = (e: MessageEvent) => this.handleMessage(e.data);
      this.worker!.onerror = (err: ErrorEvent) => {
        window.clearTimeout(timeout);
        reject(new Error(err.message || "Engine error"));
      };

      const transferList: ArrayBuffer[] = [wasmBuffer, dataBuffer];
      this.worker!.postMessage(
        { type: "wasm", buffer: wasmBuffer, dataBuffer },
        transferList,
      );
    });
  }
}

export const engine = new XiangqiEngine();
