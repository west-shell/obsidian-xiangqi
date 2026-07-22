import type ChessPlugin from "../../main";
import { DownloadModal } from "../../utils/confirmModal";
import { t } from "../../i18n";

const BASE_URL =
  "https://raw.githubusercontent.com/west-shell/obsidian-xiangqi/main/assets/pikafish";
const ENGINE_FILES = ["pikafish.js", "pikafish.wasm", "pikafish.data"] as const;

export interface EngineResult {
  bestmove: string;
  ponder?: string;
  score?: number;
  depth?: number;
  scoreType?: "cp" | "mate";
}

type UciHandler = (msg: string) => void;

export class XiangqiEngine {
  private worker: Worker | null = null;
  private ready = false;
  private plugin: ChessPlugin | null = null;
  private msgHandler: UciHandler | null = null;
  private initResolve: ((value: void) => void) | null = null;
  private initReject: ((reason: Error) => void) | null = null;
  private analyzeReject: ((reason: Error) => void) | null = null;
  private analyzeTimeout: number | null = null;
  private pikafishJs: string | null = null;

  setPlugin(plugin: ChessPlugin): void {
    this.plugin = plugin;
  }

  async ensureReady(): Promise<void> {
    if (this.worker && this.ready) return;
    this.terminate();
    await this.initWorker();
  }

  async checkFileExists(): Promise<string[]> {
    const adapter = this.plugin.app.vault.adapter;
    const baseDir = `${this.plugin.app.vault.configDir}/plugins/xiangqi`;
    const missing: string[] = [];
    for (const file of ENGINE_FILES) {
      if (!(await adapter.exists(`${baseDir}/${file}`))) {
        missing.push(file);
      }
    }
    return missing;
  }

  openDownloadModal(missingFiles: string[]): void {
    const adapter = this.plugin.app.vault.adapter;
    const baseDir = `${this.plugin.app.vault.configDir}/plugins/xiangqi`;

    const files = missingFiles.map((f) => ({
      name: f,
      url: `${BASE_URL}/${f}`,
    }));
    const modal = new DownloadModal(
      this.plugin.app,
      t("engine.downloadFile", 0).replace("{file}", missingFiles.join("、")),
      files,
      t("engine.downloadBtn", 0),
      t("engine.downloadCancel", 0),
    );
    modal.open();
    const doDownload = async (confirmed: boolean) => {
      if (!confirmed) return;
      for (let i = 0; i < ENGINE_FILES.length; i++) {
        const file = ENGINE_FILES[i];
        const url = `${BASE_URL}/${file}`;
        const destPath = `${baseDir}/${file}`;
        modal.showProgress(i);
        try {
          let contentLength = 0;
          try {
            const headResp = await window.fetch(url, { method: "HEAD" });
            contentLength = Number(headResp.headers.get("content-length")) || 0;
          } catch {
            /* ignore */
          }
          const resp = await window.fetch(url, {
            signal: modal.abortController.signal,
          });
          if (!resp.ok) throw new Error(`HTTP ${resp.status}`);
          if (contentLength === 0) {
            contentLength = Number(resp.headers.get("content-length")) || 0;
          }
          const reader = resp.body?.getReader();
          if (!reader) throw new Error("No response body");
          const chunks: Uint8Array[] = [];
          let loaded = 0;
          while (true) {
            const { done, value } = await reader.read();
            if (done) break;
            chunks.push(value);
            loaded += value.length;
            modal.setProgress(i, loaded, contentLength);
          }
          const buffer = new Uint8Array(loaded);
          let offset = 0;
          for (const chunk of chunks) {
            buffer.set(chunk, offset);
            offset += chunk.length;
          }
          if (file === "pikafish.js") {
            await adapter.write(destPath, new TextDecoder().decode(buffer));
          } else {
            await adapter.writeBinary(destPath, buffer.buffer);
          }
          modal.done(i);
        } catch (err) {
          const msg =
            err instanceof TypeError
              ? t("engine.downloadFailed", 0)
              : String(err);
          modal.error(i, msg);
          return;
        }
      }
    };
    void modal.promise.then(doDownload);
  }

  private async loadPikafishSource(): Promise<string> {
    if (this.pikafishJs) return this.pikafishJs;
    if (!this.plugin) throw new Error("Plugin not set");
    const adapter = this.plugin.app.vault.adapter;
    const baseDir = `${this.plugin.app.vault.configDir}/plugins/xiangqi`;
    this.pikafishJs = await adapter.read(`${baseDir}/pikafish.js`);
    return this.pikafishJs;
  }

