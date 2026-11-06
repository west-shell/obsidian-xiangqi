import { requestUrl } from "obsidian";
import { t } from "../../i18n";
import { BaseEngine, type EngineResult } from "./BaseEngine";
import { DownloadModal } from "./DownloadModal";

export type { EngineResult };

/**
 * Versioned engine asset release. Bump on every engine rebuild and
 * publish a matching release tag (`pikafish-<version>`) on both GitHub
 * and Gitee; older plugin versions keep downloading their own assets
 * from the older, untouched releases.
 */
const ENGINE_VERSION = "1.0.0";
const BASE_GITHUB = `https://github.com/west-shell/obsidian-xiangqi/releases/download/pikafish-${ENGINE_VERSION}`;
const BASE_GITEE_RELEASE = `https://gitee.com/wesnell/obsidian-xiangqi/releases/download/pikafish-${ENGINE_VERSION}`;
const ENGINE_FILES = ["pikafish.js", "pikafish.wasm", "pikafish.data"] as const;
/**
 * Exact byte size of each engine asset in the `pikafish-<ENGINE_VERSION>`
 * release (identical on GitHub and Gitee). Verified via adapter.stat()
 * before the engine starts: a size mismatch marks a wrong-version,
 * corrupted, or truncated download and re-downloads that file, while
 * manually installed assets of the right release pass without any
 * marker file.
 */
const EXPECTED_SIZES: Record<string, number> = {
  "pikafish.js": 77_847,
  "pikafish.wasm": 845_871,
  "pikafish.data": 51_585_654,
};
/**
 * SHA-256 of the same release assets (confirmed identical on GitHub
 * and Gitee). Verified once per session at engine init, where the
 * bytes are already loaded in memory — catches the rare size-matched
 * corruption (e.g. a download manager that preallocates the file and
 * is interrupted mid-download) that the byte-size check above cannot
 * see.
 */
const EXPECTED_SHA256: Record<string, string> = {
  "pikafish.js":
    "29643b40d24879e8a1d4042b8982fee1ffbefc7b5d1fabed612bbd0ea72ad4d3",
  "pikafish.wasm":
    "2a44866abe24f0172422a8a172b268730004323a0c6c1df8af944c171bdbff3c",
  "pikafish.data":
    "3cd15292bf8c979884262f57fc723959fc0dea43b4d8d544f88db5ceb2479e24",
};

/** Engine assets already hash-verified in this app session. */
const hashVerified = new Set<string>();

async function sha256Hex(buffer: ArrayBuffer): Promise<string> {
  const digest = await crypto.subtle.digest("SHA-256", buffer);
  return Array.from(new Uint8Array(digest))
    .map((byte) => byte.toString(16).padStart(2, "0"))
    .join("");
}

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
      const stat = await adapter.stat(`${baseDir}/${file}`);
      if (!stat || stat.type !== "file" || stat.size !== EXPECTED_SIZES[file]) {
        missing.push(file);
      }
    }
    return missing;
  }

  openDownloadModal(missingFiles: string[], corrupted = false): void {
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
      corrupted ? t("engine.corrupted", 0) : t("engine.downloadFile", 0),
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
              hashVerified.delete(file);
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

  /**
   * Read an engine asset and hash-verify it on first load this
   * session. A size-matched but corrupted file falls through
   * checkFileExists and is caught here, before the worker swallows
   * it as a cryptic wasm compile error; the download modal is opened
   * for the corrupted file instead.
   */
  private async readVerifiedAsset(name: string): Promise<ArrayBuffer> {
    const plugin = this.plugin!;
    const adapter = plugin.app.vault.adapter;
    const baseDir = `${plugin.app.vault.configDir}/plugins/xiangqi`;
    const buffer = await adapter.readBinary(`${baseDir}/${name}`);
    if (hashVerified.has(name) || !crypto.subtle) return buffer;
    if ((await sha256Hex(buffer)) === EXPECTED_SHA256[name]) {
      hashVerified.add(name);
      return buffer;
    }
    this.openDownloadModal([name], true);
    throw new Error(`Engine asset corrupted: ${name}`);
  }

  private async loadPikafishSource(): Promise<string> {
    if (this.pikafishJs) return this.pikafishJs;
    if (!this.plugin) throw new Error("Plugin not set");
    this.pikafishJs = new TextDecoder().decode(
      await this.readVerifiedAsset("pikafish.js"),
    );
    return this.pikafishJs;
  }

  protected async initWorker(): Promise<void> {
    const pikafishSource = await this.loadPikafishSource();
    const wasmBuffer = await this.readVerifiedAsset("pikafish.wasm");
    const dataBuffer = await this.readVerifiedAsset("pikafish.data");

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
