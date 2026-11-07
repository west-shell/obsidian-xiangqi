import { Platform, requestUrl } from "obsidian";
import { t } from "../../i18n";
import { BaseEngine, type EngineResult } from "./BaseEngine";
import { DownloadModal } from "./DownloadModal";

export type { EngineResult };

/**
 * Versioned engine asset releases. Bump on every engine rebuild and
 * publish a matching release tag on both GitHub and Gitee; older
 * plugin versions keep downloading their own assets from the older,
 * untouched releases.
 */
const ENGINE_VERSION = "1.0.0";
/**
 * Mobile uses a dedicated asyncify build with a distilled w256 net
 * (12.6 MB): the desktop 52 MB net needs a ~519 MB wasm heap which
 * mobile webviews cannot grow (observed WebAssembly.Memory.grow
 * failure at 301 MB on Android), while the w256 build peaks at
 * ~214 MB and stops search in ~15 ms via asyncify.
 */
const MOBILE_ENGINE_VERSION = "2.0.0";

const ENGINE_FILES = ["pikafish.js", "pikafish.wasm", "pikafish.data"] as const;

/** One engine release: its tag plus the exact bytes we expect. */
interface EngineAssetSpec {
  /** Release tag, identical on GitHub and Gitee. */
  releaseTag: string;
  /**
   * Exact byte size of each engine asset. Verified via
   * adapter.stat() before the engine starts: a size mismatch marks a
   * wrong-version, corrupted, or truncated download and re-downloads
   * that file, while manually installed assets of the right release
   * pass without any marker file.
   */
  sizes: Record<string, number>;
  /**
   * SHA-256 of the same release assets. Verified once per session at
   * engine init, where the bytes are already loaded in memory —
   * catches the rare size-matched corruption (e.g. a download
   * manager that preallocates the file and is interrupted
   * mid-download) that the byte-size check above cannot see.
   */
  sha256: Record<string, string>;
}

const DESKTOP_SPEC: EngineAssetSpec = {
  releaseTag: `pikafish-${ENGINE_VERSION}`,
  sizes: {
    "pikafish.js": 77_847,
    "pikafish.wasm": 845_871,
    "pikafish.data": 51_585_654,
  },
  sha256: {
    "pikafish.js":
      "29643b40d24879e8a1d4042b8982fee1ffbefc7b5d1fabed612bbd0ea72ad4d3",
    "pikafish.wasm":
      "2a44866abe24f0172422a8a172b268730004323a0c6c1df8af944c171bdbff3c",
    "pikafish.data":
      "3cd15292bf8c979884262f57fc723959fc0dea43b4d8d544f88db5ceb2479e24",
  },
};

const MOBILE_SPEC: EngineAssetSpec = {
  releaseTag: `pikafish-mobile-${MOBILE_ENGINE_VERSION}`,
  sizes: {
    "pikafish.js": 76_704,
    "pikafish.wasm": 789_696,
    "pikafish.data": 12_646_031,
  },
  sha256: {
    "pikafish.js":
      "cd1e3e23f737f6dfa3ac798a4bf4c6bb364749ae4076d919bba3b65d42151484",
    "pikafish.wasm":
      "c80f9d408c762d50835c6f042aac3bdf91454ebbd72d79fa03f718c1f562ad35",
    "pikafish.data":
      "316da3939d66edacc730a313a1bdddb0619ad1b8158b1dc5bd8244af335c552b",
  },
};

/** Engine assets already hash-verified in this app session. */
const hashVerified = new Set<string>();

/**
 * Assets larger than this skip hash verification and rely on the
 * exact byte-size check alone: mobile webviews can fail or stall on
 * crypto.subtle.digest for very large buffers (observed with the
 * ~52 MB pikafish.data on Android, where engine init hung with no
 * visible error), while smaller assets keep full hash verification.
 */
const HASH_VERIFY_MAX_BYTES = 16 * 1024 * 1024;

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

function downloadSources(spec: EngineAssetSpec): DownloadSource[] {
  return [
    {
      key: "github",
      label: "GitHub",
      getUrl: (file) =>
        `https://github.com/west-shell/obsidian-xiangqi/releases/download/${spec.releaseTag}/${file}`,
    },
    {
      key: "gitee",
      label: "Gitee",
      getUrl: (file) =>
        `https://gitee.com/wesnell/obsidian-xiangqi/releases/download/${spec.releaseTag}/${file}`,
    },
  ];
}

/**
 * Worker bootstrap shared by both engine builds: surface unhandled
 * rejections, hide node-ism probes, silence console noise, and
 * report memory.grow failures (mobile OOM) before the glue turns
 * them into a bare "Aborted".
 */
