import { requestUrl } from "obsidian";
import { t } from "../../i18n";
import { BaseEngine, type EngineResult } from "./BaseEngine";
import { DownloadModal } from "./DownloadModal";

export type { EngineResult };

const BASE_GITHUB =
  "https://github.com/west-shell/obsidian-xiangqi/releases/download/pikafish";
const BASE_GITEE_RELEASE =
  "https://gitee.com/wesnell/obsidian-xiangqi/releases/download/pikafish";
const ENGINE_FILES = ["pikafish.js", "pikafish.wasm", "pikafish.data"] as const;
/**
 * Identifies the current single-threaded Asyncify pikafish build. Older
 * synchronous builds lack the marker and are incompatible with this
 * module's ccall glue, so they must be re-downloaded as a full set.
 */
const JS_MARKER = "Asyncify";

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
    const jsPath = `${baseDir}/pikafish.js`;
    if (!(await adapter.exists(jsPath))) return [...ENGINE_FILES];
    // Stale pre-Asyncify build: js/wasm/data only work as a matched set.
    if (!(await adapter.read(jsPath)).includes(JS_MARKER)) {
      return [...ENGINE_FILES];
    }
    const missing: string[] = [];
    for (const file of ENGINE_FILES) {
      if (file === "pikafish.js") continue;
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
      if (_PF_DATA_) {
        // Hand the preloaded .data (embedded pikafish.nnue) to the
        // emscripten file packager without a fetch.
        Module.getPreloadedPackage = function(name, size) {
          if (_PF_DATA_.byteLength !== size) {
            throw new Error('data size mismatch: expected ' + size + ' but got ' + _PF_DATA_.byteLength);
          }
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
        self.onmessage = function(e) {
          if (typeof e.data !== 'string') return;
          if (e.data.indexOf('go ') === 0) {
            // Search: async ccall suspends the wasm stack inside
            // check_time so the worker stays responsive; a re-entrant
            // sync "stop" finishes the search in ~1ms.
            _pf.ccall('command', null, ['string'], [e.data], { async: true });
          } else {
            _pf.ccall('command', null, ['string'], [e.data]);
          }
        };
        _pf.ccall('command', null, ['string'], ['uci']);
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
