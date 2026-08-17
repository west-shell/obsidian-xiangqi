export type ChessModule = {
  init(host: object): void;
  destroy?(): void;
};

export type ModuleRegistry = Map<string, ChessModule>;

// 工厂函数：创建模块系统
function createModuleSystem() {
  const moduleMap = new Map<string, ChessModule>();
  const registryMap = new WeakMap<object, ModuleRegistry>();

  function register(name: string, module: ChessModule) {
    if (!moduleMap.has(name)) {
      moduleMap.set(name, module);
    }
  }

  function createRegistry(host: object) {
    if (registryMap.has(host)) return registryMap.get(host);
    const registry = new Map<string, ChessModule>();
    for (const [name, module] of moduleMap) {
      const instance = module.init(host);
      registry.set(name, instance ?? module);
    }
    registryMap.set(host, registry);
    return registry;
  }

  function destroyRegistry(host: object) {
    const registry = registryMap.get(host);
    if (!registry) return;
    for (const module of registry.values()) {
      if (typeof (module as { destroy?(): void }).destroy === "function") {
        (module as { destroy?(): void }).destroy?.();
      }
    }
    registry.clear();
    registryMap.delete(host);
  }

  return {
    register,
    createRegistry,
    destroyRegistry,
  };
}

// 文件视图模块系统
const FileModules = createModuleSystem();
export function registerFileModule(name: string, module: ChessModule) {
  FileModules.register(name, module);
}
export function createFileModuleRegistry(host: object) {
  return FileModules.createRegistry(host);
}
export function destroyFileModuleRegistry(host: object) {
  FileModules.destroyRegistry(host);
}

// 代码块模块系统
const BlockModules = createModuleSystem();
export function registerBlockModule(name: string, module: ChessModule) {
  BlockModules.register(name, module);
}
export function createBlockModuleRegistry(host: object) {
  return BlockModules.createRegistry(host);
}
export function destroyBlockModuleRegistry(host: object) {
  BlockModules.destroyRegistry(host);
}