const WORKER_PRELUDE = `
self.addEventListener('unhandledrejection', function(e) {
  var r = e.reason;
  var msg = r ? String(r.message || r) : 'unknown';
  var stack = r && r.stack ? ' | ' + String(r.stack).slice(0, 500) : '';
  self.postMessage({type:'error', data:'UNHANDLED: ' + msg + stack});
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

var _origGrow_ = WebAssembly.Memory.prototype.grow;
WebAssembly.Memory.prototype.grow = function(pages) {
  try {
    return _origGrow_.call(this, pages);
  } catch (e) {
    self.postMessage({type:'error', data:'MEM_GROW_FAIL: current=' + this.buffer.byteLength + ' pages=' + pages + ' | ' + (e && e.message ? e.message : e)});
    throw e;
  }
};
`;

/** Asyncify worker (desktop + mobile): async ccall per command. */
function buildDesktopWorkerCode(pikafishSource: string): string {
  return `${WORKER_PRELUDE}
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
      // Diagnostic: abort(what) wraps the real reason into
      // "Aborted(what)..." — report the raw reason first.
      Module.onAbort = function(what) {
        var stack = '';
        try { stack = ' | ' + String(new Error().stack).slice(0, 500); } catch (e2) {}
        self.postMessage({type:'error', data:'ABORT: ' + (what === undefined ? '(no reason)' : String(what)) + stack});
      };
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
      }).catch(function(err) {
        var msg = err ? String(err.message || err) : 'unknown';
        var stack = err && err.stack ? ' | ' + String(err.stack).slice(0, 500) : '';
        self.postMessage({type:'error', data:'PF_INIT_FAIL: ' + msg + stack});
      });
    } catch(e) {
      self.postMessage({type:'error', data:'PF_LOAD:' + e.message + '|' + (e.stack||'')});
    }
  }
};
`;
}

export class XiangqiEngine extends BaseEngine {
  private pikafishJs: string | null = null;

  /** Mobile webviews cannot host the big-net engine — use the w256 release. */
  private readonly useMobileEngine = Platform.isMobile;

  private get spec(): EngineAssetSpec {
    return this.useMobileEngine ? MOBILE_SPEC : DESKTOP_SPEC;
  }

  async checkFileExists(): Promise<string[]> {
    const plugin = this.plugin!;
    const adapter = plugin.app.vault.adapter;
    const baseDir = `${plugin.app.vault.configDir}/plugins/xiangqi`;
    const missing: string[] = [];
    for (const file of ENGINE_FILES) {
      const stat = await adapter.stat(`${baseDir}/${file}`);
      if (
        !stat ||
        stat.type !== "file" ||
        stat.size !== this.spec.sizes[file]
      ) {
        missing.push(file);
      }
    }
    return missing;
  }

  openDownloadModal(missingFiles: string[], corrupted = false): void {
    const plugin = this.plugin!;
    const adapter = plugin.app.vault.adapter;
    const baseDir = `${plugin.app.vault.configDir}/plugins/xiangqi`;
    const sources = downloadSources(this.spec);

    const files = missingFiles.map((f) => ({
      name: f,
      sources: sources.map((s) => ({
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
        const source = sources.find((s) => s.key === sourceKey) ?? sources[0];
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
   * for the corrupted file instead. Assets larger than
   * HASH_VERIFY_MAX_BYTES, or whose hash cannot be computed on this
   * platform, skip verification and rely on the byte-size check.
   */
  private async readVerifiedAsset(name: string): Promise<ArrayBuffer> {
    const plugin = this.plugin!;
    const adapter = plugin.app.vault.adapter;
    const baseDir = `${plugin.app.vault.configDir}/plugins/xiangqi`;
    const buffer = await adapter.readBinary(`${baseDir}/${name}`);
    if (hashVerified.has(name) || !crypto.subtle) return buffer;
    // Oversized assets (unsafe to digest on mobile) rely on the size check.
    if (buffer.byteLength > HASH_VERIFY_MAX_BYTES) return buffer;
    let hex: string;
    try {
      hex = await sha256Hex(buffer);
    } catch (e) {
      // A webview whose crypto stack cannot digest this buffer must
      // not kill engine startup — degrade to the size check above.
      console.warn("[Engine] SHA-256 verify unavailable, skipping:", name, e);
      return buffer;
    }
    if (hex === this.spec.sha256[name]) {
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

    // Both engine builds export `_command` (asyncify, zero-glue): one
    // worker template, two asset specs.
    const workerCode = buildDesktopWorkerCode(pikafishSource);

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