  private async initWorker(): Promise<void> {
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

  private handleMessage(raw: unknown): void {
    if (
      raw &&
      typeof raw === "object" &&
      (raw as Record<string, unknown>).type
    ) {
      const obj = raw as Record<string, string>;
      if (obj.type === "error") {
        console.warn("[Engine] worker error:", obj.data);
        this.initReject?.(new Error(obj.data));
        this.initResolve = null;
        this.initReject = null;
      }
      return;
    }

    if (typeof raw !== "string") return;
    for (const line of raw.split("\n")) {
      const trimmed = line.trim();
      if (!trimmed) continue;

      if (trimmed === "uciok") {
        this.ready = true;
        this.initResolve?.();
        this.initResolve = null;
        this.initReject = null;
      } else {
        this.msgHandler?.(trimmed);
      }
    }
  }

  analyze(fen: string, depth = 15): Promise<EngineResult> {
    if (this.analyzeReject) {
      this.analyzeReject(new Error("Analysis cancelled: new analysis started"));
    }
    if (this.analyzeTimeout !== null) {
      window.clearTimeout(this.analyzeTimeout);
    }

    return new Promise((resolve, reject) => {
      if (!this.worker || !this.ready) {
        reject(new Error("Engine not ready"));
        return;
      }

      this.analyzeReject = reject;

      let lastScore: number | undefined;
      let lastDepth: number | undefined;
      let lastScoreType: "cp" | "mate" | undefined;

      this.analyzeTimeout = window.setTimeout(() => {
        this.analyzeTimeout = null;
        this.msgHandler = null;
        this.analyzeReject = null;
        this.stop();
        reject(new Error("Analysis timeout"));
      }, 300_000);

      this.msgHandler = (msg: string) => {
        if (msg.startsWith("info")) {
          const mateMatch = msg.match(/score mate (-?\d+)/);
          if (mateMatch) {
            lastScoreType = "mate";
            lastScore = Number.parseInt(mateMatch[1]);
          } else {
            const cpMatch = msg.match(/score cp (-?\d+)/);
            if (cpMatch) {
              lastScoreType = "cp";
              lastScore = Number.parseInt(cpMatch[1]);
            }
          }
          const depthMatch = msg.match(/depth (\d+)/);
          if (depthMatch) lastDepth = Number.parseInt(depthMatch[1]);
        } else if (msg.startsWith("bestmove")) {
          const parts = msg.split(/\s+/);
          const bestmove = parts[1];
          const ponderIdx = parts.indexOf("ponder");
          const ponder =
            ponderIdx !== -1 && parts[ponderIdx + 1]
              ? parts[ponderIdx + 1]
              : undefined;
          this.msgHandler = null;
          this.analyzeReject = null;
          if (this.analyzeTimeout !== null) {
            window.clearTimeout(this.analyzeTimeout);
            this.analyzeTimeout = null;
          }
          if (bestmove) {
            resolve({
              bestmove,
              ponder,
              score: lastScore,
              depth: lastDepth,
              scoreType: lastScoreType,
            });
          } else {
            reject(new Error("No move found"));
          }
        }
      };

      this.worker.postMessage(`position fen ${fen}`);
      this.worker.postMessage(`go depth ${depth}`);
    });
  }

  postCommand(cmd: string): void {
    if (this.worker && this.ready) {
      this.worker.postMessage(cmd);
    }
  }

  stop(): void {
    if (this.worker && this.ready) {
      this.worker.postMessage("stop");
    }
  }

  terminate(): void {
    if (this.analyzeReject) {
      this.analyzeReject(new Error("Engine terminated"));
      this.analyzeReject = null;
    }
    if (this.analyzeTimeout !== null) {
      window.clearTimeout(this.analyzeTimeout);
      this.analyzeTimeout = null;
    }
    if (this.worker) {
      try {
        this.worker.postMessage("quit");
      } catch {
        /* ignore */
      }
      this.worker.terminate();
      this.worker = null;
    }
    this.ready = false;
    this.msgHandler = null;
    this.initResolve = null;
    this.initReject = null;
  }
}

export const engine = new XiangqiEngine();
